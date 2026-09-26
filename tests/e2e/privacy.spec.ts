import { test, expect } from "@playwright/test";

const routes = [
  { path: "/private", privateField: '[aria-labelledby="home-projects"]' },
  { path: "/private/problems/00000000-0000-4000-8000-000000000003", privateField: 'input[name="problemId"]' },
  { path: "/private/ideas", privateField: 'input[name="ideaId"]' },
  { path: "/private/ideas/00000000-0000-4000-8000-000000000001", privateField: 'input[name="ideaId"]' },
  { path: "/private/projects", privateField: 'input[name="projectId"]' },
  { path: "/private/projects/00000000-0000-4000-8000-000000000002", privateField: 'input[name="projectId"]' },
  { path: "/private/finance", privateField: 'input[name="amount"]' },
  { path: "/private/research", privateField: 'select[name="parent"]' },
] as const;

for (const route of routes) {
  test(`anonymous visitors cannot access ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(route.path);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator(route.privateField)).toHaveCount(0);
  });
}
