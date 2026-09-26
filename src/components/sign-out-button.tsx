"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) { setError("Could not sign out. Try again."); return; }
      window.location.assign("/login");
    } catch {
      setError("Could not sign out. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return <span className="flex items-center gap-2">
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    <button type="button" onClick={signOut} disabled={pending} className="rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">{pending ? "Signing out…" : "Sign out"}</button>
  </span>;
}
