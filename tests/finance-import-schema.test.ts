import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { financeImports, financeTransactions, users } from "../src/db/schema";

const migrationsDir = join(__dirname, "../src/db/migrations");
const read = (file: string) => readFileSync(join(migrationsDir, file), "utf8");
const migration = read("0010_finance_import.sql");
const journal = JSON.parse(read("meta/_journal.json")) as { entries: { idx: number; tag: string }[] };
const imports = getTableConfig(financeImports);
const transactions = getTableConfig(financeTransactions);
const foreignKeyFor = (config: typeof imports, column: PgColumn) => config.foreignKeys.find((fk) => fk.reference().columns.includes(column));

describe("finance import contract (ADR-020)", () => {
  it("records an owned batch with bounded counts and file name", () => {
    expect(financeImports.ownerId.notNull).toBe(true);
    expect(foreignKeyFor(imports, financeImports.ownerId)?.reference().foreignTable).toBe(users);
    expect(foreignKeyFor(imports, financeImports.ownerId)?.onDelete).toBe("restrict");
    expect(imports.checks.map((check) => check.name)).toEqual(["finance_import_file_name_length", "finance_import_counts"]);
    expect(migration).toContain(`CHECK (char_length("finance_import"."file_name") BETWEEN 1 AND 200)`);
    expect(migration).toContain(`"finance_import"."imported_count" + "finance_import"."skipped_count" <= "finance_import"."row_count"`);
  });

  it("links imported transactions to their batch, which cannot be deleted while they exist", () => {
    const fk = foreignKeyFor(transactions, financeTransactions.importId);
    expect(fk?.reference().foreignTable).toBe(financeImports);
    expect(fk?.onDelete).toBe("restrict");
    expect(financeTransactions.importId.notNull).toBe(false);
    expect(financeTransactions.importKey.notNull).toBe(false);
  });

  it("rejects a re-imported row per owner, ignoring manual transactions", () => {
    const unique = transactions.indexes.find((index) => index.config.name === "finance_transaction_owner_import_key_idx");
    expect(unique?.config.unique).toBe(true);
    expect(migration).toContain(`CREATE UNIQUE INDEX "finance_transaction_owner_import_key_idx" ON "finance_transaction" USING btree ("owner_id","import_key") WHERE "finance_transaction"."import_key" IS NOT NULL`);
  });

  it("requires import id and key together", () => {
    expect(transactions.checks.map((check) => check.name)).toEqual(["finance_transaction_import_pair"]);
    expect(migration).toContain(`CHECK (("finance_transaction"."import_id" IS NULL) = ("finance_transaction"."import_key" IS NULL))`);
  });
});

describe("migration 0010", () => {
  it("follows 0009 in the journal", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(journal.entries.slice(9, 11).map((entry) => entry.tag)).toEqual(["0009_project_github", "0010_finance_import"]);
  });

  it("only adds: a table, nullable columns, constraints and indexes", () => {
    for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim())) {
          // New columns on the existing table are plain nullable types.
      expect(statement).toMatch(/^(CREATE TABLE "finance_import" |ALTER TABLE "finance_transaction" ADD COLUMN "import_(id|key)" (uuid|text);$|ALTER TABLE "(finance_import|finance_transaction)" ADD CONSTRAINT |CREATE (UNIQUE )?INDEX "finance_)/);
    }
    const withoutFkActions = migration.replace(/\bON (DELETE|UPDATE) (RESTRICT|NO ACTION|CASCADE|SET NULL|SET DEFAULT)\b/gi, "");
    expect(withoutFkActions).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  });
});
