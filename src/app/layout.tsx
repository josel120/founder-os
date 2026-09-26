import "./globals.css";
import type { Metadata } from "next";
// Every page renders per request so Next.js can stamp the middleware's CSP nonce on its scripts (T-045).
// A prerendered page would ship scripts without a nonce, and the policy would block them.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Founder OS", template: "%s · Founder OS" }, description: "Private operating system for digital products" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
