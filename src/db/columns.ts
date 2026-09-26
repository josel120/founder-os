import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

type WithoutOwnership<T extends PgTable> = Omit<T["_"]["columns"], "ownerId" | "visibility">;

/** Every column except the ownership boundary: owner and visibility are predicates, never payload (T-046). */
export function withoutOwnership<T extends PgTable>(table: T): WithoutOwnership<T> {
  const columns: Record<string, unknown> = { ...getTableColumns(table) };
  delete columns.ownerId;
  delete columns.visibility;
  return columns as WithoutOwnership<T>;
}
