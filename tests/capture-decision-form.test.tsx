import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CaptureDecisionForm } from "../src/modules/decisions/components/capture-decision-form";

const mocks = vi.hoisted(() => ({ createDecision: vi.fn() }));
vi.mock("../src/modules/decisions/actions/decision.actions", () => ({ createDecision: mocks.createDecision }));
let container: HTMLDivElement;
let root: Root;

async function render(ideaId?: string) {
  await act(async () => root.render(<CaptureDecisionForm ideaId={ideaId} />));
  container.querySelector("input")!.value = "Pricing model";
}
function submit() {
  container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

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

it("preserves input and shows failure without a success message", async () => {
  await render();
  mocks.createDecision.mockResolvedValue({ ok: false, error: "Reason is required" });
  await act(async () => submit());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Reason is required");
  expect(container.querySelector("input")!.value).toBe("Pricing model");
  expect(container.querySelector('[role="status"]')?.textContent).toBe("");
});

it("blocks repeated submissions and resets only after confirmation", async () => {
  await render();
  let finish!: (result: { ok: true }) => void;
  mocks.createDecision.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await act(async () => { submit(); submit(); });
  expect(mocks.createDecision).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish({ ok: true }));
  expect(container.querySelector("input")!.value).toBe("");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("recorded");
});

it("sends the preset idea id when rendered on an idea", async () => {
  await render("00000000-0000-4000-8000-0000000000bb");
  mocks.createDecision.mockResolvedValue({ ok: true });
  await act(async () => submit());
  const sent: FormData = mocks.createDecision.mock.calls[0][0];
  expect(sent.get("ideaId")).toBe("00000000-0000-4000-8000-0000000000bb");
});
