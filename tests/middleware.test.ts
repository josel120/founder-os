// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { contentSecurityPolicy, middleware } from "../src/middleware";
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

describe("content security policy (T-045)", () => {
  const nonceOf = (policy: string | null) => /'nonce-([^']+)'/.exec(policy ?? "")?.[1];

  it("gives every page response a fresh nonce and hands the same policy to Next.js through the request", () => {
    const first = middleware(request("/login"));
    const second = middleware(request("/private/ideas", { cookie: "better-auth.session_token=token" }));
    const policy = first.headers.get("content-security-policy");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("unsafe-eval");
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(nonceOf(policy)).toMatch(/^[A-Za-z0-9+/=]{24,}$/);
    expect(nonceOf(second.headers.get("content-security-policy"))).not.toBe(nonceOf(policy));
  });

  it("allows eval only for the development server's refresh runtime", () => {
    expect(contentSecurityPolicy("abc", true)).toContain("'nonce-abc' 'strict-dynamic' 'unsafe-eval'");
    expect(contentSecurityPolicy("abc", false)).not.toContain("unsafe-eval");
  });

  it("keeps the /private redirect and lets server actions through with the policy attached", () => {
    const redirect = middleware(request("/private/finance"));
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const action = middleware(request("/private/projects", { method: "POST", action: true }));
    expect(action.headers.get("location")).toBeNull();
    expect(action.headers.get("content-security-policy")).toContain("'strict-dynamic'");
  });

  it("does not treat look-alike paths as private", () => {
    expect(middleware(request("/privately")).headers.get("location")).toBeNull();
  });
});
