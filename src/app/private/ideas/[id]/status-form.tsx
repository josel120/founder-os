"use client";

import { useRef, useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { updateIdeaStatus } from "@/modules/ideas/actions/idea.actions";
import type { InboxStatus } from "@/modules/ideas/services/inbox";

// Options come from the server page, so this client bundle never imports the database schema.
export function StatusForm({ ideaId, initialStatus, options }: { ideaId: string; initialStatus: InboxStatus; options: { value: InboxStatus; label: string }[] }) {
  const t = useT();
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
      if (result.ok) setMessage(t("Saved"));
      else setError(t(result.error));
    } catch {
      setError(t("Connection interrupted. Check the saved status before retrying."));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={saving} className="workspace-panel mt-8 p-6">
      <input type="hidden" name="ideaId" value={ideaId} />
      <label className="block text-sm font-medium">{t("Status")}
        <select name="status" value={status} disabled={saving} className="mt-2 block rounded-md border p-3"
          onChange={(event) => { setStatus(event.target.value as InboxStatus); setMessage(""); setError(""); }}>
          {options.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
        </select>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={saving} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? t("Saving...") : t("Save status")}</button>
        <span role="status" className="text-sm text-green-700">{message}</span>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}
