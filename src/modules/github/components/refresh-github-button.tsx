"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshProjectGitHub } from "../actions/github.actions";

export function RefreshGitHubButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setMessage(""); setError("");
    try {
      const data = new FormData();
      data.set("projectId", projectId);
      const result = await refreshProjectGitHub(data);
      if (result.ok) { setMessage(result.message); router.refresh(); } else setError(result.error);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={refresh} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-slate-500 disabled:opacity-50">{pending ? "Refreshing…" : "Refresh from GitHub"}</button>
    <p role="status" aria-live="polite" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
