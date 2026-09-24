import { headers } from "next/headers";
import { auth } from "./auth";
import { env } from "./env";

export async function requireAuth(): Promise<{ id: string } | null> {
  // Read the request first, even when auth is unconfigured: this keeps every private page dynamic.
  // Otherwise a build without auth env prerenders private pages as static redirects to /login.
  const requestHeaders = await headers();
  if (!auth || !env.OWNER_EMAIL) return null;
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || session.user.email.trim().toLowerCase() !== env.OWNER_EMAIL) return null;
  return { id: session.user.id };
}
