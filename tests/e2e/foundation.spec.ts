import { test, expect } from "@playwright/test";

test("public foundation page renders without private data", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Founder OS", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build deliberately." }),
  ).toBeVisible();
});
