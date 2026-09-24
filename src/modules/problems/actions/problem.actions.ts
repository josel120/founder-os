"use server";

import { db } from "@/db";
import { problems } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { createProblemSchema } from "../schemas/problem.schema";
import { requireAuth } from "@/lib/require-auth";

export async function createProblem(formData: FormData): Promise<void> {
  const owner = await requireAuth();
  if (!owner) return;
  if (!db) return;
  const parsed = createProblemSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return;
  await db.insert(problems).values({ ownerId: owner.id, title: parsed.data.title, description: parsed.data.description, visibility: "PRIVATE" });
  revalidatePath("/private/problems");
}
