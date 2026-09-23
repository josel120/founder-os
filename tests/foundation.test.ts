import { describe, expect, it } from "vitest";
import { visibility, ideas, projects } from "../src/db/schema";
describe("foundation schema", () => { it("exports private-by-default domain tables", () => { expect(ideas).toBeDefined(); expect(projects).toBeDefined(); expect(visibility).toBeDefined(); }); });
