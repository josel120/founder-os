import { describe, expect, it } from "vitest";
import { createProblemSchema } from "../src/modules/problems/schemas/problem.schema";

describe("createProblemSchema", () => {
  it("requires a meaningful problem description", () => {
    expect(createProblemSchema.safeParse({ title: "A problem", description: "People cannot do this easily" }).success).toBe(true);
    expect(createProblemSchema.safeParse({ title: "A problem", description: "" }).success).toBe(false);
  });
  it("explains missing fields in plain language", () => {
    const result = createProblemSchema.safeParse({ title: " ", description: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["Title is required", "Describe who experiences the problem"]);
  });
});
