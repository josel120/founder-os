export async function seed(): Promise<void> {
  console.log("No approved seed datasets configured. No data was changed.");
}

void seed().catch(() => {
  console.error("Seed failed.");
  process.exitCode = 1;
});
