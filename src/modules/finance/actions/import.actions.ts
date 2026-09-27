"use server";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { financeImports, financeTransactions } from "@/db/schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";
import { buildImportRows, type ImportRow, type ImportRowError } from "../services/import";
import { parseImportRequest } from "../services/import-request";
import { totalsByCurrency } from "../services/totals";
import { IMPORT_SOURCE } from "../schemas/import.limits";

const signIn = { ok: false as const, error: "Sign in again to import." };
const failure = { ok: false as const, error: "Could not import the file. Nothing was saved." };
const KEY_CHUNK = 1000;
const INSERT_CHUNK = 500;
const PREVIEW_ROWS = 20;
const PREVIEW_ERRORS = 50;

type PreviewRow = Pick<ImportRow, "line" | "type" | "amount" | "currency" | "category"> & { date: string };
export type ImportPreview = {
  ok: true;
  headers: string[];
  sample: string[][];
  totalRows: number;
  mapped: null | { newCount: number; duplicateCount: number; errorCount: number; errors: ImportRowError[]; rows: PreviewRow[]; totals: ReturnType<typeof totalsByCurrency> };
};
type Failure = { ok: false; error: string };

const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

/** Keys of `rows` the owner already has in the ledger (a re-import), owner-scoped. */
async function existingKeys(ownerId: string, rows: ImportRow[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!db) return found;
  for (const keys of chunks(rows.map((row) => row.importKey), KEY_CHUNK)) {
    const matches = await db.select({ key: financeTransactions.importKey }).from(financeTransactions)
      .where(and(eq(financeTransactions.ownerId, ownerId), eq(financeTransactions.visibility, "PRIVATE"), isNotNull(financeTransactions.importKey), inArray(financeTransactions.importKey, keys)));
    for (const { key } of matches) if (key) found.add(key);
  }
  return found;
}

/**
 * Step 1 without a mapping: headers and a few sample rows so the owner can map columns. Step 2 with a mapping: every row
 * validated, with the new rows, duplicates of earlier imports and errors counted. Nothing is written.
 */
export async function previewFinanceImport(formData: FormData): Promise<ImportPreview | Failure> {
  const owner = await requireAuth();
  if (!owner) return signIn;
  const request = parseImportRequest(formData);
  if (!request.ok) return request;
  const { csv, mapping } = request;
  const base = { ok: true as const, headers: csv.headers, sample: csv.rows.slice(0, 5), totalRows: csv.rows.length };
  if (!mapping) return { ...base, mapped: null };
  const built = buildImportRows(csv, mapping);
  if (!db) return failure;
  try {
    const existing = await existingKeys(owner.id, built.rows);
    const fresh = built.rows.filter((row) => !existing.has(row.importKey));
    return {
      ...base,
      mapped: {
        newCount: fresh.length, duplicateCount: built.rows.length - fresh.length, errorCount: built.errors.length, errors: built.errors.slice(0, PREVIEW_ERRORS),
        rows: fresh.slice(0, PREVIEW_ROWS).map((row) => ({ line: row.line, date: row.occurredAt.toISOString().slice(0, 10), type: row.type, amount: row.amount, currency: row.currency, category: row.category })),
        totals: totalsByCurrency(fresh),
      },
    };
  } catch (error) {
    reportError("finance.importPreview", error);
    return failure;
  }
}

/**
 * Imports the file's valid rows in one transaction. Rows already imported (same key) are skipped by the unique index,
 * so importing the same file twice adds nothing. Invalid rows are skipped and counted.
 */
export async function confirmFinanceImport(formData: FormData): Promise<{ ok: true; importId: string | null; imported: number; skipped: number } | Failure> {
  const owner = await requireAuth();
  if (!owner) return signIn;
  const request = parseImportRequest(formData);
  if (!request.ok) return request;
  if (!request.mapping) return { ok: false, error: "Map the columns first." };
  const { rows, errors } = buildImportRows(request.csv, request.mapping);
  const rowCount = request.csv.rows.length;
  if (!db) return failure;
  const database = db;
  try {
    const result = await database.transaction(async (tx) => {
      const [batch] = await tx.insert(financeImports).values({ ownerId: owner.id, fileName: request.mapping!.fileName, rowCount, importedCount: 0, skippedCount: 0 }).returning({ id: financeImports.id });
      if (!batch) throw new Error("import batch not created");
      let imported = 0;
      for (const chunk of chunks(rows, INSERT_CHUNK)) {
        const inserted = await tx.insert(financeTransactions).values(chunk.map((row) => ({
          ownerId: owner.id, projectId: null, type: row.type, category: row.category, amount: row.amount, currency: row.currency,
          source: IMPORT_SOURCE, externalId: row.externalId ?? null, occurredAt: row.occurredAt, visibility: "PRIVATE" as const,
          importId: batch.id, importKey: row.importKey,
        }))).onConflictDoNothing({ target: [financeTransactions.ownerId, financeTransactions.importKey], where: sql`${financeTransactions.importKey} IS NOT NULL` })
          .returning({ id: financeTransactions.id });
        imported += inserted.length;
      }
      if (imported === 0) {
        // Nothing new: no empty batch is kept.
        await tx.delete(financeImports).where(and(eq(financeImports.id, batch.id), eq(financeImports.ownerId, owner.id)));
        return { importId: null, imported, skipped: rowCount };
      }
      const skipped = rows.length - imported + errors.length;
      await tx.update(financeImports).set({ importedCount: imported, skippedCount: skipped }).where(and(eq(financeImports.id, batch.id), eq(financeImports.ownerId, owner.id)));
      return { importId: batch.id, imported, skipped };
    });
    revalidatePath("/private/finance");
    return { ok: true, ...result };
  } catch (error) {
    reportError("finance.importConfirm", error);
    return failure;
  }
}

/** Removes one of the owner's imports: its transactions, then the batch, in one transaction. */
export async function undoFinanceImport(formData: FormData): Promise<{ ok: true; removed: number } | Failure> {
  const owner = await requireAuth();
  if (!owner) return signIn;
  const parsed = z.object({ importId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid import." };
  if (!db) return failure;
  const { importId } = parsed.data;
  try {
    const removed = await db.transaction(async (tx) => {
      const [batch] = await tx.select({ id: financeImports.id }).from(financeImports).where(and(eq(financeImports.id, importId), eq(financeImports.ownerId, owner.id))).limit(1);
      if (!batch) return null;
      const deleted = await tx.delete(financeTransactions).where(and(eq(financeTransactions.importId, importId), eq(financeTransactions.ownerId, owner.id), eq(financeTransactions.visibility, "PRIVATE"))).returning({ id: financeTransactions.id });
      await tx.delete(financeImports).where(and(eq(financeImports.id, importId), eq(financeImports.ownerId, owner.id)));
      return deleted.length;
    });
    if (removed === null) return { ok: false, error: "Import not found." };
    revalidatePath("/private/finance");
    return { ok: true, removed };
  } catch (error) {
    reportError("finance.importUndo", error);
    return failure;
  }
}
