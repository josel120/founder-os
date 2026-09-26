import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ auth: vi.fn(), insert: vi.fn(), values: vi.fn(), update: vi.fn(), set: vi.fn(), returning: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { insert: m.insert, update: m.update, select: m.select } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { createEvidence, updateEvidenceContent } from "@/modules/research/actions/evidence.actions";
import { listEvidenceForIdea, listEvidenceForProblem, listPrivateEvidence } from "@/modules/research/queries/evidence.queries";

const ideaId = "00000000-0000-4000-8000-00000000000a";
const problemId = "00000000-0000-4000-8000-00000000000b";
const evidenceId = "00000000-0000-4000-8000-00000000000e";

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}
const content = { title: "Five founders interviewed", summary: "All five lose context between tools.", kind: "INTERVIEW", signal: "SUPPORTS", sourceUrl: "https://example.com/notes" };
const createInput = (extra: Record<string, string> = {}) => form({ ...content, parent: `idea:${ideaId}`, ...extra });
const updateInput = (extra: Record<string, string> = {}) => form({ ...content, evidenceId, ...extra });
const whereSql = (call = 0) => new PgDialect().sqlToQuery(m.where.mock.calls[call]![0] as SQL);

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ returning: m.returning });
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ limit: m.limit, returning: m.returning, orderBy: m.orderBy });
  m.limit.mockResolvedValue([{ id: ideaId }]);
  m.returning.mockResolvedValue([{ id: evidenceId, ideaId }]);
  m.orderBy.mockResolvedValue([]);
});

