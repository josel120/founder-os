// @vitest-environment node
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "../src/lib/env";
import {
  applyKeystrokes,
  childEnv,
  createOwnerAccount,
  databaseUrlSecrets,
  describeEnvWrite,
  envAddArgs,
  evaluateSmoke,
  gitignoreCoversVercel,
  gitProblems,
  hasEnv,
  isDirectDatabaseUrl,
  isOwnerAlreadyExistsError,
  isShellSafeArg,
  normalizeOwnerEmail,
  parseEnvFile,
  parseEnvList,
  parsePorcelain,
  parseProjectLink,
  parseSetupArgs,
  passwordProblem,
  pickDirectDatabaseUrl,
  planEnvWrites,
  productionUrlFromDeployOutput,
  redact,
  renderPlan,
  renderSmokeTable,
  signUpFailureLabel,
  STEP_TITLES,
  vercelArgs,
  vercelSpawn,
  type EnvRecord,
  type HiddenInput,
  type OwnerAuth,
  type SmokeResponse,
} from "../scripts/setup-production-lib";

const root = join(__dirname, "..");
const ESC = String.fromCharCode(27);

describe("parseSetupArgs", () => {
  it("defaults to the founder-os project, no scope and a real run", () => {
    expect(parseSetupArgs([])).toEqual({ ok: true, options: { dryRun: false, help: false, resetOwner: false, project: "founder-os" } });
    expect(parseSetupArgs(["--reset-owner"])).toMatchObject({ ok: true, options: { resetOwner: true } });
  });

  it("reads --dry-run, --help, --project and --scope in both forms, and ignores a bare --", () => {
    expect(parseSetupArgs(["--", "--dry-run", "--project", "my-app", "--scope=my-team"])).toEqual({
      ok: true,
      options: { dryRun: true, help: false, resetOwner: false, project: "my-app", scope: "my-team" },
    });
    expect(parseSetupArgs(["-h", "--project=a.b_c-d", "--scope", "team_AbC123"])).toMatchObject({
      ok: true,
      options: { help: true, project: "a.b_c-d", scope: "team_AbC123" },
    });
  });

  it.each([
    [["--project", "My App"]],
    [["--project", "app;rm -rf ~"]],
    [["--project", "a---b"]],
    [["--project", "&calc"]],
    [["--scope", "team name"]],
    [["--scope", "%PATH%"]],
    [["--project"]],
    [["--project", "--dry-run"]],
    [["--scope="]],
    [["--prod"]],
    [["deploy"]],
  ])("rejects %j", (argv) => {
    expect(parseSetupArgs(argv).ok).toBe(false);
  });
});

