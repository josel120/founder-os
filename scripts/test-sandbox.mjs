import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectory = join(root, "work", "test-temp");
mkdirSync(temporaryDirectory, { recursive: true });
const result = spawnSync("pnpm exec vitest run --configLoader runner", {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env: { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory },
});
if (result.error) console.error("Unable to start Vitest:", result.error.message);
process.exitCode = result.status ?? 1;