describe("createEvidence", () => {
  it("rejects anonymous callers before touching the database", async () => {
    m.auth.mockResolvedValue(null);
    expect(await createEvidence(createInput())).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(m.select).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("verifies the idea by id, session owner and PRIVATE, then writes explicit private values", async () => {
    expect(await createEvidence(createInput())).toEqual({ ok: true, evidenceId });
    const query = whereSql();
    expect(query.sql).toContain('"idea"."owner_id"');
    expect(query.sql).toContain('"idea"."visibility"');
    expect(query.params).toEqual(expect.arrayContaining([ideaId, "owner-a", "PRIVATE"]));
    expect(m.values.mock.calls[0]![0]).toEqual({
      ownerId: "owner-a", problemId: null, ideaId, title: content.title, summary: content.summary,
      kind: "INTERVIEW", signal: "SUPPORTS", sourceUrl: "https://example.com/notes", visibility: "PRIVATE",
    });
    expect(m.refresh).toHaveBeenCalledWith("/private/research");
    expect(m.refresh).toHaveBeenCalledWith(`/private/ideas/${ideaId}`);
  });

  it("attaches to an owned problem through the problem table", async () => {
    m.limit.mockResolvedValue([{ id: problemId }]);
    expect((await createEvidence(createInput({ parent: `problem:${problemId}`, sourceUrl: "" }))).ok).toBe(true);
    expect(whereSql().sql).toContain('"problem"."owner_id"');
    expect(m.values.mock.calls[0]![0]).toMatchObject({ problemId, ideaId: null, sourceUrl: null });
  });

  it("refuses a parent owned by someone else or not PRIVATE, without inserting", async () => {
    m.limit.mockResolvedValue([]);
    expect(await createEvidence(createInput())).toEqual({ ok: false, reason: "not_found", error: "Idea not found. The evidence was not saved." });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("ignores owner, visibility and extra parent IDs sent by the client", async () => {
    await createEvidence(createInput({ ownerId: "attacker", visibility: "PUBLIC", problemId, ideaId: "00000000-0000-4000-8000-0000000000ff" }));
    expect(m.values.mock.calls[0]![0]).toMatchObject({ ownerId: "owner-a", visibility: "PRIVATE", ideaId, problemId: null });
  });

  it.each([
    ["javascript:alert(1)"], ["data:text/html,<script>alert(1)</script>"], ["ftp://example.com/file"], ["file:///etc/passwd"], ["not a link"], ["//example.com"],
  ])("rejects the source URL %s before database access", async (sourceUrl) => {
    expect(await createEvidence(createInput({ sourceUrl }))).toMatchObject({ ok: false, reason: "invalid" });
    expect(m.select).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it.each([
    [{ parent: "" }], [{ parent: `idea:not-a-uuid` }], [{ parent: `project:${ideaId}` }], [{ parent: `idea:${ideaId}:extra` }],
    [{ kind: "" }], [{ signal: "MAYBE" }], [{ title: "  " }], [{ summary: "" }], [{ title: "x".repeat(161) }],
  ])("rejects invalid input %o", async (extra) => {
    expect(await createEvidence(createInput(extra))).toMatchObject({ ok: false, reason: "invalid" });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("requires kind and signal explicitly, since the columns have no defaults", async () => {
    const data = createInput();
    data.delete("kind");
    data.delete("signal");
    expect(await createEvidence(data)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("hides database errors", async () => {
    m.returning.mockRejectedValue(new Error("private database detail"));
    const result = await createEvidence(createInput());
    expect(result).toEqual({ ok: false, reason: "failed", error: "Could not save the evidence. Please try again." });
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });
});

describe("updateEvidenceContent", () => {
  it("updates content fields only, scoped to id, session owner and PRIVATE", async () => {
    expect(await updateEvidenceContent(updateInput({ ownerId: "attacker", visibility: "PUBLIC", parent: `problem:${problemId}`, ideaId: problemId }))).toEqual({ ok: true, evidenceId });
    expect(Object.keys(m.set.mock.calls[0]![0]).sort()).toEqual(["kind", "signal", "sourceUrl", "summary", "title"]);
    const query = whereSql();
    expect(query.sql).toContain('"evidence"."id"');
    expect(query.sql).toContain('"evidence"."owner_id"');
    expect(query.sql).toContain('"evidence"."visibility"');
    expect(query.params).toEqual(expect.arrayContaining([evidenceId, "owner-a", "PRIVATE"]));
    expect(query.params).not.toContain("attacker");
    expect(m.refresh).toHaveBeenCalledWith(`/private/ideas/${ideaId}`);
  });

  it("reports not_found when no owned row matched", async () => {
    m.returning.mockResolvedValue([]);
    expect(await updateEvidenceContent(updateInput())).toEqual({ ok: false, reason: "not_found", error: "Evidence not found. Changes were not saved." });
  });

  it("rejects anonymous callers and bad links before database access", async () => {
    expect(await updateEvidenceContent(updateInput({ sourceUrl: "javascript:alert(1)" }))).toMatchObject({ ok: false, reason: "invalid" });
    m.auth.mockResolvedValue(null);
    expect(await updateEvidenceContent(updateInput())).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("evidence queries", () => {
  it("scope every list to the session owner and PRIVATE", async () => {
    await listPrivateEvidence({ kind: "MARKET", signal: "CONTRADICTS" });
    const query = whereSql();
    expect(query.sql).toContain('"evidence"."owner_id"');
    expect(query.sql).toContain('"evidence"."visibility"');
    expect(query.params).toEqual(["owner-a", "PRIVATE", "MARKET", "CONTRADICTS"]);
  });

  it("ignores unknown filters instead of failing", async () => {
    await listPrivateEvidence({ kind: "DROP TABLE" as never, signal: undefined });
    expect(whereSql().params).toEqual(["owner-a", "PRIVATE"]);
  });

  it("lists by owned parent and rejects malformed ids without a query", async () => {
    await listEvidenceForIdea(ideaId);
    expect(whereSql(0).params).toEqual(["owner-a", "PRIVATE", ideaId]);
    await listEvidenceForProblem(problemId);
    expect(whereSql(1).sql).toContain('"evidence"."problem_id"');
    expect(await listEvidenceForIdea("not-a-uuid")).toEqual([]);
    expect(await listEvidenceForProblem("../x")).toEqual([]);
    expect(m.select).toHaveBeenCalledTimes(2);
  });

  it("returns nothing to anonymous callers", async () => {
    m.auth.mockResolvedValue(null);
    expect(await listPrivateEvidence()).toEqual([]);
    expect(await listEvidenceForIdea(ideaId)).toEqual([]);
    expect(m.select).not.toHaveBeenCalled();
  });

  it("never selects owner or visibility columns", async () => {
    await listPrivateEvidence();
    expect(Object.keys(m.select.mock.calls[0]![0]).sort()).toEqual(["createdAt", "id", "ideaId", "kind", "problemId", "signal", "sourceUrl", "summary", "title", "updatedAt"]);
  });
});
