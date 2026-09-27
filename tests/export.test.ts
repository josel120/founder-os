// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect, getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ tx: vi.fn(), from: vi.fn(), where: vi.fn(), auth: vi.fn(), report: vi.fn(), rows: new Map<string, unknown[]>() }));
vi.mock("@/db", () => {
  const tx = {
    select: () => ({
      from: (table: unknown) => {
        m.from(table);
        return { where: (where: unknown) => { m.where(table, where); return Promise.resolve(m.rows.get(getTableConfig(table as PgTable).name) ?? []); } };
      },
    }),
  };
  return { db: { transaction: async <T>(run: (t: typeof tx) => Promise<T>, config: unknown) => { m.tx(config); return run(tx); } } };
});
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/report-error", () => ({ reportError: m.report }));
import { EXPORT_FORMAT, EXPORT_TABLES, buildOwnerExport } from "@/modules/export/services/export";
import { GET } from "@/app/private/export/route";

beforeEach(() => { vi.clearAllMocks(); m.rows.clear(); });
const tableNames = () => m.from.mock.calls.map(([table]) => getTableConfig(table as PgTable).name).sort();

it("reads every owned table with the session owner's id and no auth or rate-limit table", async () => {
  const exported = await buildOwnerExport("owner-a", new Date("2026-09-27T16:00:00Z"));
  expect(tableNames()).toEqual(["ai_run", "decision_log", "evidence", "finance_import", "finance_transaction", "idea", "problem", "project", "project_github", "project_publication"]);
  for (const [table, where] of m.where.mock.calls) {
    const query = new PgDialect().sqlToQuery(where as SQL);
    expect(query.sql).toBe(`"${getTableConfig(table as PgTable).name}"."owner_id" = $1`);
    expect(query.params).toEqual(["owner-a"]);
  }
  expect(m.tx).toHaveBeenCalledWith({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(exported?.format).toBe(EXPORT_FORMAT);
  expect(exported?.exportedAt).toBe("2026-09-27T16:00:00.000Z");
  expect(Object.keys(exported!.data).sort()).toEqual(Object.keys(EXPORT_TABLES).sort());
});

it("returns the rows with per-table counts", async () => {
  m.rows.set("idea", [{ id: "i1", title: "One" }, { id: "i2", title: "Two" }]);
  const exported = await buildOwnerExport("owner-a");
  expect(exported!.counts.ideas).toBe(2);
  expect(exported!.counts.problems).toBe(0);
  expect(exported!.data.ideas).toEqual([{ id: "i1", title: "One" }, { id: "i2", title: "Two" }]);
});

it("the route refuses without the owner's session and reads nothing", async () => {
  m.auth.mockResolvedValue(null);
  const response = await GET();
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(m.from).not.toHaveBeenCalled();
});

it("the route returns a no-store, noindex JSON attachment for the session owner", async () => {
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.rows.set("problem", [{ id: "p1" }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="founder-os-export-\d{4}-\d{2}-\d{2}\.json"$/);
  const body = JSON.parse(await response.text()) as { counts: { problems: number } };
  expect(body.counts.problems).toBe(1);
  for (const [, where] of m.where.mock.calls) expect(new PgDialect().sqlToQuery(where as SQL).params).toEqual(["owner-a"]);
});

it("the route reports a database failure by scope only", async () => {
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.where.mockImplementationOnce(() => { throw new Error("secret sql"); });
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("secret");
  expect(m.report).toHaveBeenCalledWith("export", expect.any(Error));
});
