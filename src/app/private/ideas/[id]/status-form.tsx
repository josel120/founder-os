"use client";

import { useState, type FormEvent } from "react";
import { updateIdeaStatus } from "@/modules/ideas/actions/idea.actions";

const statuses = ["INBOX", "RESEARCHING", "VALIDATING", "CANDIDATE", "PLANNING", "CONVERTED", "PAUSED", "REJECTED", "ARCHIVED"] as const;

export function StatusForm({ ideaId, initialStatus }: { ideaId: string; initialStatus: (typeof statuses)[number] }) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setSaved(false);
    const formData = new FormData(event.currentTarget);
    await updateIdeaStatus(formData);
    setSaving(false); setSaved(true);
  }

  return <form onSubmit={submit} className="mt-8 rounded-lg border bg-white p-5"><input type="hidden" name="ideaId" value={ideaId} /><label className="block text-sm font-medium">Status<select name="status" value={status} onChange={(event) => { setStatus(event.target.value as (typeof statuses)[number]); setSaved(false); }} className="mt-2 block rounded-md border p-2">{statuses.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><div className="mt-4 flex items-center gap-3"><button disabled={saving} type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save status"}</button>{saved && <span className="text-sm text-green-700">Saved</span>}</div></form>;
}
