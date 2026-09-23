export async function seed(): Promise<void> { /* Phase 0 intentionally has no product fixtures. */ }
if (import.meta.url === `file://${process.argv[1]}`) await seed();
