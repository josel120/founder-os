import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(), insert: vi.fn(), values: vi.fn(), onConflict: vi.fn(), del: vi.fn(), delWhere: vi.fn(), report: vi.fn() }));
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
  m.insert.mockReturnValue({ values: m.values });
  m.values.mockReturnValue({ onConflictDoUpdate: m.onConflict });
  m.onConflict.mockResolvedValue(undefined);
  m.del.mockReturnValue({ where: m.delWhere });
  m.delWhere.mockResolvedValue(undefined);
});

const options = { token: "t".repeat(24), apiUrl: "https://api.test", fetchImpl };
const repository = (open = 5) => new Response(JSON.stringify({ default_branch: "main", pushed_at: "2026-09-01T00:00:00Z", open_issues_count: open }), { status: 200 });
function github(status: number) {
  fetchImpl.mockImplementation(async (url: string) => {
    if (status !== 200) return new Response("{}", { status });
    if (url.endsWith("/pulls?state=open&per_page=1")) return new Response("[]", { status: 200 });
    if (url.endsWith("/releases/latest")) return new Response("{}", { status: 404 });
    return repository();
  });
}
// First limit(): the project lookup; second: the existing snapshot.
const rows = (project: { repository: string | null }, existing?: { repoFullName: string }) => m.limit.mockResolvedValueOnce([project]).mockResolvedValueOnce(existing ? [existing] : []);

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

it("stores the full snapshot for the session owner on success, and clears a previous error", async () => {
  github(200);
  rows({ repository: "https://github.com/o/r" });
  expect(await syncProjectGitHub("owner-a", projectId, options)).toEqual({ status: "synced" });
  const values = m.values.mock.calls[0][0];
  expect(values).toMatchObject({ projectId, ownerId: "owner-a", repoFullName: "o/r", defaultBranch: "main", openIssues: 5, openPullRequests: 0, latestReleaseTag: null, syncError: null });
  const conflict = m.onConflict.mock.calls[0][0];
  expect(Object.keys(conflict.set).sort()).toEqual(["defaultBranch", "lastPushAt", "latestReleaseAt", "latestReleaseTag", "openIssues", "openPullRequests", "repoFullName", "syncError", "syncedAt"]);
  expect(new PgDialect().sqlToQuery(conflict.setWhere as SQL).params).toEqual(["owner-a"]);
  expect(m.del).not.toHaveBeenCalled();
});

it("keeps the previous numbers when a sync fails: only the error, time and name are written", async () => {
  github(429);
  rows({ repository: "https://github.com/o/r" }, { repoFullName: "o/r" });
  expect(await syncProjectGitHub("owner-a", projectId, options)).toEqual({ status: "error", error: "rate_limited" });
  expect(Object.keys(m.onConflict.mock.calls[0][0].set).sort()).toEqual(["repoFullName", "syncError", "syncedAt"]);
  expect(m.values.mock.calls[0][0]).not.toHaveProperty("openIssues");
  expect(m.del).not.toHaveBeenCalled();
});

it("drops the old snapshot before storing a different repository's", async () => {
  github(200);
  rows({ repository: "https://github.com/o/new" }, { repoFullName: "o/old" });
  await syncProjectGitHub("owner-a", projectId, options);
  expect(m.del).toHaveBeenCalledTimes(1);
  expect(new PgDialect().sqlToQuery(m.delWhere.mock.calls[0][0] as SQL).params).toEqual([projectId, "owner-a"]);
  expect(m.del.mock.invocationCallOrder[0]!).toBeLessThan(m.insert.mock.invocationCallOrder[0]!);
});

it("removes the owner's snapshot when the project is no longer linked to GitHub, without calling GitHub", async () => {
  rows({ repository: "https://gitlab.com/o/r" });
  expect(await syncProjectGitHub("owner-a", projectId, options)).toEqual({ status: "unlinked" });
  expect(new PgDialect().sqlToQuery(m.delWhere.mock.calls[0][0] as SQL).params).toEqual([projectId, "owner-a"]);
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});

it("writes nothing and calls nothing without a token", async () => {
  rows({ repository: "https://github.com/o/r" });
  expect(await syncProjectGitHub("owner-a", projectId, { ...options, token: "" })).toEqual({ status: "not_configured" });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});
