import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), insert: vi.fn(), values: vi.fn(), returning: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { select: m.select, insert: m.insert } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { createProjectFromIdea } from "@/modules/projects/actions/project.actions";

const ideaId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";

function form() {
  const data = new FormData();
  data.set("ideaId", ideaId);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ limit: m.limit });
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ returning: m.returning });
  m.limit.mockResolvedValueOnce([{ id: ideaId, title: "Founder OS", description: "Private workspace" }]).mockResolvedValueOnce([]);
  m.returning.mockResolvedValue([{ id: projectId }]);
});

it("rejects anonymous conversion before reading or writing", async () => {
  m.auth.mockResolvedValue(null);
  expect(await createProjectFromIdea(form())).toEqual({ ok: false, error: "Sign in again to create the project." });
  expect(m.select).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});

it("checks the idea owner and PRIVATE visibility before creating a project", async () => {
  expect(await createProjectFromIdea(form())).toEqual({ ok: true, projectId });
  const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
  expect(query.sql).toContain('"idea"."owner_id"');
  expect(query.sql).toContain('"idea"."visibility"');
  expect(query.params).toEqual(expect.arrayContaining([ideaId, "owner-a", "PRIVATE"]));
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-a", originIdeaId: ideaId, visibility: "PRIVATE", lifecycle: "PLANNING" }));
});

it("does not create a duplicate project for an already converted idea", async () => {
  m.limit.mockReset();
  m.limit.mockResolvedValueOnce([{ id: ideaId, title: "Founder OS", description: "Private workspace" }]).mockResolvedValueOnce([{ id: projectId }]);
  expect(await createProjectFromIdea(form())).toEqual({ ok: true, projectId });
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.refresh).toHaveBeenCalledWith(`/private/projects/${projectId}`);
});

it("rejects an unknown or inaccessible idea", async () => {
  m.limit.mockReset();
  m.limit.mockResolvedValue([]);
  expect(await createProjectFromIdea(form())).toEqual({ ok: false, error: "Idea not found. No project was created." });
  expect(m.insert).not.toHaveBeenCalled();
});

it("hides conversion database failures", async () => {
  m.values.mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error("private database detail")) });
  const result = await createProjectFromIdea(form());
  expect(result).toEqual({ ok: false, error: "Could not save the project. Please try again." });
  expect(JSON.stringify(result)).not.toContain("private database detail");
});

it("folds accents into a valid slug for the converted project", async () => {
  m.limit.mockReset();
  m.limit.mockResolvedValueOnce([{ id: ideaId, title: "Café para niños", description: "" }]).mockResolvedValueOnce([]);
  await createProjectFromIdea(form());
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ slug: `cafe-para-ninos-${ideaId.slice(0, 8)}` }));
});
