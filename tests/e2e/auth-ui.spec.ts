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

test("login prevents repeat submission and shows pending state", async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route("**/api/auth/sign-in/email", async (route) => {
    requests++;
    await pending;
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid email or password" }) });
  });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(requests).toBe(1);
});

test("registration is closed and offers no signup form", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Registration is closed" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("responses carry security headers", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["x-powered-by"]).toBeUndefined();
});
