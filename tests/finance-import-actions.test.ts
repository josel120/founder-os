// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({ auth: vi.fn(), report: vi.fn(), refresh: vi.fn(), selectWhere: vi.fn(), inserts: [] as { values: unknown; conflict?: unknown }[], deletes: [] as unknown[], updates: [] as { set: unknown; where: unknown }[], insertedIds: [] as unknown[][], batch: [{ id: "batch-1" }] as unknown[], existing: [] as unknown[] }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/report-error", () => ({ reportError: m.report }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("@/db", () => {
  const select = () => ({ from: () => ({ where: (clause: unknown) => { m.selectWhere(clause); const result = Promise.resolve(m.existing); return Object.assign(result, { limit: () => Promise.resolve(m.existing) }); } }) });
  const insert = () => ({
    values: (values: unknown) => {
      const entry: { values: unknown; conflict?: unknown } = { values };
      m.inserts.push(entry);
      const isBatch = !Array.isArray(values);
      return {
        returning: () => Promise.resolve(isBatch ? m.batch : m.insertedIds.shift() ?? []),
        onConflictDoNothing: (conflict: unknown) => { entry.conflict = conflict; return { returning: () => Promise.resolve(m.insertedIds.shift() ?? []) }; },
      };
    },
  });
  const remove = () => ({ where: (clause: unknown) => { m.deletes.push(clause); return Object.assign(Promise.resolve(), { returning: () => Promise.resolve([{ id: "t1" }, { id: "t2" }]) }); } });
  const update = () => ({ set: (set: unknown) => ({ where: (where: unknown) => { m.updates.push({ set, where }); return Promise.resolve(); } }) });
  const tx = { select, insert, delete: remove, update };
  return { db: { ...tx, transaction: (run: (t: typeof tx) => Promise<unknown>) => run(tx) } };
});
import { confirmFinanceImport, previewFinanceImport, undoFinanceImport } from "@/modules/finance/actions/import.actions";

const dialect = new PgDialect();
const csv = "date,amount,description\n2026-09-01,-3.50,Coffee\n2026-09-02,100,Refund\nbad,1,Broken\n";
const mapping = { date: "date", amount: "amount", description: "description", currency: { fixed: "EUR" }, dateFormat: "YYYY-MM-DD", decimalSeparator: ".", fileName: "bank.csv" };
const form = (values: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(values)) data.set(k, v); return data; };
const importForm = (extra: Record<string, string> = {}) => form({ csv, mapping: JSON.stringify(mapping), ...extra });
const importId = "00000000-0000-4000-8000-000000000009";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(m, { inserts: [], deletes: [], updates: [], insertedIds: [], batch: [{ id: "batch-1" }], existing: [] });
  m.auth.mockResolvedValue({ id: "owner-a" });
});

it("refuses anonymous callers before reading anything", async () => {
  m.auth.mockResolvedValue(null);
  for (const action of [previewFinanceImport, confirmFinanceImport]) expect(await action(importForm())).toEqual({ ok: false, error: "Sign in again to import." });
  expect(await undoFinanceImport(form({ importId }))).toEqual({ ok: false, error: "Sign in again to import." });
  expect(m.selectWhere).not.toHaveBeenCalled();
  expect(m.inserts).toEqual([]);
});

it.each([
  [{ csv: "" }, "Choose a CSV file."],
  [{ csv: "a".repeat(1_000_001) }, "larger than 1 MB"],
  [{ mapping: "{not json" }, "Invalid column mapping."],
  [{ mapping: JSON.stringify({ ...mapping, ownerId: "attacker" }) }, "Unrecognized key"],
])("rejects bad input %#", async (extra, message) => {
  const result = await confirmFinanceImport(importForm(extra));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain(message);
  expect(m.inserts).toEqual([]);
});

