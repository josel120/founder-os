// ADR-023 / T-099: without a saved choice the browser's language decides; the switch works signed out too.
import { expect, test } from "@playwright/test";

test.describe("a Spanish browser", () => {
  test.use({ locale: "es-MX" });

  test("lands in Spanish on the home and sign-in pages without a cookie", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { name: "Construye con intención." })).toBeVisible();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Hola de nuevo" })).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  });
});

test("the switch on the sign-in page changes the language and keeps it on the next page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Hola de nuevo" })).toBeVisible();
  const cookie = (await page.context().cookies()).find((c) => c.name === "locale");
  expect(cookie).toMatchObject({ value: "es", httpOnly: true, sameSite: "Lax", path: "/" });
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "El registro está cerrado" })).toBeVisible();
});
