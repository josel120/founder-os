"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createEvidence } from "../actions/evidence.actions";
import { evidenceKinds, evidenceSignals, evidenceSourceUrlMax, evidenceSummaryMax, evidenceTitleMax } from "../schemas/evidence.limits";
import { kindLabel, signalLabel } from "../services/signals";

export type ParentOption = { value: string; label: string };

type Props =
  | { parents: { problems: ParentOption[]; ideas: ParentOption[] }; fixedParent?: undefined }
  | { fixedParent: ParentOption; parents?: undefined };

export function CaptureEvidenceForm({ parents, fixedParent }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const noParents = !fixedParent && parents.problems.length + parents.ideas.length === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await createEvidence(new FormData(form));
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      setMessage("Evidence saved privately.");
      router.refresh();
    } catch {
      setError("Could not confirm the save. Check your evidence before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <form id="capture-evidence" onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
    <div><p className="workspace-eyebrow">What did the research say?</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Record evidence</h2><p className="mt-2 text-sm leading-6 text-slate-500">{fixedParent ? <>About this idea. Stays private.</> : <>Attach it to one of your problems or ideas. Stays private.</>}</p></div>
    {fixedParent ? <input type="hidden" name="parent" value={fixedParent.value} /> : <label className="block text-sm font-medium">About
      <select name="parent" required defaultValue="" disabled={pending || noParents} className="mt-2 block w-full rounded-md border p-3">
        <option value="" disabled>{noParents ? "Capture a problem or idea first" : "Choose a problem or idea"}</option>
        {parents.problems.length > 0 && <optgroup label="Problems">{parents.problems.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
        {parents.ideas.length > 0 && <optgroup label="Ideas">{parents.ideas.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
      </select>
    </label>}
    <EvidenceFields pending={pending} />
    <button disabled={pending || noParents} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? "Saving..." : "Save evidence"}</button>
    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}

type FieldValues = { title: string; summary: string; kind: string; signal: string; sourceUrl: string };

/** Shared by the capture and edit forms. Kind and signal have no preselected value: the owner chooses both. */
export function EvidenceFields({ pending, initial }: { pending: boolean; initial?: FieldValues }) {
  return <>
    <label className="block text-sm font-medium">Evidence title
      <input name="title" required maxLength={evidenceTitleMax} defaultValue={initial?.title} readOnly={pending} placeholder="e.g. Five founders interviewed" className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">What did you learn?
      <textarea name="summary" required maxLength={evidenceSummaryMax} defaultValue={initial?.summary} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">Kind
        <select name="kind" required defaultValue={initial?.kind ?? ""} disabled={pending} className="mt-2 block w-full rounded-md border p-3">
          <option value="" disabled>Choose</option>
          {evidenceKinds.map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Signal
        <select name="signal" required defaultValue={initial?.signal ?? ""} disabled={pending} className="mt-2 block w-full rounded-md border p-3">
          <option value="" disabled>Choose</option>
          {evidenceSignals.map((signal) => <option key={signal} value={signal}>{signalLabel(signal)}</option>)}
        </select>
      </label>
    </div>
    <label className="block text-sm font-medium">Source link (optional)
      <input name="sourceUrl" type="url" maxLength={evidenceSourceUrlMax} defaultValue={initial?.sourceUrl} readOnly={pending} placeholder="https://" className="mt-2 w-full rounded-md border p-3" />
    </label>
  </>;
}