describe("owner input", () => {
  it("trims and lower-cases a valid email, the same way src/lib/env.ts does at boot", () => {
    const email = normalizeOwnerEmail("  Jose.Gomez+founder@Example.COM ");
    expect(email).toBe("jose.gomez+founder@example.com");
    expect(parseEnv({ OWNER_EMAIL: email } as Partial<NodeJS.ProcessEnv> as NodeJS.ProcessEnv).OWNER_EMAIL).toBe(email);
  });

  it.each(["", "owner", "owner@", "@example.com", "owner@example", "own er@example.com", "owner@@example.com", "\"a\"@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects %j",
    (input) => {
      expect(normalizeOwnerEmail(input)).toBeUndefined();
    },
  );

  it("needs 12 to 128 characters, typed the same way twice", () => {
    expect(passwordProblem("short-pass1", "short-pass1")).toMatch(/at least 12/);
    expect(passwordProblem("x".repeat(129), "x".repeat(129))).toMatch(/at most 128/);
    expect(passwordProblem("twelve-chars", "twelve-charz")).toMatch(/different/);
    expect(passwordProblem("twelve-chars", "twelve-chars")).toBeUndefined();
    expect(passwordProblem("x".repeat(128), "x".repeat(128))).toBeUndefined();
  });
});

describe("applyKeystrokes (hidden prompt)", () => {
  const start: HiddenInput = { value: "", done: false, cancelled: false };
  const type = (...chunks: string[]) => chunks.reduce(applyKeystrokes, start);

  it("collects typed characters until Enter, from a Windows (\\r) or POSIX (\\n) terminal", () => {
    expect(type("sec", "ret", "\r")).toEqual({ value: "secret", done: true, cancelled: false });
    expect(type("secret\n")).toEqual({ value: "secret", done: true, cancelled: false });
    expect(type("pasted-secret\r\n")).toEqual({ value: "pasted-secret", done: true, cancelled: false });
    expect(type("abc")).toEqual({ value: "abc", done: false, cancelled: false });
  });

  it("handles Backspace (DEL and \\b) by whole characters, including emoji", () => {
    expect(type("abcd", "\u007f", "\b", "e\r").value).toBe("abe");
    expect(type("a😀", "\u007f", "\r").value).toBe("a");
    expect(type("\u007f\u007fa\r").value).toBe("a");
  });

  it("cancels on Ctrl+C and drops what was typed", () => {
    expect(type("secret", "\u0003")).toEqual({ value: "", done: true, cancelled: true });
  });

  it("ignores arrow keys, other escape sequences and control characters", () => {
    expect(type(`ab${ESC}[D${ESC}[3~${ESC}OA\tc\u0001\r`).value).toBe("abc");
    expect(type(`x${ESC}[1;5C${ESC}xy\r`).value).toBe("xy");
  });

  it("ignores an escape sequence that arrives split across chunks", () => {
    expect(type("ab", ESC, "[", "D", "c", ESC, "[3", "~", "\r")).toEqual({ value: "abc", done: true, cancelled: false });
    expect(type("ab", ESC)).toEqual({ value: "ab", done: false, cancelled: false, escape: ESC });
  });
});

describe("Vercel env state", () => {
  const listing = `Retrieving project…\n${JSON.stringify({
    envs: [
      { key: "DATABASE_URL", value: "postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/db", type: "encrypted", target: ["production"] },
      { key: "OWNER_EMAIL", value: "owner@example.com", type: "encrypted", target: "production" },
      { key: "BETTER_AUTH_SECRET", type: "sensitive", target: ["preview"], gitBranch: "feature" },
      { key: "ENABLE_EXPERIMENTAL_COREPACK", value: "1", target: ["production", "preview"], gitBranch: null },
    ],
  })}\n`;

  it("parses `vercel env ls --format json`, tolerating text around the JSON", () => {
    const records = parseEnvList(listing);
    expect(records).toHaveLength(4);
    expect(records?.[1]).toEqual({ key: "OWNER_EMAIL", value: "owner@example.com", targets: ["production"], gitBranch: undefined });
    expect(parseEnvList("not json")).toBeUndefined();
    expect(parseEnvList('{"envs": "nope"}')).toBeUndefined();
  });

  it("finds a variable per target; a branch-only preview value does not count", () => {
    const records = parseEnvList(listing) ?? [];
    expect(hasEnv(records, "DATABASE_URL", "production")).toBe(true);
    expect(hasEnv(records, "DATABASE_URL", "preview")).toBe(false);
    expect(hasEnv(records, "BETTER_AUTH_SECRET", "preview")).toBe(false);
  });

  it("plans every write on a new project, never BETTER_AUTH_URL or NEXT_PUBLIC_BETTER_AUTH_URL", () => {
    const writes = planEnvWrites([], "owner@example.com");
    expect(writes).toEqual([
      { name: "ENABLE_EXPERIMENTAL_COREPACK", targets: ["production", "preview"], sensitive: false, source: "corepack" },
      { name: "OWNER_EMAIL", targets: ["production"], sensitive: false, source: "ownerEmail" },
      { name: "BETTER_AUTH_SECRET", targets: ["production"], sensitive: true, source: "productionSecret" },
      { name: "BETTER_AUTH_SECRET", targets: ["preview"], sensitive: true, source: "previewSecret" },
    ]);
    expect(writes.map((write) => write.name)).not.toContain("BETTER_AUTH_URL");
    expect(writes.map((write) => write.name)).not.toContain("NEXT_PUBLIC_BETTER_AUTH_URL");
    expect(writes.map((write) => write.name)).not.toContain("DATABASE_URL");
  });

  it("changes nothing that is already right on a re-run, and keeps existing secrets", () => {
    const done: EnvRecord[] = [
      { key: "ENABLE_EXPERIMENTAL_COREPACK", value: "1", targets: ["production", "preview"] },
      { key: "OWNER_EMAIL", value: "owner@example.com", targets: ["production"] },
      { key: "BETTER_AUTH_SECRET", targets: ["production"] },
      { key: "BETTER_AUTH_SECRET", targets: ["preview"] },
    ];
    expect(planEnvWrites(done, "owner@example.com")).toEqual([]);
    expect(planEnvWrites(done, "new@example.com")).toEqual([
      { name: "OWNER_EMAIL", targets: ["production"], sensitive: false, source: "ownerEmail" },
    ]);
    const previewOnly: EnvRecord[] = [{ key: "ENABLE_EXPERIMENTAL_COREPACK", value: "1", targets: ["preview"] }];
    expect(planEnvWrites(previewOnly, "owner@example.com")[0]).toMatchObject({ name: "ENABLE_EXPERIMENTAL_COREPACK", targets: ["production"] });
  });

  it("adds each value from stdin with --force --yes, marking only secrets sensitive", () => {
    const [corepack, email, secret] = planEnvWrites([], "owner@example.com");
    expect(envAddArgs(corepack!)).toEqual(["env", "add", "ENABLE_EXPERIMENTAL_COREPACK", "production,preview", "--no-sensitive", "--force", "--yes"]);
    expect(envAddArgs(email!)).toEqual(["env", "add", "OWNER_EMAIL", "production", "--no-sensitive", "--force", "--yes"]);
    expect(envAddArgs(secret!)).toEqual(["env", "add", "BETTER_AUTH_SECRET", "production", "--sensitive", "--force", "--yes"]);
    expect(describeEnvWrite(secret!)).toBe(
      "npx --yes vercel@60.1.3 env add BETTER_AUTH_SECRET production --sensitive --force --yes   (value on stdin: <generated>)",
    );
    for (const write of planEnvWrites([], "owner@example.com")) expect(envAddArgs(write)).not.toContain("--value");
  });

  it("reads the project link written by `vercel link`", () => {
    expect(parseProjectLink('{"projectId":"prj_1","orgId":"team_1","projectName":"founder-os"}')).toEqual({
      projectId: "prj_1",
      orgId: "team_1",
      projectName: "founder-os",
    });
    expect(parseProjectLink('{"projectId":""}')).toBeUndefined();
    expect(parseProjectLink("{")).toBeUndefined();
  });
});

describe("commands", () => {
  it("pins the Vercel CLI and appends the scope", () => {
    expect(vercelArgs(["whoami"])).toEqual(["--yes", "vercel@60.1.3", "whoami"]);
    expect(vercelArgs(["link", "--yes", "--project", "founder-os"], "my-team")).toEqual([
      "--yes",
      "vercel@60.1.3",
      "link",
      "--yes",
      "--project",
      "founder-os",
      "--scope",
      "my-team",
    ]);
  });

  it("starts npx directly on macOS and Linux, and as one checked command line through the shell on Windows", () => {
    expect(vercelSpawn(["env", "ls", "--format", "json"], undefined, "linux")).toEqual({
      command: "npx",
      args: ["--yes", "vercel@60.1.3", "env", "ls", "--format", "json"],
      shell: false,
    });
    expect(vercelSpawn(["whoami"], "my-team", "darwin").shell).toBe(false);
    expect(vercelSpawn(["env", "add", "OWNER_EMAIL", "production", "--no-sensitive", "--force", "--yes"], "my-team", "win32")).toEqual({
      command: "npx.cmd --yes vercel@60.1.3 env add OWNER_EMAIL production --no-sensitive --force --yes --scope my-team",
      args: [],
      shell: true,
    });
    expect(() => vercelSpawn(["env", "add", "X", "a&calc"], undefined, "win32")).toThrow();
  });

  it.each(["a b", "x&y", "a|b", "%PATH%", "\"q\"", "a;b", "$(x)", "a^b", "<in", ""])("refuses shell-unsafe argument %j", (arg) => {
    expect(isShellSafeArg(arg)).toBe(false);
    expect(() => vercelArgs(["env", "add", arg])).toThrow();
  });

  it("builds a child env without pnpm's npm_* variables or inherited app settings", () => {
    const base = {
      PATH: "/usr/bin",
      SystemRoot: "C:\\Windows",
      npm_config_user_agent: "pnpm",
      npm_lifecycle_event: "setup:production",
      DATABASE_URL: "postgresql://shell@elsewhere/db",
      owner_setup_token: "from-shell",
      VERCEL_ORG_ID: "team_other",
      VERCEL_TOKEN: "kept-for-cli-auth",
    } as unknown as NodeJS.ProcessEnv;
    expect(childEnv(base, { DATABASE_URL: "postgresql://direct/db" })).toEqual({
      PATH: "/usr/bin",
      SystemRoot: "C:\\Windows",
      VERCEL_TOKEN: "kept-for-cli-auth",
      DATABASE_URL: "postgresql://direct/db",
    });
  });
});

describe("direct database URL", () => {
  const pulled = [
    "# Created by Vercel CLI",
    'DATABASE_URL="postgresql://neondb_owner:pw@ep-cool-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"',
    'DATABASE_URL_UNPOOLED="postgresql://neondb_owner:pw@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require"',
    'POSTGRES_URL_NON_POOLING="postgres://neondb_owner:pw@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require"',
    'BETTER_AUTH_SECRET="[SENSITIVE]"',
    'VERCEL_ENV="production"',
    "",
  ].join("\n");

  it("parses the file `vercel env pull` writes and prefers DATABASE_URL_UNPOOLED", () => {
    const vars = parseEnvFile(pulled);
    expect(vars.VERCEL_ENV).toBe("production");
    expect(pickDirectDatabaseUrl(vars)).toEqual({
      key: "DATABASE_URL_UNPOOLED",
      url: "postgresql://neondb_owner:pw@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require",
    });
  });

  it("falls back to POSTGRES_URL_NON_POOLING and never picks the pooled URL", () => {
    expect(pickDirectDatabaseUrl({ DATABASE_URL_UNPOOLED: "", POSTGRES_URL_NON_POOLING: "postgres://u:p@ep-1.neon.tech/db" })?.key).toBe(
      "POSTGRES_URL_NON_POOLING",
    );
    expect(pickDirectDatabaseUrl({ DATABASE_URL: "postgresql://u:p@ep-1-pooler.neon.tech/db" })).toBeUndefined();
    expect(pickDirectDatabaseUrl({ DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-1-pooler.neon.tech/db" })).toBeUndefined();
  });

  it.each(["[SENSITIVE]", "", "https://example.com/db", "postgresql://", "mysql://u:p@h/db"])("rejects %j", (value) => {
    expect(isDirectDatabaseUrl(value)).toBe(false);
  });
});

describe("git state", () => {
  const ready = { branch: "master", changes: [], head: "abc", upstream: "abc" };

  it("allows only a clean master equal to origin/master", () => {
    expect(gitProblems(ready)).toEqual([]);
    expect(gitProblems({ ...ready, branch: "task/T-062" })[0]).toMatch(/not master/);
    expect(gitProblems({ ...ready, changes: parsePorcelain(" M src/lib/env.ts\n?? notes.txt\n") })[0]).toMatch(
      /uncommitted changes \(M src\/lib\/env.ts, \?\? notes.txt\)/,
    );
    expect(gitProblems({ ...ready, upstream: undefined })[0]).toMatch(/origin\/master was not found/);
    expect(gitProblems({ ...ready, head: "def" })[0]).toMatch(/git pull/);
  });

  it("keeps the repo's .gitignore in the shape `vercel link` leaves untouched", () => {
    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gitignoreCoversVercel(gitignore)).toBe(true);
    expect(gitignoreCoversVercel(gitignore.replace(/\n/g, "\r\n"))).toBe(true);
    expect(gitignoreCoversVercel("node_modules\n.env.*\n")).toBe(false);
  });
});

describe("deploy output and smoke check", () => {
  it("takes the production domain from the Aliased line, else the deployment URL", () => {
    const output = `Inspect: https://vercel.com/team/founder-os/abc\n${ESC}[36m▲${ESC}[39m Production  https://founder-os-abc123-team.vercel.app\n▲ Aliased     ${ESC}[36mhttps://founder-os.vercel.app${ESC}[39m\n`;
    expect(productionUrlFromDeployOutput(output)).toEqual({ url: "https://founder-os.vercel.app", aliased: true });
    expect(productionUrlFromDeployOutput("https://founder-os-abc123-team.vercel.app\n")).toEqual({
      url: "https://founder-os-abc123-team.vercel.app",
      aliased: false,
    });
    expect(productionUrlFromDeployOutput("Error: build failed")).toBeUndefined();
  });

  const base = "https://founder-os.vercel.app";
  const loginHeaders = {
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "content-security-policy": "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; frame-ancestors 'none'",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex, nofollow",
  };
  const healthy: { login: SmokeResponse; private: SmokeResponse; register: SmokeResponse } = {
    login: { status: 200, headers: loginHeaders, body: "" },
    private: { status: 307, headers: { location: `${base}/login?next=%2Fprivate`, "x-robots-tag": "noindex, nofollow" }, body: "" },
    register: { status: 200, headers: {}, body: "<h1>Registration is closed</h1>" },
  };

  it("passes RUNBOOK section 10 on a healthy deployment", () => {
    const rows = evaluateSmoke(healthy, base);
    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => !row.pass)).toEqual([]);
    expect(renderSmokeTable(rows)[1]).toBe("  PASS    HSTS header on /login");
  });

  it("accepts a relative redirect and fails a redirect elsewhere, a 200 or missing headers", () => {
    const relative = { ...healthy, private: { ...healthy.private, headers: { ...healthy.private.headers, location: "/login?next=%2Fprivate" } } };
    expect(evaluateSmoke(relative, base).every((row) => row.pass)).toBe(true);
    const elsewhere = { ...healthy, private: { ...healthy.private, headers: { location: "https://evil.example/login?next=x" } } };
    expect(evaluateSmoke(elsewhere, base).find((row) => row.check.startsWith("/private"))?.pass).toBe(false);
    const open = { ...healthy, private: { status: 200, headers: {}, body: "" }, login: { status: 200, headers: {}, body: "" } };
    expect(evaluateSmoke(open, base).filter((row) => !row.pass)).toHaveLength(7);
  });

  it("fails every check for pages that could not be fetched", () => {
    expect(evaluateSmoke({}, base).every((row) => !row.pass)).toBe(true);
    expect(renderSmokeTable(evaluateSmoke({}, base))[1]).toMatch(/^ {2}FAIL/);
  });
});

describe("owner creation", () => {
  const input = { email: "owner@example.com", password: "a-long-password", setupToken: "t".repeat(43), reset: false };
  const apiError = (status: string, code?: string) => Object.assign(new Error("message with a secret: a-long-password"), { status, body: { code } });
  const auth = (overrides: Partial<OwnerAuth> = {}): OwnerAuth => ({
    listAccounts: async () => [],
    signUpEmail: async () => ({}),
    resetOwner: async () => undefined,
    ...overrides,
  });

  it("signs up through Better Auth with the setup header", async () => {
    const signUpEmail = vi.fn<OwnerAuth["signUpEmail"]>(async () => ({}));
    const result = await createOwnerAccount(auth({ signUpEmail }), input);
    expect(result).toEqual({ outcome: "created" });
    const request = signUpEmail.mock.calls[0]?.[0];
    if (!request) throw new Error("signUpEmail was not called.");
    expect(request.body).toEqual({ email: "owner@example.com", password: "a-long-password", name: "Owner" });
    expect(request.headers.get("x-founder-setup-token")).toBe(input.setupToken);
  });

  it("treats an existing owner with the same email as done, before or during sign-up", async () => {
    const signUpEmail = vi.fn(async () => ({}));
    const resetOwner = vi.fn(async () => undefined);
    const existing = async () => [{ id: "u1", email: "Owner@Example.com " }];
    expect(await createOwnerAccount(auth({ listAccounts: existing, signUpEmail, resetOwner }), input)).toEqual({ outcome: "exists" });
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(resetOwner).not.toHaveBeenCalled();
    for (const error of [apiError("FORBIDDEN"), apiError("UNPROCESSABLE_ENTITY", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")]) {
      expect(isOwnerAlreadyExistsError(error)).toBe(true);
      const failing = async () => Promise.reject(error);
      expect(await createOwnerAccount(auth({ signUpEmail: failing }), input)).toEqual({ outcome: "exists" });
    }
  });

  it("stops when the owner exists under another email instead of leaving nobody able to sign in (T-063)", async () => {
    const resetOwner = vi.fn(async () => undefined);
    const other = async () => [{ id: "u1", email: "old@example.com" }];
    expect(await createOwnerAccount(auth({ listAccounts: other, resetOwner }), input)).toEqual({ outcome: "email-mismatch" });
    expect(resetOwner).not.toHaveBeenCalled();
  });

  it("gives the existing owner the new email and password with --reset-owner (T-063)", async () => {
    const resetOwner = vi.fn<OwnerAuth["resetOwner"]>(async () => undefined);
    const signUpEmail = vi.fn(async () => ({}));
    const other = async () => [{ id: "u1", email: "old@example.com" }];
    expect(await createOwnerAccount(auth({ listAccounts: other, resetOwner, signUpEmail }), { ...input, reset: true })).toEqual({ outcome: "reset" });
    expect(resetOwner).toHaveBeenCalledWith("u1", "owner@example.com", "a-long-password");
    expect(signUpEmail).not.toHaveBeenCalled();
    // With no owner yet, --reset-owner simply creates one.
    expect(await createOwnerAccount(auth({ signUpEmail }), { ...input, reset: true })).toEqual({ outcome: "created" });
    const failingReset = async () => Promise.reject(new TypeError("postgres://u:secret@h/db"));
    expect(await createOwnerAccount(auth({ listAccounts: other, resetOwner: failingReset }), { ...input, reset: true })).toEqual({ outcome: "failed", label: "TypeError" });
  });

  it("refuses to guess when the database holds more than one account", async () => {
    const two = async () => [{ id: "u1", email: "a@example.com" }, { id: "u2", email: "b@example.com" }];
    expect(await createOwnerAccount(auth({ listAccounts: two }), { ...input, reset: true })).toEqual({ outcome: "failed", label: "MORE_THAN_ONE_ACCOUNT" });
  });

  it("reports other failures by status or class only, never by message", async () => {
    const reject = (error: unknown) => async () => Promise.reject(error);
    const tooShort = await createOwnerAccount(auth({ signUpEmail: reject(apiError("BAD_REQUEST", "PASSWORD_TOO_SHORT")) }), input);
    expect(tooShort).toEqual({ outcome: "failed", label: "BAD_REQUEST" });
    expect(isOwnerAlreadyExistsError(apiError("UNPROCESSABLE_ENTITY", "FAILED_TO_CREATE_USER"))).toBe(false);
    expect(signUpFailureLabel(new TypeError("postgres://u:secret@h/db"))).toBe("TypeError");
    expect(signUpFailureLabel("postgres://u:secret@h/db")).toBe("unknown error");
    expect(signUpFailureLabel({ status: "postgres://u:secret@h/db" })).toBe("unknown error");
  });
});

describe("no secret in any output", () => {
  const generated = [randomBytes(32).toString("base64"), randomBytes(32).toString("base64"), randomBytes(32).toString("base64url")];

  it("redacts every known secret and a database URL's password, raw and decoded", () => {
    const url = "postgresql://neondb_owner:p%40ss%2Fw0rd@ep-1.neon.tech/neondb";
    const secrets = [...generated, "owner-password-123", ...databaseUrlSecrets(url)];
    const line = `token ${generated[2]} pw owner-password-123 url ${url} raw p%40ss%2Fw0rd decoded p@ss/w0rd`;
    const shown = redact(line, secrets);
    for (const secret of secrets) expect(shown).not.toContain(secret);
    expect(shown).toBe("token <hidden> pw <hidden> url <hidden> raw <hidden> decoded <hidden>");
  });

  it("renders the dry-run plan from placeholders only", () => {
    const plan = renderPlan({ dryRun: true, help: false, resetOwner: false, project: "founder-os", scope: "my-team" }).join("\n");
    for (const secret of generated) expect(plan).not.toContain(secret);
    expect(plan).toContain("<generated>");
    expect(plan).not.toMatch(/--value|BETTER_AUTH_URL|\.env\.local/);
    for (const [index, title] of STEP_TITLES.entries()) expect(plan).toContain(`Step ${index}/10  ${title}`);
    for (const line of plan.split("\n").filter((text) => text.trim().startsWith("npx "))) {
      const args = line.trim().split("   (")[0]!.split(" ").slice(1);
      expect(args.every(isShellSafeArg), line).toBe(true);
      expect(args.slice(-2)).toEqual(["--scope", "my-team"]);
    }
  });

  it("keeps the orchestration on the redacting logger, with values only on stdin or in a child's env", () => {
    const source = readFileSync(join(root, "scripts/setup-production.ts"), "utf8");
    expect(source).not.toMatch(/console\.|--value/);
    expect(source).toMatch(/process\.stdout\.write\(`\$\{lib\.redact\(line, secrets\)\}\\n`\)/);
    const owner = readFileSync(join(root, "scripts/create-owner.ts"), "utf8");
    // Output interpolates only fixed labels: never the password, the env, a URL or an error message.
    expect(owner).not.toMatch(/console\.\w+\([^;]*\$\{[^}]*(password|parsedEnv|process\.env|message)/);
    expect(owner).not.toMatch(/console\.log/);
  });
});

// Privacy audit (T-062): output of any command that is handed a secret, or that downloads settings, must never reach
// the terminal unfiltered. Inherited stdio would bypass redact().
it("never lets a command that receives or downloads secrets print unfiltered output", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../scripts/setup-production.ts", import.meta.url), "utf8");
  const calls = source.split("await vercel(").slice(1).map((rest) => rest.slice(0, rest.indexOf(");")));
  const withStdinData = calls.filter((call) => call.includes("stdin: { data"));
  expect(withStdinData.length).toBeGreaterThan(0);
  for (const call of withStdinData) {
    expect(call).toContain('stdout: "tee"');
    expect(call).toContain('stderr: "tee"');
  }
  const pullFunction = source.slice(source.indexOf("async function pullDirectDatabaseUrl"), source.indexOf("async function askDirectDatabaseUrl"));
  const pull = pullFunction.split("await vercel(").slice(1).map((rest) => rest.slice(0, rest.indexOf(");")));
  expect(pull).toHaveLength(1);
  expect(pull[0]).toContain('stdout: "pipe"');
  expect(pull[0]).toContain('stderr: "pipe"');
  // `vercel link` writes .env.local where it runs: it must run in the temporary folder, never in the repo.
  expect(source).toMatch(/const linked = await vercel\(args, \{ cwd: context \}\)/);
  // Child scripts (migrate, create-owner) are filtered too.
  expect(source).toMatch(/run\(process\.execPath, \[cli, script\], \{ env, stdin, stdout: "tee", stderr: "tee" \}\)/);
  expect(calls.every((call) => !call.includes('stderr: "inherit"') || !call.includes("stdin: { data"))).toBe(true);
});
