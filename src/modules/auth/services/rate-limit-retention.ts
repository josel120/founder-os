import { lt } from "drizzle-orm";
import type { db as DbClient } from "@/db";
import { rateLimits } from "@/db/schema";
import { reportError } from "@/lib/report-error";

type RateLimitDb = NonNullable<typeof DbClient>;

/**
 * ADR-016 (T-059): the `rate_limit` table keys rows on `ip|path` (Better Auth 1.7.5), the first
 * personal data this app stores that is not the owner's own. A row is only refreshed when its key
 * makes another request, so an IP that stops sending requests is kept forever without this. 24h is
 * far longer than the longest rate-limit window (60s, the sign-in rule), so an active window's rows
 * are never touched.
 */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Runs the delete at most this often per server instance, so pruning never runs on every request. */
const THROTTLE_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

/** Pure: the boundary before which a `rate_limit` row is stale and safe to delete. */
export function retentionCutoff(nowMs: number): number {
  return nowMs - RETENTION_MS;
}

/**
 * Opportunistic, throttled prune of stale `rate_limit` rows. Safe to call on every sign-in: it is a
 * no-op unless an hour has passed since the last prune on this server instance, and it never throws
 * or rejects — a failed delete is reported (`auth.rateLimitRetention`) and otherwise ignored so it
 * can never block or fail the request that triggered it.
 */
export async function pruneStaleRateLimits(db: RateLimitDb, nowMs: number): Promise<void> {
  if (nowMs - lastPruneAt < THROTTLE_MS) return;
  lastPruneAt = nowMs;
  try {
    await db.delete(rateLimits).where(lt(rateLimits.lastRequest, retentionCutoff(nowMs)));
  } catch (error) {
    reportError("auth.rateLimitRetention", error);
  }
}
