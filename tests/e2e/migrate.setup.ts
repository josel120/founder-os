import { test as setup } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { requireDisposableDatabase } from "./e2e-env";

// Runs before every other project so no request (anonymous or authenticated) can race the
// migration and hit `relation "rate_limit" does not exist` (T-053 reads it on every auth request).
setup("migrate the disposable database", async () => {
  const client = postgres(requireDisposableDatabase(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "src/db/migrations" });
  } finally {
    await client.end();
  }
});
