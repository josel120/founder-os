import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeImports } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

/** The session owner's latest imports (ADR-020). */
export async function listFinanceImports() {
  const owner = await requireAuth();
  if (!owner || !db) return [];
  return db.select({ id: financeImports.id, fileName: financeImports.fileName, rowCount: financeImports.rowCount, importedCount: financeImports.importedCount, skippedCount: financeImports.skippedCount, createdAt: financeImports.createdAt })
    .from(financeImports).where(eq(financeImports.ownerId, owner.id)).orderBy(desc(financeImports.createdAt)).limit(20);
}

export type FinanceImportSummary = Awaited<ReturnType<typeof listFinanceImports>>[number];
