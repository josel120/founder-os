import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CaptureIdeaForm } from "../src/modules/ideas/components/capture-idea-form";

const mocks = vi.hoisted(() => ({ createIdea: vi.fn() }));
vi.mock("../src/modules/ideas/actions/idea.actions", () => ({ createIdea: mocks.createIdea }));
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<CaptureIdeaForm />));
  container.querySelector("input")!.value = "Remember this idea";
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("preserves input and shows failure without a success message", async () => {
  mocks.createIdea.mockResolvedValue({ ok: false, error: "Session expired" });
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Session expired");
  expect(container.querySelector("input")!.value).toBe("Remember this idea");
  expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  expect(container.querySelector("button")!.disabled).toBe(false);
});
it("blocks repeated submissions and resets only after confirmation", async () => {
  let finish!: (result: { ok: true }) => void;
  mocks.createIdea.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await act(async () => {
    const form = container.querySelector("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mocks.createIdea).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish({ ok: true }));
  expect(container.querySelector("input")!.value).toBe("");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("saved");
});
