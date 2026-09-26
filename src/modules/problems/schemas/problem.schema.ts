import { z } from "zod";
import { problemDescriptionMax } from "./problem.limits";

export { problemDescriptionMax };

export const createProblemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "Keep the title under 160 characters"),
  description: z.string().trim().min(1, "Describe who experiences the problem").max(problemDescriptionMax, `Keep the description under ${problemDescriptionMax} characters`),
});
