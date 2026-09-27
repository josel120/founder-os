import { describe, expect, it } from "vitest";
import { assessmentOutputSchema, assessmentTool, summaryOutputSchema, summaryTool } from "../src/modules/ai/services/output";

const validAssessment = { recommendation: "CONTINUE", rationale: "Looks promising.", risks: ["Risk one"], openQuestions: ["Question one"] };
const validSummary = { supports: ["Support one"], contradicts: [], openQuestions: [], overview: "Overview text." };

describe("assessmentOutputSchema", () => {
  it("accepts a valid payload", () => {
    expect(assessmentOutputSchema.safeParse(validAssessment).success).toBe(true);
  });

  it("rejects an unknown recommendation", () => {
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, recommendation: "MAYBE" }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, score: 7 }).success).toBe(false);
  });

  it("rejects an over-length rationale, and more than 5 risks/openQuestions", () => {
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, rationale: "x".repeat(1_501) }).success).toBe(false);
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, risks: Array(6).fill("r") }).success).toBe(false);
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, openQuestions: Array(6).fill("q") }).success).toBe(false);
  });

  it("rejects an over-length risk or open question string", () => {
    expect(assessmentOutputSchema.safeParse({ ...validAssessment, risks: ["x".repeat(301)] }).success).toBe(false);
  });

  it("the tool's JSON schema names match the Zod schema's required keys", () => {
    expect(Object.keys(assessmentTool.input_schema.properties)).toEqual(["recommendation", "rationale", "risks", "openQuestions"]);
    expect(assessmentTool.input_schema.additionalProperties).toBe(false);
  });
});

describe("summaryOutputSchema", () => {
  it("accepts a valid payload", () => {
    expect(summaryOutputSchema.safeParse(validSummary).success).toBe(true);
  });

  it("rejects extra keys", () => {
    expect(summaryOutputSchema.safeParse({ ...validSummary, extra: "nope" }).success).toBe(false);
  });

  it("rejects more than 6 items in any list, and an over-length overview or item", () => {
    expect(summaryOutputSchema.safeParse({ ...validSummary, supports: Array(7).fill("s") }).success).toBe(false);
    expect(summaryOutputSchema.safeParse({ ...validSummary, overview: "x".repeat(1_501) }).success).toBe(false);
    expect(summaryOutputSchema.safeParse({ ...validSummary, contradicts: ["x".repeat(401)] }).success).toBe(false);
  });

  it("the tool's JSON schema names match the Zod schema's required keys", () => {
    expect(Object.keys(summaryTool.input_schema.properties)).toEqual(["supports", "contradicts", "openQuestions", "overview"]);
    expect(summaryTool.input_schema.additionalProperties).toBe(false);
  });
});
