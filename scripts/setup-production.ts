// `pnpm setup:production` (T-062, ADR-016): one command on the owner's own machine sets up Vercel + Neon,
// migrates, creates the owner and publishes master. Runs on macOS, Linux and Windows. Rules live in
// ./setup-production-lib.ts (unit-tested); this file only prompts and runs processes. Secrets travel through a
// child's stdin or env object, never a command line, and every line printed goes through redact().
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { StringDecoder } from "node:string_decoder";
import * as lib from "./setup-production-lib";

const root = process.cwd();
const secrets = new Set<string>();

/** A planned stop: its message tells the owner what happened and what to do next. */
class Stop extends Error {}

function say(line = ""): void {
  process.stdout.write(`${lib.redact(line, secrets)}\n`);
}

function keepSecret(...values: string[]): void {
  for (const value of values) if (value) secrets.add(value);
}

// ---------------------------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------------------------

type Stdin = "inherit" | "ignore" | { data: string };
type Output = "inherit" | "pipe" | "tee";
type RunOptions = { cwd?: string; env?: NodeJS.ProcessEnv; stdin?: Stdin; stdout?: Output; stderr?: Output; shell?: boolean };
type RunResult = { code: number; stdout: string; stderr: string };

function run(command: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  const stdin = options.stdin ?? "inherit";
  const stdout = options.stdout ?? "inherit";
  const stderr = options.stderr ?? "inherit";
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd ?? root,
      env: options.env ?? lib.childEnv(process.env, {}),
      stdio: [typeof stdin === "string" ? stdin : "pipe", stdout === "inherit" ? "inherit" : "pipe", stderr === "inherit" ? "inherit" : "pipe"],
      shell: options.shell ?? false,
    });
    let out = "";
    let err = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      out += chunk;
      if (stdout === "tee") process.stdout.write(lib.redact(chunk, secrets));
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      err += chunk;
      if (stderr === "tee") process.stderr.write(lib.redact(chunk, secrets));
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: out, stderr: err }));
    if (typeof stdin === "object") {
      child.stdin?.on("error", () => undefined); // a child that exits early must not crash this script
      child.stdin?.end(stdin.data);
    }
  });
}

let scope: string | undefined;

function vercel(args: readonly string[], options: RunOptions): Promise<RunResult> {
  const spawnAs = lib.vercelSpawn(args, scope, process.platform);
  return run(spawnAs.command, spawnAs.args, {
    ...options,
    shell: spawnAs.shell,
    env: lib.childEnv(process.env, { VERCEL_TELEMETRY_DISABLED: "1" }),
  });
}

function git(args: readonly string[], cwd = root): Promise<RunResult> {
  return run("git", args, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
}

/** Runs a repo TypeScript file with the repo's own tsx, through this Node binary: no shell, no PATH lookup. */
function tsx(script: string, env: NodeJS.ProcessEnv, stdin: Stdin): Promise<RunResult> {
  const cli = createRequire(join(root, "package.json")).resolve("tsx/cli");
  // Filtered like everything else this script prints, even though both scripts only log names and codes.
  return run(process.execPath, [cli, script], { env, stdin, stdout: "tee", stderr: "tee" });
}

// ---------------------------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------------------------

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const controller = new AbortController();
  rl.on("SIGINT", () => controller.abort());
  try {
    return await rl.question(question, { signal: controller.signal });
  } catch {
    throw new Stop("Cancelled.");
  } finally {
    rl.close();
  }
}

/** Raw-mode reader: nothing typed is echoed, on Windows consoles as on POSIX terminals. */
function askHidden(question: string): Promise<string> {
  const input = process.stdin;
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let state: lib.HiddenInput = { value: "", done: false, cancelled: false };
    const onData = (chunk: Buffer | string) => {
      state = lib.applyKeystrokes(state, typeof chunk === "string" ? chunk : decoder.write(chunk));
      if (!state.done) return;
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (state.cancelled) reject(new Stop("Cancelled."));
      else resolve(state.value);
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function askOwnerEmail(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const email = lib.normalizeOwnerEmail(await ask("Owner email (the one account allowed to sign in): "));
    if (email) return email;
    say("That is not a valid email address. Try again.");
  }
  throw new Stop("No valid email was entered. Nothing more was changed.");
}

async function askPassword(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const first = await askHidden("Password (hidden): ");
    const second = await askHidden("Same password again (hidden): ");
    const problem = lib.passwordProblem(first, second);
    if (!problem) return first;
    say(`${problem} Try again.`);
  }
  throw new Stop("No valid password was entered. Nothing more was changed.");
}

