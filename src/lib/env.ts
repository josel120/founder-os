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

/** Vercel system variables hold bare hostnames; returns the https origin, or undefined when empty or invalid. */
function httpsOrigin(host: string | undefined): string | undefined {
  const value = host?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("https://") ? value : `https://${value}`);
    return url.protocol === "https:" && url.hostname ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pure: every https origin of this Vercel deployment (its unique URL, its branch URL and the project's
 * production URL), so Better Auth accepts sign-ins on each of them (T-062). Empty off Vercel.
 */
export function vercelOrigins(source: NodeJS.ProcessEnv): string[] {
  if (source.VERCEL !== "1") return [];
  const origins = [source.VERCEL_URL, source.VERCEL_BRANCH_URL, source.VERCEL_PROJECT_PRODUCTION_URL]
    .map((host) => httpsOrigin(host))
    .filter((origin): origin is string => origin !== undefined);
  return [...new Set(origins)];
}

/**
 * Pure: the deployment's own origin, used when BETTER_AUTH_URL is not set on Vercel (T-062). Production
 * uses the project's production domain; previews use their branch URL, else their unique URL.
 */
export function vercelAuthUrl(source: NodeJS.ProcessEnv): string | undefined {
  if (source.VERCEL !== "1") return undefined;
  if (source.VERCEL_ENV === "production") return httpsOrigin(source.VERCEL_PROJECT_PRODUCTION_URL);
  return httpsOrigin(source.VERCEL_BRANCH_URL) ?? httpsOrigin(source.VERCEL_URL);
}

/**
 * Pure: parses `source` and, when strict, fails fast on missing/invalid required variables.
 * Exported so tests can pass a fake env object instead of mutating `process.env`.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = schema.parse({
    DATABASE_URL: source.DATABASE_URL,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    // An explicit BETTER_AUTH_URL always wins over the one derived from Vercel's system variables.
    BETTER_AUTH_URL: source.BETTER_AUTH_URL ?? vercelAuthUrl(source),
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
