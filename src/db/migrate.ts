import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to run migrations");

async function main(): Promise<void> {
  const client = postgres(process.env.DATABASE_URL as string);
  try {
    await migrate(drizzle(client), { migrationsFolder: "src/db/migrations" });
  } finally {
    await client.end();
  }
}

void main();
