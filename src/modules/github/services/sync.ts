import { and, eq, isNotNull, like } from "drizzle-orm";
import { db } from "@/db";
import { projectGithub, projects } from "@/db/schema";
import { env } from "@/lib/env";
import { reportError } from "@/lib/report-error";
import { fetchRepositorySnapshot, type Fetch, type GitHubSyncError } from "./github-client";
import { parseGitHubRepository } from "./repository";

export type SyncOutcome =
  | { status: "synced" }
  | { status: "error"; error: GitHubSyncError }
  | { status: "unlinked" }
  | { status: "not_configured" }
  | { status: "not_found" };

type Options = { token?: string; apiUrl?: string; fetchImpl?: Fetch };
const CRON_BATCH_LIMIT = 100;

/** Stores one project's snapshot. Owner and project come from the caller (session or cron), never from input. */
async function syncOne(ownerId: string, projectId: string, repository: string | null, options: Options): Promise<SyncOutcome> {
  if (!db) return { status: "error", error: "unavailable" };
  const repoFullName = parseGitHubRepository(repository);
  const own = and(eq(projectGithub.projectId, projectId), eq(projectGithub.ownerId, ownerId));
  if (!repoFullName) {
    await db.delete(projectGithub).where(own);
    return { status: "unlinked" };
  }
  const token = options.token ?? env.GITHUB_TOKEN;
  if (!token) return { status: "not_configured" };
  const result = await fetchRepositorySnapshot(repoFullName, { token, apiUrl: options.apiUrl ?? env.GITHUB_API_URL, fetchImpl: options.fetchImpl });
  const [existing] = await db.select({ repoFullName: projectGithub.repoFullName }).from(projectGithub).where(own).limit(1);
  // A different repository starts from an empty snapshot rather than showing the old repository's numbers.
  if (existing && existing.repoFullName !== repoFullName) await db.delete(projectGithub).where(own);
  const syncedAt = new Date();
  const values = result.ok ? { ...result.snapshot, syncError: null } : { syncError: result.error };
  await db.insert(projectGithub).values({ projectId, ownerId, repoFullName, syncedAt, ...values })
    .onConflictDoUpdate({ target: projectGithub.projectId, set: { repoFullName, syncedAt, ...values }, setWhere: eq(projectGithub.ownerId, ownerId) });
  return result.ok ? { status: "synced" } : { status: "error", error: result.error };
}

/** Refreshes one of the owner's projects. The project must be the owner's own PRIVATE project. */
export async function syncProjectGitHub(ownerId: string, projectId: string, options: Options = {}): Promise<SyncOutcome> {
  if (!db) return { status: "error", error: "unavailable" };
  try {
    const [project] = await db.select({ repository: projects.repository }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), eq(projects.visibility, "PRIVATE"))).limit(1);
    if (!project) return { status: "not_found" };
    return await syncOne(ownerId, projectId, project.repository, options);
  } catch (error) {
    reportError("github.sync", error);
    return { status: "error", error: "unavailable" };
  }
}

/** The daily cron: every owned project with a GitHub URL, one at a time, stopping early when rate limited. */
export async function syncAllLinkedProjects(options: Options = {}) {
  const totals = { synced: 0, failed: 0, unlinked: 0, skipped: 0 };
  if (!db) return totals;
  if (!(options.token ?? env.GITHUB_TOKEN)) return { ...totals, skipped: -1 };
  const linked = await db.select({ id: projects.id, ownerId: projects.ownerId, repository: projects.repository }).from(projects)
    .where(and(isNotNull(projects.ownerId), eq(projects.visibility, "PRIVATE"), like(projects.repository, "https://github.com/%")))
    .orderBy(projects.id).limit(CRON_BATCH_LIMIT);
  for (const [index, project] of linked.entries()) {
    let outcome: SyncOutcome;
    try {
      outcome = await syncOne(project.ownerId!, project.id, project.repository, options);
    } catch (error) {
      reportError("github.cron", error);
      outcome = { status: "error", error: "unavailable" };
    }
    if (outcome.status === "synced") totals.synced += 1;
    else if (outcome.status === "unlinked") totals.unlinked += 1;
    else totals.failed += 1;
    if (outcome.status === "error" && outcome.error === "rate_limited") {
      totals.skipped = linked.length - index - 1;
      break;
    }
  }
  return totals;
}
