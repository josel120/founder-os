// @vitest-environment node
import { expect, it } from "vitest";
import { normalizeBaseUrl, renderSmokeTable, runSmoke } from "../scripts/smoke-lib";

const base = "https://founder.example";
// Headers as the production deploy sent them on 2026-09-27.
const pageHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

function deployment(overrides: Record<string, (path: string) => Response> = {}) {
  const calls: { url: string; redirect: string }[] = [];
  const fetchImpl = async (url: string, init: { redirect: "manual" }) => {
    calls.push({ url, redirect: init.redirect });
    const path = new URL(url).pathname;
    if (overrides[path]) return overrides[path](path);
    if (path.startsWith("/private")) return new Response(null, { status: 307, headers: { ...pageHeaders, location: `${base}/login?next=${encodeURIComponent(path)}` } });
    if (path === "/api/auth/get-session") return new Response("null", { headers: { "content-security-policy": "default-src 'none'; frame-ancestors 'none'", "x-robots-tag": "noindex, nofollow" } });
    if (path === "/register") return new Response("<h1>Registration is closed</h1>", { headers: pageHeaders });
    return new Response("<form></form>", { headers: pageHeaders });
  };
  return { calls, fetchImpl };
}
const failures = async (fetchImpl: ReturnType<typeof deployment>["fetchImpl"]) => (await runSmoke(base, fetchImpl)).filter((row) => !row.pass).map((row) => row.check);

it("passes a deployment that matches production, without following redirects", async () => {
  const { calls, fetchImpl } = deployment();
  expect(await failures(fetchImpl)).toEqual([]);
  expect(calls.every((call) => call.redirect === "manual" && call.url.startsWith(`${base}/`))).toBe(true);
});

it("fails when a private page renders instead of redirecting to login", async () => {
  const { fetchImpl } = deployment({ "/private/finance": () => new Response("<h1>Ledger</h1>", { headers: pageHeaders }) });
  expect(await failures(fetchImpl)).toEqual(["anonymous /private/finance → /login?next="]);
});

it("accepts a relative redirect but fails one that leaves the site or drops the next path", async () => {
  const { fetchImpl } = deployment({
    "/private": () => new Response(null, { status: 307, headers: { ...pageHeaders, location: "https://evil.example/login?next=/private" } }),
    "/private/ideas": () => new Response(null, { status: 307, headers: { ...pageHeaders, location: `${base}/login` } }),
    "/private/finance": () => new Response(null, { status: 307, headers: { ...pageHeaders, location: "/login?next=%2Fprivate%2Ffinance" } }),
  });
  expect(await failures(fetchImpl)).toEqual(["anonymous /private → /login?next=", "anonymous /private/ideas → /login?next="]);
});

it("fails on missing security headers, a CSP without a nonce, indexable pages and open registration", async () => {
  const weaker: Record<string, string> = { ...pageHeaders };
  delete weaker["x-frame-options"];
  const { fetchImpl } = deployment({
    "/login": () => new Response("", { headers: { ...weaker, "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'", "x-robots-tag": "all" } }),
    "/register": () => new Response("<form>Create account</form>", { headers: pageHeaders }),
  });
  expect(await failures(fetchImpl)).toEqual(["/login x-frame-options", "/login CSP with a nonce", "/login noindex", "/register is closed"]);
});

it("fails when the session endpoint answers for someone", async () => {
  const { fetchImpl } = deployment({ "/api/auth/get-session": () => new Response('{"user":{}}', { headers: { "x-robots-tag": "noindex" } }) });
  expect(await failures(fetchImpl)).toEqual(["anonymous session is null", "auth API CSP"]);
});

it("only accepts an https origin (or localhost) as the target", () => {
  expect(normalizeBaseUrl("https://founder.example/login?x=1")).toBe(base);
  expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  expect(() => normalizeBaseUrl("http://founder.example")).toThrow("https");
  expect(() => normalizeBaseUrl(undefined)).toThrow("pnpm smoke");
});

it("fails every check on a deployment it cannot reach, and prints why", async () => {
  const rows = await runSmoke(base, async () => { throw new Error("offline"); });
  expect(rows.every((row) => !row.pass)).toBe(true);
  expect(renderSmokeTable(rows)[1]).toBe("  FAIL    /login answers 200 (status 599)");
});
