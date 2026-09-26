import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
const connectionString = process.env.DATABASE_URL;
// Dev hot reload re-evaluates this module; reuse one pool instead of opening a new one on every reload.
const cache = globalThis as typeof globalThis & { founderOsSql?: postgres.Sql };
function client(url: string): postgres.Sql {
  cache.founderOsSql ??= postgres(url);
  return cache.founderOsSql;
}
export const db = connectionString ? drizzle(client(connectionString), { schema }) : null;
