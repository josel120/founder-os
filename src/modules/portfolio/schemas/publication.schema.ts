import { z } from "zod";

/** ADR-018: a publication is PUBLIC (listed) or UNLISTED (link only). PRIVATE means no publication row. */
export const publicationVisibilitySchema = z.enum(["PUBLIC", "UNLISTED"]);
export const PUBLIC_SUMMARY_MAX = 500;

export const publishProjectSchema = z.object({
  projectId: z.uuid(),
  visibility: publicationVisibilitySchema,
  summary: z.string().trim().min(1, "Write a public summary.").max(PUBLIC_SUMMARY_MAX, `Keep the public summary to ${PUBLIC_SUMMARY_MAX} characters.`),
});
export const unpublishProjectSchema = z.object({ projectId: z.uuid() });
export const publicSlugSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
