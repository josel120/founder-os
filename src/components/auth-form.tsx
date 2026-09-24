"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
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
      const credentials = { email: String(data.get("email")), password: String(data.get("password")), callbackURL: "/private/ideas" };
      const result = registering
        ? await authClient.signUp.email({ ...credentials, name: String(data.get("name")) })
        : await authClient.signIn.email(credentials);
      if (result.error) setError(result.error.message || "We could not complete your request. Please try again.");
      else window.location.assign("/private/ideas");
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
      <h1 className="text-2xl font-semibold tracking-tight">{registering ? "Create account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-slate-600">{registering ? "Keep your ideas and the problems behind them in one place." : "Sign in to pick up where you left off."}</p>
      <form onSubmit={submit} aria-busy={loading} className="mt-7 space-y-4">
        <fieldset disabled={loading} className="space-y-4">
          <legend className="sr-only">{registering ? "Account details" : "Sign in"}</legend>
          {registering && <label className="block text-sm font-medium">Name<input autoComplete="name" name="name" required className="mt-1.5 block w-full rounded-lg border px-3 py-2" /></label>}
          <label className="block text-sm font-medium">Email<input autoComplete="email" type="email" name="email" required className="mt-1.5 block w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Password<input autoComplete={registering ? "new-password" : "current-password"} type="password" name="password" required minLength={8} aria-describedby={registering ? "password-help" : undefined} className="mt-1.5 block w-full rounded-lg border px-3 py-2" /></label>
          {registering && <p id="password-help" className="text-xs text-slate-500">Use at least 8 characters.</p>}
          <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700" type="submit">{loading ? (registering ? "Creating account…" : "Signing in…") : (registering ? "Create account" : "Sign in")}</button>
        </fieldset>
        <div aria-live="polite" className="min-h-6">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>
      </form>
      <p className="mt-3 text-center text-sm text-slate-600">{registering ? "Already have an account? " : "First time here? "}<Link href={registering ? "/login" : "/register"} className="font-medium text-teal-800 underline underline-offset-4">{registering ? "Sign in" : "Create an account"}</Link></p>
    </section>
  </main>;
}
