import type { Config } from "drizzle-kit";
import { loadDatabaseEnvironment } from "./src/db/load-environment";
loadDatabaseEnvironment();
export default { schema: "./src/db/schema/index.ts", out: "./src/db/migrations", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://localhost/founder_os" } } satisfies Config;
