import { createAuthClient } from "better-auth/react";

// The auth API always lives on the same deployment as the page, and the CSP allows only `connect-src 'self'`, so the
// browser client always calls its own origin. NEXT_PUBLIC_BETTER_AUTH_URL is ignored: a stale value (another alias,
// localhost) made every sign-in fail with "Unable to connect" (T-064). No request is sent during server rendering.
export const authClient = createAuthClient({ baseURL: typeof window === "undefined" ? undefined : window.location.origin });
