import { describe, expect, it } from "vitest";
import { createIdeaSchema, updateIdeaContentSchema } from "../src/modules/ideas/schemas/idea.schema";

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
