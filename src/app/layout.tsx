import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Founder OS", description: "Private operating system for digital products" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
