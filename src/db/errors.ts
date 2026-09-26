/** True for a Postgres unique_violation (23505), optionally on one constraint. Unwraps Drizzle's query error. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const { code, constraint_name: name, cause } = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (code === "23505") return constraint === undefined || name === constraint;
    current = cause;
  }
  return false;
}
