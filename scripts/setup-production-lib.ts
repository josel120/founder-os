// Pure helpers for `pnpm setup:production` (T-062). No I/O here, so every rule is unit-tested
// (tests/setup-production.test.ts); scripts/setup-production.ts only runs processes and prompts.
import { parseEnv } from "node:util";
import { z } from "zod";

/** Pinned so the flags this script relies on (checked against its source) cannot change underneath it. */
export const VERCEL_CLI = "vercel@60.1.3";
export const DEFAULT_PROJECT = "founder-os";
export const MIN_PASSWORD_LENGTH = 12;
/** Better Auth's default maximum password length. */
export const MAX_PASSWORD_LENGTH = 128;
/**
 * create-owner calls Better Auth in-process, so no request reaches this origin; it only has to be a valid https URL.
 * The `.invalid` TLD can never resolve.
 */
export const SETUP_AUTH_URL = "https://founder-os-setup.invalid";
/** create-owner.ts exit code when the owner account already existed and was left unchanged. */
export const OWNER_EXISTS_EXIT_CODE = 3;
/** create-owner.ts exit code: the existing owner got the new email and password (--reset-owner). */
export const OWNER_RESET_EXIT_CODE = 4;
/** create-owner.ts exit code: an owner exists under a different email; only --reset-owner may change it. */
export const OWNER_EMAIL_MISMATCH_EXIT_CODE = 5;
/** Neon's direct (unpooled) connection string, as the Vercel Marketplace integration names it. */
export const DIRECT_URL_KEYS = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"] as const;

export type SetupOptions = { dryRun: boolean; help: boolean; resetOwner: boolean; project: string; scope?: string };
export type Target = "production" | "preview";

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

/** Vercel project names: lowercase letters, digits, '.', '_' and '-', up to 100 characters, no '---'. */
export function isValidProjectName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(value) && !value.includes("---");
}

/** A Vercel team slug or id (team_…). */
export function isValidScope(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
}

export type ParsedArgs = { ok: true; options: SetupOptions } | { ok: false; error: string };

export function parseSetupArgs(argv: readonly string[]): ParsedArgs {
  const options: SetupOptions = { dryRun: false, help: false, resetOwner: false, project: DEFAULT_PROJECT };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] ?? "";
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--reset-owner") {
      options.resetOwner = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const match = /^--(project|scope)(?:=(.*))?$/.exec(arg);
    if (!match) return { ok: false, error: `Unknown option "${arg}". Run with --help to see the options.` };
    const flag = match[1];
    let value = match[2];
    if (value === undefined) {
      index++;
      value = argv[index];
    }
    if (value === undefined || value === "" || value.startsWith("-")) return { ok: false, error: `--${flag} needs a value.` };
    if (flag === "project") {
      if (!isValidProjectName(value)) {
        return { ok: false, error: "--project must be a Vercel project name: lowercase letters, digits, '.', '_' or '-'." };
      }
      options.project = value;
    } else {
      if (!isValidScope(value)) return { ok: false, error: "--scope must be a Vercel team slug or id." };
      options.scope = value;
    }
  }
  return { ok: true, options };
}

// ---------------------------------------------------------------------------------------------
// Owner input
// ---------------------------------------------------------------------------------------------

// The same rule src/lib/env.ts applies to OWNER_EMAIL, so whatever is accepted here also passes at boot.
const ownerEmailSchema = z.string().trim().max(254).email();

/** Returns the lower-cased owner email, or undefined when it is not a valid address. */
export function normalizeOwnerEmail(input: string): string | undefined {
  const parsed = ownerEmailSchema.safeParse(input);
  return parsed.success ? parsed.data.toLowerCase() : undefined;
}

