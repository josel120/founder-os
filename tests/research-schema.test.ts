import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { evidence, ideas, problems, users } from "../src/db/schema";

const migration = readFileSync(
  join(__dirname, "../src/db/migrations/0005_research_evidence.sql"),
  "utf8",
);

function foreignKeyFor(column: PgColumn) {
  return getTableConfig(evidence).foreignKeys.find((fk) => fk.reference().columns.includes(column));
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

  it("allows exactly one parent and indexes the owner", () => {
    const config = getTableConfig(evidence);
    expect(config.checks.map((c) => c.name)).toContain("evidence_exactly_one_parent");
    expect(config.indexes.map((i) => i.config.name)).toContain("evidence_owner_id_idx");
    expect(migration).toContain('CHECK (num_nonnulls("evidence"."problem_id", "evidence"."idea_id") = 1)');
  });

  it("ships an additive migration only", () => {
    const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim());
    for (const statement of statements) {
      expect(statement).toMatch(/^(CREATE (TYPE|TABLE|INDEX) |ALTER TABLE "evidence" ADD CONSTRAINT )/);
    }
  });
});
