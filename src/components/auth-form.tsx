"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

/** Sign-in form. `next` must already be validated server-side with `safePrivatePath`. */
export function AuthForm({ next = "/private" }: { next?: string }) {
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")), callbackURL: "/private" });
      if (result.error) setError(result.error.message || "We could not complete your request. Please try again.");
      else window.location.assign(next);
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
    <Link href="/" className="mb-8 w-fit text-xl font-semibold tracking-tight">Founder OS</Link>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">Your private workspace</p>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in to pick up where you left off.</p>
      <form onSubmit={submit} aria-busy={loading} className="mt-7 space-y-4">
        <fieldset disabled={loading} className="space-y-4">
          <legend className="sr-only">Sign in</legend>
          <label className="block text-sm font-medium">Email<input autoComplete="email" type="email" name="email" required className="mt-1.5 block w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Password<input autoComplete="current-password" type="password" name="password" required minLength={8} className="mt-1.5 block w-full rounded-lg border px-3 py-2" /></label>
          <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700" type="submit">{loading ? "Signing in…" : "Sign in"}</button>
        </fieldset>
        <div aria-live="polite" className="min-h-6">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>
      </form>
      <p className="mt-3 text-center text-xs text-slate-500">This workspace has a single owner. Registration is closed.</p>
    </section>
  </main>;
}
