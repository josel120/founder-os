import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

// Each db.select() returns a chain that records its WHERE and resolves to the next queued result.
const m = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), wheres: [] as unknown[], results: [] as unknown[][] }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { select: m.select } }));
import { getAttention } from "@/modules/cockpit/queries/attention.queries";
import { needsResearch, waitingTooLong, WAITING_THRESHOLD_DAYS } from "@/modules/cockpit/services/attention";

const now = new Date("2026-09-26T12:00:00Z");
const ideaA = "00000000-0000-4000-8000-00000000000a";
const ideaB = "00000000-0000-4000-8000-00000000000b";
const ideaC = "00000000-0000-4000-8000-00000000000c";

function chain() {
  const result = m.results.shift() ?? [];
  const link: Record<string, unknown> = {};
  for (const name of ["from", "orderBy", "limit", "groupBy"]) link[name] = () => link;
  link.where = (clause: unknown) => { m.wheres.push(clause); return link; };
  link.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return link;
}
const sqlOf = (clause: unknown) => new PgDialect().sqlToQuery(clause as SQL);

beforeEach(() => {
  vi.resetAllMocks();
  m.wheres = [];
  m.results = [];
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.select.mockImplementation(chain);
});

describe("selection rules", () => {
  it("flags waiting only past the threshold", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(waitingTooLong(new Date(now.getTime() - WAITING_THRESHOLD_DAYS * day), now)).toBe(true);
    expect(waitingTooLong(new Date(now.getTime() - WAITING_THRESHOLD_DAYS * day + 1), now)).toBe(false);
    expect(waitingTooLong(null, now)).toBe(false);
  });

  it.each([
    [undefined, true], [{ supports: 0, contradicts: 0, neutral: 0 }, true], [{ supports: 0, contradicts: 2, neutral: 1 }, true],
    [{ supports: 1, contradicts: 2, neutral: 0 }, false], [{ supports: 0, contradicts: 0, neutral: 3 }, false],
  ])("needsResearch(%o) is %s", (counts, expected) => {
    expect(needsResearch(counts)).toBe(expected);
  });
});

describe("getAttention", () => {
  it("returns nothing for anonymous callers without querying", async () => {
    m.auth.mockResolvedValue(null);
    expect(await getAttention(now)).toBeNull();
    expect(m.select).not.toHaveBeenCalled();
  });

  it("scopes every query to the session owner and PRIVATE on its own table", async () => {
    m.results = [[], [], [], [], [{ total: 0 }], [{ id: ideaA, title: "A", status: "RESEARCHING", createdAt: now }], [], [], []];
    await getAttention(now);
    expect(m.wheres).toHaveLength(9);
    const tables = ["project", "project", "project", "idea", "idea", "idea", "decision_log", "finance_transaction", "evidence"];
    m.wheres.forEach((clause, index) => {
      const query = sqlOf(clause);
      expect(query.sql).toContain(`"${tables[index]}"."owner_id"`);
      expect(query.sql).toContain(`"${tables[index]}"."visibility"`);
      expect(query.params).toContain("owner-a");
      expect(query.params).toContain("PRIVATE");
    });
  });

  it("uses the waiting threshold and the 30-day finance window", async () => {
    await getAttention(now);
    const waiting = sqlOf(m.wheres[1]);
    expect(waiting.sql).toContain('"project"."waiting_since" <=');
    expect(waiting.params).toEqual(expect.arrayContaining(["WAITING_PLATFORM", "WAITING_USERS", "WAITING_REVIEW", "WAITING_PAYMENT"]));
    expect(waiting.params).toContain(new Date("2026-09-12T12:00:00Z").toISOString());
    const finance = sqlOf(m.wheres[7]);
    expect(finance.sql).toContain('"finance_transaction"."occurred_at" >=');
    expect(finance.params).toContain(new Date("2026-08-27T12:00:00Z").toISOString());
    expect(sqlOf(m.wheres[2]).params).toContain(now.toISOString());
  });

  it("keeps only research ideas without evidence or with contradicting evidence alone", async () => {
    const research = [ideaA, ideaB, ideaC].map((id) => ({ id, title: id, status: "VALIDATING", createdAt: now }));
    m.results = [[], [], [], [], [{ total: 7 }], research, [], [{ type: "INCOME", amount: "10.0000", currency: "USD" }],
      [{ ideaId: ideaB, signal: "CONTRADICTS", total: 2 }, { ideaId: ideaC, signal: "CONTRADICTS", total: 1 }, { ideaId: ideaC, signal: "SUPPORTS", total: 1 }]];
    const attention = await getAttention(now);
    expect(attention!.researchIdeas.map((idea) => idea.id)).toEqual([ideaA, ideaB]);
    expect(attention!.researchIdeas[1]!.signals).toEqual({ supports: 0, contradicts: 2, neutral: 0 });
    expect(attention!.inbox.total).toBe(7);
    expect(attention!.finance).toEqual([expect.objectContaining({ currency: "USD", net: "10.00" })]);
    expect(sqlOf(m.wheres[8]).params).toEqual(expect.arrayContaining([ideaA, ideaB, ideaC]));
  });

  it("skips the evidence query when no idea is under research", async () => {
    await getAttention(now);
    expect(m.select).toHaveBeenCalledTimes(8);
  });

  it("never selects owner or visibility columns", async () => {
    await getAttention(now);
    for (const [columns] of m.select.mock.calls) {
      expect(Object.keys(columns as object)).not.toContain("ownerId");
      expect(Object.keys(columns as object)).not.toContain("visibility");
    }
  });
});
