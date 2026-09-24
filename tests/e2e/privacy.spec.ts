import { test, expect } from "@playwright/test";
for (const route of ["/private/ideas", "/private/ideas/00000000-0000-4000-8000-000000000001"]) {
  test(`anonymous visitors cannot access ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[name="ideaId"]')).toHaveCount(0);
  });
}
