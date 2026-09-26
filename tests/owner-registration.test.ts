import { beforeEach, expect, it, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";

const mocks = vi.hoisted(() => ({
  configure: vi.fn<(options: BetterAuthOptions) => object>(() => ({})),
  rows: vi.fn(),
  env: {
    BETTER_AUTH_SECRET: "test-auth-secret-not-for-production-123456",
    BETTER_AUTH_URL: "http://localhost:3000",
    OWNER_EMAIL: "owner@example.com" as string | undefined,
    OWNER_SETUP_TOKEN: "test-setup-token-not-for-production-123456" as string | undefined,
  },
}));
vi.mock("better-auth", () => ({
  betterAuth: mocks.configure,
  APIError: class extends Error {
    constructor(_status: string, options: { message: string }) { super(options.message); }
  },
}));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.rows }) }) }) } }));
// Only `env` is replaced; pure helpers such as vercelOrigins stay real.
vi.mock("../src/lib/env", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/lib/env")>()), env: mocks.env }));

beforeEach(() => {
  vi.resetModules();
  mocks.configure.mockClear();
  mocks.rows.mockReset();
  mocks.rows.mockResolvedValue([]);
  mocks.env.OWNER_EMAIL = "owner@example.com";
  mocks.env.OWNER_SETUP_TOKEN = "test-setup-token-not-for-production-123456";
});

async function configuration() {
  await import("../src/lib/auth");
  return mocks.configure.mock.calls[0][0];
}
const user = { id: "owner-id", name: "Owner", email: "owner@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date() };

it.each(["OWNER_EMAIL", "OWNER_SETUP_TOKEN"] as const)("closes signup when %s is absent", async (key) => {
  mocks.env[key] = undefined;
  const options = await configuration();
  expect(options.emailAndPassword?.disableSignUp).toBe(true);
});

it.each(["absent", "wrong", "other-email", "correct"])("enforces setup token and owner email: %s", async (mode) => {
  const options = await configuration();
  const before = options.databaseHooks!.user!.create!.before!;
  const headers = new Headers();
  if (mode !== "absent") headers.set("x-founder-setup-token", mode === "wrong" ? "x".repeat(40) : mocks.env.OWNER_SETUP_TOKEN!);
  // The hook only consumes headers; the full Better Auth request context is not needed here.
  const context = { headers } as NonNullable<Parameters<typeof before>[1]>;
  const result = before({ ...user, email: mode === "other-email" ? "other@example.com" : "Owner@example.com" }, context);
  if (mode === "correct") await expect(result).resolves.toMatchObject({ data: { email: "owner@example.com" } });
  else await expect(result).rejects.toThrow("Registration is restricted.");
});

it.each(["owner@example.com", "other@example.com"])("checks account identity before session creation: %s", async (email) => {
  mocks.rows.mockResolvedValue([{ email }]);
  const options = await configuration();
  const before = options.databaseHooks!.session!.create!.before!;
  const session = { id: "session-id", token: "test-token", userId: "owner-id", expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
  if (email === "owner@example.com") await expect(before(session, null)).resolves.toEqual({ data: session });
  else await expect(before(session, null)).rejects.toThrow("Access is restricted.");
});

it("does not provision a second account for an existing owner", async () => {
  mocks.rows.mockResolvedValue([{ id: "existing-owner" }]);
  const options = await configuration();
  const before = options.databaseHooks!.user!.create!.before!;
  const context = { headers: new Headers({ "x-founder-setup-token": mocks.env.OWNER_SETUP_TOKEN! }) } as NonNullable<Parameters<typeof before>[1]>;
  await expect(before(user, context)).rejects.toThrow("Registration is restricted.");
});
