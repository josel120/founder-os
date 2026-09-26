import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, PgDialect, type PgColumn } from "drizzle-orm/pg-core";
import { evidence, ideas, problems, users } from "../src/db/schema";

const migrationsDir = join(__dirname, "../src/db/migrations");
const read = (file: string) => readFileSync(join(migrationsDir, file), "utf8");
const evidenceMigrations = { "0005_research_evidence.sql": read("0005_research_evidence.sql"), "0006_evidence_hardening.sql": read("0006_evidence_hardening.sql") };
const journal = JSON.parse(read("meta/_journal.json")) as { entries: { idx: number; tag: string }[] };

function foreignKeyFor(column: PgColumn) {
  return getTableConfig(evidence).foreignKeys.find((fk) => fk.reference().columns.includes(column));
}

/** Additive means no row changes and nothing dropped except a column default. FK referential actions are allowed. */
function destructiveStatements(sqlText: string): string[] {
  const withoutFkActions = sqlText.replace(/\bON (DELETE|UPDATE) (RESTRICT|NO ACTION|CASCADE|SET NULL|SET DEFAULT)\b/gi, "");
  const found = [...withoutFkActions.matchAll(/\b(UPDATE|DELETE|TRUNCATE)\b/gi)].map((m) => m[0]!.toUpperCase());
  found.push(...[...withoutFkActions.matchAll(/\bDROP\s+(NOT\s+NULL|\w+)/gi)].filter((m) => m[1]!.toUpperCase() !== "DEFAULT").map((m) => m[0]!.toUpperCase()));
  return found;
}

describe("research evidence ownership contract", () => {
  it("requires an owner and is private by default", () => {
    expect(evidence.ownerId.notNull).toBe(true);
    expect(evidence.visibility.notNull).toBe(true);
    expect(evidence.visibility.default).toBe("PRIVATE");
  });

  it("references owner and parents with restrictive deletion", () => {
    const expected = [
      [evidence.ownerId, users],
      [evidence.problemId, problems],
      [evidence.ideaId, ideas],
    ] as const;
    for (const [column, table] of expected) {
      const fk = foreignKeyFor(column);
      expect(fk?.reference().foreignTable).toBe(table);
      expect(fk?.onDelete).toBe("restrict");
    }
  });

  it("allows exactly one parent, in the schema and in the migration", () => {
    const [check, ...others] = getTableConfig(evidence).checks;
    expect(others).toHaveLength(0);
    expect(check?.name).toBe("evidence_exactly_one_parent");
    expect(new PgDialect().sqlToQuery(check!.value).sql).toBe('num_nonnulls("evidence"."problem_id", "evidence"."idea_id") = 1');
    expect(evidenceMigrations["0005_research_evidence.sql"]).toContain('CONSTRAINT "evidence_exactly_one_parent" CHECK (num_nonnulls("evidence"."problem_id", "evidence"."idea_id") = 1)');
  });

  it("indexes the owner and both parents", () => {
    const indexes = getTableConfig(evidence).indexes.map((index) => [index.config.name, index.config.columns.map((column) => (column as PgColumn).name)]);
    expect(indexes).toEqual([
      ["evidence_owner_id_idx", ["owner_id"]],
      ["evidence_problem_id_idx", ["problem_id"]],
      ["evidence_idea_id_idx", ["idea_id"]],
    ]);
    const migration = evidenceMigrations["0006_evidence_hardening.sql"];
    expect(migration).toContain('CREATE INDEX "evidence_problem_id_idx" ON "evidence" USING btree ("problem_id")');
    expect(migration).toContain('CREATE INDEX "evidence_idea_id_idx" ON "evidence" USING btree ("idea_id")');
  });

  it("has no kind or signal default, so an insert must choose both", () => {
    for (const column of [evidence.kind, evidence.signal]) {
      expect(column.notNull).toBe(true);
      expect(column.hasDefault).toBe(false);
      expect(column.default).toBeUndefined();
    }
    const migration = evidenceMigrations["0006_evidence_hardening.sql"];
    expect(migration).toContain('ALTER TABLE "evidence" ALTER COLUMN "kind" DROP DEFAULT');
    expect(migration).toContain('ALTER TABLE "evidence" ALTER COLUMN "signal" DROP DEFAULT');
  });

  it("stamps updatedAt on every update", () => {
    const before = Date.now();
    const stamped = evidence.updatedAt.onUpdateFn?.();
    expect(stamped).toBeInstanceOf(Date);
    expect((stamped as Date).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("evidence migrations", () => {
  it("follow 0004 in order in the journal", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(journal.entries.slice(5, 7).map((entry) => entry.tag)).toEqual(["0005_research_evidence", "0006_evidence_hardening"]);
  });

  it.each(Object.entries(evidenceMigrations))("%s is additive only", (_file, sqlText) => {
    expect(destructiveStatements(sqlText)).toEqual([]);
    for (const statement of sqlText.split("--> statement-breakpoint").map((part) => part.trim())) {
      expect(statement).toMatch(/^(CREATE (TYPE|TABLE|INDEX) |ALTER TABLE "evidence" (ADD CONSTRAINT |ALTER COLUMN "\w+" DROP DEFAULT;?$))/);
    }
  });

  it("the additive guard catches destructive SQL and allows FK actions", () => {
    expect(destructiveStatements('UPDATE "idea" SET "owner_id" = NULL')).toEqual(["UPDATE"]);
    expect(destructiveStatements('DELETE FROM "evidence"')).toEqual(["DELETE"]);
    expect(destructiveStatements('TRUNCATE "evidence"')).toEqual(["TRUNCATE"]);
    expect(destructiveStatements('ALTER TABLE "evidence" DROP COLUMN "title"')).toEqual(["DROP COLUMN"]);
    expect(destructiveStatements('DROP TABLE "evidence"')).toEqual(["DROP TABLE"]);
    expect(destructiveStatements('ALTER TABLE "evidence" ALTER COLUMN "kind" DROP NOT NULL')).toEqual(["DROP NOT NULL"]);
    expect(destructiveStatements('ALTER TABLE "evidence" ALTER COLUMN "kind" DROP DEFAULT')).toEqual([]);
    expect(destructiveStatements('REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action')).toEqual([]);
  });
});
