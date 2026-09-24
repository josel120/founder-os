import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CaptureProblemForm } from "../src/modules/problems/components/capture-problem-form";

const mocks = vi.hoisted(() => ({ createProblem: vi.fn() }));
vi.mock("../src/modules/problems/actions/problem.actions", () => ({ createProblem: mocks.createProblem }));
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<CaptureProblemForm />));
  container.querySelector("input")!.value = "Hard onboarding";
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("preserves input and shows failure without a success message", async () => {
  mocks.createProblem.mockResolvedValue({ ok: false, error: "Session expired" });
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Session expired");
  expect(container.querySelector("input")!.value).toBe("Hard onboarding");
  expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  expect(container.querySelector("button")!.disabled).toBe(false);
});
it("blocks repeated submissions and resets only after confirmation", async () => {
  let finish!: (result: { ok: true }) => void;
  mocks.createProblem.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await act(async () => {
    const form = container.querySelector("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(mocks.createProblem).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish({ ok: true }));
  expect(container.querySelector("input")!.value).toBe("");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("saved");
});
