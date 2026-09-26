import { defineConfig, devices } from "@playwright/test";
import { e2eAuthSecret, e2eBaseUrl, e2eDatabaseUrl, e2eOwner, e2eSetupToken, e2eStorageState, requireDisposableDatabase } from "./tests/e2e/e2e-env";

// Authenticated tests run only with E2E_DATABASE_URL (a *_e2e database). The server is then pointed at it
// explicitly, so a local run can never use the real database from .env.local.
const authenticated = Boolean(e2eDatabaseUrl);
const serverEnv: Record<string, string> = authenticated
  ? { DATABASE_URL: requireDisposableDatabase(), OWNER_EMAIL: e2eOwner.email, OWNER_SETUP_TOKEN: e2eSetupToken, BETTER_AUTH_SECRET: e2eAuthSecret, BETTER_AUTH_URL: e2eBaseUrl }
  : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  globalTimeout: 180_000,
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: { baseURL: e2eBaseUrl, trace: "retain-on-failure" },
  webServer: {
    // Run next directly (on PATH via `pnpm test:e2e`): a pnpm wrapper may not forward SIGTERM, leaving the server alive and teardown hung.
    command: process.env.CI ? "next start" : "next dev",
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI && !authenticated,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    env: serverEnv,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /authenticated\//,
      // A fresh CI database has no `rate_limit` table until `migrate` runs; without this dependency
      // an anonymous /api/auth/* request can race the migration and get a 500 (T-060).
      dependencies: authenticated ? ["migrate"] : [],
      use: { ...devices["Desktop Chrome"] },
    },
    ...(authenticated
      ? [
          { name: "migrate", testMatch: /migrate\.setup\.ts/ },
          { name: "setup", testMatch: /authenticated\/auth\.setup\.ts/, dependencies: ["migrate"] },
          { name: "authenticated", testMatch: /\.auth\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], storageState: e2eStorageState } },
        ]
      : []),
  ],
});
