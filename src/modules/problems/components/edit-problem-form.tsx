"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProblemContent } from "../actions/problem.actions";
import { problemDescriptionMax } from "../schemas/problem.limits";

export function EditProblemForm({ problemId, initialTitle, initialDescription }: { problemId: string; initialTitle: string; initialDescription: string }) {
  const router = useRouter();
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
      const result = await updateProblemContent(data);
      if (!result.ok) { setError(result.error); return; }
      setMessage("Problem updated.");
      router.refresh();
    } catch {
      setError("Could not confirm the save. Check the problem before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} aria-busy={pending} className="workspace-panel mt-8 space-y-4 p-6">
    <h2 className="text-lg font-semibold">Refine problem</h2>
    <input type="hidden" name="problemId" value={problemId} />
    <label className="block text-sm font-medium">Problem
      <input name="title" defaultValue={initialTitle} required maxLength={160} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">Who experiences it and why does it matter?
      <textarea name="description" defaultValue={initialDescription} required maxLength={problemDescriptionMax} readOnly={pending} className="mt-2 min-h-28 w-full rounded-md border p-3" />
    </label>
    <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Saving..." : "Save problem"}</button>
    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
