import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { problems } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function listPrivateProblems() {
  const owner = await requireAuth();
  if (!owner) return [];
  if (!db) return [];
  return db.select().from(problems).where(and(eq(problems.visibility, "PRIVATE"), eq(problems.ownerId, owner.id))).orderBy(desc(problems.createdAt));
}
