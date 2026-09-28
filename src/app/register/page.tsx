import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Registration closed"), robots: { index: false, follow: false } };
}

// Registration is closed (ADR-005): the owner account is created once by an operator with a setup token,
// which a public form can never send. This page explains that instead of offering a form that always fails.
export default async function Page() {
  const t = await getT();
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
    <div className="mb-8 flex items-center justify-between gap-4"><Link href="/" className="w-fit text-xl font-semibold tracking-tight">Founder OS</Link><LanguageSwitcher /></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">{t("Private workspace")}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Registration is closed")}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{t("Founder OS has a single owner account. New accounts cannot be created here.")}</p>
      <Link href="/login" className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">{t("Go to sign in")}</Link>
    </section>
  </main>;
}
