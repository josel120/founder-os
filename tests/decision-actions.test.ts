import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ owner: vi.fn(), select: vi.fn(), where: vi.fn(), insert: vi.fn(), values: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: mocks.owner }));
vi.mock("@/db", () => ({ db: { select: mocks.select, insert: mocks.insert } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createDecision } from "../src/modules/decisions/actions/decision.actions";
import { listDecisionsForIdea, listPrivateDecisions } from "../src/modules/decisions/queries/decision.queries";

const ideaId = "00000000-0000-4000-8000-0000000000bb";

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("title", "Pricing model");
  data.set("decision", "Start with a flat monthly plan");
  data.set("reason", "Simplest to validate willingness to pay");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

function predicate(call = 0) {
  const sql: SQL = mocks.where.mock.calls[call][0];
  return new PgDialect().sqlToQuery(sql);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ id: "owner-a" });
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.where.mockReturnValue({ limit: async () => [{ id: ideaId }], orderBy: async () => [] });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});

it("rejects anonymous requests before touching the database", async () => {
  mocks.owner.mockResolvedValue(null);
  expect((await createDecision(form())).ok).toBe(false);
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("rejects missing required fields", async () => {
  expect(await createDecision(form({ reason: "  " }))).toEqual({ ok: false, error: "Reason is required" });
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("saves an unlinked decision as PRIVATE for the session owner", async () => {
  expect(await createDecision(form({ ownerId: "owner-b", visibility: "PUBLIC" }))).toEqual({ ok: true });
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-a", ideaId: null, visibility: "PRIVATE" }));
});

it("links an idea only after an owner-scoped PRIVATE check", async () => {
  expect(await createDecision(form({ ideaId }))).toEqual({ ok: true });
  const query = predicate();
  expect(query.sql).toContain('"idea"."owner_id" =');
  expect(query.params).toEqual(expect.arrayContaining([ideaId, "owner-a", "PRIVATE"]));
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ ideaId }));
});

it("rejects another owner's or an unknown idea without inserting", async () => {
  mocks.where.mockReturnValue({ limit: async () => [] });
  expect(await createDecision(form({ ideaId }))).toEqual({ ok: false, error: "Idea not found. The decision was not saved." });
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("reports insert failures explicitly", async () => {
  mocks.values.mockRejectedValue(new Error("connection reset"));
  expect(await createDecision(form())).toEqual({ ok: false, error: "Could not save the decision. Please try again." });
});

it("scopes list queries to the session owner and PRIVATE", async () => {
  await listPrivateDecisions();
  expect(predicate(0).sql).toContain('"decision_log"."owner_id" =');
  expect(predicate(0).params).toEqual(expect.arrayContaining(["owner-a", "PRIVATE"]));
  await listDecisionsForIdea(ideaId);
  expect(predicate(1).params).toEqual(expect.arrayContaining([ideaId, "owner-a", "PRIVATE"]));
});

it("returns nothing without a session or with a malformed idea id", async () => {
  expect(await listDecisionsForIdea("not-a-uuid")).toEqual([]);
  mocks.owner.mockResolvedValue(null);
  expect(await listPrivateDecisions()).toEqual([]);
  expect(mocks.select).not.toHaveBeenCalled();
});
