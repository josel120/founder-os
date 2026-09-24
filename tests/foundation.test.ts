import { describe, expect, it } from "vitest";
import { problems, ideas, projects, decisionLogs } from "../src/db/schema";
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
