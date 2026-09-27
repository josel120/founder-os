import { z } from "zod";
import type { AIRecommendation } from "../types";

/** ADR-021: forced tool use. Each tool's JSON schema and its matching, strict Zod schema must agree. */

const RECOMMENDATIONS = ["CONTINUE", "INVESTIGATE_MORE", "PAUSE", "REJECT"] as const satisfies readonly AIRecommendation[];

export const ASSESSMENT_TOOL_NAME = "idea_assessment";
export const SUMMARY_TOOL_NAME = "research_summary";

export const assessmentOutputSchema = z
  .object({
    recommendation: z.enum(RECOMMENDATIONS),
    rationale: z.string().max(1_500),
    risks: z.array(z.string().max(300)).max(5),
    openQuestions: z.array(z.string().max(300)).max(5),
  })
  .strict();
export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;

export const summaryOutputSchema = z
  .object({
    supports: z.array(z.string().max(400)).max(6),
    contradicts: z.array(z.string().max(400)).max(6),
    openQuestions: z.array(z.string().max(400)).max(6),
    overview: z.string().max(1_500),
  })
  .strict();
export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

export const assessmentTool = {
  name: ASSESSMENT_TOOL_NAME,
  description: "Record a second opinion on this idea: a recommendation, a short rationale, risks and open questions.",
  input_schema: {
    type: "object",
    properties: {
      recommendation: { type: "string", enum: RECOMMENDATIONS },
      rationale: { type: "string", maxLength: 1_500 },
      risks: { type: "array", items: { type: "string", maxLength: 300 }, maxItems: 5 },
      openQuestions: { type: "array", items: { type: "string", maxLength: 300 }, maxItems: 5 },
    },
    required: ["recommendation", "rationale", "risks", "openQuestions"],
    additionalProperties: false,
  },
} as const;

export const summaryTool = {
  name: SUMMARY_TOOL_NAME,
  description: "Record a summary of this idea's research evidence: what it supports, contradicts and leaves open.",
  input_schema: {
    type: "object",
    properties: {
      supports: { type: "array", items: { type: "string", maxLength: 400 }, maxItems: 6 },
      contradicts: { type: "array", items: { type: "string", maxLength: 400 }, maxItems: 6 },
      openQuestions: { type: "array", items: { type: "string", maxLength: 400 }, maxItems: 6 },
      overview: { type: "string", maxLength: 1_500 },
    },
    required: ["supports", "contradicts", "openQuestions", "overview"],
    additionalProperties: false,
  },
} as const;
