"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectPublications, projects } from "@/db/schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";
import { publishProjectSchema, unpublishProjectSchema } from "../schemas/publication.schema";

type Result = { ok: true; projectId: string } | { ok: false; error: string };
const failure = { ok: false as const, error: "Could not change what is public. Please try again." };
const signIn = { ok: false as const, error: "Sign in again to save changes." };
const notFound = { ok: false as const, error: "Project not found. Nothing was published." };

function refresh(projectId: string) {
  revalidatePath(`/private/projects/${projectId}`);
  revalidatePath("/portfolio");
}

/** Publishes, or updates the publication of, one of the owner's projects (ADR-018). */
export async function publishProject(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return signIn;
  const parsed = publishProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid publication." };
  if (!db) return failure;
  const { projectId, visibility, summary } = parsed.data;
  try {
    // The project must be the session owner's; the publication is then written with that owner, never a form value.
    const [project] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).limit(1);
    if (!project) return notFound;
    const saved = await db.insert(projectPublications).values({ projectId, ownerId: owner.id, visibility, summary })
      .onConflictDoUpdate({ target: projectPublications.projectId, set: { visibility, summary, updatedAt: new Date() }, setWhere: eq(projectPublications.ownerId, owner.id) })
      .returning({ projectId: projectPublications.projectId });
    if (!saved.length) return notFound;
  } catch (error) {
    reportError("portfolio.publish", error);
    return failure;
  }
  refresh(projectId);
  return { ok: true, projectId };
}

/** Makes a project private again: its publication row is deleted, so public pages return 404 on the next request. */
export async function unpublishProject(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return signIn;
  const parsed = unpublishProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid project." };
  if (!db) return failure;
  const { projectId } = parsed.data;
  try {
    const removed = await db.delete(projectPublications)
      .where(and(eq(projectPublications.projectId, projectId), eq(projectPublications.ownerId, owner.id)))
      .returning({ projectId: projectPublications.projectId });
    if (!removed.length) return { ok: false, error: "This project is not published." };
  } catch (error) {
    reportError("portfolio.unpublish", error);
    return failure;
  }
  refresh(projectId);
  return { ok: true, projectId };
}