// ---------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------

async function checkGit(): Promise<string> {
  let fetched: RunResult;
  try {
    fetched = await git(["fetch", "--quiet", "origin", "master"]);
  } catch {
    throw new Stop("git was not found. Install Git, then run pnpm setup:production again.");
  }
  if (fetched.code !== 0) throw new Stop("git fetch origin master failed. Check your internet connection and try again.");
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
  const changes = lib.parsePorcelain((await git(["status", "--porcelain"])).stdout);
  const head = (await git(["rev-parse", "HEAD"])).stdout.trim();
  const upstream = await git(["rev-parse", "--verify", "--quiet", "origin/master"]);
  const problems = lib.gitProblems({ branch, changes, head, upstream: upstream.code === 0 ? upstream.stdout.trim() : undefined });
  if (problems.length > 0) {
    throw new Stop(["Only an up-to-date master with no local changes is published:", ...problems.map((problem) => `  - ${problem}`)].join("\n"));
  }
  return head;
}

async function readEnvList(context: string): Promise<lib.EnvRecord[]> {
  const result = await vercel(["env", "ls", "--format", "json"], { cwd: context, stdin: "ignore", stdout: "pipe", stderr: "tee" });
  // The JSON holds readable values (it may include the database URL): parsed here, never printed.
  const records = result.code === 0 ? lib.parseEnvList(result.stdout) : undefined;
  if (!records) throw new Stop("Could not read the project's settings from Vercel. Run pnpm setup:production again.");
  return records;
}

