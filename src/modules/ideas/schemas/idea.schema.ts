import { z } from "zod";
import { ideaDescriptionMax } from "./idea.limits";

const description = z.string().trim().max(ideaDescriptionMax).default("");

export const createIdeaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description,
  source: z.enum(["OWN", "PROBLEM_HUNTER", "PROJECT_HUNTER", "CHATGPT", "OTHER"]).default("OWN"),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaContentSchema = z.object({
  ideaId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(160),
  description,
});

export type UpdateIdeaContentInput = z.infer<typeof updateIdeaContentSchema>;

export const updateIdeaStatusSchema = z.object({
  ideaId: z.string().uuid(),
  status: z.enum(["INBOX", "RESEARCHING", "VALIDATING", "CANDIDATE", "PLANNING", "CONVERTED", "PAUSED", "REJECTED", "ARCHIVED"]),
});

export const createIdeaFromProblemSchema = z.object({
  problemId: z.string().uuid(),
});
