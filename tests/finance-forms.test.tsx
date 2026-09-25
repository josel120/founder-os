import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CaptureFinanceForm } from "../src/modules/finance/components/capture-finance-form";

const mocks = vi.hoisted(() => ({ create: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/finance/actions/finance.actions", () => ({ createFinanceTransaction: mocks.create }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

let container: HTMLDivElement;
let root: Root;
const projectId = "11111111-1111-4111-8111-111111111111";

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
async function type(name: string, value: string) {
  const input = field(name)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

it("offers owned projects and sends transaction fields without an owner", async () => {
  await render(<CaptureFinanceForm projects={[{ id: projectId, name: "Founder OS" }]} />);
  expect(field<HTMLSelectElement>("projectId")!.options[1]!.text).toBe("Founder OS");
  mocks.create.mockResolvedValue({ ok: true, transactionId: projectId });
  await type("amount", "12.34");
  await type("category", "Hosting");
  await type("source", "AWS");
  await type("occurredAt", "2026-09-24T12:00");
  await submit();
  const data = mocks.create.mock.calls[0]![0] as FormData;
  expect(data.get("amount")).toBe("12.34");
  expect(data.get("projectId")).toBe("");
  expect(data.has("ownerId")).toBe(false);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Transaction recorded privately.");
});

it("keeps entered values and reports server errors", async () => {
  await render(<CaptureFinanceForm projects={[]} />);
  mocks.create.mockResolvedValue({ ok: false, error: "Project not found. The transaction was not saved." });
  await type("amount", "9.99");
  await submit();
  expect(field("amount")!.value).toBe("9.99");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Project not found");
  expect(mocks.refresh).not.toHaveBeenCalled();
});
