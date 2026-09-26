import { z } from "zod";
import { evidenceKinds, evidenceSignals, evidenceSourceUrlMax, evidenceSummaryMax, evidenceTitleMax } from "./evidence.limits";

// Source URLs are stored and rendered as links, never fetched (ADR-012): only http(s) is accepted.
const sourceUrl = z.union([
  z.literal(""),
  // The protocol option validates without throwing; a refine calling new URL() would throw on non-URLs.
  z.url({ protocol: /^https?$/, error: "Use a full http or https link, like https://example.com" }).max(evidenceSourceUrlMax),
]).default("");

const content = {
  title: z.string().trim().min(1, "Title is required").max(evidenceTitleMax, `Keep the title under ${evidenceTitleMax} characters`),
  summary: z.string().trim().min(1, "Summary is required").max(evidenceSummaryMax, `Keep the summary under ${evidenceSummaryMax} characters`),
  kind: z.enum(evidenceKinds, "Choose what kind of evidence this is"),
  signal: z.enum(evidenceSignals, "Choose whether it supports or contradicts"),
  sourceUrl,
};

// The form sends one `parent` value, "problem:<uuid>" or "idea:<uuid>", so exactly one parent is structural.
const parent = z.string().trim()
  .regex(/^(problem|idea):[^:]+$/, "Choose the problem or idea this evidence is about")
  .transform((value) => {
    const [type, id] = value.split(":") as ["problem" | "idea", string];
    return { type, id };
  })
  .pipe(z.object({ type: z.enum(["problem", "idea"]), id: z.uuid("Choose the problem or idea this evidence is about") }));

export const createEvidenceSchema = z.object({ ...content, parent });
export const updateEvidenceContentSchema = z.object({ evidenceId: z.uuid(), ...content });
export const evidenceFilterSchema = z.object({
  kind: z.enum(evidenceKinds).optional().catch(undefined),
  signal: z.enum(evidenceSignals).optional().catch(undefined),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type EvidenceFilter = z.infer<typeof evidenceFilterSchema>;
