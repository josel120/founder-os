import { describe, expect, it } from "vitest";
import { createIdeaSchema, updateIdeaContentSchema } from "../src/modules/ideas/schemas/idea.schema";
import { createProblemSchema, problemDescriptionMax } from "../src/modules/problems/schemas/problem.schema";

describe("createIdeaSchema", () => {
  it("defaults new ideas to own source", () => {
    expect(createIdeaSchema.parse({ title: "A useful idea" })).toMatchObject({ source: "OWN", description: "" });
  });
  it("rejects empty titles", () => {
    expect(createIdeaSchema.safeParse({ title: " " }).success).toBe(false);
  });
});

describe("updateIdeaContentSchema", () => {
  it("trims editable content and defaults the description", () => {
    expect(updateIdeaContentSchema.parse({
      ideaId: "00000000-0000-4000-8000-000000000001",
      title: "  Refined idea  ",
    })).toMatchObject({ title: "Refined idea", description: "" });
  });

  it("rejects malformed ids and empty titles", () => {
    expect(updateIdeaContentSchema.safeParse({ ideaId: "bad", title: "Title" }).success).toBe(false);
    expect(updateIdeaContentSchema.safeParse({ ideaId: "00000000-0000-4000-8000-000000000001", title: " " }).success).toBe(false);
  });
});

describe("description limit", () => {
  const ideaId = "00000000-0000-4000-8000-000000000001";
  it("accepts any description a problem can hand over, so converted ideas stay editable", () => {
    const longest = "x".repeat(problemDescriptionMax);
    expect(createProblemSchema.safeParse({ title: "Problem", description: longest }).success).toBe(true);
    expect(updateIdeaContentSchema.safeParse({ ideaId, title: "Idea", description: longest }).success).toBe(true);
    expect(createIdeaSchema.safeParse({ title: "Idea", description: longest }).success).toBe(true);
  });
  it("still rejects descriptions over the limit", () => {
    expect(updateIdeaContentSchema.safeParse({ ideaId, title: "Idea", description: "x".repeat(problemDescriptionMax + 1) }).success).toBe(false);
  });
});
