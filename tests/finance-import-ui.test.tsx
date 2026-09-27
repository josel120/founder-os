import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImportCsv } from "../src/modules/finance/components/import-csv";
import { ImportHistory } from "../src/modules/finance/components/import-history";
import { IMPORT_MAX_BYTES } from "../src/modules/finance/schemas/import.limits";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), undo: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/finance/actions/import.actions", () => ({
  previewFinanceImport: mocks.preview,
  confirmFinanceImport: mocks.confirm,
  undoFinanceImport: mocks.undo,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

// jsdom has no File.prototype.text (used by the component to read the chosen file); FileReader is available.
if (typeof File.prototype.text !== "function") {
  File.prototype.text = function text(this: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(element: ReactElement) { await act(async () => root.render(element)); }
function field<T extends HTMLElement = HTMLInputElement>(name: string) { return container.querySelector(`[name="${name}"]`) as T | null; }
function byText(text: string) { return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text)) ?? null; }

async function click(button: HTMLElement) { await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))); await flush(); }
async function submitForm() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await flush(); }

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

async function chooseFile(file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  await flush();
}

const HEADERS_CSV = "Booking Date,Amount,Concepto,Moneda,Ref\n2026-01-01,12.34,Coffee,EUR,abc\n";

it("rejects a file larger than the byte limit before reading it", async () => {
  await render(<ImportCsv />);
  const big = "x".repeat(IMPORT_MAX_BYTES + 1);
  const file = new File([big], "big.csv", { type: "text/csv" });
  await chooseFile(file);
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("The file is larger than 1 MB.");
  expect(mocks.preview).not.toHaveBeenCalled();
});

it("prefills the mapping form from header guesses", async () => {
  mocks.preview.mockResolvedValue({
    ok: true,
    headers: ["Booking Date", "Amount", "Concepto", "Moneda", "Ref"],
    sample: [["2026-01-01", "12.34", "Coffee", "EUR", "abc"]],
    totalRows: 1,
    mapped: null,
  });
  await render(<ImportCsv />);
  const file = new File([HEADERS_CSV], "export.csv", { type: "text/csv" });
  await chooseFile(file);
  expect(field<HTMLSelectElement>("date")!.value).toBe("Booking Date");
  expect(field<HTMLSelectElement>("amount")!.value).toBe("Amount");
  expect(field<HTMLSelectElement>("description")!.value).toBe("Concepto");
  expect(field<HTMLSelectElement>("externalId")!.value).toBe("Ref");
});

async function toPreviewStep() {
  mocks.preview.mockResolvedValueOnce({
    ok: true,
    headers: ["Date", "Amount", "Description"],
    sample: [["2026-01-01", "12.34", "Coffee"]],
    totalRows: 1,
    mapped: null,
  });
  await render(<ImportCsv />);
  const file = new File(["Date,Amount,Description\n2026-01-01,12.34,Coffee\n"], "export.csv", { type: "text/csv" });
  await chooseFile(file);
  mocks.preview.mockResolvedValueOnce({
    ok: true,
    headers: ["Date", "Amount", "Description"],
    sample: [["2026-01-01", "12.34", "Coffee"]],
    totalRows: 1,
    mapped: {
      newCount: 1,
      duplicateCount: 0,
      errorCount: 1,
      errors: [{ line: 3, message: "Invalid amount" }],
      rows: [{ line: 2, date: "2026-01-01", type: "EXPENSE", amount: "12.34", currency: "EUR", category: "Coffee" }],
      totals: [{ currency: "EUR", income: "0.00", expense: "12.34", net: "-12.34", netNegative: true }],
    },
  });
  await submitForm();
}

it("shows counts, totals and errors after a mapped preview", async () => {
  await toPreviewStep();
  expect(container.textContent).toContain("Invalid amount");
  const counts = Array.from(container.querySelectorAll("dd")).map((n) => n.textContent);
  expect(counts).toEqual(["1", "0", "1"]);
  expect(byText("Import 1 transaction")).toBeTruthy();
});

it("requires confirmation before importing and sends the csv text with the mapping JSON", async () => {
  await toPreviewStep();
  mocks.confirm.mockResolvedValue({ ok: true, importId: "11111111-1111-4111-8111-111111111111", imported: 1, skipped: 0 });
  const importButton = byText("Import 1 transaction")!;
  await click(importButton);
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Import 1 transaction into your private ledger?");
  const confirmButton = byText("Confirm")!;
  await click(confirmButton);
  expect(mocks.confirm).toHaveBeenCalledOnce();
  const data = mocks.confirm.mock.calls[0]![0] as FormData;
  expect(data.get("csv")).toBe("Date,Amount,Description\n2026-01-01,12.34,Coffee\n");
  const mapping = JSON.parse(data.get("mapping") as string);
  expect(mapping).toMatchObject({ date: "Date", amount: "Amount", description: "Description", currency: { fixed: "EUR" } });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Imported 1, skipped 0.");
});

it("ignores a second import click while the first is in flight", async () => {
  await toPreviewStep();
  let resolveConfirm: (value: unknown) => void = () => {};
  mocks.confirm.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve; }));
  await click(byText("Import 1 transaction")!);
  const confirmButton = byText("Confirm")!;
  await click(confirmButton);
  await click(confirmButton);
  expect(mocks.confirm).toHaveBeenCalledOnce();
  await act(async () => { resolveConfirm({ ok: true, importId: null, imported: 1, skipped: 0 }); });
});

const IMPORT_ID = "22222222-2222-4222-8222-222222222222";

it("requires confirmation before undoing an import and reports the result", async () => {
  const createdAt = new Date("2026-09-20T00:00:00.000Z");
  await render(<ImportHistory imports={[{ id: IMPORT_ID, fileName: "bank.csv", rowCount: 5, importedCount: 3, skippedCount: 2, createdAt }]} />);
  const undoButton = byText("Undo")!;
  await click(undoButton);
  expect(mocks.undo).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Remove the 3 transactions from this import?");
  mocks.undo.mockResolvedValue({ ok: true, removed: 3 });
  await click(byText("Confirm")!);
  expect(mocks.undo).toHaveBeenCalledOnce();
  const data = mocks.undo.mock.calls[0]![0] as FormData;
  expect(data.get("importId")).toBe(IMPORT_ID);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Removed 3 transactions.");
});

it("shows a server error from undo with role=alert", async () => {
  const createdAt = new Date("2026-09-20T00:00:00.000Z");
  await render(<ImportHistory imports={[{ id: IMPORT_ID, fileName: "bank.csv", rowCount: 5, importedCount: 3, skippedCount: 2, createdAt }]} />);
  await click(byText("Undo")!);
  mocks.undo.mockResolvedValue({ ok: false, error: "Import not found." });
  await click(byText("Confirm")!);
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Import not found.");
});
