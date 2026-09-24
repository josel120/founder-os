import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditIdeaForm } from "../src/modules/ideas/components/edit-idea-form";

const mocks = vi.hoisted(() => ({ updateIdeaContent: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/ideas/actions/idea.actions", () => ({ updateIdeaContent: mocks.updateIdeaContent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<EditIdeaForm ideaId="idea-1" initialTitle="Initial title" initialDescription="Initial description" />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function submit() {
  container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

it("starts with the saved idea content", () => {
  expect((container.querySelector('[name="title"]') as HTMLInputElement).value).toBe("Initial title");
  expect((container.querySelector('[name="description"]') as HTMLTextAreaElement).value).toBe("Initial description");
});

it("preserves edited values and shows an explicit failure", async () => {
  const title = container.querySelector('[name="title"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Edited title");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  mocks.updateIdeaContent.mockResolvedValue({ ok: false, error: "Idea not found. Changes were not saved." });

  await act(async () => submit());

  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Idea not found");
  expect((container.querySelector('[name="title"]') as HTMLInputElement).value).toBe("Edited title");
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("refreshes after a successful save", async () => {
  mocks.updateIdeaContent.mockResolvedValue({ ok: true });

  await act(async () => submit());

  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Idea updated.");
  expect(container.querySelector('[role="alert"]')?.textContent).toBeUndefined();
});

it("blocks repeated submissions while saving", async () => {
  let finish!: () => void;
  mocks.updateIdeaContent.mockReturnValue(new Promise<{ ok: true }>((resolve) => { finish = () => resolve({ ok: true }); }));

  await act(async () => { submit(); submit(); });
  expect(mocks.updateIdeaContent).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")!.disabled).toBe(true);

  finish();
  await act(async () => { await Promise.resolve(); });
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("reports thrown failures", async () => {
  mocks.updateIdeaContent.mockRejectedValue(new Error("network"));

  await act(async () => submit());

  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not confirm");
});
