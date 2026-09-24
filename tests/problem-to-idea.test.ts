import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), select: vi.fn(), where: vi.fn(), insert: vi.fn(), values: vi.fn(), returning: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.owner }));
vi.mock("@/db", () => ({ db: { select: mocks.select, insert: mocks.insert } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createIdeaFromProblem } from "../src/modules/ideas/actions/idea.actions";
import { getPrivateProblem } from "../src/modules/problems/queries/problem.queries";

const problemId = "00000000-0000-4000-8000-0000000000aa";
const problem = { id: problemId, title: "Hard onboarding", description: "New founders get lost in setup" };

function form(id = problemId) {
  const data = new FormData();
  data.set("problemId", id);
  return data;
}

function problemPredicate() {
  const predicate: SQL = mocks.where.mock.calls[0][0];
  return new PgDialect().sqlToQuery(predicate);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ id: "owner-a" });
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.where.mockReturnValue({ limit: async () => [problem] });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: "idea-1" }]);
});

it("rejects anonymous requests before touching the database", async () => {
  mocks.owner.mockResolvedValue(null);
  expect((await createIdeaFromProblem(form())).ok).toBe(false);
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("rejects a malformed problem id", async () => {
  expect(await createIdeaFromProblem(form("not-a-uuid"))).toEqual({ ok: false, error: "Invalid problem." });
  expect(mocks.select).not.toHaveBeenCalled();
});

it("looks the problem up scoped to the session owner and PRIVATE", async () => {
  await createIdeaFromProblem(form());
  const query = problemPredicate();
  expect(query.sql).toContain('"problem"."owner_id" =');
  expect(query.sql).toContain('"problem"."visibility" =');
  expect(query.params).toEqual(expect.arrayContaining([problemId, "owner-a", "PRIVATE"]));
});

it("creates nothing for another owner's or an unknown problem", async () => {
  mocks.where.mockReturnValue({ limit: async () => [] });
  expect(await createIdeaFromProblem(form())).toEqual({ ok: false, error: "Problem not found. No idea was created." });
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("creates a private INBOX idea linked to the owned problem", async () => {
  expect(await createIdeaFromProblem(form())).toEqual({ ok: true, ideaId: "idea-1" });
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
    ownerId: "owner-a", problemId, title: problem.title, description: problem.description, status: "INBOX", visibility: "PRIVATE",
  }));
});

it("reports database failures explicitly", async () => {
  mocks.returning.mockRejectedValue(new Error("connection reset"));
  expect(await createIdeaFromProblem(form())).toEqual({ ok: false, error: "Could not create the idea. Please try again." });
});

it("reads a linked problem only for its owner", async () => {
  expect(await getPrivateProblem(problemId)).toEqual(problem);
  expect(problemPredicate().params).toEqual(expect.arrayContaining([problemId, "owner-a", "PRIVATE"]));
  mocks.owner.mockResolvedValue(null);
  mocks.select.mockClear();
  expect(await getPrivateProblem(problemId)).toBeNull();
  expect(mocks.select).not.toHaveBeenCalled();
});
