import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { evidence } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { evidenceFilterSchema, type EvidenceFilter } from "../schemas/evidence.schema";

// Explicit columns: owner and visibility never leave the server, even to the owner's own pages.
const columns = {
  id: evidence.id,
  title: evidence.title,
  summary: evidence.summary,
  kind: evidence.kind,
  signal: evidence.signal,
  sourceUrl: evidence.sourceUrl,
  problemId: evidence.problemId,
  ideaId: evidence.ideaId,
  createdAt: evidence.createdAt,
  updatedAt: evidence.updatedAt,
};

async function listScoped(extra: SQL[]) {
  const owner = await requireAuth();
  if (!owner || !db) return [];
  return db.select(columns).from(evidence)
    .where(and(eq(evidence.ownerId, owner.id), eq(evidence.visibility, "PRIVATE"), ...extra))
    .orderBy(desc(evidence.createdAt));
}

export type EvidenceRow = Awaited<ReturnType<typeof listScoped>>[number];

/** All of the owner's evidence, newest first, optionally filtered by kind and signal. */
export async function listPrivateEvidence(filter: EvidenceFilter = {}) {
  const { kind, signal } = evidenceFilterSchema.parse(filter);
  const extra: SQL[] = [];
  if (kind) extra.push(eq(evidence.kind, kind));
  if (signal) extra.push(eq(evidence.signal, signal));
  return listScoped(extra);
}

export async function listEvidenceForIdea(ideaId: string) {
  if (!z.uuid().safeParse(ideaId).success) return [];
  return listScoped([eq(evidence.ideaId, ideaId)]);
}

export async function listEvidenceForProblem(problemId: string) {
  if (!z.uuid().safeParse(problemId).success) return [];
  return listScoped([eq(evidence.problemId, problemId)]);
}
