import { expect, test, type Page } from "@playwright/test";
import { e2eOwner } from "../e2e-env";
import { captureServerAction, ready, replayAnonymously, retargetServerActions, unique, withE2eDb } from "./helpers";

// ADR-020: CSV imports are exact, idempotent, owner-scoped and undoable. Other specs run in parallel, so every run
// uses its own currency code and descriptions, and assertions never rely on totals across specs.
const letters = () => Array.from({ length: 2 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
const currency = () => `K${letters()}`; // K… is reserved for this spec

const ownerA = () => withE2eDb(async (sql) => {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${e2eOwner.email}`;
  if (!row) throw new Error("The E2E owner does not exist.");
  return row.id;
});
const ledger = (ownerId: string, code: string) => withE2eDb(async (sql) =>
  [...(await sql<{ type: string; amount: string; category: string; source: string }[]>`SELECT type, amount::text AS amount, category, source FROM finance_transaction WHERE owner_id = ${ownerId} AND currency = ${code} ORDER BY occurred_at, amount`)]);

const importPanel = (page: Page) => page.locator("div.workspace-panel", { has: page.getByRole("heading", { name: "Import from CSV" }) });
const historyPanel = (page: Page) => page.locator("div.workspace-panel", { has: page.getByRole("heading", { name: "Import history" }) });

async function uploadAndMap(page: Page, file: { name: string; body: string }, mapping: { date: string; format: string; amount: string; decimal: "Period (1.23)" | "Comma (1,23)"; description: string; code: string }) {
  await ready(page, page.goto("/private/finance"));
  const panel = importPanel(page);
  await panel.getByLabel("CSV file").setInputFiles({ name: file.name, mimeType: "text/csv", buffer: Buffer.from(file.body, "utf8") });
  await expect(panel.getByLabel("Date column")).toBeVisible();
  await panel.getByLabel("Date column").selectOption(mapping.date);
  await panel.getByLabel("Date format").selectOption(mapping.format);
  await panel.getByLabel("Amount column").selectOption(mapping.amount);
  await panel.getByLabel("Decimal separator").selectOption({ label: mapping.decimal });
  await panel.getByLabel("Description column").selectOption(mapping.description);
  await panel.getByRole("combobox", { name: "Currency", exact: true }).selectOption("fixed");
  await panel.getByLabel("Currency code").fill(mapping.code);
  await panel.getByRole("button", { name: "Preview" }).click();
  return panel;
}
const counts = async (panel: ReturnType<typeof importPanel>) => Object.fromEntries(await Promise.all(["New", "Already imported", "Errors"].map(async (label) => [label, await panel.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd").innerText()])));

test("a Spanish bank export imports exactly once, shows in the ledger, and undo removes only that import", async ({ page }) => {
  const owner = await ownerA();
  const code = currency();
  const id = unique();
  const body = `Fecha;Concepto;Importe\n01/09/2026;Café ${id};-3,50\n01/09/2026;Café ${id};-3,50\n02/09/2026;Nómina ${id};1.234,56\n31/02/2026;Fecha imposible ${id};-1,00\n`;
  const file = { name: `banco-${id}.csv`, body };
  const mapping = { date: "Fecha", format: "DD/MM/YYYY", amount: "Importe", decimal: "Comma (1,23)" as const, description: "Concepto", code };

  let panel = await uploadAndMap(page, file, mapping);
  await expect.poll(() => counts(panel)).toEqual({ New: "3", "Already imported": "0", Errors: "1" });
  await expect(panel.getByText("Line 5: ")).toBeVisible();
  expect(await ledger(owner, code)).toEqual([]); // the preview writes nothing
  await panel.getByRole("button", { name: "Import 3 transactions" }).click();
  await expect(panel.getByText("Import 3 transactions into your private ledger?")).toBeVisible();
  await panel.getByRole("button", { name: "Confirm" }).click();
  await expect(panel.getByRole("status")).toHaveText("Imported 3, skipped 1.");
  expect(await ledger(owner, code)).toEqual([
    { type: "EXPENSE", amount: "3.5000", category: `Café ${id}`, source: "CSV import" },
    { type: "EXPENSE", amount: "3.5000", category: `Café ${id}`, source: "CSV import" },
    { type: "INCOME", amount: "1234.5600", category: `Nómina ${id}`, source: "CSV import" },
  ]);
  await expect(page.getByRole("region", { name: "Totals by currency" }).getByText(code)).toBeVisible();
  await expect(historyPanel(page).getByText(file.name)).toBeVisible();

  // Importing the same file again adds nothing.
  panel = await uploadAndMap(page, file, mapping);
  await expect.poll(() => counts(panel)).toEqual({ New: "0", "Already imported": "3", Errors: "1" });
  await expect(panel.getByRole("button", { name: "Import 0 transactions" })).toBeDisabled();
  expect(await ledger(owner, code)).toHaveLength(3);

  const item = historyPanel(page).getByRole("listitem").filter({ hasText: file.name });
  await item.getByRole("button", { name: "Undo" }).click();
  await expect(item.getByText("Remove the 3 transactions from this import?")).toBeVisible();
  await item.getByRole("button", { name: "Confirm" }).click();
  await expect(historyPanel(page).getByRole("status")).toHaveText("Removed 3 transactions.");
  expect(await ledger(owner, code)).toEqual([]);
});

test("a US export with period decimals and month-first dates imports exact amounts", async ({ page }) => {
  const owner = await ownerA();
  const code = currency();
  const id = unique();
  const body = `Date,Description,Amount\n"09/30/2026","Stripe payout, ${id}","2,500.10"\n"09/29/2026","Hosting ""pro"" ${id}",(19.99)\n`;
  const panel = await uploadAndMap(page, { name: `us-${id}.csv`, body }, { date: "Date", format: "MM/DD/YYYY", amount: "Amount", decimal: "Period (1.23)", description: "Description", code });
  await expect.poll(() => counts(panel)).toEqual({ New: "2", "Already imported": "0", Errors: "0" });
  await panel.getByRole("button", { name: "Import 2 transactions" }).click();
  await panel.getByRole("button", { name: "Confirm" }).click();
  await expect(panel.getByRole("status")).toHaveText("Imported 2, skipped 0.");
  expect(await ledger(owner, code)).toEqual([
    { type: "EXPENSE", amount: "19.9900", category: `Hosting "pro" ${id}`, source: "CSV import" },
    { type: "INCOME", amount: "2500.1000", category: `Stripe payout, ${id}`, source: "CSV import" },
  ]);
});

test("owner B's imports never show for A, A cannot undo them, and anonymous imports are refused", async ({ page }) => {
  const owner = await ownerA();
  const id = unique();
  const otherOwner = `e2e-import-b-${id}`;
  const otherFile = `owner-b-${id}.csv`;
  const otherCode = currency();
  const otherImport = await withE2eDb(async (sql) => {
    await sql`INSERT INTO "user" (id, name, email) VALUES (${otherOwner}, 'E2E Owner B', ${`${otherOwner}@e2e.test`})`;
    const [batch] = await sql<{ id: string }[]>`INSERT INTO finance_import (owner_id, file_name, row_count, imported_count, skipped_count) VALUES (${otherOwner}, ${otherFile}, 1, 1, 0) RETURNING id`;
    await sql`INSERT INTO finance_transaction (owner_id, type, category, amount, currency, source, occurred_at, visibility, import_id, import_key)
      VALUES (${otherOwner}, 'EXPENSE', ${`Owner B row ${id}`}, '1.00', ${otherCode}, 'CSV import', now(), 'PRIVATE', ${batch!.id}, ${`row:${id}`})`;
    return batch!.id;
  });

  // A imports a file of its own so there is an Undo button to retarget.
  const code = currency();
  const file = { name: `mine-${id}.csv`, body: `date,amount,description\n2026-09-01,-5.00,Mine ${id}\n` };
  const panel = await uploadAndMap(page, file, { date: "date", format: "YYYY-MM-DD", amount: "amount", decimal: "Period (1.23)", description: "description", code });
  await expect.poll(() => counts(panel)).toEqual({ New: "1", "Already imported": "0", Errors: "0" });
  // The same content as owner B's row is still "new" for A: keys are per owner.
  await panel.getByRole("button", { name: "Import 1 transaction" }).click();
  await panel.getByRole("button", { name: "Confirm" }).click();
  await expect(panel.getByRole("status")).toHaveText("Imported 1, skipped 0.");
  await expect(page.getByText(otherFile)).toHaveCount(0);
  await expect(page.getByText(`Owner B row ${id}`)).toHaveCount(0);

  const myImportId = await withE2eDb(async (sql) => (await sql<{ id: string }[]>`SELECT id FROM finance_import WHERE owner_id = ${owner} AND file_name = ${file.name}`)[0]!.id);
  await ready(page, page.goto("/private/finance"));
  const retargeted = await retargetServerActions(page, myImportId, otherImport);
  const item = historyPanel(page).getByRole("listitem").filter({ hasText: file.name });
  await item.getByRole("button", { name: "Undo" }).click();
  await item.getByRole("button", { name: "Confirm" }).click();
  await expect(historyPanel(page).getByRole("alert")).toHaveText("Import not found.");
  expect(retargeted.count).toBe(1);
  await page.unroute("**/*");
  expect(await ledger(otherOwner, otherCode)).toHaveLength(1);

  // Choosing a file sends the first preview; replayed without cookies it must be refused like every import action.
  await ready(page, page.goto("/private/finance"));
  const anonymous = await captureServerAction(page, async () => {
    await importPanel(page).getByLabel("CSV file").setInputFiles({ name: `anon-${id}.csv`, mimeType: "text/csv", buffer: Buffer.from(`date,amount,description\n2026-09-02,-1.00,Anon ${id}\n`, "utf8") });
  });
  const replay = await replayAnonymously(anonymous);
  expect(replay.status).toBe(200);
  expect(replay.body).toContain("Sign in again to import.");
  expect(replay.body).not.toContain('"ok":true');
});
