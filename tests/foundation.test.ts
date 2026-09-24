import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { problems, ideas, projects, decisionLogs, users } from "../src/db/schema";
describe("database privacy defaults", () => {
  for (const [name, table] of Object.entries({ ideas, problems, projects, decisionLogs })) {
    it(`${name} defaults to PRIVATE and rejects null visibility`, () => {
      expect(table.visibility.default).toBe("PRIVATE");
      expect(table.visibility.notNull).toBe(true);
    });
  }
});
describe("decision log ownership", () => {
  it("has a nullable owner reference for unclaimed historical rows", () => {
    expect(decisionLogs.ownerId.notNull).toBe(false);
  });
});
describe("project ownership", () => {
  it("has a nullable owner reference for unclaimed historical rows", () => {
    expect(projects.ownerId.notNull).toBe(false);
  });
  it("restricts deleting a user who still owns projects", () => {
    const ownerFk = getTableConfig(projects).foreignKeys.find((fk) =>
      fk.reference().columns.includes(projects.ownerId),
    );
    expect(ownerFk?.reference().foreignTable).toBe(users);
    expect(ownerFk?.onDelete).toBe("restrict");
  });
});
