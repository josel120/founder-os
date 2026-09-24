import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function listPrivateProjects() {
  const owner = await requireAuth();
  if (!owner || !db) return [];
  return db.select().from(projects).where(and(eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).orderBy(desc(projects.createdAt));
}

export async function getPrivateProject(id: string) {
  const owner = await requireAuth();
  if (!owner || !db || !z.uuid().safeParse(id).success) return null;
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).limit(1);
  return project ?? null;
}
