import { normalizeBaseUrl, renderSmokeTable, runSmoke } from "./smoke-lib";

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2] ?? process.env.BASE_URL);
  const results = await runSmoke(baseUrl, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }));
  for (const line of renderSmokeTable(results)) console.log(line);
  const failed = results.filter((result) => !result.pass).length;
  console.log(failed === 0 ? `\nAll ${results.length} checks passed on ${baseUrl}.` : `\n${failed} of ${results.length} checks failed on ${baseUrl}.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke check failed.");
  process.exitCode = 2;
});
