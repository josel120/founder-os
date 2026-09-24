import { describe, expect, it } from "vitest";
import { problems, ideas, projects } from "../src/db/schema";
describe("database privacy defaults", () => {
  for (const [name, table] of Object.entries({ ideas, problems, projects })) {
    it(`${name} defaults to PRIVATE and rejects null visibility`, () => {
      expect(table.visibility.default).toBe("PRIVATE");
      expect(table.visibility.notNull).toBe(true);
    });
  }
});
