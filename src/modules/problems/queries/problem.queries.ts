import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { problems } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { withoutOwnership } from "@/db/columns";

const columns = withoutOwnership(problems);

export async function listPrivateProblems() {
  const owner = await requireAuth();
  if (!owner) return [];
  if (!db) return [];
  return db.select(columns).from(problems).where(and(eq(problems.visibility, "PRIVATE"), eq(problems.ownerId, owner.id))).orderBy(desc(problems.createdAt));
}

export async function getPrivateProblem(id: string) {
  const owner = await requireAuth();
  if (!owner || !z.string().uuid().safeParse(id).success) return null;
  if (!db) return null;
  const result = await db.select(columns).from(problems).where(and(eq(problems.id, id), eq(problems.ownerId, owner.id), eq(problems.visibility, "PRIVATE"))).limit(1);
  return result[0] ?? null;
}
