import { describe, expect, it } from "vitest";
import { createProblemSchema } from "../src/modules/problems/schemas/problem.schema";

describe("createProblemSchema", () => {
  it("requires a meaningful problem description", () => {
    expect(createProblemSchema.safeParse({ title: "A problem", description: "People cannot do this easily" }).success).toBe(true);
    expect(createProblemSchema.safeParse({ title: "A problem", description: "" }).success).toBe(false);
  });
});
