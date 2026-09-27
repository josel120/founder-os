import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { PublishPanelPreview } from "@/modules/portfolio/components/publish-panel";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({
  auth: vi.fn(), refresh: vi.fn(), report: vi.fn(),
  select: vi.fn(), from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  insert: vi.fn(), values: vi.fn(), onConflict: vi.fn(), returning: vi.fn(), del: vi.fn(),
}));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/report-error", () => ({ reportError: m.report }));
vi.mock("@/db", () => ({ db: { select: m.select, insert: m.insert, delete: m.del } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { publishProject, unpublishProject } from "@/modules/portfolio/actions/publication.actions";
import { getPrivatePublication, getPublishedProject, listPublicProjects, publicProjectColumns } from "@/modules/portfolio/queries/publication.queries";

const projectId = "00000000-0000-4000-8000-000000000001";
const dialect = new PgDialect();
const render = (condition: unknown) => dialect.sqlToQuery(condition as SQL);
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}
const publishForm = (extra: Record<string, string> = {}) => form({ projectId, visibility: "PUBLIC", summary: "  A calm habit tracker.  ", ...extra });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where, innerJoin: m.innerJoin });
  m.innerJoin.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ limit: m.limit, orderBy: m.orderBy, returning: m.returning });
  m.orderBy.mockReturnValue({ limit: m.limit });
  m.limit.mockResolvedValue([{ id: projectId }]);
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ onConflictDoUpdate: m.onConflict });
  m.onConflict.mockReturnValue({ returning: m.returning });
  m.del.mockReturnValue({ where: m.where });
  m.returning.mockResolvedValue([{ projectId }]);
});

