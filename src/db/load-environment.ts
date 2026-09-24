import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

/** CLI-only loader. Existing process variables win, then .env.local, then .env. */
export function loadDatabaseEnvironment(root = process.cwd()): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(root, name);
    if (existsSync(path)) loadEnvFile(path);
  }
}
