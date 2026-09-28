import "./globals.css";
import type { Metadata } from "next";
import { catalogFor } from "@/lib/i18n/catalogs";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
// Every page renders per request so Next.js can stamp the middleware's CSP nonce on its scripts (T-045).
// A prerendered page would ship scripts without a nonce, and the policy would block them.
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: "Founder OS", template: "%s · Founder OS" }, description: t("Private operating system for digital products") };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><I18nProvider locale={locale} catalog={catalogFor(locale)}>{children}</I18nProvider></body></html>;
}
