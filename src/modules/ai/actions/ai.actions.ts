"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { DAILY_RUN_LIMIT, runIdeaAI, type RunKind, type RunOutcome } from "../services/run";

type Result = { ok: true; message: string } | { ok: false; error: string };

const failures: Record<string, string> = {
  unauthorized: "Anthropic refused the API key. Check ANTHROPIC_API_KEY.",
  rate_limited: "Anthropic's rate limit was reached. Try again later.",
  unavailable: "The AI provider did not answer. Try again later.",
  invalid_output: "The answer did not have the expected shape, so it was not kept. Try again.",
  too_large: "This idea's notes are too long to send.",
  interrupted: "The run took too long and was stopped. Try again.",
};

function resultFor(outcome: RunOutcome, done: string): Result {
  switch (outcome.status) {
    case "succeeded": return { ok: true, message: done };
    case "failed": return { ok: false, error: failures[outcome.error] ?? failures.unavailable! };
    case "not_configured": return { ok: false, error: "AI is not connected yet: ANTHROPIC_API_KEY is not set." };
    case "not_found": return { ok: false, error: "Idea not found." };
    case "too_large": return { ok: false, error: failures.too_large! };
    case "daily_limit": return { ok: false, error: `You have used today's ${DAILY_RUN_LIMIT} AI runs. The limit resets at 00:00 UTC.` };
    case "in_progress": return { ok: false, error: "A run on this idea is already in progress." };
    case "unavailable": return { ok: false, error: failures.unavailable! };
  }
}

async function run(formData: FormData, kind: RunKind, done: string): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to run this." };
  const parsed = z.object({ ideaId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid idea." };
  const outcome = await runIdeaAI(owner.id, parsed.data.ideaId, kind);
  if (outcome.status === "succeeded" || outcome.status === "failed") revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
  return resultFor(outcome, done);
}

/** A second opinion on the owner's idea (ADR-021). It never changes the idea. */
export async function runIdeaAssessment(formData: FormData): Promise<Result> {
  return run(formData, "ASSESSMENT", "Assessment ready. You decide what to do with it.");
}

/** A summary of the owner's evidence on the idea (ADR-021). */
export async function runResearchSummary(formData: FormData): Promise<Result> {
  return run(formData, "SUMMARY", "Research summary ready.");
}