describe("publishProject", () => {
  it("rejects anonymous callers before touching the database", async () => {
    m.auth.mockResolvedValue(null);
    expect(await publishProject(publishForm())).toEqual({ ok: false, error: "Sign in again to save changes." });
    expect(await unpublishProject(form({ projectId }))).toMatchObject({ ok: false });
    expect(m.select).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it.each([
    [{ visibility: "PRIVATE" }, "Invalid"],
    [{ summary: "   " }, "Write a public summary."],
    [{ summary: "a".repeat(501) }, "Keep the public summary to 500 characters."],
    [{ projectId: "not-a-uuid" }, "Invalid"],
  ])("rejects invalid input %j", async (extra, message) => {
    const result = await publishProject(publishForm(extra));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("checks the project is the session owner's, then writes that owner and never a form value", async () => {
    expect(await publishProject(publishForm({ ownerId: "attacker", publishedAt: "2020-01-01" }))).toEqual({ ok: true, projectId });
    const lookup = render(m.where.mock.calls[0][0]);
    expect(lookup.sql).toContain('"project"."id"');
    expect(lookup.sql).toContain('"project"."owner_id"');
    expect(lookup.params).toEqual([projectId, "owner-a", "PRIVATE"]);
    expect(m.values).toHaveBeenCalledWith({ projectId, ownerId: "owner-a", visibility: "PUBLIC", summary: "A calm habit tracker." });
    const conflict = m.onConflict.mock.calls[0][0];
    expect(Object.keys(conflict.set).sort()).toEqual(["summary", "updatedAt", "visibility"]);
    expect(render(conflict.setWhere).params).toEqual(["owner-a"]);
    expect(m.refresh).toHaveBeenCalledWith(`/private/projects/${projectId}`);
    expect(m.refresh).toHaveBeenCalledWith("/portfolio");
  });

  it("publishes nothing for another owner's or an unknown project", async () => {
    m.limit.mockResolvedValue([]);
    expect(await publishProject(publishForm())).toEqual({ ok: false, error: "Project not found. Nothing was published." });
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("does not overwrite a publication owned by someone else", async () => {
    m.returning.mockResolvedValue([]);
    expect(await publishProject(publishForm())).toMatchObject({ ok: false });
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("reports a database failure without its message and returns a generic error", async () => {
    const error = new Error("secret summary text");
    m.onConflict.mockImplementation(() => { throw error; });
    expect(await publishProject(publishForm())).toEqual({ ok: false, error: "Could not change what is public. Please try again." });
    expect(m.report).toHaveBeenCalledWith("portfolio.publish", error);
  });
});

describe("unpublishProject", () => {
  it("deletes only the session owner's publication of that project", async () => {
    expect(await unpublishProject(form({ projectId, ownerId: "attacker" }))).toEqual({ ok: true, projectId });
    const predicate = render(m.where.mock.calls[0][0]);
    expect(predicate.sql).toContain('"project_publication"."project_id"');
    expect(predicate.sql).toContain('"project_publication"."owner_id"');
    expect(predicate.params).toEqual([projectId, "owner-a"]);
    expect(m.refresh).toHaveBeenCalledWith("/portfolio");
  });

  it("says so when the project was not published", async () => {
    m.returning.mockResolvedValue([]);
    expect(await unpublishProject(form({ projectId }))).toEqual({ ok: false, error: "This project is not published." });
    expect(m.refresh).not.toHaveBeenCalled();
  });
});

describe("public queries", () => {
  const allowlist = ["name", "slug", "lifecycle", "releasedAt", "website", "playStoreUrl", "appStoreUrl", "summary", "publishedAt"];

  it("read only the ADR-018 allowlist", () => {
    expect(Object.keys(publicProjectColumns)).toEqual(allowlist);
    const columnNames = Object.values(publicProjectColumns).map((column) => column.name);
    for (const privateColumn of ["description", "repository", "next_action", "waiting_reason", "owner_id", "current_version", "production_version", "origin_idea_id", "visibility", "id"]) {
      expect(columnNames).not.toContain(privateColumn);
    }
  });

  it("list PUBLIC projects only, joined on the project and its own owner, newest first and capped", async () => {
    m.limit.mockResolvedValue([]);
    await listPublicProjects();
    expect(Object.keys(m.select.mock.calls[0][0])).toEqual(allowlist);
    const join = render(m.innerJoin.mock.calls[0][1]);
    expect(join.sql).toBe('("project_publication"."project_id" = "project"."id" and "project_publication"."owner_id" = "project"."owner_id")');
    expect(render(m.where.mock.calls[0][0]).params).toEqual(["PUBLIC"]);
    expect(m.limit).toHaveBeenCalledWith(100);
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("find one published project by slug, PUBLIC or UNLISTED, and nothing for a malformed slug", async () => {
    m.limit.mockResolvedValue([]);
    expect(await getPublishedProject("habit-tracker")).toBeNull();
    const predicate = render(m.where.mock.calls[0][0]);
    expect(predicate.sql).toContain('"project"."slug"');
    expect(predicate.params).toEqual(["habit-tracker", "PUBLIC", "UNLISTED"]);
    m.select.mockClear();
    for (const slug of ["", "../private", "Habit", "a".repeat(101), "a--b"]) expect(await getPublishedProject(slug)).toBeNull();
    expect(m.select).not.toHaveBeenCalled();
  });

  it("give the owner their own publication settings only", async () => {
    m.limit.mockResolvedValue([]);
    expect(await getPrivatePublication(projectId)).toBeNull();
    expect(render(m.where.mock.calls[0][0]).params).toEqual([projectId, "owner-a"]);
    m.auth.mockResolvedValue(null);
    m.select.mockClear();
    expect(await getPrivatePublication(projectId)).toBeNull();
    expect(m.select).not.toHaveBeenCalled();
  });
});

it("lets the owner's publish panel receive only allowlisted project fields (checked by pnpm typecheck)", () => {
  expectTypeOf<keyof PublishPanelPreview>().toEqualTypeOf<"name" | "slug" | "lifecycle" | "releasedAt" | "website" | "playStoreUrl" | "appStoreUrl">();
});
