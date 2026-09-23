import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ideas } from "@/db/schema";

export async function listPrivateIdeas() {
  if (!db) return [];
  return db.select().from(ideas).where(eq(ideas.visibility, "PRIVATE")).orderBy(desc(ideas.createdAt));
}

export async function getPrivateIdea(id: string) {
  if (!db) return null;
  const result = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
  return result[0] ?? null;
}
