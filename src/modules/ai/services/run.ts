import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { aiRuns, evidence, ideas, problems } from "@/db/schema";
import { env } from "@/lib/env";
import { reportError } from "@/lib/report-error";
import { runTool, type AIClientError, type AIFailureReason, type Fetch } from "./anthropic-client";
import { buildIdeaInput } from "./prompt";

/** ADR-021 limits. */
export const DAILY_RUN_LIMIT = 20;
export const STALE_RUN_MS = 5 * 60 * 1000;
const EVIDENCE_LIMIT = 50;

export type RunKind = "ASSESSMENT" | "SUMMARY";
export type RunOutcome =
  | { status: "succeeded"; runId: string }
  | { status: "failed"; runId: string; error: AIClientError | "interrupted"; reason?: AIFailureReason }
  // Refusals: nothing is stored and nothing is sent.
  | { status: "not_configured" }
  | { status: "not_found" }
  | { status: "too_large" }
  | { status: "daily_limit" }
  | { status: "in_progress" }
  | { status: "unavailable" };

type Options = { apiKey?: string; apiUrl?: string; model?: string; fetchImpl?: Fetch; now?: () => Date };

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Finishes the owner's RUNNING rows older than `STALE_RUN_MS` as `interrupted` (the function died mid-call). */
async function finishStaleRuns(executor: Pick<NonNullable<typeof db>, "update">, ownerId: string, now: Date) {
  await executor.update(aiRuns).set({ status: "FAILED", error: "interrupted", finishedAt: now })
    .where(and(eq(aiRuns.ownerId, ownerId), eq(aiRuns.status, "RUNNING"), lt(aiRuns.createdAt, new Date(now.getTime() - STALE_RUN_MS))));
}

/** Runs used today (UTC) by the owner, failed ones included. */
export async function countRunsToday(ownerId: string, now = new Date()): Promise<number> {
  if (!db) return 0;
  const [row] = await db.select({ used: count() }).from(aiRuns).where(and(eq(aiRuns.ownerId, ownerId), gte(aiRuns.createdAt, startOfUtcDay(now))));
  return row?.used ?? 0;
}

/**
 * One owner-triggered run on one idea (ADR-021). The owner comes from the session, never from input. Only the
 * allowlisted fields of the owner's own PRIVATE idea, problem and evidence are read. A RUNNING row is inserted
 * (after the daily cap check, serialized per owner) before the provider call and finished after it. Nothing
 * here changes the idea, creates a decision or publishes anything.
 */
export async function runIdeaAI(ownerId: string, ideaId: string, kind: RunKind, options: Options = {}): Promise<RunOutcome> {
  const apiKey = options.apiKey ?? env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: "not_configured" };
  if (!db) return { status: "unavailable" };
  const database = db;
  const now = options.now ?? (() => new Date());
  const model = options.model ?? env.AI_MODEL;

  let runId: string;
  let input: Parameters<typeof runTool>[0]["input"];
  let promptVersion: string;
  try {
    const [idea] = await database.select({ title: ideas.title, description: ideas.description, status: ideas.status, source: ideas.source, problemId: ideas.problemId })
      .from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.ownerId, ownerId), eq(ideas.visibility, "PRIVATE"))).limit(1);
    if (!idea) return { status: "not_found" };
    const [problem] = idea.problemId
      ? await database.select({ title: problems.title, description: problems.description }).from(problems)
        .where(and(eq(problems.id, idea.problemId), eq(problems.ownerId, ownerId), eq(problems.visibility, "PRIVATE"))).limit(1)
      : [];
    const notes = await database.select({ title: evidence.title, summary: evidence.summary, kind: evidence.kind, signal: evidence.signal })
      .from(evidence).where(and(eq(evidence.ideaId, ideaId), eq(evidence.ownerId, ownerId), eq(evidence.visibility, "PRIVATE")))
      .orderBy(desc(evidence.createdAt)).limit(EVIDENCE_LIMIT);
    const prompt = buildIdeaInput({ idea, problem: problem ?? null, evidence: notes });
    if (!prompt.ok) return { status: "too_large" };
    input = prompt.text;
    promptVersion = prompt.promptVersion;

    const started = await database.transaction(async (tx) => {
      // One owner's runs are serialized here, so two clicks cannot both pass the cap.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ai_run:${ownerId}`}))`);
      const at = now();
      await finishStaleRuns(tx, ownerId, at);
      const [row] = await tx.select({ used: count() }).from(aiRuns).where(and(eq(aiRuns.ownerId, ownerId), gte(aiRuns.createdAt, startOfUtcDay(at))));
      if ((row?.used ?? 0) >= DAILY_RUN_LIMIT) return null;
      const [run] = await tx.insert(aiRuns).values({ ownerId, ideaId, kind, model, promptVersion, createdAt: at }).returning({ id: aiRuns.id });
      if (!run) throw new Error("ai run not created");
      return run.id;
    });
    if (!started) return { status: "daily_limit" };
    runId = started;
  } catch (error) {
    if (isUniqueViolation(error, "ai_run_one_running_per_idea_idx")) return { status: "in_progress" };
    reportError("ai.run.start", error);
    return { status: "unavailable" };
  }

  const result = await runTool({ kind, input, apiKey, apiUrl: options.apiUrl ?? env.AI_API_URL, model, fetchImpl: options.fetchImpl });
  const own = and(eq(aiRuns.id, runId), eq(aiRuns.ownerId, ownerId), eq(aiRuns.status, "RUNNING"));
  try {
    if (result.ok) {
      const finished = await database.update(aiRuns).set({
        status: "SUCCEEDED", output: result.output, recommendation: "recommendation" in result ? result.recommendation : null,
        model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, finishedAt: now(),
      }).where(own).returning({ id: aiRuns.id });
      // No row: the stale sweep already finished this run as interrupted, so the answer is not kept.
      return finished.length > 0 ? { status: "succeeded", runId } : { status: "failed", runId, error: "interrupted" };
    }
    await database.update(aiRuns).set({ status: "FAILED", error: result.error, finishedAt: now() }).where(own);
    return result.reason ? { status: "failed", runId, error: result.error, reason: result.reason } : { status: "failed", runId, error: result.error };
  } catch (error) {
    reportError("ai.run.finish", error);
    return { status: "unavailable" };
  }
}
