"use client";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    const result = await authClient.signUp.email({ name: String(formData.get("name")), email: String(formData.get("email")), password: String(formData.get("password")), callbackURL: "/private/ideas" });
    if (result.error) setError(result.error.message ?? "Unable to create account");
    else window.location.assign("/private/ideas");
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"><h1 className="text-2xl font-semibold">Create account</h1><p className="mt-2 text-slate-600">This Foundation build supports one private owner.</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-sm">Name<input className="mt-1 block w-full rounded-md border p-2" type="text" name="name" required /></label><label className="block text-sm">Email<input className="mt-1 block w-full rounded-md border p-2" type="email" name="email" required /></label><label className="block text-sm">Password<input className="mt-1 block w-full rounded-md border p-2" type="password" name="password" required minLength={8} /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-md bg-slate-900 p-2 text-white" type="submit">Create account</button></form></main>;
}
