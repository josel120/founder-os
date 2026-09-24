"use server";

import { db } from "@/db";
import { problems } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { createProblemSchema } from "../schemas/problem.schema";
import { requireAuth } from "@/lib/require-auth";

export async function createProblem(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save this problem." };
  const parsed = createProblemSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid problem." };
  if (!db) return { ok: false, error: "Database is unavailable." };
  try {
    await db.insert(problems).values({ ownerId: owner.id, title: parsed.data.title, description: parsed.data.description, visibility: "PRIVATE" });
  } catch {
    return { ok: false, error: "Could not save the problem. Please try again." };
  }
  revalidatePath("/private/problems");
  return { ok: true };
}
