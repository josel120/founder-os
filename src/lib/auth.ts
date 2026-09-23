import { betterAuth } from "better-auth";
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
          },
        }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        emailAndPassword: {
          enabled: true,
        },
      })
    : null;
