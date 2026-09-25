import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { financeTransactions } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function listPrivateFinanceTransactions(projectId?: string) {
  const owner = await requireAuth();
  if (!owner || !db) return [];
  if (projectId !== undefined && !z.string().uuid().safeParse(projectId).success) return [];
  const scope = [eq(financeTransactions.ownerId, owner.id), eq(financeTransactions.visibility, "PRIVATE")];
  if (projectId) scope.push(eq(financeTransactions.projectId, projectId));
  return db.select().from(financeTransactions).where(and(...scope)).orderBy(desc(financeTransactions.occurredAt));
}

export async function getPrivateFinanceTransaction(id: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.string().uuid().safeParse(id).success) return null;
  const [transaction] = await db.select().from(financeTransactions)
    .where(and(eq(financeTransactions.id, id), eq(financeTransactions.ownerId, owner.id), eq(financeTransactions.visibility, "PRIVATE")))
    .limit(1);
  return transaction ?? null;
}
