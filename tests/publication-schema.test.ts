import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { projectPublications, projects, users } from "../src/db/schema";

const migrationsDir = join(__dirname, "../src/db/migrations");
const read = (file: string) => readFileSync(join(migrationsDir, file), "utf8");
const migration = read("0008_project_publication.sql");
const journal = JSON.parse(read("meta/_journal.json")) as { entries: { idx: number; tag: string }[] };
const config = getTableConfig(projectPublications);
const foreignKeyFor = (column: PgColumn) => config.foreignKeys.find((fk) => fk.reference().columns.includes(column));

describe("project publication contract (ADR-018)", () => {
  it("is keyed by the project and removed with it", () => {
    expect(projectPublications.projectId.primary).toBe(true);
    const fk = foreignKeyFor(projectPublications.projectId);
    expect(fk?.reference().foreignTable).toBe(projects);
    expect(fk?.onDelete).toBe("cascade");
  });

  it("requires an owner, with restrictive deletion", () => {
    expect(projectPublications.ownerId.notNull).toBe(true);
    const fk = foreignKeyFor(projectPublications.ownerId);
    expect(fk?.reference().foreignTable).toBe(users);
    expect(fk?.onDelete).toBe("restrict");
  });

  it("has no visibility default and never stores PRIVATE", () => {
    expect(projectPublications.visibility.notNull).toBe(true);
    expect(projectPublications.visibility.hasDefault).toBe(false);
    expect(config.checks.map((check) => check.name)).toEqual(["project_publication_not_private", "project_publication_summary_length"]);
    expect(migration).toContain(`CONSTRAINT "project_publication_not_private" CHECK ("project_publication"."visibility" <> 'PRIVATE')`);
  });

  it("requires a trimmed summary of 1 to 500 characters", () => {
    expect(projectPublications.summary.notNull).toBe(true);
    expect(migration).toContain(`CHECK (char_length(btrim("project_publication"."summary")) BETWEEN 1 AND 500)`);
  });

  it("indexes the public list and the owner", () => {
    expect(config.indexes.map((index) => [index.config.name, index.config.columns.map((column) => (column as PgColumn).name)])).toEqual([
      ["project_publication_list_idx", ["visibility", "published_at"]],
      ["project_publication_owner_id_idx", ["owner_id"]],
    ]);
  });

  it("leaves the private project row and its PRIVATE default untouched", () => {
    expect(projects.visibility.default).toBe("PRIVATE");
    expect(migration).not.toMatch(/ALTER TABLE "project"\s/);
  });
});

describe("migration 0008", () => {
  it("follows 0007 in the journal", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(journal.entries.slice(7).map((entry) => entry.tag)).toEqual(["0007_rate_limit", "0008_project_publication"]);
  });

  it("only creates the table, its foreign keys and indexes", () => {
    for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim())) {
      expect(statement).toMatch(/^(CREATE TABLE "project_publication" |ALTER TABLE "project_publication" ADD CONSTRAINT |CREATE INDEX "project_publication_)/);
    }
    const withoutFkActions = migration.replace(/\bON (DELETE|UPDATE) (RESTRICT|NO ACTION|CASCADE|SET NULL|SET DEFAULT)\b/gi, "");
    expect(withoutFkActions).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  });
});
