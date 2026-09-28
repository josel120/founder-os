"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { updateIdeaContent } from "../actions/idea.actions";
import { ideaDescriptionMax } from "../schemas/idea.limits";

type EditIdeaFormProps = {
  ideaId: string;
  initialTitle: string;
  initialDescription: string;
};

export function EditIdeaForm({ ideaId, initialTitle, initialDescription }: EditIdeaFormProps) {
  const router = useRouter();
  const t = useT();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await updateIdeaContent(data);
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      setMessage(t("Idea updated."));
      router.refresh();
    } catch {
      setError(t("Could not confirm the save. Check the idea before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="workspace-panel mt-8 space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("Refine idea")}</h2>
      <input type="hidden" name="ideaId" value={ideaId} />
      <label className="block text-sm font-medium">{t("Title")}
        <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} readOnly={pending} required className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">{t("Description")}
        <textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={ideaDescriptionMax} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Saving...") : t("Save idea")}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
