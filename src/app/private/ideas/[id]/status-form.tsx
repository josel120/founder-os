"use client";

import { useRef, useState, type FormEvent } from "react";
import { updateIdeaStatus } from "@/modules/ideas/actions/idea.actions";

const statuses = ["INBOX", "RESEARCHING", "VALIDATING", "CANDIDATE", "PLANNING", "CONVERTED", "PAUSED", "REJECTED", "ARCHIVED"] as const;

export function StatusForm({ ideaId, initialStatus }: { ideaId: string; initialStatus: (typeof statuses)[number] }) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setSaving(true); setMessage(""); setError("");
    try {
      const result = await updateIdeaStatus(data);
      if (result.ok) setMessage("Saved");
      else setError(result.error);
    } catch {
      setError("Connection interrupted. Check the saved status before retrying.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={saving} className="mt-8 rounded-lg border bg-white p-5">
      <input type="hidden" name="ideaId" value={ideaId} />
      <label className="block text-sm font-medium">Status
        <select name="status" value={status} disabled={saving} className="mt-2 block rounded-md border p-2"
          onChange={(event) => { setStatus(event.target.value as (typeof statuses)[number]); setMessage(""); setError(""); }}>
          {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={saving} type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving..." : "Save status"}</button>
        <span role="status" className="text-sm text-green-700">{message}</span>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}
