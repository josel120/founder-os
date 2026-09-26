import { betterAuth, APIError } from "better-auth";
import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env";

export const auth =
  db && env.BETTER_AUTH_SECRET
    ? betterAuth({
        database: drizzleAdapter(db, {
          provider: "pg",
          schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
            rateLimit: schema.rateLimits,
          },
        }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        // ADR-016: counters live in Postgres so every serverless instance shares them; keyed per client IP and path.
        rateLimit: {
          enabled: process.env.NODE_ENV === "production",
          storage: "database",
          customRules: { "/sign-in/email": { window: 60, max: 5 } },
        },
        session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
        telemetry: { enabled: false },
        emailAndPassword: {
          enabled: true,
          disableSignUp: !env.OWNER_EMAIL || !env.OWNER_SETUP_TOKEN,
        },
        databaseHooks: {
          user: {
            create: {
              before: async (user, context) => {
                const provided = context?.headers?.get("x-founder-setup-token") ?? "";
                const expected = env.OWNER_SETUP_TOKEN;
                if (!db || !env.OWNER_EMAIL || user.email.trim().toLowerCase() !== env.OWNER_EMAIL ||
                    !expected || Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
                    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
                  throw new APIError("FORBIDDEN", { message: "Registration is restricted." });
                }
                const existing = await db.select({ id: schema.users.id }).from(schema.users)
                  .where(eq(sql<string>`lower(trim(${schema.users.email}))`, env.OWNER_EMAIL)).limit(1);
                if (existing.length > 0) throw new APIError("FORBIDDEN", { message: "Registration is restricted." });
                return { data: { ...user, email: env.OWNER_EMAIL } };
              },
            },
          },
          session: {
            create: {
              before: async (session) => {
                if (!db || !env.OWNER_EMAIL) throw new APIError("FORBIDDEN", { message: "Access is restricted." });
                const [user] = await db.select({ email: schema.users.email }).from(schema.users)
                  .where(eq(schema.users.id, session.userId)).limit(1);
                if (!user || user.email.trim().toLowerCase() !== env.OWNER_EMAIL) {
                  throw new APIError("FORBIDDEN", { message: "Access is restricted." });
                }
                return { data: session };
              },
            },
          },
        },
      })
    : null;
