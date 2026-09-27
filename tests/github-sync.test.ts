import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), insert: vi.fn(), del: vi.fn(), report: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: m.select, insert: m.insert, delete: m.del } }));
vi.mock("@/lib/report-error", () => ({ reportError: m.report }));
import { syncAllLinkedProjects, syncProjectGitHub } from "@/modules/github/services/sync";

const projectId = "00000000-0000-4000-8000-000000000001";
const fetchImpl = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  m.select.mockReturnValue({ from: m.from });
  m.from.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ limit: m.limit, orderBy: () => ({ limit: m.limit }) });
  m.limit.mockResolvedValue([]);
});

it("looks the project up by id, session owner and PRIVATE, and fetches nothing for another owner's project", async () => {
  expect(await syncProjectGitHub("owner-a", projectId, { token: "t".repeat(24), apiUrl: "https://api.test", fetchImpl })).toEqual({ status: "not_found" });
  const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL);
  expect(query.sql).toContain('"project"."owner_id"');
  expect(query.params).toEqual([projectId, "owner-a", "PRIVATE"]);
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});

it("reports a database failure without details and returns unavailable", async () => {
  const error = new Error("secret");
  m.limit.mockRejectedValue(error);
  expect(await syncProjectGitHub("owner-a", projectId, { token: "t".repeat(24), fetchImpl })).toEqual({ status: "error", error: "unavailable" });
  expect(m.report).toHaveBeenCalledWith("github.sync", error);
});

it("does nothing in the cron when no token is configured", async () => {
  expect(await syncAllLinkedProjects({ token: "" })).toMatchObject({ synced: 0, skipped: -1 });
  expect(m.select).not.toHaveBeenCalled();
});
