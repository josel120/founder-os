import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { aiRunKind, aiRunStatus, aiRuns, ideas, users } from "../src/db/schema";

const migrationsDir = join(__dirname, "../src/db/migrations");
const read = (file: string) => readFileSync(join(migrationsDir, file), "utf8");
const migration = read("0011_ai_run.sql");
const journal = JSON.parse(read("meta/_journal.json")) as { entries: { idx: number; tag: string; when: number }[] };
const config = getTableConfig(aiRuns);
const foreignKeyFor = (column: PgColumn) => config.foreignKeys.find((fk) => fk.reference().columns.includes(column));

describe("AI run contract (ADR-021)", () => {
  it("belongs to a required owner and idea, and deleting either is refused", () => {
    for (const [column, table] of [[aiRuns.ownerId, users], [aiRuns.ideaId, ideas]] as const) {
      expect(column.notNull).toBe(true);
      expect(foreignKeyFor(column)?.reference().foreignTable).toBe(table);
      expect(foreignKeyFor(column)?.onDelete).toBe("restrict");
    }
  });

  it("stores the validated result and run metadata only, never the prompt", () => {
    expect(Object.keys(aiRuns).filter((key) => !key.startsWith("_") && !["getSQL", "enableRLS", "$inferSelect", "$inferInsert"].includes(key)).sort()).toEqual(
      ["createdAt", "error", "finishedAt", "id", "ideaId", "inputTokens", "kind", "model", "output", "outputTokens", "ownerId", "promptVersion", "recommendation", "status", "visibility"],
    );
  });

  it("starts RUNNING and PRIVATE", () => {
    expect(aiRunKind.enumValues).toEqual(["ASSESSMENT", "SUMMARY"]);
    expect(aiRunStatus.enumValues).toEqual(["RUNNING", "SUCCEEDED", "FAILED"]);
    expect(migration).toContain(`"status" "ai_run_status" DEFAULT 'RUNNING' NOT NULL`);
    expect(migration).toContain(`"visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL`);
  });

  it("ties the recommendation, output, error and finish time to the status", () => {
    expect(config.checks.map((check) => check.name)).toEqual(["ai_run_recommendation", "ai_run_outcome", "ai_run_error", "ai_run_tokens", "ai_run_labels", "ai_run_private"]);
    expect(migration).toContain(`CONSTRAINT "ai_run_private" CHECK ("ai_run"."visibility" = 'PRIVATE')`);
    expect(migration).toContain(`(("ai_run"."kind" = 'ASSESSMENT' AND "ai_run"."status" = 'SUCCEEDED') = ("ai_run"."recommendation" IS NOT NULL))`);
    expect(migration).toContain(`IN ('CONTINUE', 'INVESTIGATE_MORE', 'PAUSE', 'REJECT')`);
    expect(migration).toContain(`("ai_run"."status" = 'SUCCEEDED') = ("ai_run"."output" IS NOT NULL) AND ("ai_run"."status" = 'FAILED') = ("ai_run"."error" IS NOT NULL) AND ("ai_run"."status" = 'RUNNING') = ("ai_run"."finished_at" IS NULL)`);
    expect(migration).toContain(`IN ('unauthorized', 'rate_limited', 'unavailable', 'invalid_output', 'too_large', 'interrupted')`);
    expect(migration).not.toContain("not_configured");
  });

  it("indexes the daily cap and history lookups, and allows one RUNNING row per idea", () => {
    expect(config.indexes.map((index) => index.config.name)).toEqual(["ai_run_owner_created_idx", "ai_run_idea_created_idx", "ai_run_one_running_per_idea_idx"]);
    expect(migration).toContain(`CREATE UNIQUE INDEX "ai_run_one_running_per_idea_idx" ON "ai_run" USING btree ("idea_id") WHERE "ai_run"."status" = 'RUNNING'`);
  });
});

describe("migration 0011", () => {
  it("follows 0010 in the journal, later in time", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(journal.entries.slice(10, 12).map((entry) => entry.tag)).toEqual(["0010_finance_import", "0011_ai_run"]);
    expect(journal.entries[11].when).toBeGreaterThan(journal.entries[10].when);
  });

  it("only creates the enums, the table, its foreign keys and indexes", () => {
    for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim())) {
      expect(statement).toMatch(/^(CREATE TYPE "public"\."ai_run_(kind|status)" AS ENUM|CREATE TABLE "ai_run" |ALTER TABLE "ai_run" ADD CONSTRAINT |CREATE (UNIQUE )?INDEX "ai_run_)/);
    }
    const withoutFkActions = migration.replace(/\bON (DELETE|UPDATE) (RESTRICT|NO ACTION|CASCADE|SET NULL|SET DEFAULT)\b/gi, "");
    expect(withoutFkActions).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  });
});
