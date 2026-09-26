import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
const connectionString = process.env.DATABASE_URL;

/**
 * Neon's pooled endpoint (PgBouncer, transaction mode) rejects server-side prepared statements, and
 * each serverless function instance should hold only a few connections against Neon's shared pool;
 * 3 gives an instance room for a couple of concurrent queries without exhausting the pool across many
 * instances. Pure so it can be unit-tested without connecting (ADR-016).
 */
export function resolvePostgresOptions(url: string, source: NodeJS.ProcessEnv): postgres.Options<Record<string, never>> {
  const isPooled = url.includes("-pooler.") || source.DATABASE_POOLED === "1";
  return isPooled ? { prepare: false, max: 3 } : {};
}

// Dev hot reload re-evaluates this module; reuse one pool instead of opening a new one on every reload.
const cache = globalThis as typeof globalThis & { founderOsSql?: postgres.Sql };
function client(url: string): postgres.Sql {
  cache.founderOsSql ??= postgres(url, resolvePostgresOptions(url, process.env));
  return cache.founderOsSql;
}
export const db = connectionString ? drizzle(client(connectionString), { schema }) : null;
