"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { evidence, ideas, problems } from "@/db/schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";
import { createEvidenceSchema, updateEvidenceContentSchema } from "../schemas/evidence.schema";

export type EvidenceResult =
  | { ok: true; evidenceId: string }
  | { ok: false; reason: "unauthorized" | "invalid" | "not_found" | "failed"; error: string };

const failed = { ok: false as const, reason: "failed" as const, error: "Could not save the evidence. Please try again." };

function refresh(parent: { ideaId: string | null }) {
  revalidatePath("/private/research");
  revalidatePath("/private/problems");
  if (parent.ideaId) revalidatePath(`/private/ideas/${parent.ideaId}`);
}

// Only the listed fields are read from the form: owner, visibility and extra parent IDs sent by a client are ignored.
function contentFields(formData: FormData) {
  return {
    title: formData.get("title"),
    summary: formData.get("summary"),
    kind: formData.get("kind"),
    signal: formData.get("signal"),
    sourceUrl: formData.get("sourceUrl") ?? "",
  };
}

export async function createEvidence(formData: FormData): Promise<EvidenceResult> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, reason: "unauthorized", error: "Sign in again to save this evidence." };
  const parsed = createEvidenceSchema.safeParse({ ...contentFields(formData), parent: formData.get("parent") });
  if (!parsed.success) return { ok: false, reason: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid evidence." };
  if (!db) return failed;
  const { parent, ...content } = parsed.data;
  try {
    // A foreign key never authorizes (ADR-012): the parent must belong to this owner and be PRIVATE.
    const [owned] = parent.type === "idea"
      ? await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.id, parent.id), eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE"))).limit(1)
      : await db.select({ id: problems.id }).from(problems).where(and(eq(problems.id, parent.id), eq(problems.ownerId, owner.id), eq(problems.visibility, "PRIVATE"))).limit(1);
    if (!owned) return { ok: false, reason: "not_found", error: `${parent.type === "idea" ? "Idea" : "Problem"} not found. The evidence was not saved.` };
    const ideaId = parent.type === "idea" ? owned.id : null;
    const [created] = await db.insert(evidence).values({
      ownerId: owner.id,
      problemId: parent.type === "problem" ? owned.id : null,
      ideaId,
      title: content.title,
      summary: content.summary,
      kind: content.kind,
      signal: content.signal,
      sourceUrl: content.sourceUrl || null,
      visibility: "PRIVATE",
    }).returning({ id: evidence.id });
    if (!created) return failed;
    refresh({ ideaId });
    return { ok: true, evidenceId: created.id };
  } catch (error) {
    reportError("evidence.create", error);
    return failed;
  }
}

export async function updateEvidenceContent(formData: FormData): Promise<EvidenceResult> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, reason: "unauthorized", error: "Sign in again to save changes." };
  const parsed = updateEvidenceContentSchema.safeParse({ ...contentFields(formData), evidenceId: formData.get("evidenceId") });
  if (!parsed.success) return { ok: false, reason: "invalid", error: parsed.error.issues[0]?.message ?? "Invalid evidence." };
  if (!db) return failed;
  const { evidenceId, ...content } = parsed.data;
  try {
    // Content only: the parent, owner and visibility never change after creation (ADR-012). updatedAt is set by $onUpdate.
    const [changed] = await db.update(evidence).set({
      title: content.title,
      summary: content.summary,
      kind: content.kind,
      signal: content.signal,
      sourceUrl: content.sourceUrl || null,
    }).where(and(eq(evidence.id, evidenceId), eq(evidence.ownerId, owner.id), eq(evidence.visibility, "PRIVATE")))
      .returning({ id: evidence.id, ideaId: evidence.ideaId });
    if (!changed) return { ok: false, reason: "not_found", error: "Evidence not found. Changes were not saved." };
    refresh({ ideaId: changed.ideaId });
    return { ok: true, evidenceId: changed.id };
  } catch (error) {
    reportError("evidence.updateContent", error);
    return failed;
  }
}
