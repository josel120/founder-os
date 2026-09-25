import { z } from "zod";

export const createDecisionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  decision: z.string().trim().min(1, "Decision is required").max(2000),
  reason: z.string().trim().min(1, "Reason is required").max(2000),
  ideaId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
  if (data.ideaId && data.projectId) ctx.addIssue({ code: "custom", path: ["projectId"], message: "A decision can link to one record only." });
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
