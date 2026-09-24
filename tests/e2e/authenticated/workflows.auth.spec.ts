import { expect, test, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eOwner, e2eSetupToken } from "../e2e-env";

const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function captureIdea(page: Page, title: string) {
  await page.goto("/private/ideas");
  await page.getByLabel("Idea", { exact: true }).fill(title);
  await page.getByRole("button", { name: "+ Capture idea" }).click();
  await expect(page.getByText("Idea saved privately to your inbox.")).toBeVisible();
}

test("captured ideas appear in the private inbox", async ({ page }) => {
  const title = `E2E idea ${unique()}`;
  await captureIdea(page, title);
  await page.reload();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("idea status changes persist after reload", async ({ page }) => {
  const title = `E2E status ${unique()}`;
  await captureIdea(page, title);
  await page.reload();
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Status").selectOption("RESEARCHING");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("RESEARCHING");
});

test("a problem becomes a linked idea that records decisions", async ({ page, browser }) => {
  const title = `E2E problem ${unique()}`;
  await page.goto("/private/problems");
  await page.getByLabel("Problem", { exact: true }).fill(title);
  await page.getByLabel("Who experiences it and why does it matter?").fill("Founders lose context between tools");
  await page.getByRole("button", { name: "Capture problem" }).click();
  await expect(page.getByText("Problem saved privately.")).toBeVisible();
  await page.reload();
  await page.locator("article", { hasText: title }).getByRole("button", { name: "Turn into idea" }).click();
  await page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("From problem:")).toBeVisible();
  const ideaUrl = page.url();

  const decision = `E2E decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Interview five founders first");
  await page.getByLabel("Why").fill("Cheapest way to validate the problem");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await page.goto("/private/decisions");
  await expect(page.getByText(decision)).toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto(ideaUrl);
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await anonymous.close();
});

test("closed registration rejects other accounts and a second owner", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: e2eBaseUrl });
  for (const email of ["intruder@e2e.test", e2eOwner.email]) {
    const response = await api.post("/api/auth/sign-up/email", {
      headers: { "x-founder-setup-token": e2eSetupToken, origin: e2eBaseUrl },
      data: { email, password: "another-password-0123", name: "Someone else" },
    });
    expect(response.ok()).toBe(false);
  }
  const intruder = await api.post("/api/auth/sign-in/email", {
    headers: { origin: e2eBaseUrl },
    data: { email: "intruder@e2e.test", password: "another-password-0123" },
  });
  expect(intruder.ok()).toBe(false);
  await api.dispose();
});
