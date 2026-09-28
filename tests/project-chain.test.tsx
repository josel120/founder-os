import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ project: vi.fn(), idea: vi.fn(), transactions: vi.fn(), decisions: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: async () => ({ id: "owner-a" }) }));
// The page now calls getT(), which reads cookies() outside a request scope in this render harness (ADR-023, T-097).
vi.mock("@/lib/i18n/server", () => ({ getT: async () => (text: string) => text }));
vi.mock("@/modules/projects/queries/project.queries", () => ({ getPrivateProject: m.project }));
vi.mock("@/modules/ideas/queries/idea.queries", () => ({ getPrivateIdea: m.idea }));
vi.mock("@/modules/finance/queries/finance.queries", () => ({ listPrivateFinanceTransactions: m.transactions }));
vi.mock("@/modules/decisions/queries/decision.queries", () => ({ listDecisionsForProject: m.decisions }));
vi.mock("@/modules/projects/actions/project.actions", () => ({ updateProjectContent: vi.fn(), updateProjectStatus: vi.fn() }));
vi.mock("@/modules/decisions/actions/decision.actions", () => ({ createDecision: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, redirect: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
import ProjectDetailPage from "../src/app/private/projects/[id]/page";

const projectId = "00000000-0000-4000-8000-000000000001";
const ideaId = "00000000-0000-4000-8000-0000000000aa";
const project = { id: projectId, name: "Founder OS", slug: "founder-os", description: "Private workspace", originIdeaId: ideaId, lifecycle: "BUILDING", operationalStatus: "READY", nextAction: null, waitingReason: null, waitingSince: null, reviewAt: null, currentVersion: null, productionVersion: null, repository: null, website: null, playStoreUrl: null, appStoreUrl: null, createdAt: new Date(), updatedAt: new Date() };
const tx = (type: "INCOME" | "EXPENSE", amount: string, currency = "USD") => ({ id: `${type}-${amount}`, type, category: "Hosting", amount, currency, occurredAt: new Date("2026-09-20T10:00:00Z") });

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  m.project.mockResolvedValue(project);
  m.decisions.mockResolvedValue([]);
  m.transactions.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

async function renderPage() {
  const element = await ProjectDetailPage({ params: Promise.resolve({ id: projectId }) });
  await act(async () => root.render(element));
}

it("links the project to the owner's origin idea", async () => {
  m.idea.mockResolvedValue({ id: ideaId, title: "A private founder OS" });
  await renderPage();
  expect(m.idea).toHaveBeenCalledWith(ideaId);
  expect(container.querySelector(`a[href="/private/ideas/${ideaId}"]`)?.textContent).toBe("A private founder OS");
});

it("shows no origin link when the idea is not the owner's own private idea", async () => {
  m.idea.mockResolvedValue(null);
  await renderPage();
  expect(container.textContent).not.toContain("From idea");
  m.idea.mockClear();
  m.project.mockResolvedValue({ ...project, originIdeaId: null });
  await renderPage();
  expect(m.idea).not.toHaveBeenCalled();
});

it("lists the project's transactions with exact per-currency totals", async () => {
  m.idea.mockResolvedValue(null);
  m.transactions.mockResolvedValue([tx("INCOME", "100.1000"), tx("EXPENSE", "0.2000"), tx("EXPENSE", "12.3400", "EUR")]);
  await renderPage();
  expect(m.transactions).toHaveBeenCalledWith(projectId);
  const finance = container.querySelector('section[aria-labelledby="project-finance-heading"]')!;
  expect(finance.textContent).toContain("99.90 net");
  expect(finance.textContent).toContain("−12.34 net");
  expect(finance.querySelectorAll("li")).toHaveLength(3);
});

it("says when no transactions are linked", async () => {
  m.idea.mockResolvedValue(null);
  await renderPage();
  expect(container.textContent).toContain("No transactions linked to this project yet.");
});
