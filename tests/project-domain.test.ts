import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({ auth: vi.fn(), insert: vi.fn(), values: vi.fn(), update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn(), select: vi.fn(), from: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { insert: m.insert, update: m.update, select: m.select } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { createProject, updateProjectContent, updateProjectStatus } from "@/modules/projects/actions/project.actions";
import { getPrivateProject, listPrivateProjects } from "@/modules/projects/queries/project.queries";
import { createProjectSchema, updateProjectStatusSchema } from "@/modules/projects/schemas/project.schema";

const id = "00000000-0000-4000-8000-000000000001";
function input(extra: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({ projectId: id, name: "AllFlag", slug: "allflag", description: "Private", lifecycle: "BETA", operationalStatus: "READY", ...extra }).forEach(([key, value]) => form.set(key, value));
  return form;
}
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ returning: m.returning });
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ returning: m.returning, limit: m.limit, orderBy: m.orderBy });
  m.returning.mockResolvedValue([{ id }]);
  m.limit.mockResolvedValue([]);
  m.orderBy.mockResolvedValue([]);
});
function predicate(includeId: boolean) {
  const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
  expect(query.sql).toContain('"project"."owner_id"');
  expect(query.sql).toContain('"project"."visibility"');
  expect(query.params).toContain("owner-a");
  expect(query.params).toContain("PRIVATE");
  expect(query.params).not.toContain("attacker");
  if (includeId) {
    expect(query.sql).toContain('"project"."id"');
    expect(query.params).toContain(id);
  }
}
it.each([createProject, updateProjectContent, updateProjectStatus])("rejects anonymous mutations", async action => {
  m.auth.mockResolvedValue(null);
  expect((await action(input())).ok).toBe(false);
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects anonymous reads", async () => {
  m.auth.mockResolvedValue(null);
  expect(await listPrivateProjects()).toEqual([]);
  expect(await getPrivateProject(id)).toBeNull();
  expect(m.select).not.toHaveBeenCalled();
});
it("sets private creation defaults and ignores supplied ownership, publication and origin", async () => {
  expect((await createProject(input({ ownerId: "attacker", visibility: "PUBLIC", originIdeaId: id, publishedAt: "2026-01-01" }))).ok).toBe(true);
  const values = m.values.mock.calls[0][0];
  expect(values).toMatchObject({ ownerId: "owner-a", visibility: "PRIVATE", lifecycle: "PLANNING", operationalStatus: "NO_ACTION_REQUIRED" });
  expect(values).not.toHaveProperty("originIdeaId");
  expect(values).not.toHaveProperty("publishedAt");
});
it.each([updateProjectContent, updateProjectStatus])("scopes updates and only confirms returned rows", async action => {
  m.returning.mockResolvedValue([]);
  expect((await action(input({ ownerId: "attacker" }))).ok).toBe(false);
  predicate(true);
  expect(m.refresh).not.toHaveBeenCalled();
});
it.each([createProject, updateProjectContent, updateProjectStatus])("hides database errors", async action => {
  m.returning.mockRejectedValue(new Error("secret connection string"));
  const result = await action(input());
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(m.refresh).not.toHaveBeenCalled();
});
it("edits only content fields", async () => {
  expect((await updateProjectContent(input({ visibility: "PUBLIC", ownerId: "attacker" }))).ok).toBe(true);
  expect(Object.keys(m.set.mock.calls[0][0]).sort()).toEqual(["name", "slug", "description", "repository", "website", "playStoreUrl", "appStoreUrl", "currentVersion", "productionVersion", "updatedAt"].sort());
  predicate(true);
});
it("keeps lifecycle independent and clears obsolete waiting details", async () => {
  expect((await updateProjectStatus(input({ waitingReason: "old", waitingSince: "2026-09-24T00:00:00Z" }))).ok).toBe(true);
  expect(m.set.mock.calls[0][0]).toMatchObject({ lifecycle: "BETA", operationalStatus: "READY", waitingReason: null, waitingSince: null });
  expect(m.set.mock.calls[0][0]).not.toHaveProperty("visibility");
});
it("persists waiting context without changing the requested lifecycle", async () => {
  expect((await updateProjectStatus(input({ operationalStatus: "WAITING_USERS", waitingReason: "Feedback", waitingSince: "2026-09-24T00:00:00Z" }))).ok).toBe(true);
  expect(m.set.mock.calls[0][0]).toMatchObject({ lifecycle: "BETA", operationalStatus: "WAITING_USERS", waitingReason: "Feedback", waitingSince: new Date("2026-09-24T00:00:00Z") });
});
it.each(["list", "detail"])("scopes %s reads", async mode => {
  if (mode === "list") expect(await listPrivateProjects()).toEqual([]);
  else expect(await getPrivateProject(id)).toBeNull();
  predicate(mode === "detail");
});
it("rejects malformed IDs before queries", async () => {
  expect(await getPrivateProject("bad")).toBeNull();
  expect(m.select).not.toHaveBeenCalled();
});
it.each([createProject, updateProjectContent, updateProjectStatus])("rejects invalid input without writes", async action => {
  expect((await action(input({ name: "", projectId: "bad" }))).ok).toBe(false);
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it.each(["javascript:alert(1)", "file:///private", "ftp://example.com"])("rejects unsafe URL %s", website => {
  expect(createProjectSchema.safeParse({ name: "App", slug: "app", website }).success).toBe(false);
});
it.each(["../app", "App", "a--b"])("rejects unsafe slug %s", slug => {
  expect(createProjectSchema.safeParse({ name: "App", slug }).success).toBe(false);
});
it("requires waiting context and rejects invalid dates", () => {
  expect(updateProjectStatusSchema.safeParse({ projectId: id, lifecycle: "BETA", operationalStatus: "WAITING_USERS" }).success).toBe(false);
  expect(updateProjectStatusSchema.safeParse({ projectId: id, lifecycle: "BETA", operationalStatus: "READY", reviewAt: "invalid" }).success).toBe(false);
});

it("reports a slug collision plainly on create and edit, without database details", async () => {
  const collision = Object.assign(new Error("Failed query: insert into project ... private detail"), { cause: Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: "project_slug_unique" }) });
  m.returning.mockRejectedValue(collision);
  const expected = { ok: false, error: "That slug is already in use. Choose another one." };
  expect(await createProject(input())).toEqual(expected);
  expect(await updateProjectContent(input())).toEqual(expected);
  m.returning.mockRejectedValue(new Error("private detail"));
  expect(await createProject(input())).toEqual({ ok: false, error: "Could not save the project. Please try again." });
});
