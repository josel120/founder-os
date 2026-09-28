"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { updateEvidenceContent } from "../actions/evidence.actions";
import type { EvidenceKind, EvidenceSignal } from "../schemas/evidence.limits";
import { EvidenceFields } from "./capture-evidence-form";

export type EditableEvidence = { id: string; title: string; summary: string; kind: EvidenceKind; signal: EvidenceSignal; sourceUrl: string | null };

export function EditEvidenceForm({ evidence }: { evidence: EditableEvidence }) {
  const router = useRouter();
  const t = useT();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await updateEvidenceContent(data);
      if (!result.ok) { setError(t(result.error)); return; }
      setMessage(t("Evidence updated."));
      router.refresh();
    } catch {
      setError(t("Could not confirm the save. Check the evidence before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} aria-busy={pending} className="mt-3 space-y-4 border-t border-slate-100 pt-4">
    <input type="hidden" name="evidenceId" value={evidence.id} />
    <EvidenceFields pending={pending} initial={{ title: evidence.title, summary: evidence.summary, kind: evidence.kind, signal: evidence.signal, sourceUrl: evidence.sourceUrl ?? "" }} />
    <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Saving...") : t("Save changes")}</button>
    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
