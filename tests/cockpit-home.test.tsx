import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Attention } from "../src/modules/cockpit/queries/attention.queries";

const m = vi.hoisted(() => ({ attention: vi.fn(), pathname: vi.fn(() => "/private") }));
vi.mock("@/modules/cockpit/queries/attention.queries", () => ({ getAttention: m.attention }));
vi.mock("next/navigation", () => ({ usePathname: m.pathname, redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import PrivateHomePage, { metadata } from "../src/app/private/page";
import { WorkspaceNav, WorkspaceSection } from "../src/components/workspace-nav";

const now = new Date("2026-09-26T12:00:00Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const project = (n: number, extra: Partial<Attention["actionProjects"][number]> = {}): Attention["actionProjects"][number] => ({ id: id(n), name: `Project ${n}`, lifecycle: "BUILDING", operationalStatus: "READY", nextAction: null, waitingReason: null, waitingSince: null, reviewAt: null, ...extra });
const empty: Attention = { actionProjects: [], waitingProjects: [], reviewProjects: [], inbox: { ideas: [], total: 0 }, researchIdeas: [], decisions: [], finance: [] };
const filled: Attention = {
  actionProjects: [project(1, { operationalStatus: "BLOCKED", nextAction: "Renew the signing key" }), project(2, { operationalStatus: "ACTION_REQUIRED" })],
  waitingProjects: [project(3, { operationalStatus: "WAITING_REVIEW", waitingReason: "App Store review", waitingSince: new Date("2026-09-06T12:00:00Z") })],
  reviewProjects: [project(1, { operationalStatus: "BLOCKED", reviewAt: new Date("2026-09-20T00:00:00Z") })],
  inbox: { ideas: [{ id: id(10), title: "Oldest inbox idea", status: "INBOX", createdAt: new Date("2026-08-01T00:00:00Z") }], total: 7 },
  researchIdeas: [
    { id: id(20), title: "Unresearched idea", status: "RESEARCHING", createdAt: now, signals: { supports: 0, contradicts: 0, neutral: 0 } },
    { id: id(21), title: "Contradicted idea", status: "VALIDATING", createdAt: now, signals: { supports: 0, contradicts: 2, neutral: 1 } },
  ],
  decisions: [
    { id: id(30), title: "Ship the beta", ideaId: null, projectId: id(1), createdAt: new Date("2026-09-25T00:00:00Z") },
    { id: id(31), title: "Drop the paid tier", ideaId: id(20), projectId: null, createdAt: new Date("2026-09-24T00:00:00Z") },
    { id: id(32), title: "Loose decision", ideaId: null, projectId: null, createdAt: new Date("2026-09-23T00:00:00Z") },
  ],
  finance: [{ currency: "EUR", count: 2, income: "0.00", expense: "12.50", net: "−12.50", netNegative: true }, { currency: "USD", count: 1, income: "1,000.00", expense: "0.00", net: "1,000.00", netNegative: false }],
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now, toFake: ["Date"] });
  m.pathname.mockReturnValue("/private");
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { vi.useRealTimers(); await act(async () => root.unmount()); container.remove(); });

async function renderHome(attention: Attention | null) {
  m.attention.mockResolvedValue(attention);
  const element = await PrivateHomePage();
  await act(async () => root.render(element));
}
const section = (headingId: string) => container.querySelector(`[aria-labelledby="${headingId}"]`)!;
const hrefs = (element: Element) => [...element.querySelectorAll("a")].map((link) => link.getAttribute("href"));

it("uses a generic title and sends anonymous callers to login", async () => {
  expect(metadata.title).toBe("Home");
  await expect(renderHome(null)).rejects.toThrow("NEXT_REDIRECT /login");
});

it("asks for attention with the request time", async () => {
  await renderHome(empty);
  expect(m.attention).toHaveBeenCalledWith(now);
});

it("shows an empty state for every section when nothing needs attention", async () => {
  await renderHome(empty);
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Nothing needs your attention right now.");
  for (const text of ["No project needs an action, has waited more than 14 days or is due for review", "Every idea under research has supporting evidence", "The inbox is empty", "No decisions logged yet", "No transactions in the last 30 days"]) expect(container.textContent).toContain(text);
  expect(hrefs(section("home-inbox"))).toEqual(["/private/ideas"]);
  expect(container.querySelector('[role="group"]')).toBeNull();
});

it("lists projects that need action, wait too long or are due for review, each linking to its page", async () => {
  await renderHome(filled);
  const action = section("home-action");
  expect(hrefs(action)).toEqual([`/private/projects/${id(1)}`, `/private/projects/${id(2)}`]);
  expect(action.textContent).toContain("Renew the signing key");
  expect(action.textContent).toContain("No next action written yet.");
  expect(action.textContent).toContain("Blocked");
  expect(section("home-waiting").textContent).toContain("Waiting 20 days: App Store review");
  expect(section("home-review").textContent).toContain("Review was due 2026-09-20");
  // Project 1 is in two lists but counts once.
  expect(container.querySelector('[role="status"]')?.textContent).toBe("3 projects · 2 research gaps · 7 ideas in the inbox");
  expect(section("home-projects").querySelector("h2 + span")?.textContent).toBe("3");
});

it("hides project groups with nothing in them", async () => {
  await renderHome({ ...empty, waitingProjects: filled.waitingProjects });
  expect([...container.querySelectorAll('[role="group"]')].map((group) => group.getAttribute("aria-labelledby"))).toEqual(["home-waiting"]);
  expect(container.querySelector('[role="status"]')?.textContent).toBe("1 project");
});

it("links research gaps to the idea's evidence and explains why each one is listed", async () => {
  await renderHome(filled);
  const research = section("home-research");
  expect(hrefs(research)).toEqual([`/private/ideas/${id(20)}#evidence-heading`, `/private/ideas/${id(21)}#evidence-heading`]);
  expect(research.textContent).toContain("No evidence yet.");
  expect(research.textContent).toContain("2 contradicting items, nothing supporting.");
});

it("shows the oldest inbox ideas with the full count and a link to the filtered inbox", async () => {
  await renderHome(filled);
  const inbox = section("home-inbox");
  expect(inbox.textContent).toContain("The 1 oldest of 7.");
  expect(hrefs(inbox)).toEqual([`/private/ideas/${id(10)}`, "/private/ideas?status=INBOX"]);
});

it("links decisions to their project or idea and the finance snapshot to the ledger", async () => {
  await renderHome(filled);
  expect(hrefs(section("home-decisions"))).toEqual([`/private/projects/${id(1)}`, `/private/ideas/${id(20)}`, "/private/decisions"]);
  const finance = section("home-finance");
  expect(finance.textContent).toContain("EUR");
  expect(finance.textContent).toContain("−12.50");
  expect(finance.textContent).toContain("1,000.00");
  expect(finance.querySelector(".text-red-700")?.textContent).toContain("−12.50");
  expect(hrefs(finance)).toEqual(["/private/finance"]);
});

async function renderNav(pathname: string) {
  m.pathname.mockReturnValue(pathname);
  await act(async () => root.render(<><WorkspaceSection /><WorkspaceNav /></>));
  // Accessible name only: the decorative marks are aria-hidden.
  const name = (link: Element) => [...link.childNodes].filter((node) => !(node instanceof Element && node.getAttribute("aria-hidden") === "true")).map((node) => node.textContent).join("");
  return { current: [...container.querySelectorAll('a[aria-current="page"]')].map(name), label: container.querySelector("span")?.textContent };
}

it("puts Home first in the nav and marks it current only on /private", async () => {
  expect(await renderNav("/private")).toEqual({ current: ["Home"], label: "Personal workspace / Home" });
  expect(container.querySelector("nav a")?.getAttribute("href")).toBe("/private");
  expect(await renderNav(`/private/ideas/${id(10)}`)).toEqual({ current: ["Ideas"], label: "Personal workspace / Ideas" });
});
