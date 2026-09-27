import type { NextConfig } from "next";

// Content-Security-Policy is set per request in src/middleware.ts, because its script-src carries a nonce (T-045).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
// API routes are outside the middleware matcher and return JSON, so they get a policy that allows nothing.
const apiPolicy = [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ADR-020: an import sends the CSV text (at most 1 MB, checked again on the server) to a server action.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: apiPolicy },
      ...["/private/:path*", "/login", "/register", "/api/:path*"].map((source) => ({ source, headers: noIndex })),
    ];
  },
};
export default nextConfig;
