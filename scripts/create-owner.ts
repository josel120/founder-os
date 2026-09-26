// Creates the single owner account through Better Auth's own sign-up path (ADR-005), in-process, so the setup
// token never exists outside this process and the one that started it. Run by scripts/setup-production.ts;
// the password arrives on stdin, everything else in this process's env. Exit codes: 0 created,
// OWNER_EXISTS_EXIT_CODE already existed (left unchanged), OWNER_RESET_EXIT_CODE new email and password
// (OWNER_RESET=1), OWNER_EMAIL_MISMATCH_EXIT_CODE an owner exists under another email, 1 failed.
import { z } from "zod";
import { createOwnerAccount, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, OWNER_EMAIL_MISMATCH_EXIT_CODE, OWNER_EXISTS_EXIT_CODE, OWNER_RESET_EXIT_CODE } from "./setup-production-lib";

const setupEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  OWNER_EMAIL: z.string().trim().email(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  OWNER_SETUP_TOKEN: z.string().min(32),
});

async function readStdin(): Promise<string> {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += String(chunk);
  return text;
}

async function main(): Promise<number> {
  if (process.stdin.isTTY) {
    console.error("This script is run by `pnpm setup:production`, which passes the password on stdin.");
    return 1;
  }
  const parsedEnv = setupEnvSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    // Names only: a value may be a secret.
    const names = [...new Set(parsedEnv.error.issues.map((issue) => issue.path.join(".")))];
    console.error(`Missing or invalid setup variables: ${names.join(", ")}`);
    return 1;
  }
  const password = await readStdin();
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    console.error("The password on stdin does not meet the length rule.");
    return 1;
  }
  const email = parsedEnv.data.OWNER_EMAIL.toLowerCase();

  // Imported only now: src/lib/env.ts and src/db read process.env when they load.
  const { auth } = await import("../src/lib/auth");
  const { db } = await import("../src/db");
  try {
    if (!auth) {
      console.error("Better Auth is not configured (database or secret missing).");
      return 1;
    }
    const context = await auth.$context;
    const result = await createOwnerAccount(
      {
        listAccounts: async () => (await context.internalAdapter.listUsers(2)).map((user) => ({ id: user.id, email: user.email })),
        signUpEmail: (request) => auth.api.signUpEmail(request),
        // Better Auth's own hashing and adapter, so the new password verifies exactly like a signed-up one.
        resetOwner: async (userId, newEmail, newPassword) => {
          await context.internalAdapter.updateUser(userId, { email: newEmail });
          await context.internalAdapter.updatePassword(userId, await context.password.hash(newPassword));
          await context.internalAdapter.deleteUserSessions(userId);
        },
      },
      { email, password, setupToken: parsedEnv.data.OWNER_SETUP_TOKEN, reset: process.env.OWNER_RESET === "1" },
    );
    if (result.outcome === "exists") return OWNER_EXISTS_EXIT_CODE;
    if (result.outcome === "reset") return OWNER_RESET_EXIT_CODE;
    if (result.outcome === "email-mismatch") return OWNER_EMAIL_MISMATCH_EXIT_CODE;
    if (result.outcome === "failed") {
      console.error(`Sign-up failed: ${result.label}`);
      return 1;
    }
    return 0;
  } finally {
    await db?.$client.end({ timeout: 5 });
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`Owner setup failed: ${error instanceof Error ? error.name : "unknown error"}`);
    process.exitCode = 1;
  },
);
