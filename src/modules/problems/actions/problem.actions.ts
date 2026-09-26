"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { problems } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { createProblemSchema, updateProblemContentSchema } from "../schemas/problem.schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";

export async function createProblem(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save this problem." };
  const parsed = createProblemSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid problem." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  try {
    await db.insert(problems).values({ ownerId: owner.id, title: parsed.data.title, description: parsed.data.description, visibility: "PRIVATE" });
  } catch (error) {
    reportError("problems.create", error);
    return { ok: false, error: "Could not save the problem. Please try again." };
  }
  revalidatePath("/private/problems");
  return { ok: true };
}

export async function updateProblemContent(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  const parsed = updateProblemContentSchema.safeParse({ problemId: formData.get("problemId"), title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid problem." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  const { problemId, title, description } = parsed.data;
  try {
    const changed = await db.update(problems).set({ title, description, updatedAt: new Date() })
      .where(and(eq(problems.id, problemId), eq(problems.ownerId, owner.id), eq(problems.visibility, "PRIVATE")))
      .returning({ id: problems.id });
    if (changed.length === 0) return { ok: false, error: "Problem not found. Changes were not saved." };
  } catch (error) {
    reportError("problems.updateContent", error);
    return { ok: false, error: "Could not save changes. Please try again." };
  }
  revalidatePath("/private/problems");
  revalidatePath(`/private/problems/${problemId}`);
  return { ok: true };
}
