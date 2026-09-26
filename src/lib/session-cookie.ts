// Better Auth's default session cookie names ("__Secure-" is added on HTTPS). This mirrors getSessionCookie
// from better-auth/cookies, which the Edge middleware cannot import: it pulls in jose APIs Edge lacks.
// tests/middleware.test.ts checks both helpers agree.
const sessionCookieNames = ["better-auth.session_token", "__Secure-better-auth.session_token", "better-auth-session_token", "__Secure-better-auth-session_token"] as const;

export function hasSessionCookie(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return sessionCookieNames.some((name) => Boolean(cookies.get(name)?.value));
}
