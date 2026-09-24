import { describe, expect, it } from "vitest";
import { ideaStatus } from "../src/db/schema";
import { filterInbox, inboxStatuses, statusLabel, summarizeInbox } from "../src/modules/ideas/services/inbox";

const items = [
  { title: "Gift app", description: "Subscriptions", status: "INBOX" },
  { title: "Flags", description: "Gift quiz", status: "RESEARCHING" },
  { title: "Old", description: "", status: "ARCHIVED" },
];

describe("filterInbox", () => {
  it("returns everything with an empty query and no status", () => {
    expect(filterInbox(items, "   ", "")).toEqual(items);
  });
  it("filters by status only", () => {
    expect(filterInbox(items, "", "RESEARCHING")).toEqual([items[1]]);
  });
  it("matches trimmed, case-insensitive text across title and description", () => {
    expect(filterInbox(items, " GIFT ", "")).toEqual([items[0], items[1]]);
    expect(filterInbox(items, "subscriptions", "")).toEqual([items[0]]);
    expect(filterInbox(items, "missing", "")).toEqual([]);
  });
  it("combines text search with status filtering", () => {
    expect(filterInbox(items, "gift", "INBOX")).toEqual([items[0]]);
  });
});

describe("summarizeInbox", () => {
  it("counts total, inbox and exploration statuses", () => {
    expect(summarizeInbox(items)).toEqual({ total: 3, inbox: 1, exploring: 1 });
  });
});

describe("inbox statuses", () => {
  it("mirrors the database enum", () => {
    expect(inboxStatuses).toEqual(ideaStatus.enumValues);
  });
  it("labels statuses for display", () => {
    expect(statusLabel("PROBLEM_HUNTER")).toBe("Problem hunter");
  });
});
