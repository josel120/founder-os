import { ideaStatus } from "@/db/schema";

export const inboxStatuses = ideaStatus.enumValues;
export type InboxStatus = (typeof inboxStatuses)[number];

const explorationStatuses: readonly InboxStatus[] = ["RESEARCHING", "VALIDATING", "CANDIDATE", "PLANNING"];

export function filterInbox<T extends { title: string; description: string; status: string }>(
  items: T[], query: string, status: string,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  return items.filter((item) =>
    (!status || item.status === status) &&
    (!term || (item.title + " " + item.description).toLocaleLowerCase().includes(term)));
}

export function summarizeInbox(items: { status: string }[]): { total: number; inbox: number; exploring: number } {
  return {
    total: items.length,
    inbox: items.filter((item) => item.status === "INBOX").length,
    exploring: items.filter((item) => (explorationStatuses as readonly string[]).includes(item.status)).length,
  };
}

/** Catalog key for an idea status label: ideas and projects share English words that differ in Spanish (ADR-023). */
export function ideaStatusKey(status: string): string {
  return `Idea status::${statusLabel(status)}`;
}

export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}
