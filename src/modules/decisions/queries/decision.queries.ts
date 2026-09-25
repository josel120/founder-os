import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { decisionLogs } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function listPrivateDecisions() {
  const owner = await requireAuth();
  if (!owner) return [];
  if (!db) return [];
  return db.select().from(decisionLogs).where(and(eq(decisionLogs.ownerId, owner.id), eq(decisionLogs.visibility, "PRIVATE"))).orderBy(desc(decisionLogs.createdAt));
}

export async function listDecisionsForIdea(ideaId: string) {
  const owner = await requireAuth();
  if (!owner || !z.string().uuid().safeParse(ideaId).success) return [];
  if (!db) return [];
  return db.select().from(decisionLogs)
    .where(and(eq(decisionLogs.ideaId, ideaId), eq(decisionLogs.ownerId, owner.id), eq(decisionLogs.visibility, "PRIVATE")))
    .orderBy(desc(decisionLogs.createdAt));
}

export async function listDecisionsForProject(projectId: string) {
  const owner = await requireAuth();
  if (!owner || !z.string().uuid().safeParse(projectId).success) return [];
  if (!db) return [];
  return db.select().from(decisionLogs)
    .where(and(eq(decisionLogs.projectId, projectId), eq(decisionLogs.ownerId, owner.id), eq(decisionLogs.visibility, "PRIVATE")))
    .orderBy(desc(decisionLogs.createdAt));
}
