/** Read-only post-deploy checks (ADR-014, ADR-016). Sends no credentials and reads no secret. */
export type SmokeRow = { check: string; pass: boolean; detail: string };
type Fetch = (url: string, init: { redirect: "manual"; headers: Record<string, string> }) => Promise<Response>;

const SECURITY_HEADERS: Record<string, (value: string) => boolean> = {
  "strict-transport-security": (value) => /max-age=\d{7,}/.test(value),
  "x-frame-options": (value) => value.toUpperCase() === "DENY",
  "x-content-type-options": (value) => value === "nosniff",
  "referrer-policy": (value) => value === "strict-origin-when-cross-origin",
  "permissions-policy": (value) => value.includes("camera=()"),
};
const PAGE_CSP = ["script-src 'self' 'nonce-", "'strict-dynamic'", "connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "form-action 'self'"];
const NOINDEX_PATHS = ["/login", "/register", "/private", "/api/auth/get-session", "/portfolio", "/p/smoke-check"];
const PRIVATE_PATHS = ["/private", "/private/ideas", "/private/finance"];

export function normalizeBaseUrl(input: string | undefined) {
  if (!input) throw new Error("Pass the production URL: pnpm smoke https://<PRODUCTION_DOMAIN>");
  const url = new URL(input);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("The smoke check only runs against https URLs (or localhost).");
  return url.origin;
}

export function renderSmokeTable(rows: readonly SmokeRow[]): string[] {
  return ["  Result  Check", ...rows.map((row) => `  ${row.pass ? "PASS" : "FAIL"}    ${row.check}${row.pass ? "" : ` (${row.detail})`}`)];
}

export async function runSmoke(baseUrl: string, fetchImpl: Fetch): Promise<SmokeRow[]> {
  // An unreachable page answers 599, so every check on it fails instead of throwing.
  const get = (path: string) => fetchImpl(new URL(path, baseUrl).href, { redirect: "manual", headers: { "user-agent": "founder-os-smoke" } }).catch(() => new Response(null, { status: 599 }));
  const results: SmokeRow[] = [];
  const check = (name: string, pass: boolean, detail: string) => results.push({ check: name, pass, detail: pass ? "ok" : detail });

  const login = await get("/login");
  check("/login answers 200", login.status === 200, `status ${login.status}`);
  for (const [header, valid] of Object.entries(SECURITY_HEADERS)) {
    const value = login.headers.get(header);
    check(`/login ${header}`, value !== null && valid(value), value === null ? "missing" : `unexpected: ${value}`);
  }
  const csp = login.headers.get("content-security-policy") ?? "";
  const missing = PAGE_CSP.filter((part) => !csp.includes(part));
  check("/login CSP with a nonce", missing.length === 0, csp ? `missing ${missing.join(", ")}` : "missing");
  check("/login caches privately", /no-store/.test(login.headers.get("cache-control") ?? ""), "no no-store");

  for (const path of NOINDEX_PATHS) {
    const response = path === "/login" ? login : await get(path);
    check(`${path} noindex`, /noindex/.test(response.headers.get("x-robots-tag") ?? ""), "no X-Robots-Tag noindex");
  }

  for (const path of PRIVATE_PATHS) {
    const response = await get(path);
    const location = response.headers.get("location");
    const target = location ? new URL(location, baseUrl) : null;
    const ok = response.status === 307 && target?.origin === baseUrl && target.pathname === "/login" && target.searchParams.get("next") === path;
    check(`anonymous ${path} → /login?next=`, ok, `status ${response.status}, location ${location ?? "none"}`);
  }

  const portfolio = await get("/portfolio");
  check("/portfolio is public (200, no sign-in)", portfolio.status === 200, `status ${portfolio.status}`);

  const register = await get("/register");
  check("/register is closed", register.status === 200 && (await register.text()).includes("Registration is closed"), `status ${register.status} without the closed notice`);

  const session = await get("/api/auth/get-session");
  const body = session.status === 200 ? (await session.text()).trim() : "";
  check("anonymous session is null", body === "null", `status ${session.status}`);
  check("auth API CSP", (session.headers.get("content-security-policy") ?? "").includes("default-src 'none'"), "no default-src 'none'");
  return results;
}
