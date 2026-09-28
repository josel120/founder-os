// ADR-023 / T-099: the owner switches the interface to Spanish and back; their own records never change.
import { expect, test } from "@playwright/test";
import { e2eOwner } from "../e2e-env";
import { ready, unique, withE2eDb } from "./helpers";

test("ES translates the header and a module page, survives a reload, and EN switches back", async ({ page }) => {
  const title = `E2E idioma idea ${unique()}`;
  await withE2eDb(async (sql) => {
    const [owner] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
    await sql`INSERT INTO idea (owner_id, title, description, status) VALUES (${owner!.id}, ${title}, 'Owner text stays as written.', 'PAUSED')`;
  });

  await ready(page, page.goto("/private/ideas"));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const language = page.getByRole("group", { name: "Language" });
  await language.getByRole("button", { name: "Español" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const nav = page.getByRole("navigation", { name: "Espacio de trabajo" });
  await expect(nav.getByRole("link", { name: "Problemas" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Finanzas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exportar datos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  const card = page.locator("article", { hasText: title });
  await expect(card.getByText(title)).toBeVisible(); // the owner's title is never translated
  await expect(card.getByText("Pausada", { exact: true })).toBeVisible(); // idea status, feminine form

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("group", { name: "Idioma" }).getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("group", { name: "Idioma" }).getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Problems" })).toBeVisible();
  await expect(page.locator("article", { hasText: title }).getByText("Paused", { exact: true })).toBeVisible();
});