/** Pulls production's variables into the private temporary folder, keeps only the direct database URL, deletes the file. */
async function pullDirectDatabaseUrl(context: string): Promise<string | undefined> {
  const file = join(context, "production.env");
  const args = ["env", "pull", "production.env", "--environment", "production", "--yes"];
  say(`> ${lib.describeVercel(args, scope)}   (private temporary folder, deleted right after)`);
  try {
    // Captured, never printed: the database URL is only known (and redactable) after this command.
    const result = await vercel(args, { cwd: context, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    if (result.code !== 0 || !existsSync(file)) {
      say(`Could not download the settings (exit ${result.code}). You will be asked to paste the address instead.`);
      return undefined;
    }
    const vars = lib.parseEnvFile(readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(vars)) {
      if (/DATABASE|POSTGRES|^PG/.test(key)) keepSecret(...lib.databaseUrlSecrets(value));
    }
    return lib.pickDirectDatabaseUrl(vars)?.url;
  } finally {
    rmSync(file, { force: true });
  }
}

async function askDirectDatabaseUrl(): Promise<string> {
  say("Vercel did not hand out the direct database address (it may be stored as a hidden value). Copy it yourself:");
  say("  vercel.com > your project > Storage > the Neon database > copy DATABASE_URL_UNPOOLED");
  say("  (or the Neon console > Connect, with connection pooling turned off). Its host has no \"-pooler\".");
  for (let attempt = 0; attempt < 3; attempt++) {
    const value = (await askHidden("Paste the direct database URL (hidden): ")).trim();
    if (lib.isDirectDatabaseUrl(value)) return value;
    say("That is not a direct postgres:// URL (a pooled \"-pooler\" address does not work for this). Try again.");
  }
  throw new Stop("No direct database URL was entered. Run pnpm setup:production again when you have it.");
}

async function fetchPage(baseUrl: string, path: string): Promise<lib.SmokeResponse | undefined> {
  try {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const body = path === "/register" ? await response.text() : "";
    if (path !== "/register") await response.body?.cancel();
    return { status: response.status, headers, body };
  } catch {
    return undefined;
  }
}

async function smokeCheck(baseUrl: string): Promise<lib.SmokeRow[]> {
  let rows: lib.SmokeRow[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const [login, privatePage, register] = await Promise.all(["/login", "/private", "/register"].map((path) => fetchPage(baseUrl, path)));
    rows = lib.evaluateSmoke({ login, private: privatePage, register }, baseUrl);
    if (rows.every((row) => row.pass) || attempt === 3) break;
    say("Some checks failed; the new version may still be starting. Trying again in 10 seconds…");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return rows;
}

function usage(): void {
  say("Usage: pnpm setup:production [--dry-run] [--reset-owner] [--project <name>] [--scope <team>]");
  say("  --dry-run          show every step and command without running or changing anything");
  say("  --reset-owner      forgot the owner email or password? give the existing owner account new ones");
  say(`  --project <name>   Vercel project name (default: ${lib.DEFAULT_PROJECT})`);
  say("  --scope <team>     Vercel team slug or id, when your account has several teams");
  say("Details: docs/RUNBOOK.md, sections 1-5.");
}

async function setup(options: lib.SetupOptions, work: string): Promise<boolean> {
  // A folder holding only a copy of .vercel/project.json. Vercel commands that do not need the repo run here, so
  // nothing they write (agent skills, plugin prompts, env files) lands in the repo.
  const context = join(work, "vercel");
  mkdirSync(join(context, ".vercel"), { recursive: true });

  say(lib.stepHeading(0));
  say("This sets up Founder OS on Vercel with a Neon database. It takes about 10 minutes and will:");
  say("  - sign you in to Vercel (in your browser) and connect this folder to a Vercel project");
  say("  - create a Neon Postgres database for production only (Vercel may ask for a region and a plan; the free plan is enough)");
  say("  - ask for the owner email and a password, and generate the app's secret keys");
  say("  - save the settings in Vercel, create the database tables and the owner account");
  say("  - publish master and check the live site");
  say("Steps that are already done are skipped, so after a problem you can simply run it again.");
  say("No secret is shown on screen or put on a command line.");
  if (!process.stdin.isTTY) {
    throw new Stop("Run this in an interactive terminal: PowerShell or Windows Terminal on Windows (Git Bash's window cannot hide a password), Terminal on macOS or Linux.");
  }
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (!(nodeMajor >= 22)) throw new Stop(`Node.js 22 or newer is needed (this is ${process.versions.node}). Install it from nodejs.org.`);
  await checkGit();
  say("This computer is ready: Node.js is recent enough and master matches origin/master.");
  if (!/^y(es)?$/i.test((await ask("Continue? (y/N) ")).trim())) throw new Stop("Stopped. Nothing was changed.");

  say();
  say(lib.stepHeading(1));
  say("Checking your Vercel sign-in. The first run downloads the Vercel CLI, which can take a minute.");
  const whoami = () => vercel(["whoami"], { cwd: context, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  if ((await whoami()).code === 0) {
    say("Already signed in to Vercel.");
  } else {
    say("Sign in to Vercel in the browser window that opens (you can create a free account there).");
    const login = await vercel(["login"], { cwd: context });
    if (login.code !== 0 || (await whoami()).code !== 0) throw new Stop("Vercel sign-in did not finish. Run pnpm setup:production again.");
    say("Signed in to Vercel.");
  }

  say();
  say(lib.stepHeading(2));
  const linkFile = join(root, ".vercel", "project.json");
  const current = existsSync(linkFile) ? lib.parseProjectLink(readFileSync(linkFile, "utf8")) : undefined;
  if (current?.projectName === options.project) {
    say(`Already connected to the Vercel project "${options.project}".`);
  } else {
    say(`Connecting this folder to the Vercel project "${options.project}" (created when it does not exist yet).`);
    const args = ["link", "--yes", "--project", options.project];
    // Linked inside the private temporary folder: `vercel link` writes .env.local and edits .gitignore where it runs,
    // and neither of this repo's files may change. Only the resulting project.json is copied into the repo.
    say(`> ${lib.describeVercel(args, scope)}   (in a private temporary folder; your .env.local is not touched)`);
    const linked = await vercel(args, { cwd: context });
    const made = join(context, ".vercel", "project.json");
    if (linked.code !== 0 || !existsSync(made)) throw new Stop("Connecting to Vercel failed; see the message above. Run pnpm setup:production again.");
    mkdirSync(join(root, ".vercel"), { recursive: true });
    copyFileSync(made, linkFile);
  }
  const link = existsSync(linkFile) ? lib.parseProjectLink(readFileSync(linkFile, "utf8")) : undefined;
  if (!link) throw new Stop("The Vercel link (.vercel/project.json) is missing or unreadable. Run pnpm setup:production again.");
  copyFileSync(linkFile, join(context, ".vercel", "project.json"));

  say();
  say(lib.stepHeading(3));
  let records = await readEnvList(context);
  if (lib.hasEnv(records, "DATABASE_URL", "production")) {
    say("Production already has a database (DATABASE_URL). Skipped.");
  } else {
    say("Creating a Neon Postgres database through the Vercel Marketplace, connected to production only.");
    say("Previews get no database on purpose: a preview of unreviewed code must never reach your real data.");
    say("Vercel may ask you to accept Neon's terms and to pick a region (the one closest to you) and a plan (Free is enough).");
    const args = ["integration", "add", "neon", "-e", "production", "--no-env-pull"];
    say(`> ${lib.describeVercel(args, scope)}`);
    const added = await vercel(args, { cwd: context });
    records = await readEnvList(context);
    if (!lib.hasEnv(records, "DATABASE_URL", "production")) {
      throw new Stop(
        added.code === 0
          ? "The database is not connected to production yet. If a browser page opened, finish it there, then run pnpm setup:production again."
          : "Creating the database failed; see the message above. Run pnpm setup:production again.",
      );
    }
    say("Database created and connected to production.");
  }

  say();
  say(lib.stepHeading(4));
  const email = await askOwnerEmail();
  say(`Choose the owner password: at least ${lib.MIN_PASSWORD_LENGTH} characters. Nothing is shown while you type.`);
  say(options.resetOwner
    ? "--reset-owner: the existing owner account gets this email and password, and is signed out everywhere."
    : "If the owner account already exists, it keeps its current password (forgot it? run again with --reset-owner).");
  const password = await askPassword();
  const productionSecret = randomBytes(32).toString("base64");
  const previewSecret = randomBytes(32).toString("base64");
  keepSecret(password, productionSecret, previewSecret);
  say("Generated fresh secret keys for production and previews (not shown). Vercel only gets one where none is set yet.");

  say();
  say(lib.stepHeading(5));
  const values: Record<lib.EnvValueSource, string> = { corepack: "1", ownerEmail: email, productionSecret, previewSecret };
  const writes = lib.planEnvWrites(records, email);
  for (const target of ["production", "preview"] as const) {
    if (lib.hasEnv(records, "BETTER_AUTH_SECRET", target)) say(`BETTER_AUTH_SECRET is already set for ${target}: kept (replacing it would sign you out).`);
  }
  if (writes.length === 0) say("Vercel already has every setting. Skipped.");
  for (const write of writes) {
    say(`> ${lib.describeEnvWrite(write, scope)}`);
    // Output goes through redact(): the CLI must never be able to echo the value it just read from stdin.
    const saved = await vercel(lib.envAddArgs(write), { cwd: context, stdin: { data: values[write.source] }, stdout: "tee", stderr: "tee" });
    if (saved.code !== 0) throw new Stop(`Saving ${write.name} in Vercel failed; see the message above. Run pnpm setup:production again.`);
  }

  say();
  say(lib.stepHeading(6));
  const directUrl = (await pullDirectDatabaseUrl(context)) ?? (await askDirectDatabaseUrl());
  keepSecret(...lib.databaseUrlSecrets(directUrl));
  say("> pnpm db:migrate   (DATABASE_URL=<direct database URL>, for this command only)");
  const migrated = await tsx("src/db/migrate.ts", lib.childEnv(process.env, { DATABASE_URL: directUrl }), "ignore");
  if (migrated.code !== 0) throw new Stop("Creating the database tables failed; see the message above. Nothing was published.");

  say();
  say(lib.stepHeading(7));
  const setupToken = randomBytes(32).toString("base64url");
  keepSecret(setupToken);
  say("> tsx scripts/create-owner.ts   (DATABASE_URL=<direct database URL>, OWNER_SETUP_TOKEN=<generated>, password on stdin)");
  const owner = await tsx(
    "scripts/create-owner.ts",
    lib.childEnv(process.env, {
      DATABASE_URL: directUrl,
      OWNER_EMAIL: email,
      BETTER_AUTH_SECRET: productionSecret,
      BETTER_AUTH_URL: lib.SETUP_AUTH_URL,
      // Exists only in that child process: it never reaches Vercel, so sign-up stays closed in production (ADR-005).
      OWNER_SETUP_TOKEN: setupToken,
      OWNER_RESET: options.resetOwner ? "1" : "0",
    }),
    { data: password },
  );
  if (owner.code === 0) say(`Owner account created for ${email}.`);
  else if (owner.code === lib.OWNER_EXISTS_EXIT_CODE) say(`An owner account for ${email} already exists. It was left unchanged, password included.`);
  else if (owner.code === lib.OWNER_RESET_EXIT_CODE) say(`The owner account now signs in as ${email} with the new password. Old sessions were signed out.`);
  else if (owner.code === lib.OWNER_EMAIL_MISMATCH_EXIT_CODE) {
    throw new Stop(`An owner account already exists under a different email, so ${email} could not sign in. To give it this email and a new password, run: pnpm setup:production --reset-owner`);
  }
  else throw new Stop("Creating the owner account failed; see the message above. Nothing was published. Run pnpm setup:production again.");

  say();
  say(lib.stepHeading(8));
  const head = await checkGit();
  // Deploy a fresh clone of master: `vercel deploy` uploads every file that is not in .vercelignore, and .gitignore
  // does not count, so a deploy from this folder would also upload work/ backups or a local .env.
  const source = join(work, "source");
  say("> git clone master into a private temporary folder, so only committed files are uploaded");
  const cloned = await git(["clone", "--quiet", "--branch", "master", "--single-branch", root, source]);
  if (cloned.code !== 0 || (await git(["rev-parse", "HEAD"], source)).stdout.trim() !== head) {
    throw new Stop("Could not make a clean copy of master to publish. Run pnpm setup:production again.");
  }
  // The copy's origin would be a local folder path; without a remote, Vercel receives no path from this computer.
  await git(["remote", "remove", "origin"], source);
  mkdirSync(join(source, ".vercel"), { recursive: true });
  copyFileSync(linkFile, join(source, ".vercel", "project.json"));
  const deployArgs = ["deploy", "--prod", "--yes"];
  say(`> ${lib.describeVercel(deployArgs, scope)}   (from the clean copy of master; takes a few minutes)`);
  const deployed = await vercel(deployArgs, { cwd: source, stdout: "tee", stderr: "tee" });
  if (deployed.code !== 0) throw new Stop("Publishing failed; see the build log above. Run pnpm setup:production again after fixing it.");
  const production = lib.productionUrlFromDeployOutput(`${deployed.stdout}\n${deployed.stderr}`);
  if (!production) throw new Stop("Published, but the address was not found in Vercel's output. Open vercel.com to find it.");

  say();
  say(lib.stepHeading(9));
  if (!production.aliased) say("Could not find the production domain in Vercel's output; checking the deployment's own address instead.");
  const rows = await smokeCheck(production.url);
  for (const line of lib.renderSmokeTable(rows)) say(line);
  const passed = rows.every((row) => row.pass);

  say();
  say(lib.stepHeading(10));
  say(`Founder OS is live at ${production.url}`);
  say(`Sign in at ${production.url}/login with ${email} and the password you chose.`);
  say("Branch previews have no database on purpose, so they show an error page. That is expected.");
  if (!passed) say("Some checks failed. Do not store private data yet; see docs/RUNBOOK.md section 10.");
  return passed;
}

async function main(): Promise<number> {
  const parsed = lib.parseSetupArgs(process.argv.slice(2));
  if (!parsed.ok) {
    say(parsed.error);
    return 2;
  }
  const options = parsed.options;
  scope = options.scope;
  if (options.help) {
    usage();
    return 0;
  }
  if (options.dryRun) {
    for (const line of lib.renderPlan(options)) say(line);
    return 0;
  }
  // Private temporary folder (mkdtemp is owner-only on POSIX); removed on every exit path, Ctrl+C and a closed window included.
  const work = mkdtempSync(join(tmpdir(), "founder-os-setup-"));
  const cleanup = () => rmSync(work, { recursive: true, force: true });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(signal, () => {
      cleanup();
      process.stdout.write("\nCancelled.\n");
      process.exit(130);
    });
  }
  try {
    return (await setup(options, work)) ? 0 : 1;
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    say();
    say(error.message);
    return 1;
  } finally {
    cleanup();
    process.stdin.pause();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Never print the error itself: a child's message could echo a value.
    say(`Setup stopped unexpectedly (${error instanceof Error ? error.name : "unknown error"}). Run pnpm setup:production again.`);
    process.exitCode = 1;
  },
);
