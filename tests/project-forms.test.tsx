import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProjectForm } from "../src/modules/projects/components/capture-project-form";
import { EditProjectForm } from "../src/modules/projects/components/edit-project-form";
import { ProjectStatusForm } from "../src/modules/projects/components/project-status-form";

const mocks = vi.hoisted(() => ({ createProject: vi.fn(), updateProjectContent: vi.fn(), updateProjectStatus: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/projects/actions/project.actions", () => ({ createProject: mocks.createProject, updateProjectContent: mocks.updateProjectContent, updateProjectStatus: mocks.updateProjectStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const projectId = "11111111-1111-4111-8111-111111111111";
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
function field<T extends HTMLElement = HTMLInputElement>(name: string) {
  return container.querySelector(`[name="${name}"]`) as T | null;
}
async function type(name: string, value: string) {
  const input = field(name)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(name: string, value: string) {
  const element = field<HTMLSelectElement>(name)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
const alert = () => container.querySelector('[role="alert"]')?.textContent;
const status = () => container.querySelector('[role="status"]')?.textContent;
const sent = (mock: typeof mocks.createProject) => mock.mock.calls[0]![0] as FormData;

describe("CaptureProjectForm", () => {
  beforeEach(() => render(<CaptureProjectForm />));

  it("sends only name, slug and description and never an owner", async () => {
    mocks.createProject.mockResolvedValue({ ok: true, projectId });
    await type("name", "Founder OS");
    await type("slug", "founder-os");
    await submit();
    expect([...sent(mocks.createProject).keys()].sort()).toEqual(["description", "name", "slug"]);
  });

  it("resets, confirms and refreshes after success", async () => {
    mocks.createProject.mockResolvedValue({ ok: true, projectId });
    await type("name", "Founder OS");
    await submit();
    expect(field("name")!.value).toBe("");
    expect(status()).toBe("Project created privately.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps input and shows the server error on failure", async () => {
    mocks.createProject.mockResolvedValue({ ok: false, error: "Could not save the project. Please try again." });
    await type("name", "Founder OS");
    await submit();
    expect(field("name")!.value).toBe("Founder OS");
    expect(alert()).toContain("Could not save the project");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("blocks repeated submissions while saving", async () => {
    let finish!: () => void;
    mocks.createProject.mockReturnValue(new Promise((resolve) => { finish = () => resolve({ ok: true, projectId }); }));
    await act(async () => {
      const form = container.querySelector("form")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mocks.createProject).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")!.disabled).toBe(true);
    await act(async () => { finish(); await Promise.resolve(); });
    expect(container.querySelector("button")!.disabled).toBe(false);
  });

  it("reports thrown failures without claiming success", async () => {
    mocks.createProject.mockRejectedValue(new Error("network"));
    await submit();
    expect(alert()).toContain("Could not confirm");
    expect(status()).toBe("");
  });
});

describe("EditProjectForm", () => {
  const project = { id: projectId, name: "Founder OS", slug: "founder-os", description: "Private workspace", repository: "https://github.com/example/repo", website: null, playStoreUrl: null, appStoreUrl: null, currentVersion: "0.3.0", productionVersion: null };
  beforeEach(() => render(<EditProjectForm project={project} />));

  it("starts with saved content and blanks for missing values", () => {
    expect(field("name")!.value).toBe("Founder OS");
    expect(field("repository")!.value).toBe("https://github.com/example/repo");
    expect(field("website")!.value).toBe("");
    expect(field("currentVersion")!.value).toBe("0.3.0");
  });

  it("sends the project id with the edited content and refreshes", async () => {
    mocks.updateProjectContent.mockResolvedValue({ ok: true, projectId });
    await type("name", "Founder OS 2");
    await submit();
    const data = sent(mocks.updateProjectContent);
    expect(data.get("projectId")).toBe(projectId);
    expect(data.get("name")).toBe("Founder OS 2");
    expect(data.has("lifecycle")).toBe(false);
    expect(status()).toBe("Project updated.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps edits and shows not-found failures", async () => {
    mocks.updateProjectContent.mockResolvedValue({ ok: false, error: "Project not found. Changes were not saved." });
    await type("name", "Edited");
    await submit();
    expect(field("name")!.value).toBe("Edited");
    expect(alert()).toContain("Project not found");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("ProjectStatusForm", () => {
  const base = { projectId, lifecycle: "BUILDING" as const, operationalStatus: "READY" as const, nextAction: "", waitingReason: "", waitingSince: "", reviewAt: "" };

  it("shows lifecycle and operational status as separate controls", async () => {
    await render(<ProjectStatusForm {...base} />);
    expect(field<HTMLSelectElement>("lifecycle")!.value).toBe("BUILDING");
    expect(field<HTMLSelectElement>("operationalStatus")!.value).toBe("READY");
  });

  it("only shows waiting fields for waiting statuses", async () => {
    await render(<ProjectStatusForm {...base} />);
    expect(field("waitingReason")).toBeNull();
    await select("operationalStatus", "WAITING_REVIEW");
    expect(field("waitingReason")!.required).toBe(true);
    expect(field("waitingSince")!.required).toBe(true);
  });

  it("changing operational status leaves lifecycle unchanged and sends ISO dates", async () => {
    mocks.updateProjectStatus.mockResolvedValue({ ok: true, projectId });
    await render(<ProjectStatusForm {...base} />);
    await select("operationalStatus", "WAITING_PLATFORM");
    await type("waitingReason", "App review");
    await type("waitingSince", "2026-09-20");
    await submit();
    const data = sent(mocks.updateProjectStatus);
    expect(data.get("lifecycle")).toBe("BUILDING");
    expect(data.get("operationalStatus")).toBe("WAITING_PLATFORM");
    expect(data.get("waitingSince")).toBe("2026-09-20T00:00:00.000Z");
    expect(data.get("reviewAt")).toBe("");
    expect(status()).toBe("Status saved.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not send waiting fields when leaving a waiting status", async () => {
    mocks.updateProjectStatus.mockResolvedValue({ ok: true, projectId });
    await render(<ProjectStatusForm {...base} operationalStatus="WAITING_USERS" waitingReason="Beta feedback" waitingSince="2026-09-01" />);
    await select("operationalStatus", "ACTION_REQUIRED");
    await submit();
    const data = sent(mocks.updateProjectStatus);
    expect(data.has("waitingReason")).toBe(false);
    expect(data.has("waitingSince")).toBe(false);
  });

  it("shows validation errors from the server", async () => {
    mocks.updateProjectStatus.mockResolvedValue({ ok: false, error: "Waiting requires a reason and a start date." });
    await render(<ProjectStatusForm {...base} />);
    await submit();
    expect(alert()).toContain("Waiting requires");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
