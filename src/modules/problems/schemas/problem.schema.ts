import { z } from "zod";

export const createProblemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
});
