import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { projectGithub, projects, users } from "../src/db/schema";

const migrationsDir = join(__dirname, "../src/db/migrations");
const read = (file: string) => readFileSync(join(migrationsDir, file), "utf8");
const migration = read("0009_project_github.sql");
const journal = JSON.parse(read("meta/_journal.json")) as { entries: { idx: number; tag: string }[] };
const config = getTableConfig(projectGithub);
const foreignKeyFor = (column: PgColumn) => config.foreignKeys.find((fk) => fk.reference().columns.includes(column));

describe("project GitHub snapshot contract (ADR-019)", () => {
  it("is keyed by the project and removed with it, with a required owner", () => {
    expect(projectGithub.projectId.primary).toBe(true);
    expect(foreignKeyFor(projectGithub.projectId)?.reference().foreignTable).toBe(projects);
    expect(foreignKeyFor(projectGithub.projectId)?.onDelete).toBe("cascade");
    expect(projectGithub.ownerId.notNull).toBe(true);
    expect(foreignKeyFor(projectGithub.ownerId)?.reference().foreignTable).toBe(users);
    expect(foreignKeyFor(projectGithub.ownerId)?.onDelete).toBe("restrict");
  });

  it("stores counts, dates and the release tag only, never text from GitHub", () => {
    expect(Object.keys(projectGithub).filter((key) => !key.startsWith("_") && !["getSQL", "enableRLS", "$inferSelect", "$inferInsert"].includes(key)).sort()).toEqual(
      ["defaultBranch", "lastPushAt", "latestReleaseAt", "latestReleaseTag", "openIssues", "openPullRequests", "ownerId", "projectId", "repoFullName", "syncError", "syncedAt"],
    );
  });

  it("checks the repository name, non-negative counts and known error codes only", () => {
    expect(config.checks.map((check) => check.name)).toEqual(["project_github_repo_format", "project_github_counts", "project_github_sync_error"]);
    expect(migration).toContain(`"project_github"."repo_full_name" ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'`);
    expect(migration).toContain(`coalesce("project_github"."open_issues", 0) >= 0 AND coalesce("project_github"."open_pull_requests", 0) >= 0`);
    expect(migration).toContain(`IN ('not_found', 'unauthorized', 'rate_limited', 'unavailable')`);
  });

  it("the repository pattern accepts GitHub names and rejects anything else", () => {
    const pattern = /'(\^\[A-Za-z0-9-\]\{1,39\}\/\[A-Za-z0-9._-\]\{1,100\}\$)'/.exec(migration)?.[1];
    expect(pattern).toBeDefined();
    const repo = new RegExp(pattern!);
    for (const name of ["josel120/founder-os", "a/b", "Org-1/repo.name_x"]) expect(repo.test(name)).toBe(true);
    for (const name of ["bad repo", "a/b/c", "a", "/b", "a/", `${"a".repeat(40)}/b`, "a/b c", "a/b;drop"]) expect(repo.test(name)).toBe(false);
  });

  it("indexes the owner", () => {
    expect(config.indexes.map((index) => index.config.name)).toEqual(["project_github_owner_id_idx"]);
  });
});

describe("migration 0009", () => {
  it("follows 0008 in the journal", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
    expect(journal.entries.slice(8, 10).map((entry) => entry.tag)).toEqual(["0008_project_publication", "0009_project_github"]);
  });

  it("only creates the table, its foreign keys and index", () => {
    for (const statement of migration.split("--> statement-breakpoint").map((part) => part.trim())) {
      expect(statement).toMatch(/^(CREATE TABLE "project_github" |ALTER TABLE "project_github" ADD CONSTRAINT |CREATE INDEX "project_github_)/);
    }
    const withoutFkActions = migration.replace(/\bON (DELETE|UPDATE) (RESTRICT|NO ACTION|CASCADE|SET NULL|SET DEFAULT)\b/gi, "");
    expect(withoutFkActions).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  });
});
