"use client";

import { useRef, useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { createProblem } from "../actions/problem.actions";
import { problemDescriptionMax } from "../schemas/problem.limits";

export function CaptureProblemForm() {
  const t = useT();
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
      if (!result.ok) { setError(t(result.error)); return; }
      form.reset();
      setMessage(t("Problem saved privately."));
      form.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    } catch {
      setError(t("Could not confirm the save. Check your problems before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form id="capture-problem" onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
      <div><p className="workspace-eyebrow">{t("Start from the need")}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t("Capture a problem")}</h2></div>
      <label className="block text-sm font-medium">{t("Problem")}
        <input name="title" required maxLength={160} readOnly={pending} placeholder={t("What problem exists?")} className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">{t("Who experiences it and why does it matter?")}
        <textarea name="description" required maxLength={problemDescriptionMax} readOnly={pending} className="mt-2 min-h-28 w-full rounded-md border p-3" />
      </label>
      <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? t("Saving...") : t("Capture problem")}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
