"use server";

import { ideas } from "@/db/schema";
import { db } from "@/db";
import { createIdeaSchema } from "../schemas/idea.schema";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { updateIdeaStatusSchema } from "../schemas/idea.schema";
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

  await db.insert(ideas).values({
    ownerId: owner.id,
    title: parsed.data.title,
    description: parsed.data.description,
    source: parsed.data.source,
    status: "INBOX",
    visibility: "PRIVATE",
  });
  revalidatePath("/private/ideas");
  return { ok: true };
}

export async function createIdeaAction(formData: FormData): Promise<void> {
  await createIdea(formData);
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
  } catch {
    return { ok: false, error: "Could not save changes. Please try again." };
  }
  revalidatePath("/private/ideas");
  revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
  return { ok: true };
}
