import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { syncAllLinkedProjects } from "@/modules/github/services/sync";

// Vercel Cron calls this daily with `Authorization: Bearer <CRON_SECRET>` (ADR-019). Fails closed without a secret.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (value: string) => createHash("sha256").update(value).digest();

function authorized(header: string | null): boolean {
  if (!env.CRON_SECRET || !header) return false;
  // Hashing first makes both sides the same length, so the comparison is constant-time.
  return timingSafeEqual(digest(header), digest(`Bearer ${env.CRON_SECRET}`));
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  const totals = await syncAllLinkedProjects();
  // Counts only: no project, repository or owner data leaves this route.
  return Response.json(totals, { headers: { "cache-control": "no-store" } });
}
