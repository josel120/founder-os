import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/session-cookie";

// Optimistic navigation guard only: a cookie is not a session. Every private page, query and action still
// validates the session and owner on the server (requireAuth). Server action POSTs pass through so they
// return their explicit "sign in again" results instead of a redirect.
export function middleware(request: NextRequest) {
  const pageRequest = (request.method === "GET" || request.method === "HEAD") && !request.headers.has("next-action");
  if (!pageRequest || hasSessionCookie(request.cookies)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/private/:path*"] };
