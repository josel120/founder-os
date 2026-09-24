import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), where: vi.fn(), values: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.owner }));
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update, insert: mocks.insert } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getPrivateIdea, listPrivateIdeas } from "../src/modules/ideas/queries/idea.queries";
import { createIdea, updateIdeaStatus } from "../src/modules/ideas/actions/idea.actions";
import { listPrivateProblems } from "../src/modules/problems/queries/problem.queries";
import { createProblem } from "../src/modules/problems/actions/problem.actions";

const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ id: "owner-a" });
  mocks.where.mockReturnValue({ orderBy: async () => [], limit: async () => [], returning: async () => [] });
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.update.mockReturnValue({ set: () => ({ where: mocks.where }) });
  mocks.insert.mockReturnValue({ values: mocks.values });
});

function assertOwnerFilter(table: string) {
  const predicate: SQL = mocks.where.mock.calls[0][0];
  const query = new PgDialect().sqlToQuery(predicate);
  expect(query.sql).toContain(`"${table}"."owner_id" =`);
  expect(query.sql).toContain(`"${table}"."visibility" =`);
  expect(query.sql).toContain(" and ");
  expect(query.params).toContain("owner-a");
  expect(query.params).toContain("PRIVATE");
}

it("scopes list queries to the authenticated owner and PRIVATE", async () => {
  await listPrivateIdeas();
  assertOwnerFilter("idea");
  mocks.where.mockClear();
  await listPrivateProblems();
  assertOwnerFilter("problem");
});
it("scopes detail by ID, owner and visibility", async () => {
  expect(await getPrivateIdea(id)).toBeNull();
  assertOwnerFilter("idea");
  expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toContain(id);
});
it("does not query malformed IDs", async () => {
  expect(await getPrivateIdea("not-an-id")).toBeNull();
  expect(mocks.select).not.toHaveBeenCalled();
});
it("updates only owned private ideas and reports no matching row as failure", async () => {
  const form = new FormData();
  form.set("ideaId", id);
  form.set("status", "RESEARCHING");
  form.set("ownerId", "owner-b");
  expect((await updateIdeaStatus(form)).ok).toBe(false);
  assertOwnerFilter("idea");
});
it.each(["idea", "problem"])("ignores forged ownerId when creating %s", async (kind) => {
  const form = new FormData();
  form.set("title", "Ownership test");
  form.set("description", "Private content");
  form.set("ownerId", "owner-b");
  form.set("visibility", "PUBLIC");
  if (kind === "idea") await createIdea(form);
  else await createProblem(form);
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-a", visibility: "PRIVATE" }));
});
it("does not read or create problems without an allowed session", async () => {
  mocks.owner.mockResolvedValue(null);
  expect(await listPrivateProblems()).toEqual([]);
  await createProblem(new FormData());
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
