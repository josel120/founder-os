import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projectGithub, projects } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

const snapshotColumns = {
  repoFullName: projectGithub.repoFullName, defaultBranch: projectGithub.defaultBranch, lastPushAt: projectGithub.lastPushAt,
  openIssues: projectGithub.openIssues, openPullRequests: projectGithub.openPullRequests, latestReleaseTag: projectGithub.latestReleaseTag,
  latestReleaseAt: projectGithub.latestReleaseAt, syncedAt: projectGithub.syncedAt, syncError: projectGithub.syncError,
};

/** The session owner's snapshot for one project, or null. */
export async function getPrivateGitHubSnapshot(projectId: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(projectId).success) return null;
  const [snapshot] = await db.select(snapshotColumns).from(projectGithub)
    .where(and(eq(projectGithub.projectId, projectId), eq(projectGithub.ownerId, owner.id))).limit(1);
  return snapshot ?? null;
}

/** The owner's projects whose repository has had no push since `before` (ADR-019). Owner is checked on both tables. */
export async function listStaleRepositories(ownerId: string, before: Date) {
  if (!db) return [];
  return db.select({ id: projects.id, name: projects.name, repoFullName: projectGithub.repoFullName, lastPushAt: projectGithub.lastPushAt })
    .from(projectGithub)
    .innerJoin(projects, and(eq(projects.id, projectGithub.projectId), eq(projects.ownerId, projectGithub.ownerId)))
    .where(and(eq(projectGithub.ownerId, ownerId), eq(projects.visibility, "PRIVATE"), lte(projectGithub.lastPushAt, before)))
    .orderBy(asc(projectGithub.lastPushAt)).limit(10);
}

export type GitHubSnapshotView = NonNullable<Awaited<ReturnType<typeof getPrivateGitHubSnapshot>>>;
