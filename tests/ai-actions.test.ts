// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const m = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn(), revalidate: vi.fn(), where: vi.fn(), limit: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/env", () => ({ env: { ANTHROPIC_API_KEY: "sk-ant-test-key-1234567890" } }));
vi.mock("@/modules/ai/services/run", () => ({ DAILY_RUN_LIMIT: 20, runIdeaAI: m.run, countRunsToday: m.count }));
vi.mock("@/db", () => {
  const chain = { from: () => chain, innerJoin: () => chain, where: (w: unknown) => { m.where(w); return chain; }, orderBy: () => chain, limit: m.limit };
  return { db: { select: () => chain } };
});
import { runIdeaAssessment, runResearchSummary } from "@/modules/ai/actions/ai.actions";
import { getAIStatus, listIdeaRuns } from "@/modules/ai/queries/ai.queries";

const ideaId = "00000000-0000-4000-8000-000000000001";
const form = (value: string) => { const data = new FormData(); data.set("ideaId", value); return data; };
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: "owner-a" }); });

it("requires the owner's session and a valid idea id before running anything", async () => {
  m.auth.mockResolvedValue(null);
  expect(await runIdeaAssessment(form(ideaId))).toEqual({ ok: false, error: "Sign in again to run this." });
  m.auth.mockResolvedValue({ id: "owner-a" });
  expect(await runIdeaAssessment(form("not-a-uuid"))).toEqual({ ok: false, error: "Invalid idea." });
  expect(m.run).not.toHaveBeenCalled();
});

it("runs with the session owner, never an owner from the form, and refreshes the idea page", async () => {
  m.run.mockResolvedValue({ status: "succeeded", runId: "r" });
  const data = form(ideaId);
  data.set("ownerId", "owner-b");
  expect(await runResearchSummary(data)).toEqual({ ok: true, message: "Research summary ready." });
  expect(m.run).toHaveBeenCalledWith("owner-a", ideaId, "SUMMARY");
  expect(m.revalidate).toHaveBeenCalledWith(`/private/ideas/${ideaId}`);
});

it("explains refusals and failures with fixed messages only", async () => {
  const cases: [unknown, string][] = [
    [{ status: "not_configured" }, "AI is not connected yet: ANTHROPIC_API_KEY is not set."],
    [{ status: "daily_limit" }, "You have used today's 20 AI runs. The limit resets at 00:00 UTC."],
    [{ status: "in_progress" }, "A run on this idea is already in progress."],
    [{ status: "not_found" }, "Idea not found."],
    [{ status: "failed", runId: "r", error: "invalid_output" }, "The answer did not have the expected shape, so it was not kept. Try again."],
    [{ status: "failed", runId: "r", error: "unavailable", reason: "billing" }, "Anthropic says this account has no credit. Add credit under Billing in the Anthropic console, then try again."],
    [{ status: "failed", runId: "r", error: "unavailable", reason: "model_unavailable" }, "The configured model (AI_MODEL) is not available to this Anthropic account."],
  ];
  for (const [outcome, error] of cases) {
    m.run.mockResolvedValueOnce(outcome);
    expect(await runIdeaAssessment(form(ideaId))).toEqual({ ok: false, error });
  }
  expect(m.revalidate).toHaveBeenCalledTimes(3); // only the failed runs were stored
});

it("lists only the owner's runs on their PRIVATE idea and drops stored output that no longer validates", async () => {
  const createdAt = new Date("2026-09-27T12:00:00Z");
  m.limit.mockResolvedValue([
    { id: "1", kind: "ASSESSMENT", status: "SUCCEEDED", model: "m", error: null, createdAt, output: { recommendation: "CONTINUE", rationale: "r", risks: [], openQuestions: [] } },
    { id: "2", kind: "SUMMARY", status: "SUCCEEDED", model: "m", error: null, createdAt, output: { unexpected: true } },
  ]);
  const runs = await listIdeaRuns(ideaId);
  expect(runs.map((run) => [run.id, run.output === null])).toEqual([["1", false], ["2", true]]);
  expect(new PgDialect().sqlToQuery(m.where.mock.calls[0]![0] as SQL).params).toEqual([ideaId, "owner-a", "PRIVATE", "PRIVATE"]);

  m.auth.mockResolvedValue(null);
  expect(await listIdeaRuns(ideaId)).toEqual([]);
  expect(await getAIStatus()).toBeNull();
});

it("reports whether AI is configured and today's usage", async () => {
  m.count.mockResolvedValue(3);
  expect(await getAIStatus()).toEqual({ configured: true, used: 3, limit: 20 });
  expect(m.count).toHaveBeenCalledWith("owner-a");
});
