import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ auth: vi.fn(), insert: vi.fn(), values: vi.fn(), returning: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { insert: m.insert, select: m.select } }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
import { createFinanceTransaction } from "@/modules/finance/actions/finance.actions";
import { getPrivateFinanceTransaction, listPrivateFinanceTransactions } from "@/modules/finance/queries/finance.queries";

const id = "00000000-0000-4000-8000-000000000001";
function input(extra: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({ type: "EXPENSE", category: "Hosting", amount: "12.3400", currency: "USD", source: "Cloud provider", occurredAt: "2026-09-24T12:00:00.000Z", projectId: id, ...extra }).forEach(([key, value]) => form.set(key, value));
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ returning: m.returning });
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ returning: m.returning, limit: m.limit, orderBy: m.orderBy });
  m.limit.mockResolvedValue([{ id }]);
  m.orderBy.mockResolvedValue([]);
  m.returning.mockResolvedValue([{ id }]);
});

it("rejects anonymous writes and reads", async () => {
  m.auth.mockResolvedValue(null);
  expect((await createFinanceTransaction(input())).ok).toBe(false);
  expect(await listPrivateFinanceTransactions()).toEqual([]);
  expect(await getPrivateFinanceTransaction(id)).toBeNull();
  expect(m.insert).not.toHaveBeenCalled();
  expect(m.select).not.toHaveBeenCalled();
});

it("checks the linked project and writes private owner-scoped values", async () => {
  expect((await createFinanceTransaction(input())).ok).toBe(true);
  const values = m.values.mock.calls[0][0];
  expect(values).toMatchObject({ ownerId: "owner-a", projectId: id, visibility: "PRIVATE", amount: "12.3400" });
  const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
  expect(query.sql).toContain('"project"."owner_id"');
  expect(query.sql).toContain('"project"."visibility"');
  expect(query.params).toContain("owner-a");
  expect(query.params).toContain("PRIVATE");
  expect(m.refresh).toHaveBeenCalledWith("/private/finance");
});

it("rejects a missing linked project without inserting", async () => {
  m.limit.mockResolvedValue([]);
  const result = await createFinanceTransaction(input());
  expect(result).toEqual({ ok: false, error: "Project not found. The transaction was not saved." });
  expect(m.insert).not.toHaveBeenCalled();
});

it.each<Record<string, string>>([
  { amount: "0" }, { amount: "0.0000" }, { amount: "-5" }, { amount: "1e3" }, { amount: "12.34567" },
  { amount: "123456789012345" }, { currency: "US1" }, { currency: "EURO" }, { occurredAt: "1" }, { occurredAt: "2026-02-30T10:00" },
])("rejects invalid input %o before database access", async (extra) => {
  expect((await createFinanceTransaction(input(extra))).ok).toBe(false);
  expect(m.select).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});

it("normalizes currency case and comma decimals and keeps exact amounts", async () => {
  expect((await createFinanceTransaction(input({ amount: "12,5", currency: " eur " }))).ok).toBe(true);
  expect(m.values.mock.calls[0][0]).toMatchObject({ amount: "12.5", currency: "EUR" });
});

it("accepts the largest amount the numeric(18, 4) column can store", async () => {
  expect((await createFinanceTransaction(input({ amount: "99999999999999.9999" }))).ok).toBe(true);
  expect(m.values.mock.calls[0][0]).toMatchObject({ amount: "99999999999999.9999" });
});

it("stores the typed wall-clock time as UTC, whatever the server time zone", async () => {
  expect((await createFinanceTransaction(input({ occurredAt: "2026-09-24T23:30" }))).ok).toBe(true);
  expect((m.values.mock.calls[0][0].occurredAt as Date).toISOString()).toBe("2026-09-24T23:30:00.000Z");
});

it("scopes transaction reads to owner and private visibility", async () => {
  await listPrivateFinanceTransactions(id);
  const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
  expect(query.sql).toContain('"finance_transaction"."owner_id"');
  expect(query.sql).toContain('"finance_transaction"."visibility"');
  expect(query.params).toEqual(expect.arrayContaining(["owner-a", "PRIVATE", id]));
});
