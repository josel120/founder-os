"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { ideas, projects } from "@/db/schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";
import { createProjectFromIdeaSchema, createProjectSchema, updateProjectContentSchema, updateProjectStatusSchema } from "../schemas/project.schema";
import { slugify } from "../services/slug";

type Result = { ok: true; projectId: string } | { ok: false; error: string };
const failure = { ok: false as const, error: "Could not save the project. Please try again." };
// Slugs are unique across the table, so a collision is reported plainly instead of as a generic failure.
const slugTaken = { ok: false as const, error: "That slug is already in use. Choose another one." };
function saveFailure(scope: string, error: unknown) {
  if (isUniqueViolation(error, "project_slug_unique")) return slugTaken; // expected; not an error to report
  reportError(scope, error);
  return failure;
}

function refresh(id: string) {
  revalidatePath("/private/projects");
  revalidatePath(`/private/projects/${id}`);
}

export async function createProject(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  const parsed = createProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid project." };
  if (!db) return failure;
  let projectId: string;
  try {
    const [created] = await db.insert(projects).values({ ...parsed.data, ownerId: owner.id, visibility: "PRIVATE", lifecycle: "PLANNING", operationalStatus: "NO_ACTION_REQUIRED" }).returning({ id: projects.id });
    if (!created) return failure;
    projectId = created.id;
  } catch (error) { return saveFailure("projects.create", error); }
  refresh(projectId);
  return { ok: true, projectId };
}

export async function createProjectFromIdea(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to create the project." };
  const parsed = createProjectFromIdeaSchema.safeParse({ ideaId: formData.get("ideaId") });
  if (!parsed.success) return { ok: false, error: "Invalid idea." };
  if (!db) return failure;
  try {
    const [idea] = await db.select({ id: ideas.id, title: ideas.title, description: ideas.description })
      .from(ideas)
      .where(and(eq(ideas.id, parsed.data.ideaId), eq(ideas.ownerId, owner.id), eq(ideas.visibility, "PRIVATE")))
      .limit(1);
    if (!idea) return { ok: false, error: "Idea not found. No project was created." };
    const [existing] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.originIdeaId, idea.id), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE")))
      .limit(1);
    if (existing) {
      refresh(existing.id);
      return { ok: true, projectId: existing.id };
    }
    const slugBase = slugify(idea.title) || "project";
    const [created] = await db.insert(projects).values({
      ownerId: owner.id,
      originIdeaId: idea.id,
      name: idea.title,
      slug: `${slugBase}-${idea.id.slice(0, 8)}`,
      description: idea.description,
      lifecycle: "PLANNING",
      operationalStatus: "NO_ACTION_REQUIRED",
      visibility: "PRIVATE",
    }).returning({ id: projects.id });
    if (!created) return failure;
    refresh(created.id);
    return { ok: true, projectId: created.id };
  } catch (error) {
    reportError("projects.createFromIdea", error);
    return failure;
  }
}

export async function updateProjectContent(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  const parsed = updateProjectContentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid project." };
  if (!db) return failure;
  const { projectId, ...content } = parsed.data;
  try {
    const changed = await db.update(projects).set({ ...content, updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).returning({ id: projects.id });
    if (!changed.length) return { ok: false, error: "Project not found. Changes were not saved." };
  } catch (error) { return saveFailure("projects.updateContent", error); }
  refresh(projectId);
  return { ok: true, projectId };
}

export async function updateProjectStatus(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save changes." };
  const parsed = updateProjectStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid project status." };
  if (!db) return failure;
  const data = parsed.data;
  const waiting = data.operationalStatus.startsWith("WAITING_");
  try {
    const changed = await db.update(projects).set({
      lifecycle: data.lifecycle, operationalStatus: data.operationalStatus,
      nextAction: data.nextAction || null,
      waitingReason: waiting ? data.waitingReason : null,
      waitingSince: waiting ? new Date(data.waitingSince) : null,
      reviewAt: data.reviewAt ? new Date(data.reviewAt) : null,
      updatedAt: new Date(),
    }).where(and(eq(projects.id, data.projectId), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE"))).returning({ id: projects.id });
    if (!changed.length) return { ok: false, error: "Project not found. Changes were not saved." };
  } catch (error) { reportError("projects.updateStatus", error); return failure; }
  refresh(data.projectId);
  return { ok: true, projectId: data.projectId };
}
