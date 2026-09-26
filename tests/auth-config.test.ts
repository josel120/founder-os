import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { getTableColumns, getTableName, type Table } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  configure: vi.fn<(options: BetterAuthOptions) => object>(() => ({})),
  adapter: vi.fn<(db: unknown, config: { schema: Record<string, Table> }) => object>(() => ({})),
  env: {
    BETTER_AUTH_SECRET: "test-auth-secret-not-for-production-123456",
    BETTER_AUTH_URL: "http://localhost:3000",
    OWNER_EMAIL: "owner@example.com",
    OWNER_SETUP_TOKEN: undefined,
  },
}));
vi.mock("better-auth", () => ({ betterAuth: mocks.configure, APIError: class extends Error {} }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: mocks.adapter }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("../src/lib/env", () => ({ env: mocks.env }));

beforeEach(() => {
  vi.resetModules();
  mocks.configure.mockClear();
  mocks.adapter.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

async function configuration(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  await import("../src/lib/auth");
  const options = mocks.configure.mock.calls[0]?.[0];
  const adapterSchema = mocks.adapter.mock.calls[0]?.[1].schema;
  if (!options || !adapterSchema) throw new Error("Better Auth was not configured.");
  return { options, adapterSchema };
}

it("stores rate limits in the database with a strict sign-in rule, enabled in production", async () => {
  const { options } = await configuration("production");
  expect(options.rateLimit).toEqual({
    enabled: true,
    storage: "database",
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  });
});

it("leaves rate limiting off outside production, as Better Auth does by default", async () => {
  const { options } = await configuration("development");
  expect(options.rateLimit?.enabled).toBe(false);
  expect(options.rateLimit?.storage).toBe("database");
});

it("pins the 7-day session with a 1-day refresh and disables telemetry", async () => {
  const { options } = await configuration("production");
  expect(options.session).toEqual({ expiresIn: 604_800, updateAge: 86_400 });
  expect(options.telemetry).toEqual({ enabled: false });
});

it("maps Better Auth's rateLimit model onto the snake_case rate_limit table", async () => {
  const { options, adapterSchema } = await configuration("production");
  const model = getAuthTables(options).rateLimit;
  if (!model) throw new Error("Better Auth expects no rateLimit table for this configuration.");
  const table = adapterSchema[model.modelName];
  if (!table) throw new Error(`The adapter schema has no "${model.modelName}" table.`);
  expect(getTableName(table)).toBe("rate_limit");
  const columns = getTableColumns(table);
  // The adapter addresses columns by property name: the generated id plus every field Better Auth writes.
  for (const field of ["id", ...Object.values(model.fields).map((attribute) => attribute.fieldName ?? "")]) {
    expect(columns, field).toHaveProperty(field);
  }
  expect(columns.key).toMatchObject({ name: "key", notNull: true, isUnique: true });
  expect(columns.count).toMatchObject({ name: "count", notNull: true, columnType: "PgInteger" });
  expect(columns.lastRequest).toMatchObject({ name: "last_request", notNull: true, columnType: "PgBigInt53" });
});

it("adds rate_limit with an additive migration 0007 after the existing journal", () => {
  const migrations = join(__dirname, "../src/db/migrations");
  const journal = JSON.parse(readFileSync(join(migrations, "meta/_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] };
  expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
  expect(journal.entries[7]?.tag).toBe("0007_rate_limit");
  const sqlText = readFileSync(join(migrations, "0007_rate_limit.sql"), "utf8");
  const statements = sqlText.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toMatch(/^CREATE TABLE "rate_limit" \(/);
  expect(statements[0]).toContain('CONSTRAINT "rate_limit_key_unique" UNIQUE("key")');
  expect(sqlText).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i);
});
