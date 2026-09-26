import { beforeEach, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { decisionLogs, financeTransactions, ideas, problems, projects } from "../src/db/schema";
import { withoutOwnership } from "../src/db/columns";

const m = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), chain: {} as Record<string, unknown> }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/db", () => ({ db: { select: m.select } }));
import { listPrivateIdeas, getPrivateIdea } from "@/modules/ideas/queries/idea.queries";
import { listPrivateProblems, getPrivateProblem } from "@/modules/problems/queries/problem.queries";
import { listPrivateDecisions, listDecisionsForIdea, listDecisionsForProject } from "@/modules/decisions/queries/decision.queries";
import { listPrivateProjects, getPrivateProject } from "@/modules/projects/queries/project.queries";
import { listPrivateFinanceTransactions, getPrivateFinanceTransaction } from "@/modules/finance/queries/finance.queries";

const id = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: "owner-a" });
  // Every query ends in orderBy or limit; both resolve to no rows.
  const chain = { from: () => chain, where: () => chain, orderBy: async () => [], limit: async () => [] };
  m.select.mockReturnValue(chain);
});

it("drops only the ownership columns", () => {
  for (const table of [ideas, problems, projects, decisionLogs, financeTransactions]) {
    const all = Object.keys(getTableColumns(table));
    expect(Object.keys(withoutOwnership(table)).sort()).toEqual(all.filter((key) => key !== "ownerId" && key !== "visibility").sort());
  }
});

it.each([
  ["listPrivateIdeas", () => listPrivateIdeas()], ["getPrivateIdea", () => getPrivateIdea(id)],
  ["listPrivateProblems", () => listPrivateProblems()], ["getPrivateProblem", () => getPrivateProblem(id)],
  ["listPrivateDecisions", () => listPrivateDecisions()], ["listDecisionsForIdea", () => listDecisionsForIdea(id)], ["listDecisionsForProject", () => listDecisionsForProject(id)],
  ["listPrivateProjects", () => listPrivateProjects()], ["getPrivateProject", () => getPrivateProject(id)],
  ["listPrivateFinanceTransactions", () => listPrivateFinanceTransactions()], ["getPrivateFinanceTransaction", () => getPrivateFinanceTransaction(id)],
])("%s never selects owner or visibility", async (_name, run) => {
  await run();
  expect(m.select).toHaveBeenCalledOnce();
  const selected = Object.keys(m.select.mock.calls[0]![0] as object);
  expect(selected).toContain("id");
  expect(selected).not.toContain("ownerId");
  expect(selected).not.toContain("visibility");
});
