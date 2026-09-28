"use client";

import { useRef, useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { createIdea } from "../actions/idea.actions";
import { ideaDescriptionMax } from "../schemas/idea.limits";

export function CaptureIdeaForm() {
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
      const result = await createIdea(data);
      if (!result.ok) { setError(t(result.error)); return; }
      form.reset();
      setMessage(t("Idea saved privately to your inbox."));
      form.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    } catch {
      setError(t("Could not confirm the save. Check your inbox before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form id="capture-idea" onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
      <div><p className="workspace-eyebrow">{t("Make room for the next thing")}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t("Quick capture")}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t("A rough thought is enough. Give it a name; refine it later.")}</p></div>
      <label className="block text-sm font-medium">{t("Idea")}
        <input name="title" required maxLength={160} readOnly={pending} placeholder={t("What is the idea?")} className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">{t("Context (optional)")}
        <textarea name="description" maxLength={ideaDescriptionMax} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <input type="hidden" name="source" value="OWN" />
      <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? t("Saving...") : t("+ Capture idea")}</button>
      <p className="text-xs text-slate-500">{t("Private by default · Added to Inbox")}</p>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
