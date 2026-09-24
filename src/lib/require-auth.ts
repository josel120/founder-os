import { headers } from "next/headers";
import { auth } from "./auth";
import { env } from "./env";

export async function requireAuth(): Promise<{ id: string } | null> {
  if (!auth || !env.OWNER_EMAIL) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.email.trim().toLowerCase() !== env.OWNER_EMAIL) return null;
  return { id: session.user.id };
}
