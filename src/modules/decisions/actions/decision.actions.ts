"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { decisionLogs, ideas } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { createDecisionSchema } from "../schemas/decision.schema";

export async function createDecision(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save this decision." };
  const ideaId = formData.get("ideaId");
  const parsed = createDecisionSchema.safeParse({
    title: formData.get("title"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
    ideaId: typeof ideaId === "string" && ideaId !== "" ? ideaId : undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid decision." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  try {
    if (parsed.data.ideaId) {
      const [idea] = await db.select({ id: ideas.id }).from(ideas)
        .where(and(eq(ideas.id, parsed.data.ideaId), eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE"))).limit(1);
      if (!idea) return { ok: false, error: "Idea not found. The decision was not saved." };
    }
    await db.insert(decisionLogs).values({
      ownerId: owner.id,
      ideaId: parsed.data.ideaId ?? null,
      title: parsed.data.title,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
      visibility: "PRIVATE",
    });
  } catch {
    return { ok: false, error: "Could not save the decision. Please try again." };
  }
  revalidatePath("/private/decisions");
  if (parsed.data.ideaId) revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
  return { ok: true };
}
