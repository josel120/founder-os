import { z } from "zod";

export const createDecisionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  decision: z.string().trim().min(1, "Decision is required").max(2000),
  reason: z.string().trim().min(1, "Reason is required").max(2000),
  ideaId: z.string().uuid().optional(),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
