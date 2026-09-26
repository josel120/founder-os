import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type * as RateLimitRetention from "../src/modules/auth/services/rate-limit-retention";
import type * as Schema from "../src/db/schema";

const mocks = vi.hoisted(() => ({ delete: vi.fn(), where: vi.fn(), reportError: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: mocks.reportError }));

let pruneStaleRateLimits: typeof RateLimitRetention.pruneStaleRateLimits;
let retentionCutoff: typeof RateLimitRetention.retentionCutoff;
let rateLimits: typeof Schema.rateLimits;
type FakeDb = Parameters<typeof pruneStaleRateLimits>[0];
const db = { delete: mocks.delete } as unknown as FakeDb;

// Fresh module per test: `pruneStaleRateLimits` throttles via in-memory state, so isolation needs
// a clean module instance (matches the resetModules pattern in tests/auth-config.test.ts).
beforeEach(async () => {
  vi.resetModules();
  mocks.delete.mockReset().mockReturnValue({ where: mocks.where });
  mocks.where.mockReset().mockResolvedValue(undefined);
  mocks.reportError.mockReset();
  ({ pruneStaleRateLimits, retentionCutoff } = await import("../src/modules/auth/services/rate-limit-retention"));
  ({ rateLimits } = await import("../src/db/schema"));
});

it("cuts off 24h before now", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  expect(retentionCutoff(now)).toBe(now - 24 * 60 * 60 * 1000);
});

it("puts the cutoff well before the longest active window (60s sign-in rule), never at or after it", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const cutoff = retentionCutoff(now);
  const oldestRowInAnyWindow = now - 60_000; // the sign-in rule's 60s window is the longest configured
  expect(cutoff).toBeLessThan(oldestRowInAnyWindow);
});

it("deletes only rows strictly older than the cutoff", async () => {
  const now = 1_800_000_000_000;
  await pruneStaleRateLimits(db, now);
  expect(mocks.delete).toHaveBeenCalledWith(rateLimits);
  const sql: SQL = mocks.where.mock.calls[0][0];
  const { sql: text, params } = new PgDialect().sqlToQuery(sql);
  expect(text).toContain('"rate_limit"."last_request" <');
  expect(params).toEqual([retentionCutoff(now)]); // strict "<": a row exactly at the cutoff survives
});

it("throttles the delete to at most once per hour per server instance", async () => {
  const t0 = 1_800_000_000_000;
  await pruneStaleRateLimits(db, t0);
  expect(mocks.delete).toHaveBeenCalledTimes(1);

  await pruneStaleRateLimits(db, t0 + 30 * 60 * 1000); // 30 min later: still throttled
  expect(mocks.delete).toHaveBeenCalledTimes(1);

  await pruneStaleRateLimits(db, t0 + 61 * 60 * 1000); // just past an hour: runs again
  expect(mocks.delete).toHaveBeenCalledTimes(2);
});

it("reports a failing delete instead of throwing into the caller", async () => {
  mocks.where.mockReset().mockRejectedValue(new Error("connection reset"));
  await expect(pruneStaleRateLimits(db, 1_900_000_000_000)).resolves.toBeUndefined();
  expect(mocks.reportError).toHaveBeenCalledWith("auth.rateLimitRetention", expect.any(Error));
});
