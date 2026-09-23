"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true); setError(null);
    const result = await authClient.signIn.email({ email: String(formData.get("email")), password: String(formData.get("password")), callbackURL: "/private/ideas" });
    if (result.error) setError(result.error.message ?? "Unable to sign in");
    else window.location.assign("/private/ideas");
    setLoading(false);
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"><h1 className="text-2xl font-semibold">Sign in</h1><p className="mt-2 text-slate-600">Enter your Founder OS account.</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-sm">Email<input className="mt-1 block w-full rounded-md border p-2" type="email" name="email" required /></label><label className="block text-sm">Password<input className="mt-1 block w-full rounded-md border p-2" type="password" name="password" required minLength={8} /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={loading} className="w-full rounded-md bg-slate-900 p-2 text-white disabled:opacity-50" type="submit">{loading ? "Signing in…" : "Continue"}</button></form><a className="mt-4 text-center text-sm text-slate-600 underline" href="/register">Create an account</a></main>;
}
