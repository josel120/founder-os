import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ideas } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function listPrivateIdeas() {
  const owner = await requireAuth();
  if (!owner) return [];
  if (!db) return [];
  return db.select().from(ideas).where(and(eq(ideas.visibility, "PRIVATE"), eq(ideas.ownerId, owner.id))).orderBy(desc(ideas.createdAt));
}

export async function getPrivateIdea(id: string) {
  const owner = await requireAuth();
  if (!owner || !z.string().uuid().safeParse(id).success) return null;
  if (!db) return null;
  const result = await db.select().from(ideas).where(and(eq(ideas.id, id), eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE"))).limit(1);
  return result[0] ?? null;
}
