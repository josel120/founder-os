import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  globalTimeout: 180_000,
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    // Run next directly (on PATH via `pnpm test:e2e`): a pnpm wrapper may not forward SIGTERM, leaving the server alive and teardown hung.
    command: process.env.CI ? "next start" : "next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
