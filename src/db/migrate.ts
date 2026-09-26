import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { loadDatabaseEnvironment } from "./load-environment";
import { reportError } from "../lib/report-error";

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

void main().catch((error: unknown) => {
  // Never log driver messages: they can contain credentials, SQL or private values. Only the error class and SQLSTATE.
  reportError("db.migrate", error);
  console.error("Migration failed. Check DATABASE_URL, database availability and migration prerequisites.");
  process.exitCode = 1;
});
