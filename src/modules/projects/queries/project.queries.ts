import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { withoutOwnership } from "@/db/columns";

const columns = withoutOwnership(projects);

export async function listPrivateProjects() {
  const owner = await requireAuth();
  if (!owner || !db) return [];
  return db.select(columns).from(projects).where(and(eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).orderBy(desc(projects.createdAt));
}

export async function getPrivateProject(id: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(id).success) return null;
  const [project] = await db.select(columns).from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).limit(1);
  return project ?? null;
}

/** The owner's project converted from this idea, if any (conversion is idempotent, ADR-009). */
export async function findPrivateProjectForIdea(ideaId: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(ideaId).success) return null;
  const [project] = await db.select({ id: projects.id, name: projects.name }).from(projects)
    .where(and(eq(projects.originIdeaId, ideaId), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).limit(1);
  return project ?? null;
}
