import type { z } from "zod";
import type { projectLifecycleSchema, projectOperationalStatusSchema } from "../schemas/project.schema";

export type ProjectLifecycle = z.infer<typeof projectLifecycleSchema>;
export type ProjectOperationalStatus = z.infer<typeof projectOperationalStatusSchema>;

export const lifecycles: readonly ProjectLifecycle[] = ["PLANNING", "BUILDING", "TESTING", "BETA", "RELEASED", "MONETIZING", "PAUSED", "ARCHIVED"];
export const operationalStatuses: readonly ProjectOperationalStatus[] = ["NO_ACTION_REQUIRED", "READY", "ACTION_REQUIRED", "WAITING_PLATFORM", "WAITING_USERS", "WAITING_REVIEW", "WAITING_PAYMENT", "BLOCKED"];

export function projectLabel(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isWaiting(status: ProjectOperationalStatus) {
  return status.startsWith("WAITING_");
}

export function operationalTone(status: ProjectOperationalStatus) {
  if (status === "BLOCKED") return "bg-red-50 text-red-700";
  if (status === "ACTION_REQUIRED") return "bg-amber-50 text-amber-700";
  if (isWaiting(status)) return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

export function toDateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}
