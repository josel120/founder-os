"use client";

import { useRef, useState, type FormEvent } from "react";
import { createIdea } from "../actions/idea.actions";

export function CaptureIdeaForm() {
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
      const result = await createIdea(data);
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      setMessage("Idea saved privately to your inbox.");
      form.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    } catch {
      setError("Could not confirm the save. Check your inbox before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="mb-10 max-w-2xl space-y-4 rounded-lg border bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium">Idea
        <input name="title" required maxLength={160} readOnly={pending} placeholder="What is the idea?" className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">Context (optional)
        <textarea name="description" maxLength={2000} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <input type="hidden" name="source" value="OWN" />
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50" type="submit">{pending ? "Saving..." : "Capture idea"}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
