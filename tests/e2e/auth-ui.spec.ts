import { expect, test } from "@playwright/test";

test("login preserves input and allows retry after a connection failure", async ({ page }) => {
  await page.route("**/api/auth/sign-in/email", (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("owner@example.com");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

test("register prevents repeat submission and shows pending state", async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route("**/api/auth/sign-up/email", async (route) => {
    requests++;
    await pending;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Registration unavailable" }) });
  });
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Test Owner");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  try {
    await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(requests).toBe(1);
});
