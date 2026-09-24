import { z } from "zod";

export const projectLifecycleSchema = z.enum(["PLANNING", "BUILDING", "TESTING", "BETA", "RELEASED", "MONETIZING", "PAUSED", "ARCHIVED"]);
export const projectOperationalStatusSchema = z.enum(["READY", "ACTION_REQUIRED", "WAITING_PLATFORM", "WAITING_USERS", "WAITING_REVIEW", "WAITING_PAYMENT", "BLOCKED", "NO_ACTION_REQUIRED"]);
const optionalText = z.string().trim().max(2000).default("");
const optionalUrl = z.union([z.literal(""), z.url().max(2048).refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS URL.")]).default("");
const optionalDate = z.union([z.literal(""), z.iso.datetime({ offset: true })]).default("");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
  description: z.string().trim().max(20000).default(""),
  repository: optionalUrl,
  website: optionalUrl,
  playStoreUrl: optionalUrl,
  appStoreUrl: optionalUrl,
  currentVersion: z.string().trim().max(100).default(""),
  productionVersion: z.string().trim().max(100).default(""),
});
export const updateProjectContentSchema = createProjectSchema.extend({ projectId: z.uuid() });
export const updateProjectStatusSchema = z.object({
  projectId: z.uuid(),
  lifecycle: projectLifecycleSchema,
  operationalStatus: projectOperationalStatusSchema,
  nextAction: optionalText,
  waitingReason: optionalText,
  waitingSince: optionalDate,
  reviewAt: optionalDate,
}).superRefine((data, ctx) => {
  if (data.operationalStatus.startsWith("WAITING_") && (!data.waitingReason || !data.waitingSince)) {
    ctx.addIssue({ code: "custom", path: ["waitingReason"], message: "Waiting requires a reason and a start date." });
  }
});
