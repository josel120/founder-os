import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Registration closed", robots: { index: false, follow: false } };

// Registration is closed (ADR-005): the owner account is created once by an operator with a setup token,
// which a public form can never send. This page explains that instead of offering a form that always fails.
export default function Page() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
    <Link href="/" className="mb-8 w-fit text-xl font-semibold tracking-tight">Founder OS</Link>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Private workspace</p>
      <h1 className="text-2xl font-semibold tracking-tight">Registration is closed</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Founder OS has a single owner account. New accounts cannot be created here.</p>
      <Link href="/login" className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">Go to sign in</Link>
    </section>
  </main>;
}
