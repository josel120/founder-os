import type { NextConfig } from "next";

// No script-src here: Next.js injects inline scripts, so a script policy would need per-request nonces.
// These directives stop framing, plugin content, base-tag hijacking and cross-origin form posts.
const contentSecurityPolicy = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["/private/:path*", "/login", "/register", "/api/:path*"].map((source) => ({ source, headers: noIndex })),
    ];
  },
};
export default nextConfig;
