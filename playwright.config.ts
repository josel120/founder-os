import { defineConfig, devices } from "@playwright/test";
import { e2eAiKey, e2eAiStubPort, e2eAiStubUrl, e2eAuthSecret, e2eBaseUrl, e2eCronSecret, e2eDatabaseUrl, e2eGithubStubPort, e2eGithubStubUrl, e2eGithubToken, e2eOwner, e2eSetupToken, e2eStorageState, requireDisposableDatabase } from "./tests/e2e/e2e-env";

// Authenticated tests run only with E2E_DATABASE_URL (a *_e2e database). The server is then pointed at it
// explicitly, so a local run can never use the real database from .env.local.
const authenticated = Boolean(e2eDatabaseUrl);
const serverEnv: Record<string, string> = authenticated
  ? {
      DATABASE_URL: requireDisposableDatabase(), OWNER_EMAIL: e2eOwner.email, OWNER_SETUP_TOKEN: e2eSetupToken, BETTER_AUTH_SECRET: e2eAuthSecret, BETTER_AUTH_URL: e2eBaseUrl,
      // ADR-019: the app talks only to the local stub GitHub API (tests/e2e/github-stub.mjs), never the real GitHub.
      GITHUB_TOKEN: e2eGithubToken, GITHUB_API_URL: e2eGithubStubUrl, CRON_SECRET: e2eCronSecret,
      // ADR-021/024: AI runs go only to the local stub (tests/e2e/ai-stub.mjs) through the Groq path, never to a real provider.
      GROQ_API_KEY: e2eAiKey, AI_API_URL: e2eAiStubUrl,
    }
  : {};

const appServer = {
  // Run next directly (on PATH via `pnpm test:e2e`): a pnpm wrapper may not forward SIGTERM, leaving the server alive and teardown hung.
  command: process.env.CI ? "next start" : "next dev",
  url: e2eBaseUrl,
  reuseExistingServer: !process.env.CI && !authenticated,
  timeout: 120_000,
  gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 },
  env: serverEnv,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  globalTimeout: 180_000,
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: { baseURL: e2eBaseUrl, trace: "retain-on-failure" },
  webServer: authenticated
    ? [
        appServer,
        {
          command: "node tests/e2e/github-stub.mjs",
          url: `${e2eGithubStubUrl}/`,
          reuseExistingServer: false,
          timeout: 20_000,
          env: { GITHUB_STUB_PORT: String(e2eGithubStubPort), E2E_GITHUB_TOKEN: e2eGithubToken },
        },
        {
          command: "node tests/e2e/ai-stub.mjs",
          url: `${e2eAiStubUrl}/`,
          reuseExistingServer: false,
          timeout: 20_000,
          env: { AI_STUB_PORT: String(e2eAiStubPort), E2E_AI_KEY: e2eAiKey },
        },
      ]
    : appServer,
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
