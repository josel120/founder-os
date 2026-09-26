import { createAuthClient } from "better-auth/react";

// T-062: unset on Vercel, so Better Auth uses the page's own origin (window.location.origin) and sign-in works on
// every alias of a deployment. Local dev and E2E browse http://localhost:3000, which is that origin.
export const authClient = createAuthClient({ baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || undefined });
