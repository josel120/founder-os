import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { aiRuns, decisionLogs, evidence, financeImports, financeTransactions, ideas, problems, projectGithub, projectPublications, projects } from "@/db/schema";

/**
 * ADR-022: every table the owner's own records live in. Auth tables (user, session, account, verification) and
 * rate limits are deliberately absent: they hold credentials and IP data, not the owner's work.
 */
export const EXPORT_TABLES = {
  problems,
  ideas,
  evidence,
  decisions: decisionLogs,
  projects,
  projectPublications,
  projectGithub,
  financeImports,
  financeTransactions,
  aiRuns,
} as const;

export type ExportKey = keyof typeof EXPORT_TABLES;
export const EXPORT_FORMAT = "founder-os-export";
export const EXPORT_VERSION = 1;

export type OwnerExport = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  counts: Record<ExportKey, number>;
  data: Record<ExportKey, Record<string, unknown>[]>;
};

/** All of one owner's rows, every column, owner-scoped on each table. `ownerId` must come from the session. */
export async function buildOwnerExport(ownerId: string, now = new Date()): Promise<OwnerExport | null> {
  if (!db) return null;
  const database = db;
  const entries = await Promise.all(
    (Object.keys(EXPORT_TABLES) as ExportKey[]).map(async (key) => {
      const table = EXPORT_TABLES[key];
      const rows = await database.select(getTableColumns(table)).from(table).where(eq(table.ownerId, ownerId));
      return [key, rows as Record<string, unknown>[]] as const;
    }),
  );
  const data = Object.fromEntries(entries) as OwnerExport["data"];
  const counts = Object.fromEntries(entries.map(([key, rows]) => [key, rows.length])) as OwnerExport["counts"];
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), counts, data };
}
