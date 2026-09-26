import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { e2eBaseUrl } from "../e2e-env";
import { withE2eDb } from "./helpers";

// Better Auth rate limiting is on only in production builds: CI serves `next start`, local runs `next dev` (playwright.config.ts).
test.skip(!process.env.CI, "Rate limiting is enabled only in production builds; run with CI=1 after pnpm build.");

// `next start` keeps a client-sent x-forwarded-for, so each test run gets its own `ip|/sign-in/email` bucket
// and never spends the budget of the owner sign-in in auth.setup (socket IP).
const testNetIp = (block: 18 | 19) => `198.${block}.${randomInt(256)}.${randomInt(1, 255)}`;

test("the 6th rapid failed sign-in from one IP within a minute gets 429, counted in the database", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: e2eBaseUrl, storageState: { cookies: [], origins: [] } });
  const signIn = (ip: string) => api.post("/api/auth/sign-in/email", {
    headers: { origin: e2eBaseUrl, "x-forwarded-for": ip },
    data: { email: "rate-limit-probe@e2e.test", password: "not-the-password-0123" },
  });
  try {
    const ip = testNetIp(18);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) statuses.push((await signIn(ip)).status());
    expect(statuses).toEqual([401, 401, 401, 401, 401]);

    const limited = await signIn(ip);
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()["x-retry-after"])).toBeGreaterThan(0);

    // Database storage (not per-instance memory): the counter is a row every serverless instance reads.
    const counts = await withE2eDb(async (sql) => (await sql<{ count: number }[]>`SELECT count FROM rate_limit WHERE key = ${`${ip}|/sign-in/email`}`).map((row) => row.count));
    expect(counts).toEqual([5]);

    // The limit is per client IP: another address is still answered normally.
    expect((await signIn(testNetIp(19))).status()).toBe(401);
  } finally {
    await api.dispose();
  }
});
