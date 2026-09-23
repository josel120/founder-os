import { describe, expect, it } from "vitest";
import { createIdeaSchema } from "../src/modules/ideas/schemas/idea.schema";

describe("createIdeaSchema", () => {
  it("defaults new ideas to own source", () => {
    expect(createIdeaSchema.parse({ title: "A useful idea" })).toMatchObject({ source: "OWN", description: "" });
  });
  it("rejects empty titles", () => {
    expect(createIdeaSchema.safeParse({ title: " " }).success).toBe(false);
  });
});
