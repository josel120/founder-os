// @vitest-environment node
import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { middleware } from "../src/middleware";
import { hasSessionCookie } from "../src/lib/session-cookie";

const origin = "http://localhost:3000";
function request(path: string, init: { method?: string; cookie?: string; action?: boolean } = {}) {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.action) headers.set("next-action", "abc123");
  return new NextRequest(new URL(path, origin), { method: init.method ?? "GET", headers });
}

it("redirects cookieless page requests to login and remembers where the owner was going", () => {
  const response = middleware(request("/private/projects/00000000-0000-4000-8000-000000000002?tab=x"));
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe("/private/projects/00000000-0000-4000-8000-000000000002?tab=x");
});

it.each(["better-auth.session_token=token", "__Secure-better-auth.session_token=token"])("lets requests with %s through to the server-side session check", (cookie) => {
  const response = middleware(request("/private/ideas", { cookie }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

it("never redirects server action POSTs, so they return explicit results", () => {
  const response = middleware(request("/private/projects", { method: "POST", action: true }));
  expect(response.headers.get("location")).toBeNull();
});

it.each([
  "better-auth.session_token=token", "__Secure-better-auth.session_token=token", "better-auth.session_token=",
  "better-auth-session_token=legacy", "other=1", "better-auth.session_data=cache", "",
])("agrees with Better Auth's own cookie helper for %j", (cookie) => {
  const headers = new Headers(cookie ? { cookie } : {});
  expect(hasSessionCookie(request("/private/ideas", { cookie }).cookies)).toBe(Boolean(getSessionCookie(headers)));
});
