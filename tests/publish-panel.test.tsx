import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishPanel } from "../src/modules/portfolio/components/publish-panel";

const mocks = vi.hoisted(() => ({ publishProject: vi.fn(), unpublishProject: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/portfolio/actions/publication.actions", () => ({ publishProject: mocks.publishProject, unpublishProject: mocks.unpublishProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const projectId = "11111111-1111-4111-8111-111111111111";
const preview = { name: "Founder OS", slug: "founder-os", lifecycle: "BUILDING" as const, releasedAt: null, website: null, playStoreUrl: null, appStoreUrl: null };

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

async function render(element: ReactElement) {
  await act(async () => root.render(element));
}
function button(label: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === label) as HTMLButtonElement;
}
async function click(label: string) {
  await act(async () => button(label)!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function type(name: string, value: string) {
  const textarea = container.querySelector(`[name="${name}"]`) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const alert = () => container.querySelector('[role="alert"]')?.textContent;
const status = () => container.querySelector('[role="status"]')?.textContent;
const html = () => container.innerHTML;
const sent = (mock: typeof mocks.publishProject) => mock.mock.calls[0]![0] as FormData;

describe("PublishPanel private state", () => {
  beforeEach(() => render(<PublishPanel projectId={projectId} publication={null} preview={preview} />));

  it("shows Private with no public link and no unpublish button", () => {
    expect(html()).toContain("Private");
    expect(html()).not.toContain("/p/founder-os");
    expect(button("Make private")).toBeUndefined();
  });

  it("counts summary characters live", async () => {
    await type("summary", "A short public summary.");
    expect(html()).toContain("23/500");
  });

  it("previews the allowlisted preview and summary, never the private description or next action", async () => {
    await type("summary", "A public summary, not the private description.");
    const output = html();
    expect(output).toContain("Founder OS");
    expect(output).toContain("A public summary, not the private description.");
    expect(output).not.toContain("SECRET_DESCRIPTION_SENTINEL");
    expect(output).not.toContain("SECRET_NEXT_ACTION_SENTINEL");
  });

  it("does not call publishProject before the confirm step", async () => {
    await type("summary", "A public summary.");
    await click("Review and publish");
    expect(mocks.publishProject).not.toHaveBeenCalled();
    expect(html()).toContain("This will be visible to anyone");
  });

  it("publishes with projectId, visibility and summary only after Confirm", async () => {
    mocks.publishProject.mockResolvedValue({ ok: true, projectId });
    await type("summary", "A public summary.");
    await click("Review and publish");
    await click("Confirm");
    const data = sent(mocks.publishProject);
    expect(data.get("projectId")).toBe(projectId);
    expect(data.get("visibility")).toBe("PUBLIC");
    expect(data.get("summary")).toBe("A public summary.");
    expect(status()).toBe("Project published.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("cancels the confirm step without publishing", async () => {
    await type("summary", "A public summary.");
    await click("Review and publish");
    await click("Cancel");
    expect(mocks.publishProject).not.toHaveBeenCalled();
    expect(button("Review and publish")).toBeDefined();
  });

  it("shows the server error on failure", async () => {
    mocks.publishProject.mockResolvedValue({ ok: false, error: "Write a public summary." });
    await click("Review and publish");
    await click("Confirm");
    expect(alert()).toBe("Write a public summary.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("blocks a second publish while one is in flight", async () => {
    let finish!: () => void;
    mocks.publishProject.mockReturnValue(new Promise((resolve) => { finish = () => resolve({ ok: true, projectId }); }));
    await type("summary", "A public summary.");
    await click("Review and publish");
    await act(async () => {
      button("Confirm")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button("Confirm")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mocks.publishProject).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await Promise.resolve(); });
  });
});

describe("PublishPanel published state", () => {
  const publication = { visibility: "PUBLIC" as const, summary: "Existing public summary.", publishedAt: new Date("2026-01-01T00:00:00Z") };
  beforeEach(() => render(<PublishPanel projectId={projectId} publication={publication} preview={preview} />));

  it("shows the current visibility and the public link", () => {
    expect(html()).toContain("Public");
    expect(html()).toContain("/p/founder-os");
  });

  it("offers to update rather than publish, starting from the saved summary", () => {
    expect(html()).toContain("Review and update");
    expect(html()).not.toContain("Review and publish");
    expect(html()).toContain("Existing public summary.");
  });

  it("requires confirmation before unpublishing", async () => {
    await click("Make private");
    expect(mocks.unpublishProject).not.toHaveBeenCalled();
    expect(html()).toContain("This removes the public page");
  });

  it("unpublishes with the projectId after Confirm", async () => {
    mocks.unpublishProject.mockResolvedValue({ ok: true, projectId });
    await click("Make private");
    await click("Confirm");
    const data = sent(mocks.unpublishProject);
    expect(data.get("projectId")).toBe(projectId);
    expect(status()).toBe("Project is private again.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("cancels the unpublish confirmation", async () => {
    await click("Make private");
    await click("Cancel");
    expect(mocks.unpublishProject).not.toHaveBeenCalled();
    expect(button("Make private")).toBeDefined();
  });

  it("shows the server error on unpublish failure", async () => {
    mocks.unpublishProject.mockResolvedValue({ ok: false, error: "This project is not published." });
    await click("Make private");
    await click("Confirm");
    expect(alert()).toBe("This project is not published.");
  });
});
