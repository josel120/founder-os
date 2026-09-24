import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../src/db/schema/index.ts";

const base = new URL("../src/db/migrations/", import.meta.url);
const previous = JSON.parse(readFileSync(new URL("meta/0000_snapshot.json", base), "utf8"));
const journalPath = new URL("meta/_journal.json", base);
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const sqlPath = new URL("0001_owner_isolation.sql", base);
if (existsSync(sqlPath) || journal.entries.length !== 1) throw new Error("Expected exactly one existing migration; refusing overwrite");
const snapshot = generateDrizzleJson(schema, previous.id);
const statements = await generateMigration(previous, snapshot);
writeFileSync(sqlPath, statements.join("\n--> statement-breakpoint\n") + "\n");
writeFileSync(new URL("meta/0001_snapshot.json", base), JSON.stringify(snapshot, null, 2) + "\n");
journal.entries.push({ idx: 1, version: "7", when: Date.now(), tag: "0001_owner_isolation", breakpoints: true });
writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
console.log(`Generated ${statements.length} SQL statements; no database connection or migration execution.`);
