import { z } from "zod";

export const createIdeaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(2000).default(""),
  source: z.enum(["OWN", "PROBLEM_HUNTER", "PROJECT_HUNTER", "CHATGPT", "OTHER"]).default("OWN"),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaStatusSchema = z.object({
  ideaId: z.string().uuid(),
  status: z.enum(["INBOX", "RESEARCHING", "VALIDATING", "CANDIDATE", "PLANNING", "CONVERTED", "PAUSED", "REJECTED", "ARCHIVED"]),
});

export const createIdeaFromProblemSchema = z.object({
  problemId: z.string().uuid(),
});
