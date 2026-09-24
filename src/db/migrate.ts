import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { loadDatabaseEnvironment } from "./load-environment";

async function main(): Promise<void> {
  loadDatabaseEnvironment();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations");
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "src/db/migrations" });
    console.log("Database migrations applied successfully.");
  } finally {
    await client.end();
  }
}

void main().catch(() => {
  // Do not log driver errors: they can contain credentials, SQL or private values.
  console.error("Migration failed. Check DATABASE_URL, database availability and migration prerequisites.");
  process.exitCode = 1;
});
