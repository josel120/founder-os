// Server-side error reporting that never records PRIVATE data (ADR-016). Messages are not logged: driver and
// Drizzle messages embed SQL and parameter values. Only fixed-shape identifiers are kept.
const sqlState = /^[0-9A-Z]{5}$/;
const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const digestPattern = /^[A-Za-z0-9_-]{1,64}$/; // Next.js digests are often all digits

export type ErrorReport = { scope: string; error: string; code?: string; digest?: string };

export function describeError(scope: string, error: unknown): ErrorReport {
  const report: ErrorReport = { scope, error: "Unknown" };
  if (error instanceof Error && identifier.test(error.name)) report.error = error.name;
  else if (typeof error === "object" && error !== null) report.error = "Error";
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const { code, digest, cause } = current as { code?: unknown; digest?: unknown; cause?: unknown };
    if (!report.code && typeof code === "string" && sqlState.test(code)) report.code = code;
    if (!report.digest && typeof digest === "string" && digestPattern.test(digest)) report.digest = digest;
    current = cause;
  }
  return report;
}

/** Logs one structured line for an unexpected server failure. The caller still returns its generic user message. */
export function reportError(scope: string, error: unknown): void {
  console.error("[founder-os] server error", JSON.stringify(describeError(scope, error)));
}
