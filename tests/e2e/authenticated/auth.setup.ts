import { expect, test as setup } from "@playwright/test";
import postgres from "postgres";
import { e2eBaseUrl, e2eOwner, e2eSetupToken, e2eStorageState, requireDisposableDatabase } from "../e2e-env";

// Migration runs once in the `migrate` project (tests/e2e/migrate.setup.ts), which this project
// depends on; this only truncates and seeds the owner.
setup("reset the disposable database and sign in as the owner", async ({ page, request }) => {
  const client = postgres(requireDisposableDatabase(), { max: 1, onnotice: () => {} });
  try {
    await client`TRUNCATE decision_log, idea, problem, session, account, verification, rate_limit, "user" CASCADE`;
  } finally {
    await client.end();
  }

  const signUp = await request.post("/api/auth/sign-up/email", {
    headers: { "x-founder-setup-token": e2eSetupToken, origin: e2eBaseUrl },
    data: { email: e2eOwner.email, password: e2eOwner.password, name: e2eOwner.name },
  });
  expect(signUp.ok()).toBe(true);

  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // let React hydrate before filling the form
  await page.getByLabel("Email", { exact: true }).fill(e2eOwner.email);
  await page.getByLabel("Password", { exact: true }).fill(e2eOwner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/private"); // owners land on the home (ADR-015)
  await page.context().storageState({ path: e2eStorageState });
});
