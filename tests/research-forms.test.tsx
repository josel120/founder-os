import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureEvidenceForm } from "../src/modules/research/components/capture-evidence-form";
import { EditEvidenceForm } from "../src/modules/research/components/edit-evidence-form";
import { EvidenceList } from "../src/modules/research/components/evidence-list";
import { summarizeSignals } from "../src/modules/research/services/signals";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/research/actions/evidence.actions", () => ({ createEvidence: mocks.create, updateEvidenceContent: mocks.update }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));

let container: HTMLDivElement;
let root: Root;
const ideaId = "11111111-1111-4111-8111-111111111111";
const problemId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "33333333-3333-4333-8333-333333333333";

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
function field<T extends HTMLElement = HTMLInputElement>(name: string, scope: ParentNode = container) { return scope.querySelector(`[name="${name}"]`) as T | null; }
async function type(name: string, value: string, scope: ParentNode = container) {
  const element = field<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name, scope)!;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
}
async function submit(form = container.querySelector("form")!) { await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
async function fillContent() {
  await type("title", "Five founders interviewed");
  await type("summary", "All five lose context between tools.");
  await type("kind", "INTERVIEW");
  await type("signal", "SUPPORTS");
}

describe("CaptureEvidenceForm", () => {
  const parents = { problems: [{ value: `problem:${problemId}`, label: "Context loss" }], ideas: [{ value: `idea:${ideaId}`, label: "Founder OS" }] };

  it("offers only the given problems and ideas and makes the owner choose kind and signal", async () => {
    await render(<CaptureEvidenceForm parents={parents} />);
    const groups = [...container.querySelectorAll("optgroup")].map((group) => [group.label, [...group.querySelectorAll("option")].map((option) => option.value)]);
    expect(groups).toEqual([["Problems", [`problem:${problemId}`]], ["Ideas", [`idea:${ideaId}`]]]);
    expect(field<HTMLSelectElement>("kind")!.value).toBe("");
    expect(field<HTMLSelectElement>("signal")!.value).toBe("");
    expect(field<HTMLSelectElement>("kind")!.required).toBe(true);
  });

  it("sends the chosen parent and content, never an owner, then resets and refreshes", async () => {
    mocks.create.mockResolvedValue({ ok: true, evidenceId });
    await render(<CaptureEvidenceForm parents={parents} />);
    await type("parent", `idea:${ideaId}`);
    await fillContent();
    await type("sourceUrl", "https://example.com/notes");
    await submit();
    const data = mocks.create.mock.calls[0]![0] as FormData;
    expect(Object.fromEntries(data)).toEqual({ parent: `idea:${ideaId}`, title: "Five founders interviewed", summary: "All five lose context between tools.", kind: "INTERVIEW", signal: "SUPPORTS", sourceUrl: "https://example.com/notes" });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Evidence saved privately.");
    expect(field("title")!.value).toBe("");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("binds to a fixed idea without offering a parent choice", async () => {
    await render(<CaptureEvidenceForm fixedParent={{ value: `idea:${ideaId}`, label: "Founder OS" }} />);
    expect(container.querySelector("select[name=parent]")).toBeNull();
    expect(field("parent")!.type).toBe("hidden");
    expect(field("parent")!.value).toBe(`idea:${ideaId}`);
  });

  it("explains that a parent is needed when the owner has no problems or ideas", async () => {
    await render(<CaptureEvidenceForm parents={{ problems: [], ideas: [] }} />);
    expect(container.querySelector("select[name=parent] option")?.textContent).toBe("Capture a problem or idea first");
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps entered values and shows the server's reason", async () => {
    mocks.create.mockResolvedValue({ ok: false, reason: "invalid", error: "Use a full http or https link, like https://example.com" });
    await render(<CaptureEvidenceForm fixedParent={{ value: `idea:${ideaId}`, label: "Founder OS" }} />);
    await fillContent();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("http or https");
    expect(field("title")!.value).toBe("Five founders interviewed");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

const row = { id: evidenceId, title: "Competitor pricing", summary: "Two competitors charge per seat.\nNone offer a free tier.", kind: "COMPETITOR" as const, signal: "CONTRADICTS" as const, sourceUrl: "https://example.com/pricing", problemId: null, ideaId, createdAt: new Date("2026-09-25T10:00:00Z"), updatedAt: new Date("2026-09-25T10:00:00Z") };

describe("EditEvidenceForm", () => {
  it("prefills the content and sends only the evidence id with it", async () => {
    mocks.update.mockResolvedValue({ ok: true, evidenceId });
    await render(<EditEvidenceForm evidence={row} />);
    expect(field<HTMLSelectElement>("signal")!.value).toBe("CONTRADICTS");
    await type("signal", "NEUTRAL");
    await submit();
    const data = Object.fromEntries(mocks.update.mock.calls[0]![0] as FormData);
    expect(data).toEqual({ evidenceId, title: row.title, summary: row.summary, kind: "COMPETITOR", signal: "NEUTRAL", sourceUrl: row.sourceUrl });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Evidence updated.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reports a not_found result", async () => {
    mocks.update.mockResolvedValue({ ok: false, reason: "not_found", error: "Evidence not found. Changes were not saved." });
    await render(<EditEvidenceForm evidence={row} />);
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Evidence not found. Changes were not saved.");
  });
});

describe("EvidenceList", () => {
  it("shows kind, signal, parent and a safe external source link", async () => {
    await render(<EvidenceList rows={[row]} parentOf={() => ({ href: `/private/ideas/${ideaId}`, label: "Idea: Founder OS" })} empty="None" />);
    const article = container.querySelector("article")!;
    expect(article.textContent).toContain("Competitor");
    expect(article.textContent).toContain("Contradicts");
    const source = [...article.querySelectorAll("a")].find((link) => link.textContent === "Source")!;
    expect(source.getAttribute("href")).toBe("https://example.com/pricing");
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(article.querySelector(`a[href="/private/ideas/${ideaId}"]`)?.textContent).toBe("Idea: Founder OS");
  });

  it("renders the empty message and no source link when none was given", async () => {
    await render(<EvidenceList rows={[]} empty="No evidence about this idea yet." />);
    expect(container.textContent).toBe("No evidence about this idea yet.");
    await render(<EvidenceList rows={[{ ...row, sourceUrl: null }]} empty="None" />);
    expect([...container.querySelectorAll("a")].some((link) => link.textContent === "Source")).toBe(false);
  });
});

it("summarizes how the evidence leans", () => {
  expect(summarizeSignals([{ signal: "SUPPORTS" }, { signal: "SUPPORTS" }, { signal: "CONTRADICTS" }, { signal: "NEUTRAL" }])).toEqual({ total: 4, supports: 2, contradicts: 1, neutral: 1 });
  expect(summarizeSignals([])).toEqual({ total: 0, supports: 0, contradicts: 0, neutral: 0 });
});