it("previews headers without a mapping, and counts new rows, duplicates and errors with one", async () => {
  expect(await previewFinanceImport(form({ csv }))).toMatchObject({ ok: true, headers: ["date", "amount", "description"], totalRows: 3, mapped: null });
  const preview = await previewFinanceImport(importForm());
  expect(preview).toMatchObject({ ok: true, mapped: { newCount: 2, duplicateCount: 0, errorCount: 1 } });
  const lookup = dialect.sqlToQuery(m.selectWhere.mock.calls[0][0] as SQL);
  expect(lookup.sql).toContain('"finance_transaction"."owner_id"');
  expect(lookup.params[0]).toBe("owner-a");
  expect(m.inserts).toEqual([]);
});

it("imports as the session owner with keys, skipping re-imported rows through the partial unique index", async () => {
  m.insertedIds = [[{ id: "t1" }]];
  expect(await confirmFinanceImport(importForm())).toEqual({ ok: true, importId: "batch-1", imported: 1, skipped: 2 });
  const [batch, rows] = m.inserts;
  expect(batch!.values).toEqual({ ownerId: "owner-a", fileName: "bank.csv", rowCount: 3, importedCount: 0, skippedCount: 0 });
  expect(rows!.values).toEqual([
    expect.objectContaining({ ownerId: "owner-a", type: "EXPENSE", amount: "3.50", currency: "EUR", source: "CSV import", visibility: "PRIVATE", importId: "batch-1", importKey: expect.stringMatching(/^row:[0-9a-f]{64}$/) }),
    expect.objectContaining({ ownerId: "owner-a", type: "INCOME", importId: "batch-1" }),
  ]);
  const conflict = rows!.conflict as { target: { name: string }[]; where: SQL };
  expect(conflict.target.map((column) => column.name)).toEqual(["owner_id", "import_key"]);
  expect(dialect.sqlToQuery(conflict.where).sql).toBe('"finance_transaction"."import_key" IS NOT NULL');
  expect(m.updates[0]!.set).toEqual({ importedCount: 1, skippedCount: 2 });
  expect(dialect.sqlToQuery(m.updates[0]!.where as SQL).params).toEqual(["batch-1", "owner-a"]);
});

it("keeps no empty batch when nothing is new", async () => {
  m.insertedIds = [[]];
  expect(await confirmFinanceImport(importForm())).toEqual({ ok: true, importId: null, imported: 0, skipped: 3 });
  expect(dialect.sqlToQuery(m.deletes[0] as SQL).params).toEqual(["batch-1", "owner-a"]);
  expect(m.updates).toEqual([]);
});

it("undoes only the session owner's import: its rows, then the batch", async () => {
  m.existing = [{ id: importId }];
  expect(await undoFinanceImport(form({ importId, ownerId: "attacker" }))).toEqual({ ok: true, removed: 2 });
  expect(dialect.sqlToQuery(m.selectWhere.mock.calls[0][0] as SQL).params).toEqual([importId, "owner-a"]);
  expect(m.deletes.map((clause) => dialect.sqlToQuery(clause as SQL))).toEqual([
    expect.objectContaining({ sql: expect.stringContaining('"finance_transaction"."import_id"'), params: [importId, "owner-a", "PRIVATE"] }),
    expect.objectContaining({ sql: expect.stringContaining('"finance_import"."id"'), params: [importId, "owner-a"] }),
  ]);
});

it("does not undo another owner's or an unknown import", async () => {
  m.existing = [];
  expect(await undoFinanceImport(form({ importId }))).toEqual({ ok: false, error: "Import not found." });
  expect(m.deletes).toEqual([]);
  expect(await undoFinanceImport(form({ importId: "nope" }))).toEqual({ ok: false, error: "Invalid import." });
});

it("reports a failure without details and saves nothing", async () => {
  m.batch = [];
  expect(await confirmFinanceImport(importForm())).toEqual({ ok: false, error: "Could not import the file. Nothing was saved." });
  expect(m.report).toHaveBeenCalledWith("finance.importConfirm", expect.any(Error));
});
