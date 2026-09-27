import { normalizeBaseUrl, runSmoke } from "./smoke-lib";

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2] ?? process.env.BASE_URL);
  const results = await runSmoke(baseUrl, (url, init) => fetch(url, init));
  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok ? "" : ` (${result.detail})`}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(failed === 0 ? `\nAll ${results.length} checks passed on ${baseUrl}.` : `\n${failed} of ${results.length} checks failed on ${baseUrl}.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke check failed.");
  process.exitCode = 2;
});
