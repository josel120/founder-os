import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiRuns, ideas } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { assessmentOutputSchema, summaryOutputSchema, type AssessmentOutput, type SummaryOutput } from "../services/output";
import { activeProvider } from "../services/provider";
import { countRunsToday, DAILY_RUN_LIMIT } from "../services/run";

const HISTORY_LIMIT = 20;

export type AIRunView = {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  model: string;
  error: string | null;
  createdAt: Date;
} & ({ kind: "ASSESSMENT"; output: AssessmentOutput | null } | { kind: "SUMMARY"; output: SummaryOutput | null });

/** The session owner's runs on one of their PRIVATE ideas, newest first. Stored output is re-validated on read. */
export async function listIdeaRuns(ideaId: string): Promise<AIRunView[]> {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(ideaId).success) return [];
  const rows = await db.select({ id: aiRuns.id, kind: aiRuns.kind, status: aiRuns.status, model: aiRuns.model, error: aiRuns.error, output: aiRuns.output, createdAt: aiRuns.createdAt })
    .from(aiRuns)
    .innerJoin(ideas, and(eq(ideas.id, aiRuns.ideaId), eq(ideas.ownerId, aiRuns.ownerId)))
    .where(and(eq(aiRuns.ideaId, ideaId), eq(aiRuns.ownerId, owner.id), eq(aiRuns.visibility, "PRIVATE"), eq(ideas.visibility, "PRIVATE")))
    .orderBy(desc(aiRuns.createdAt)).limit(HISTORY_LIMIT);
  return rows.map(({ kind, output, ...row }): AIRunView => {
    if (kind === "ASSESSMENT") {
      const parsed = assessmentOutputSchema.safeParse(output);
      return { ...row, kind, output: parsed.success ? parsed.data : null };
    }
    const parsed = summaryOutputSchema.safeParse(output);
    return { ...row, kind, output: parsed.success ? parsed.data : null };
  });
}

/** Whether AI is configured and how many of today's runs the session owner has used. */
export async function getAIStatus(): Promise<{ configured: boolean; provider: string; used: number; limit: number } | null> {
  const owner = await requireAuth();
  if (!owner) return null;
  const provider = activeProvider();
  // Only the provider's display name leaves the server, never its key or URL.
  return { configured: provider !== null, provider: provider?.label ?? "Groq", used: await countRunsToday(owner.id), limit: DAILY_RUN_LIMIT };
}
