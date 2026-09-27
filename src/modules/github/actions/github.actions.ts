"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { syncProjectGitHub } from "../services/sync";

type Result = { ok: true; message: string } | { ok: false; error: string };
const messages: Record<string, string> = {
  not_found: "GitHub could not find that repository, or the token cannot see it.",
  unauthorized: "GitHub refused the token. Check that it is valid and can read this repository.",
  rate_limited: "GitHub's rate limit was reached. Try again later.",
  unavailable: "GitHub did not answer. Try again later.",
};

/** Refreshes the session owner's project snapshot from GitHub (ADR-019). */
export async function refreshProjectGitHub(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to refresh." };
  const parsed = z.object({ projectId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid project." };
  const outcome = await syncProjectGitHub(owner.id, parsed.data.projectId);
  revalidatePath(`/private/projects/${parsed.data.projectId}`);
  switch (outcome.status) {
    case "synced": return { ok: true, message: "Refreshed from GitHub." };
    case "unlinked": return { ok: false, error: "Add a https://github.com/owner/repo URL as the project's repository first." };
    case "not_configured": return { ok: false, error: "GitHub is not connected yet: GITHUB_TOKEN is not set." };
    case "not_found": return { ok: false, error: "Project not found." };
    case "error": return { ok: false, error: messages[outcome.error] ?? messages.unavailable! };
  }
}
