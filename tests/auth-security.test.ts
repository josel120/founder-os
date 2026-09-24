import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ headers: vi.fn(async () => new Headers()), getSession: vi.fn(), env: { OWNER_EMAIL: "owner@example.com" as string | undefined } }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("../src/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("../src/lib/env", () => ({ env: mocks.env }));
import { requireAuth } from "../src/lib/require-auth";

beforeEach(() => { vi.resetAllMocks(); mocks.headers.mockResolvedValue(new Headers()); mocks.env.OWNER_EMAIL = "owner@example.com"; });

it("fails closed when the owner has not been configured", async () => {
  mocks.env.OWNER_EMAIL = undefined;
  expect(await requireAuth()).toBeNull();
  expect(mocks.getSession).not.toHaveBeenCalled();
  // Reading request headers keeps private pages dynamic even when auth is unconfigured at build time.
  expect(mocks.headers).toHaveBeenCalled();
});

it("requires a session validated by Better Auth", async () => {
  mocks.getSession.mockResolvedValue(null);
  expect(await requireAuth()).toBeNull();
  mocks.getSession.mockResolvedValue({ user: { id: "owner", email: "Owner@example.com" } });
  expect(await requireAuth()).toEqual({ id: "owner" });
});

it("rejects existing sessions belonging to a different account", async () => {
  mocks.getSession.mockResolvedValue({ user: { id: "stranger", email: "stranger@example.com" } });
  expect(await requireAuth()).toBeNull();
});

it("does not grant access if session validation fails", async () => {
  mocks.getSession.mockRejectedValue(new Error("Session unavailable"));
  await expect(requireAuth()).rejects.toThrow("Session unavailable");
});
