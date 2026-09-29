import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ assess: vi.fn(), summarize: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/modules/ai/actions/ai.actions", () => ({ runIdeaAssessment: m.assess, runResearchSummary: m.summarize }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
import { AIPanel } from "../src/modules/ai/components/ai-panel";
import type { AIRunView } from "../src/modules/ai/queries/ai.queries";

const ideaId = "00000000-0000-4000-8000-000000000001";
const createdAt = new Date("2026-09-27T15:04:00Z");
const assessment: AIRunView = { id: "r1", kind: "ASSESSMENT", status: "SUCCEEDED", model: "claude-sonnet-5", error: null, createdAt, output: { recommendation: "INVESTIGATE_MORE", rationale: "Interviews are thin.", risks: ["<img src=x onerror=alert(1)>"], openQuestions: ["Who pays?"] } };
const summary: AIRunView = { id: "r2", kind: "SUMMARY", status: "SUCCEEDED", model: "claude-sonnet-5", error: null, createdAt, output: { overview: "Mixed.", supports: ["Demand"], contradicts: [], openQuestions: [] } };
const failed: AIRunView = { id: "r3", kind: "SUMMARY", status: "FAILED", model: "claude-sonnet-5", error: "rate_limited", createdAt, output: null };
const on = { configured: true, provider: "Groq", used: 2, limit: 20 };

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = (props: Parameters<typeof AIPanel>[0]) => act(async () => root.render(<AIPanel {...props} />));
const buttons = () => [...container.querySelectorAll("button")];

it("says what is sent and to whom before any button, and offers no run when not configured", async () => {
  await render({ ideaId, status: { ...on, configured: false }, runs: [] });
  expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe("ai-heading");
  expect(container.textContent).toContain("Runs only when you click");
  expect(container.textContent).toContain("to Groq.");
  expect(container.textContent).toContain("GROQ_API_KEY");
  expect(buttons()).toHaveLength(0);
});

it("shows today's usage and disables both buttons at the daily limit", async () => {
  await render({ ideaId, status: on, runs: [] });
  expect(container.textContent).toContain("2 of 20 runs used today (UTC).");
  expect(buttons().every((button) => !button.disabled)).toBe(true);
  await render({ ideaId, status: { ...on, used: 20 }, runs: [] });
  expect(buttons().every((button) => button.disabled)).toBe(true);
  expect(container.textContent).toContain("resets at 00:00 UTC");
});

it("renders output as plain text, with one h3 per run and a link to record a decision", async () => {
  await render({ ideaId, status: on, runs: [assessment, summary, failed] });
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(container.textContent).toContain("Suggests: Investigate more");
  expect(container.textContent).toContain("The AI provider's rate limit was reached.");
  const headings = [...container.querySelectorAll("h3")].map((heading) => heading.textContent);
  expect(headings).toEqual(["Assessment · 2026-09-27 15:04 UTC", "Research summary · 2026-09-27 15:04 UTC", "Research summary · 2026-09-27 15:04 UTC"]);
  expect(container.querySelectorAll("h1, h2")).toHaveLength(1);
  expect(container.querySelector('a[href="#decisions"]')?.textContent).toBe("Record a decision");
});

it("runs one thing at a time with the idea id only, then refreshes", async () => {
  let finish: (value: unknown) => void = () => {};
  m.assess.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await render({ ideaId, status: on, runs: [] });
  await act(async () => buttons()[0]!.click());
  expect(buttons().every((button) => button.disabled)).toBe(true);
  expect(buttons()[0]!.textContent).toContain("Assessing");
  const data = m.assess.mock.calls[0]![0] as FormData;
  expect([...data.keys()]).toEqual(["ideaId"]);
  expect(data.get("ideaId")).toBe(ideaId);
  await act(async () => finish({ ok: false, error: "A run on this idea is already in progress." }));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("A run on this idea is already in progress.");
  expect(m.refresh).toHaveBeenCalled();
  expect(m.summarize).not.toHaveBeenCalled();
});
