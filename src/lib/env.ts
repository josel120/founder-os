import { z } from "zod";
const schema = z.object({ DATABASE_URL: z.string().url().optional(), BETTER_AUTH_SECRET: z.string().min(32).optional(), BETTER_AUTH_URL: z.string().url().default("http://localhost:3000") });
export const env = schema.parse({ DATABASE_URL: process.env.DATABASE_URL, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL });
