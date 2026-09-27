import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projectPublications, projects } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { publicSlugSchema } from "../schemas/publication.schema";

/**
 * The ADR-018 allowlist: the only columns a public page may read. Adding a field here publishes it for every
 * published project, so it needs an ADR change first.
 */
export const publicProjectColumns = {
  name: projects.name,
  slug: projects.slug,
  lifecycle: projects.lifecycle,
  releasedAt: projects.releasedAt,
  website: projects.website,
  playStoreUrl: projects.playStoreUrl,
  appStoreUrl: projects.appStoreUrl,
  summary: projectPublications.summary,
  publishedAt: projectPublications.publishedAt,
};

// The publication must belong to the project's own owner; a mismatched row publishes nothing.
const publishedJoin = and(eq(projectPublications.projectId, projects.id), eq(projectPublications.ownerId, projects.ownerId));
const PUBLIC_LIST_LIMIT = 100;

/** Projects listed on /portfolio: PUBLIC only, newest publication first. Anonymous. */
export async function listPublicProjects() {
  if (!db) return [];
  return db.select(publicProjectColumns).from(projectPublications).innerJoin(projects, publishedJoin)
    .where(eq(projectPublications.visibility, "PUBLIC")).orderBy(desc(projectPublications.publishedAt)).limit(PUBLIC_LIST_LIMIT);
}

/** One published project (PUBLIC or UNLISTED) by slug. Private and unknown slugs both return null. Anonymous. */
export async function getPublishedProject(slug: string) {
  if (!db || !publicSlugSchema.safeParse(slug).success) return null;
  const [project] = await db.select(publicProjectColumns).from(projectPublications).innerJoin(projects, publishedJoin)
    .where(and(eq(projects.slug, slug), inArray(projectPublications.visibility, ["PUBLIC", "UNLISTED"]))).limit(1);
  return project ?? null;
}

/** The owner's publication settings for one project, or null when it is private. */
export async function getPrivatePublication(projectId: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(projectId).success) return null;
  const [publication] = await db.select({ visibility: projectPublications.visibility, summary: projectPublications.summary, publishedAt: projectPublications.publishedAt, updatedAt: projectPublications.updatedAt })
    .from(projectPublications).where(and(eq(projectPublications.projectId, projectId), eq(projectPublications.ownerId, owner.id))).limit(1);
  return publication ?? null;
}

export type PublicProject = Awaited<ReturnType<typeof listPublicProjects>>[number];
