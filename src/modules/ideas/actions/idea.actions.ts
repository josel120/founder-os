"use server";

import { ideas, problems } from "@/db/schema";
import { db } from "@/db";
import { createIdeaSchema } from "../schemas/idea.schema";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createIdeaFromProblemSchema, updateIdeaContentSchema, updateIdeaStatusSchema } from "../schemas/idea.schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";

export async function createIdea(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Unauthorized" };
  const parsed = createIdeaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    source: formData.get("source") ?? "OWN",
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid idea" };
  if (!db) return { ok: false, error: "Database is not configured" };

  try {
    await db.insert(ideas).values({
      ownerId: owner.id,
      title: parsed.data.title,
      description: parsed.data.description,
      source: parsed.data.source,
      status: "INBOX",
      visibility: "PRIVATE",
    });
  } catch (error) {
    reportError("ideas.create", error);
    return { ok: false, error: "Could not save the idea. Please try again." };
  }
  revalidatePath("/private/ideas");
  return { ok: true };
}

export async function updateIdeaStatus(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  const parsed = updateIdeaStatusSchema.safeParse({ ideaId: formData.get("ideaId"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, error: "Invalid idea or status." };
  try {
    const changed = await db.update(ideas).set({ status: parsed.data.status, updatedAt: new Date() }).where(and(eq(ideas.id, parsed.data.ideaId), eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE"))).returning({ id: ideas.id });
    if (changed.length === 0) return { ok: false, error: "Idea not found. Changes were not saved." };
  } catch (error) {
    reportError("ideas.updateStatus", error);
    return { ok: false, error: "Could not save changes. Please try again." };
  }
  revalidatePath("/private/ideas");
  revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
  return { ok: true };
}

export async function updateIdeaContent(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  const parsed = updateIdeaContentSchema.safeParse({
    ideaId: formData.get("ideaId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid idea content." };
  try {
    const changed = await db.update(ideas).set({
      title: parsed.data.title,
      description: parsed.data.description,
      updatedAt: new Date(),
    }).where(and(
      eq(ideas.id, parsed.data.ideaId),
      eq(ideas.ownerId, owner.id),
      eq(ideas.visibility, "PRIVATE"),
    )).returning({ id: ideas.id });
    if (changed.length === 0) return { ok: false, error: "Idea not found. Changes were not saved." };
  } catch (error) {
    reportError("ideas.updateContent", error);
    return { ok: false, error: "Could not save changes. Please try again." };
  }
  revalidatePath("/private/ideas");
  revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
  return { ok: true };
}

export async function createIdeaFromProblem(formData: FormData): Promise<{ ok: true; ideaId: string } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to create the idea." };
  const parsed = createIdeaFromProblemSchema.safeParse({ problemId: formData.get("problemId") });
  if (!parsed.success) return { ok: false, error: "Invalid problem." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  try {
    const [problem] = await db.select({ id: problems.id, title: problems.title, description: problems.description }).from(problems)
      .where(and(eq(problems.id, parsed.data.problemId), eq(problems.ownerId, owner.id), eq(problems.visibility, "PRIVATE"))).limit(1);
    if (!problem) return { ok: false, error: "Problem not found. No idea was created." };
    const [created] = await db.insert(ideas).values({
      ownerId: owner.id,
      problemId: problem.id,
      title: problem.title,
      description: problem.description,
      source: "OWN",
      status: "INBOX",
      visibility: "PRIVATE",
    }).returning({ id: ideas.id });
    if (!created) return { ok: false, error: "Could not create the idea. Please try again." };
    revalidatePath("/private/ideas");
    return { ok: true, ideaId: created.id };
  } catch (error) {
    reportError("ideas.createFromProblem", error);
    return { ok: false, error: "Could not create the idea. Please try again." };
  }
}
