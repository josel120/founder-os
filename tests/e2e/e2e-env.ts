// Authenticated E2E runs only against a throwaway database whose name ends in "_e2e".
// Values come from E2E_* variables so they can never be confused with real OWNER_EMAIL / DATABASE_URL.
export const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
export const e2eOwner = {
  email: process.env.E2E_OWNER_EMAIL ?? "owner@e2e.test",
  password: "e2e-owner-password-0123",
  name: "E2E Owner",
};
export const e2eSetupToken = process.env.E2E_SETUP_TOKEN ?? "";
export const e2eAuthSecret = process.env.E2E_AUTH_SECRET ?? "";
export const e2eBaseUrl = "http://localhost:3000";
export const e2eStorageState = "test-results/.auth/owner.json";

export function requireDisposableDatabase(): string {
  if (!e2eDatabaseUrl) throw new Error("E2E_DATABASE_URL is not set.");
  const name = decodeURIComponent(new URL(e2eDatabaseUrl).pathname.slice(1));
  if (!name.endsWith("_e2e")) throw new Error(`Refusing to run authenticated E2E: database "${name}" is not named *_e2e.`);
  if (e2eSetupToken.length < 32 || e2eAuthSecret.length < 32) throw new Error("E2E_SETUP_TOKEN and E2E_AUTH_SECRET must be at least 32 characters.");
  return e2eDatabaseUrl;
}
