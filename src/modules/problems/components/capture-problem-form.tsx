"use client";

import { useRef, useState, type FormEvent } from "react";
import { createProblem } from "../actions/problem.actions";

export function CaptureProblemForm() {
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
      const result = await createProblem(data);
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      setMessage("Problem saved privately.");
      form.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    } catch {
      setError("Could not confirm the save. Check your problems before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="workspace-panel mb-10 max-w-2xl space-y-4 p-6">
      <label className="block text-sm font-medium">Problem
        <input name="title" required maxLength={160} readOnly={pending} placeholder="What problem exists?" className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">Who experiences it and why does it matter?
        <textarea name="description" required maxLength={3000} readOnly={pending} className="mt-2 min-h-28 w-full rounded-md border p-3" />
      </label>
      <button disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? "Saving..." : "Capture problem"}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
