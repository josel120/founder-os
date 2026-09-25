import { expect, test, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eOwner, e2eSetupToken } from "../e2e-env";

// Interacting before React hydrates lets hydration reset controlled inputs; wait for the page to settle first.
async function ready(page: Page, action: Promise<unknown>) {
  await action;
  await page.waitForLoadState("networkidle");
}

const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function captureIdea(page: Page, title: string) {
  await ready(page, page.goto("/private/ideas"));
  await page.getByLabel("Idea", { exact: true }).fill(title);
  await page.getByRole("button", { name: "+ Capture idea" }).click();
  await expect(page.getByText("Idea saved privately to your inbox.")).toBeVisible();
}

test("captured ideas appear in the private inbox", async ({ page }) => {
  const title = `E2E idea ${unique()}`;
  await captureIdea(page, title);
  await ready(page, page.reload());
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("idea status changes persist after reload", async ({ page }) => {
  const title = `E2E status ${unique()}`;
  await captureIdea(page, title);
  await ready(page, page.reload());
  await page.getByRole("link", { name: title }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByLabel("Status").selectOption("RESEARCHING");
  await expect(page.getByLabel("Status")).toHaveValue("RESEARCHING");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await ready(page, page.reload());
  await expect(page.getByLabel("Status")).toHaveValue("RESEARCHING");
});

test("idea content edits persist and decisions stay with their idea", async ({ page }) => {
  const firstTitle = `E2E editable ${unique()}`;
  const secondTitle = `E2E separate ${unique()}`;
  await captureIdea(page, firstTitle);
  await captureIdea(page, secondTitle);

  await ready(page, page.reload());
  await page.getByRole("link", { name: firstTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByLabel("Title", { exact: true }).fill(`${firstTitle} refined`);
  await page.getByLabel("Description", { exact: true }).fill("A persisted description");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText("Idea updated.")).toBeVisible();
  await ready(page, page.reload());
  await expect(page.getByRole("heading", { name: `${firstTitle} refined` })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: "A persisted description" })).toBeVisible();
  await ready(page, page.goto("/private/ideas"));
  await expect(page.getByRole("link", { name: `${firstTitle} refined` })).toBeVisible();
  await page.getByRole("link", { name: `${firstTitle} refined` }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));

  const decision = `E2E isolated decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Interview the target user");
  await page.getByLabel("Why").fill("Validate the refined idea");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await ready(page, page.goto("/private/decisions"));
  await expect(page.getByText(decision)).toBeVisible();

  await ready(page, page.goto("/private/ideas"));
  await page.getByRole("link", { name: secondTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await expect(page.getByText(decision)).not.toBeVisible();
});

test("an idea converts into a private project with an isolated decision log", async ({ page, browser }) => {
  const ideaTitle = `E2E project idea ${unique()}`;
  await captureIdea(page, ideaTitle);
  await ready(page, page.reload());
  await page.getByRole("link", { name: ideaTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByRole("button", { name: "Turn into project" }).click();
  await ready(page, page.waitForURL(/\/private\/projects\/[0-9a-f-]{36}$/));
  await expect(page.getByRole("heading", { name: ideaTitle })).toBeVisible();
  await expect(page.locator("dl").getByText("Planning", { exact: true })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(`${ideaTitle} edited`);
  await page.getByLabel("Description", { exact: true }).fill("A project description that survives reload");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project updated.")).toBeVisible();

  await page.locator('select[name="lifecycle"]').selectOption("BETA");
  await page.locator('select[name="operationalStatus"]').selectOption("WAITING_REVIEW");
  await page.locator('input[name="waitingReason"]').fill("Review the beta onboarding flow");
  await page.locator('input[name="waitingSince"]').fill("2026-09-24");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Status saved.")).toBeVisible();

  const projectUrl = page.url();
  await ready(page, page.reload());
  await expect(page.getByRole("heading", { name: `${ideaTitle} edited` })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: "A project description that survives reload" })).toBeVisible();
  await expect(page.locator('select[name="lifecycle"]')).toHaveValue("BETA");
  await expect(page.locator('select[name="operationalStatus"]')).toHaveValue("WAITING_REVIEW");
  await expect(page.locator('input[name="waitingReason"]')).toHaveValue("Review the beta onboarding flow");

  const decision = `E2E project decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Ship the smallest useful version");
  await page.getByLabel("Why").fill("Keep the first release focused");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await ready(page, page.reload());
  await expect(page.getByText(decision)).toBeVisible();

  await ready(page, page.goto("/private/ideas"));
  const secondIdeaTitle = `E2E second project ${unique()}`;
  await captureIdea(page, secondIdeaTitle);
  await ready(page, page.reload());
  await page.getByRole("link", { name: secondIdeaTitle }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await page.getByRole("button", { name: "Turn into project" }).click();
  await ready(page, page.waitForURL(/\/private\/projects\/[0-9a-f-]{36}$/));
  await expect(page.getByText(decision)).not.toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto(projectUrl);
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await anonymous.close();
});

test("a problem becomes a linked idea that records decisions", async ({ page, browser }) => {
  const title = `E2E problem ${unique()}`;
  await ready(page, page.goto("/private/problems"));
  await page.getByLabel("Problem", { exact: true }).fill(title);
  await page.getByLabel("Who experiences it and why does it matter?").fill("Founders lose context between tools");
  await page.getByRole("button", { name: "Capture problem" }).click();
  await expect(page.getByText("Problem saved privately.")).toBeVisible();
  await ready(page, page.reload());
  await page.locator("article", { hasText: title }).getByRole("button", { name: "Turn into idea" }).click();
  await ready(page, page.waitForURL(/\/private\/ideas\/[0-9a-f-]{36}$/));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("From problem:")).toBeVisible();
  const ideaUrl = page.url();

  const decision = `E2E decision ${unique()}`;
  await page.getByLabel("What was decided about?").fill(decision);
  await page.getByLabel("Decision", { exact: true }).fill("Interview five founders first");
  await page.getByLabel("Why").fill("Cheapest way to validate the problem");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Decision recorded privately.")).toBeVisible();
  await ready(page, page.goto("/private/decisions"));
  await expect(page.getByText(decision)).toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto(ideaUrl);
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await anonymous.close();
});

test("Finance records private income and expenses with project context", async ({ page, browser }) => {
  const projectName = `E2E finance project ${unique()}`;
  await ready(page, page.goto("/private/projects"));
  await page.locator('input[name="name"]').fill(projectName);
  await page.locator('input[name="slug"]').fill(`finance-${unique()}`);
  await page.getByRole("button", { name: "+ Create project" }).click();
  await expect(page.getByText("Project created privately.")).toBeVisible();

  await ready(page, page.goto("/private/finance"));
  await expect(page.locator('select[name="projectId"] option', { hasText: projectName })).toHaveCount(1);
  await page.locator('input[name="amount"]').fill("12.3400");
  await page.locator('input[name="category"]').fill("Hosting");
  await page.locator('input[name="source"]').fill("Cloud provider");
  await page.locator('input[name="occurredAt"]').fill("2026-09-24T12:00");
  await page.locator('select[name="projectId"]').selectOption({ label: projectName });
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.getByText("Transaction recorded privately.")).toBeVisible();

  await page.locator('select[name="type"]').selectOption("INCOME");
  await page.locator('input[name="amount"]').fill("99.9900");
  await page.locator('input[name="category"]').fill("First sale");
  await page.locator('input[name="source"]').fill("Customer");
  await page.locator('input[name="occurredAt"]').fill("2026-09-25T09:30");
  await page.locator('select[name="projectId"]').selectOption("");
  await page.getByRole("button", { name: "Record transaction" }).click();
  await expect(page.getByText("Transaction recorded privately.")).toBeVisible();

  await ready(page, page.reload());
  await expect(page.getByText("12.3400 USD")).toBeVisible();
  await expect(page.getByText("99.9900 USD")).toBeVisible();
  await expect(page.getByText(`Project: ${projectName}`)).toBeVisible();
  await expect(page.getByText("Cloud provider")).toBeVisible();
  await expect(page.getByText("Customer")).toBeVisible();

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const stranger = await anonymous.newPage();
  await stranger.goto("/private/finance");
  await expect(stranger).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(stranger.locator('input[name="amount"]')).toHaveCount(0);
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
