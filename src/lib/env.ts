import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  OWNER_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  OWNER_SETUP_TOKEN: z.string().min(32).optional(),
});

export type Env = z.infer<typeof schema>;

/**
 * Real production configuration is required on Vercel (which sets VERCEL=1 for both preview and
 * production deploys, at build and at runtime) or when explicitly opted in, but never during
 * `next build` itself. CI and local E2E run `next start` with NODE_ENV=production and no auth/DB
 * env at all (and an authenticated E2E run uses an http BETTER_AUTH_URL), so NODE_ENV cannot gate
 * this (ADR-016).
 */
function isStrict(source: NodeJS.ProcessEnv): boolean {
  if (source.NEXT_PHASE === "phase-production-build") return false;
  return source.VERCEL === "1" || source.FOUNDER_OS_STRICT_ENV === "1";
}

/**
 * Pure: parses `source` and, when strict, fails fast on missing/invalid required variables.
 * Exported so tests can pass a fake env object instead of mutating `process.env`.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = schema.parse({
    DATABASE_URL: source.DATABASE_URL,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    OWNER_EMAIL: source.OWNER_EMAIL,
    OWNER_SETUP_TOKEN: source.OWNER_SETUP_TOKEN,
  });

  if (isStrict(source)) {
    const offending: string[] = [];
    if (!parsed.DATABASE_URL) offending.push("DATABASE_URL");
    if (!parsed.BETTER_AUTH_SECRET) offending.push("BETTER_AUTH_SECRET");
    if (!parsed.BETTER_AUTH_URL.startsWith("https://")) offending.push("BETTER_AUTH_URL (must be https)");
    if (!parsed.OWNER_EMAIL) offending.push("OWNER_EMAIL");
    if (offending.length > 0) {
      // Name the offending variables only; never interpolate a variable's value here.
      throw new Error(`Missing or invalid required production environment variables: ${offending.join(", ")}`);
    }
  }

  return parsed;
}

export const env = parseEnv(process.env);
