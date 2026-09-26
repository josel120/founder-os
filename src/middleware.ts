import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/session-cookie";

/** Per-request policy. Next.js reads the nonce from the request's CSP header and puts it on its own scripts. */
export function contentSecurityPolicy(nonce: string, dev = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce-bearing framework scripts load their chunks; 'unsafe-eval' only for dev refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// Optimistic navigation guard only: a cookie is not a session. Every private page, query and action still
// validates the session and owner on the server (requireAuth). Server action POSTs pass through so they
// return their explicit "sign in again" results instead of a redirect.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const isPrivate = request.nextUrl.pathname === "/private" || request.nextUrl.pathname.startsWith("/private/");
  const pageRequest = (request.method === "GET" || request.method === "HEAD") && !request.headers.has("next-action");
  if (isPrivate && pageRequest && !hasSessionCookie(request.cookies)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Content-Security-Policy", policy); // every page response carries the policy, redirects included
    return redirect;
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Every page gets a fresh nonce; API routes and static assets carry no inline scripts.
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };
