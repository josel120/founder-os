"use client";

import { useRef, useState, type FormEvent } from "react";
import { createDecision } from "../actions/decision.actions";

export function CaptureDecisionForm({ ideaId, projectId }: { ideaId?: string; projectId?: string }) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await createDecision(data);
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      setMessage("Decision recorded privately.");
      form.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    } catch {
      setError("Could not confirm the save. Check your decisions before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
      <label className="block text-sm font-medium">What was decided about?
        <input name="title" required maxLength={160} readOnly={pending} placeholder="e.g. Pricing model" className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">Decision
        <textarea name="decision" required maxLength={2000} readOnly={pending} className="mt-2 min-h-20 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">Why
        <textarea name="reason" required maxLength={2000} readOnly={pending} className="mt-2 min-h-20 w-full rounded-md border p-3" />
      </label>
      {ideaId && <input type="hidden" name="ideaId" value={ideaId} />}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? "Saving..." : "Record decision"}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
