import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const m = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), syncAll: vi.fn(), refresh: vi.fn(), env: { CRON_SECRET: undefined as string | undefined }, select: vi.fn(), from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/env", () => ({ env: m.env }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("@/modules/github/services/sync", () => ({ syncProjectGitHub: m.sync, syncAllLinkedProjects: m.syncAll }));
vi.mock("@/db", () => ({ db: { select: m.select } }));
import { refreshProjectGitHub } from "@/modules/github/actions/github.actions";
import { GET } from "@/app/api/cron/github/route";
import { listStaleRepositories } from "@/modules/github/queries/github.queries";

const projectId = "00000000-0000-4000-8000-000000000001";
const form = (values: Record<string, string>) => { const data = new FormData(); Object.entries(values).forEach(([k, v]) => data.set(k, v)); return data; };
const secret = "s".repeat(40);
const call = (authorization?: string) => GET(new Request("https://app.example/api/cron/github", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  m.env.CRON_SECRET = undefined;
  m.auth.mockResolvedValue({ id: "owner-a" });
});

describe("refreshProjectGitHub", () => {
  it("refuses anonymous callers and invalid ids before syncing", async () => {
    m.auth.mockResolvedValue(null);
    expect(await refreshProjectGitHub(form({ projectId }))).toEqual({ ok: false, error: "Sign in again to refresh." });
    m.auth.mockResolvedValue({ id: "owner-a" });
    expect(await refreshProjectGitHub(form({ projectId: "x" }))).toEqual({ ok: false, error: "Invalid project." });
    expect(m.sync).not.toHaveBeenCalled();
  });

  it("syncs as the session owner, never a submitted owner", async () => {
    m.sync.mockResolvedValue({ status: "synced" });
    expect(await refreshProjectGitHub(form({ projectId, ownerId: "attacker" }))).toEqual({ ok: true, message: "Refreshed from GitHub." });
    expect(m.sync).toHaveBeenCalledWith("owner-a", projectId);
    expect(m.refresh).toHaveBeenCalledWith(`/private/projects/${projectId}`);
  });

  it.each([
    [{ status: "unlinked" }, "Add a https://github.com/owner/repo URL"], [{ status: "not_configured" }, "GITHUB_TOKEN is not set"],
    [{ status: "not_found" }, "Project not found."], [{ status: "error", error: "rate_limited" }, "rate limit"], [{ status: "error", error: "unauthorized" }, "refused the token"],
  ])("explains %j", async (outcome, text) => {
    m.sync.mockResolvedValue(outcome);
    const result = await refreshProjectGitHub(form({ projectId }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(text);
  });
});

describe("/api/cron/github", () => {
  it("fails closed without a configured secret, even with a header", async () => {
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call(`Bearer ${secret}`)).status).toBe(401);
    expect(m.syncAll).not.toHaveBeenCalled();
  });

  it.each([undefined, secret, `Bearer ${secret}x`, `bearer ${secret}`, `Bearer ${secret.slice(1)}`])("rejects the header %s", async (header) => {
    m.env.CRON_SECRET = secret;
    const response = await call(header);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(m.syncAll).not.toHaveBeenCalled();
  });

  it("runs the sync with the right secret and returns counts only", async () => {
    m.env.CRON_SECRET = secret;
    m.syncAll.mockResolvedValue({ synced: 2, failed: 1, unlinked: 0, skipped: 0 });
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ synced: 2, failed: 1, unlinked: 0, skipped: 0 });
  });
});

describe("listStaleRepositories", () => {
  it("joins on the project and its own owner, filters the owner and PRIVATE, and caps the list", async () => {
    m.select.mockReturnValue({ from: m.from });
    m.from.mockReturnValue({ innerJoin: m.innerJoin });
    m.innerJoin.mockReturnValue({ where: m.where });
    m.where.mockReturnValue({ orderBy: m.orderBy });
    m.orderBy.mockReturnValue({ limit: m.limit });
    m.limit.mockResolvedValue([]);
    const before = new Date("2026-08-28T00:00:00Z");
    await listStaleRepositories("owner-a", before);
    expect(new PgDialect().sqlToQuery(m.innerJoin.mock.calls[0][1] as SQL).sql).toBe('("project"."id" = "project_github"."project_id" and "project"."owner_id" = "project_github"."owner_id")');
    expect(new PgDialect().sqlToQuery(m.where.mock.calls[0][0] as SQL).params).toEqual(["owner-a", "PRIVATE", before.toISOString()]);
    expect(Object.keys(m.select.mock.calls[0][0])).toEqual(["id", "name", "repoFullName", "lastPushAt"]);
    expect(m.limit).toHaveBeenCalledWith(10);
  });
});
