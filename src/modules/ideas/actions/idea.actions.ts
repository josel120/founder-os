"use server";

import { ideas } from "@/db/schema";
import { db } from "@/db";
import { createIdeaSchema } from "../schemas/idea.schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { updateIdeaStatusSchema } from "../schemas/idea.schema";

export async function createIdea(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = createIdeaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    source: formData.get("source") ?? "OWN",
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid idea" };
  if (!db) return { ok: false, error: "Database is not configured" };

  await db.insert(ideas).values({
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

export async function updateIdeaStatus(formData: FormData): Promise<void> {
  if (!db) return;
  const parsed = updateIdeaStatusSchema.safeParse({ ideaId: formData.get("ideaId"), status: formData.get("status") });
  if (!parsed.success) return;
  await db.update(ideas).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(ideas.id, parsed.data.ideaId));
  revalidatePath("/private/ideas");
  revalidatePath(`/private/ideas/${parsed.data.ideaId}`);
}