/** Returns what is wrong with the password pair, or undefined when it is acceptable. */
export function passwordProblem(first: string, second: string): string | undefined {
  if (first.length < MIN_PASSWORD_LENGTH) return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (first.length > MAX_PASSWORD_LENGTH) return `The password can have at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (first !== second) return "The two passwords are different.";
  return undefined;
}

/** `escape` holds an unfinished terminal escape sequence, which may arrive split across chunks. */
export type HiddenInput = { value: string; done: boolean; cancelled: boolean; escape?: string };

const ESC = String.fromCharCode(27);

/** True once `sequence` (starting with ESC) is complete: CSI "ESC [ params final", SS3 "ESC O x", or "ESC x". */
function escapeComplete(sequence: string): boolean {
  if (sequence.length < 2) return false;
  if (sequence[1] === "[") return sequence.length > 2 && /[@-~]/.test(sequence[sequence.length - 1] ?? "");
  if (sequence[1] === "O") return sequence.length >= 3;
  return true;
}

/**
 * Applies raw-mode keystrokes to a hidden answer: Enter finishes, Ctrl+C cancels, Backspace deletes one character,
 * arrow keys and other escape sequences and control keys are ignored. Works the same for Windows and POSIX terminals.
 */
export function applyKeystrokes(state: HiddenInput, chunk: string): HiddenInput {
  let value = state.value;
  let escape = state.escape;
  for (const char of chunk) {
    if (escape !== undefined) {
      escape += char;
      if (escapeComplete(escape) || escape.length > 16) escape = undefined;
      continue;
    }
    if (char === ESC) {
      escape = char;
      continue;
    }
    if (char === "\r" || char === "\n" || char === "\u0004") return { value, done: true, cancelled: false };
    if (char === "\u0003") return { value: "", done: true, cancelled: true };
    if (char === "\u007f" || char === "\b") {
      value = Array.from(value).slice(0, -1).join("");
      continue;
    }
    if (char < " ") continue;
    value += char;
  }
  return escape === undefined ? { value, done: false, cancelled: false } : { value, done: false, cancelled: false, escape };
}

// ---------------------------------------------------------------------------------------------
// Vercel state
// ---------------------------------------------------------------------------------------------

export type EnvRecord = { key: string; value?: string; targets: string[]; gitBranch?: string };

const envListSchema = z.object({
  envs: z.array(
    z.object({
      key: z.string(),
      value: z.string().nullish(),
      target: z.union([z.string(), z.array(z.string())]).nullish(),
      gitBranch: z.string().nullish(),
    }),
  ),
});

/** Parses `vercel env ls --format json`. Returns undefined when the output is not the expected JSON. */
export function parseEnvList(stdout: string): EnvRecord[] | undefined {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return undefined;
  }
  const parsed = envListSchema.safeParse(json);
  if (!parsed.success) return undefined;
  return parsed.data.envs.map((record) => ({
    key: record.key,
    value: record.value ?? undefined,
    targets: typeof record.target === "string" ? [record.target] : (record.target ?? []),
    gitBranch: record.gitBranch ?? undefined,
  }));
}

function recordFor(records: readonly EnvRecord[], key: string, target: Target): EnvRecord | undefined {
  // A branch-specific preview value does not cover every preview branch, so it does not count here.
  return records.find((record) => record.key === key && record.targets.includes(target) && !record.gitBranch);
}

export function hasEnv(records: readonly EnvRecord[], key: string, target: Target): boolean {
  return recordFor(records, key, target) !== undefined;
}

/** Where an env var's value comes from. The value itself never enters a write, a command line or a log line. */
export type EnvValueSource = "corepack" | "ownerEmail" | "productionSecret" | "previewSecret";
export type EnvWrite = { name: string; targets: Target[]; sensitive: boolean; source: EnvValueSource };

/**
 * Decides which env vars to write so a re-run changes nothing that is already right. An existing BETTER_AUTH_SECRET
 * is kept: replacing it would sign the owner out (RUNBOOK section 8 rotates it on purpose). BETTER_AUTH_URL and
 * NEXT_PUBLIC_BETTER_AUTH_URL are never written: the app derives them on Vercel (src/lib/env.ts, auth-client.ts).
 */
export function planEnvWrites(records: readonly EnvRecord[], ownerEmail: string): EnvWrite[] {
  const writes: EnvWrite[] = [];
  const corepackTargets = (["production", "preview"] as const).filter(
    (target) => recordFor(records, "ENABLE_EXPERIMENTAL_COREPACK", target)?.value !== "1",
  );
  if (corepackTargets.length > 0) {
    writes.push({ name: "ENABLE_EXPERIMENTAL_COREPACK", targets: [...corepackTargets], sensitive: false, source: "corepack" });
  }
  // Readable on purpose: RUNBOOK section 9 asks the owner to compare it with the account's email. It is not a secret (ADR-005).
  if (recordFor(records, "OWNER_EMAIL", "production")?.value !== ownerEmail) {
    writes.push({ name: "OWNER_EMAIL", targets: ["production"], sensitive: false, source: "ownerEmail" });
  }
  if (!hasEnv(records, "BETTER_AUTH_SECRET", "production")) {
    writes.push({ name: "BETTER_AUTH_SECRET", targets: ["production"], sensitive: true, source: "productionSecret" });
  }
  // A separate secret, so a preview can boot once the owner gives previews their own database, without sharing production's.
  if (!hasEnv(records, "BETTER_AUTH_SECRET", "preview")) {
    writes.push({ name: "BETTER_AUTH_SECRET", targets: ["preview"], sensitive: true, source: "previewSecret" });
  }
  return writes;
}

export function envAddArgs(write: EnvWrite): string[] {
  // --yes with a Preview target applies to every preview branch (no git-branch prompt); the value arrives on stdin.
  return ["env", "add", write.name, write.targets.join(","), write.sensitive ? "--sensitive" : "--no-sensitive", "--force", "--yes"];
}

const valueLabels: Record<EnvValueSource, string> = {
  corepack: "1",
  ownerEmail: "<owner email>",
  productionSecret: "<generated>",
  previewSecret: "<generated>",
};

export function describeEnvWrite(write: EnvWrite, scope?: string): string {
  return `${describeVercel(envAddArgs(write), scope)}   (value on stdin: ${valueLabels[write.source]})`;
}

const projectLinkSchema = z.object({ projectId: z.string().min(1), orgId: z.string().min(1), projectName: z.string().optional() });
export type ProjectLink = z.infer<typeof projectLinkSchema>;

/** Parses `.vercel/project.json`, written by `vercel link`. */
export function parseProjectLink(text: string): ProjectLink | undefined {
  try {
    const parsed = projectLinkSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

/**
 * On Windows npx is a .cmd file, which Node 22 only starts through a shell, so every argument must be plain:
 * no spaces, quotes or shell characters. Secrets never get here: they go through stdin or the child's env.
 */
export function isShellSafeArg(arg: string): boolean {
  return /^[A-Za-z0-9@._,-]+$/.test(arg);
}

export function vercelArgs(args: readonly string[], scope?: string): string[] {
  const all = ["--yes", VERCEL_CLI, ...args, ...(scope ? ["--scope", scope] : [])];
  const unsafe = all.find((arg) => !isShellSafeArg(arg));
  if (unsafe !== undefined) throw new Error("Refusing to run the Vercel CLI with an unexpected argument.");
  return all;
}

/**
 * How to start the pinned CLI. npx is a .cmd file on Windows, which Node 22 only starts through a shell; there the
 * already-checked arguments are joined into one command line (an args array with a shell is deprecated).
 */
export function vercelSpawn(args: readonly string[], scope: string | undefined, platform: string): { command: string; args: string[]; shell: boolean } {
  const all = vercelArgs(args, scope);
  if (platform === "win32") return { command: ["npx.cmd", ...all].join(" "), args: [], shell: true };
  return { command: "npx", args: all, shell: false };
}

export function describeVercel(args: readonly string[], scope?: string): string {
  return `npx ${vercelArgs(args, scope).join(" ")}`;
}

// Variables that decide which database, secret or project a child uses: only this script sets them for a child.
const controlledKeys = new Set([
  "DATABASE_URL",
  "DATABASE_POOLED",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_BETTER_AUTH_URL",
  "OWNER_EMAIL",
  "OWNER_SETUP_TOKEN",
  "FOUNDER_OS_STRICT_ENV",
  "NEXT_PHASE",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
]);

/**
 * A child process environment: the owner's own environment minus the variables above and pnpm's `npm_*` script
 * variables (they make npm print config warnings), plus `overrides`.
 */
export function childEnv(base: NodeJS.ProcessEnv, overrides: Record<string, string>): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...base };
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined || key.startsWith("npm_") || controlledKeys.has(key.toUpperCase())) delete result[key];
  }
  return { ...result, ...overrides };
}

// ---------------------------------------------------------------------------------------------
// Database URL
// ---------------------------------------------------------------------------------------------

/** Parses a dotenv file such as the one `vercel env pull` writes. */
export function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parseEnv(text))) if (value !== undefined) result[key] = value;
  return result;
}

/** A Postgres URL that is not Neon's pooled (PgBouncer) endpoint. Placeholders such as "[SENSITIVE]" are rejected. */
export function isDirectDatabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "" && !url.hostname.includes("-pooler.");
  } catch {
    return false;
  }
}

/** Picks the direct (unpooled) connection string for migrations from the pulled production variables. */
export function pickDirectDatabaseUrl(vars: Readonly<Record<string, string>>): { key: string; url: string } | undefined {
  for (const key of DIRECT_URL_KEYS) {
    const value = vars[key];
    if (isDirectDatabaseUrl(value)) return { key, url: value.trim() };
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Owner creation (scripts/create-owner.ts)
// ---------------------------------------------------------------------------------------------

const apiErrorSchema = z.object({ status: z.string().regex(/^[A-Z_]{1,40}$/), body: z.object({ code: z.string().optional() }).passthrough().nullish() });

/**
 * Better Auth refuses a second account for an existing email (422 USER_ALREADY_EXISTS…), and the owner hook in
 * src/lib/auth.ts refuses any sign-up once the owner exists (403). Both mean "already done".
 */
export function isOwnerAlreadyExistsError(error: unknown): boolean {
  const parsed = apiErrorSchema.safeParse(error);
  if (!parsed.success) return false;
  if (parsed.data.status === "FORBIDDEN") return true;
  return parsed.data.status === "UNPROCESSABLE_ENTITY" && parsed.data.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
}

/** Only the HTTP status name or the error class: error messages can carry SQL or values. */
export function signUpFailureLabel(error: unknown): string {
  const parsed = apiErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data.status;
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : "unknown error";
}

/** The Better Auth calls create-owner needs, so the flow is testable without a database. */
export type OwnerAuth = {
  /** Every account in the database (the app allows exactly one: the owner, ADR-005). */
  listAccounts(): Promise<readonly { id: string; email: string }[]>;
  signUpEmail(input: { body: { email: string; password: string; name: string }; headers: Headers }): Promise<unknown>;
  /** Gives the existing owner a new email and password and signs out every session. */
  resetOwner(userId: string, email: string, password: string): Promise<void>;
};
export type OwnerResult =
  | { outcome: "created" }
  | { outcome: "exists" }
  | { outcome: "reset" }
  | { outcome: "email-mismatch" }
  | { outcome: "failed"; label: string };

/**
 * Creates the owner through Better Auth's own sign-up endpoint, with the setup header the owner hook in
 * src/lib/auth.ts requires (ADR-005). With an owner already there: same email → "exists" (left unchanged);
 * `reset` → that account gets the new email and password; a different email without `reset` → "email-mismatch",
 * because OWNER_EMAIL would no longer match any account and nobody could sign in (T-063).
 */
export async function createOwnerAccount(
  auth: OwnerAuth,
  input: { email: string; password: string; setupToken: string; reset: boolean },
): Promise<OwnerResult> {
  const accounts = await auth.listAccounts();
  if (accounts.length > 1) return { outcome: "failed", label: "MORE_THAN_ONE_ACCOUNT" };
  const owner = accounts[0];
  if (owner) {
    try {
      if (input.reset) {
        await auth.resetOwner(owner.id, input.email, input.password);
        return { outcome: "reset" };
      }
    } catch (error) {
      return { outcome: "failed", label: signUpFailureLabel(error) };
    }
    return owner.email.trim().toLowerCase() === input.email ? { outcome: "exists" } : { outcome: "email-mismatch" };
  }
  try {
    await auth.signUpEmail({
      body: { email: input.email, password: input.password, name: "Owner" },
      headers: new Headers({ "x-founder-setup-token": input.setupToken }),
    });
    return { outcome: "created" };
  } catch (error) {
    if (isOwnerAlreadyExistsError(error)) return { outcome: "exists" };
    return { outcome: "failed", label: signUpFailureLabel(error) };
  }
}

// ---------------------------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------------------------

export type GitState = { branch: string; changes: string[]; head: string; upstream?: string };

/**
 * `vercel link` appends `.vercel` and `.env*` to .gitignore unless a line equals them exactly (the check can miss
 * on Windows when the file has LF endings). When the original already has both lines, its edit is undone.
 */
export function gitignoreCoversVercel(content: string): boolean {
  const lines = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  return lines.has(".vercel") && lines.has(".env*");
}

/** `git status --porcelain` lines (ignored files are not listed). */
export function parsePorcelain(output: string): string[] {
  return output.split(/\r?\n/).filter((line) => line.trim() !== "");
}

/** Why the local copy may not be deployed, in plain language. Empty when it is master, clean and equal to origin/master. */
export function gitProblems(state: GitState): string[] {
  const problems: string[] = [];
  if (state.branch !== "master") problems.push(`You are on branch "${state.branch}", not master. Run: git switch master`);
  if (state.changes.length > 0) {
    const shown = state.changes.slice(0, 5).map((line) => line.trim()).join(", ");
    const more = state.changes.length > 5 ? ` and ${state.changes.length - 5} more` : "";
    problems.push(`There are uncommitted changes (${shown}${more}). Commit or stash them first.`);
  }
  if (!state.upstream) problems.push("origin/master was not found. Check your internet connection, then run: git fetch origin");
  else if (state.head !== state.upstream) problems.push("Your master is not the same commit as origin/master. Run: git pull");
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Deploy and smoke check
// ---------------------------------------------------------------------------------------------

function stripAnsi(text: string): string {
  return text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
}

/**
 * The production URL from `vercel deploy --prod` output: the "Aliased" line (the project's production domain), else
 * the deployment's own URL, which Vercel's Deployment Protection may put behind a Vercel sign-in.
 */
export function productionUrlFromDeployOutput(output: string): { url: string; aliased: boolean } | undefined {
  const text = stripAnsi(output);
  const aliased = /Aliased\s+(https:\/\/[A-Za-z0-9.-]+)/.exec(text)?.[1];
  if (aliased) return { url: aliased, aliased: true };
  const urls = text.match(/https:\/\/[A-Za-z0-9.-]+\.vercel\.app/g);
  const last = urls?.[urls.length - 1];
  return last ? { url: last, aliased: false } : undefined;
}

export type SmokeResponse = { status: number; headers: Readonly<Record<string, string>>; body: string };
export type SmokeInput = { login?: SmokeResponse; private?: SmokeResponse; register?: SmokeResponse };
export type SmokeRow = { check: string; pass: boolean };

function header(response: SmokeResponse | undefined, name: string): string {
  return response?.headers[name.toLowerCase()] ?? "";
}

function redirectsToLogin(response: SmokeResponse | undefined, baseUrl: string): boolean {
  if (!response || response.status !== 307) return false;
  try {
    const location = new URL(header(response, "location"), baseUrl);
    return location.origin === new URL(baseUrl).origin && location.pathname === "/login" && location.searchParams.has("next");
  } catch {
    return false;
  }
}

/** RUNBOOK section 10 as data: an unreachable page (undefined) fails its checks. */
export function evaluateSmoke(input: SmokeInput, baseUrl: string): SmokeRow[] {
  const csp = header(input.login, "content-security-policy");
  return [
    { check: "HSTS header on /login", pass: /max-age=\d+/.test(header(input.login, "strict-transport-security")) },
    { check: "Content-Security-Policy with a nonce on /login", pass: csp.includes("'nonce-") },
    {
      check: "Framing blocked on /login",
      pass: header(input.login, "x-frame-options").toUpperCase() === "DENY" || csp.includes("frame-ancestors 'none'"),
    },
    { check: "X-Content-Type-Options: nosniff on /login", pass: header(input.login, "x-content-type-options") === "nosniff" },
    { check: "noindex on /login", pass: header(input.login, "x-robots-tag").includes("noindex") },
    { check: "noindex on /private", pass: header(input.private, "x-robots-tag").includes("noindex") },
    { check: "/private sends visitors to /login?next=… (307)", pass: redirectsToLogin(input.private, baseUrl) },
    { check: "/register says \"Registration is closed\"", pass: input.register?.status === 200 && input.register.body.includes("Registration is closed") },
  ];
}

export function renderSmokeTable(rows: readonly SmokeRow[]): string[] {
  return ["  Result  Check", ...rows.map((row) => `  ${row.pass ? "PASS" : "FAIL"}    ${row.check}`)];
}

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------

/** Replaces every known secret (and a database URL's password) with <hidden>. The last guard before any output. */
export function redact(text: string, secrets: Iterable<string>): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length >= 4) result = result.split(secret).join("<hidden>");
  }
  return result;
}

/** The pieces of a database URL that must never be printed: the URL itself and its password, raw and decoded. */
export function databaseUrlSecrets(url: string): string[] {
  const secrets = [url];
  try {
    const password = new URL(url).password;
    if (password) secrets.push(password, decodeURIComponent(password));
  } catch {
    // Not a URL: the whole value is already listed.
  }
  return secrets;
}

export const STEP_TITLES = [
  "Check this computer",
  "Sign in to Vercel",
  "Connect this folder to the Vercel project",
  "Create the database (Neon, production only)",
  "Owner account details",
  "Save the settings in Vercel",
  "Create the database tables",
  "Create the owner account",
  "Publish the app",
  "Check the live site",
  "Done",
] as const;

export function stepHeading(index: number): string {
  return `Step ${index}/${STEP_TITLES.length - 1}  ${STEP_TITLES[index] ?? ""}`;
}

/**
 * The whole run as text, for --dry-run. Built only from options and placeholders, so it cannot contain a secret.
 */
export function renderPlan(options: SetupOptions): string[] {
  const vercel = (args: readonly string[]) => `    ${describeVercel(args, options.scope)}`;
  const writes = planEnvWrites([], "<owner email>");
  return [
    "Founder OS production setup: dry run. Nothing is run and nothing is changed.",
    "",
    stepHeading(0),
    "    Node.js 22 or newer; git fetch origin master; branch master, no uncommitted changes, same commit as origin/master",
    "    Asks: continue? (y/N)",
    stepHeading(1),
    vercel(["whoami"]),
    `${vercel(["login"])}   (only when not signed in; opens your browser)`,
    stepHeading(2),
    `${vercel(["link", "--yes", "--project", options.project])}   (skipped when already linked)`,
    stepHeading(3),
    vercel(["env", "ls", "--format", "json"]),
    `${vercel(["integration", "add", "neon", "-e", "production", "--no-env-pull"])}   (skipped when production already has DATABASE_URL)`,
    "    Previews get no database on purpose: a preview of unreviewed code must never reach your real data.",
    stepHeading(4),
    "    Asks: owner email; password twice (hidden, at least 12 characters)",
    "    Generates: BETTER_AUTH_SECRET for production <generated>, a different one for preview <generated>",
    stepHeading(5),
    ...writes.map((write) => `    ${describeEnvWrite(write, options.scope)}`),
    "    Each one is skipped when Vercel already has the right value; an existing BETTER_AUTH_SECRET is kept.",
    stepHeading(6),
    `${vercel(["env", "pull", "production.env", "--environment", "production", "--yes"])}   (in a private temporary folder, deleted right after)`,
    "    pnpm db:migrate   with DATABASE_URL=<direct database URL> (DATABASE_URL_UNPOOLED) for this command only",
    stepHeading(7),
    "    tsx scripts/create-owner.ts   with DATABASE_URL=<direct database URL>, OWNER_SETUP_TOKEN=<generated> (never sent to Vercel),",
    options.resetOwner
      ? "                                  password on stdin <hidden>; --reset-owner: the existing owner gets this email and password, and is signed out everywhere"
      : "                                  password on stdin <hidden>; skipped when the owner account already exists",
    stepHeading(8),
    "    git fetch origin master, then the Step 0 git check again",
    "    git clone of master into a private temporary folder (so ignored files such as work/ and .env are never uploaded)",
    vercel(["deploy", "--prod", "--yes"]),
    stepHeading(9),
    "    GET /login, /private, /register: security headers, noindex, redirect to sign-in, registration closed",
    stepHeading(10),
    "    Prints the address and the email to sign in with. No secret is ever printed.",
  ];
}
