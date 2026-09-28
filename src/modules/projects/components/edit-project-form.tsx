"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { updateProjectContent } from "../actions/project.actions";

export type EditableProject = {
  id: string;
  name: string;
  slug: string;
  description: string;
  repository: string | null;
  website: string | null;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  currentVersion: string | null;
  productionVersion: string | null;
};

const urlFields = [["repository", "Repository"], ["website", "Website"], ["playStoreUrl", "Play Store URL"], ["appStoreUrl", "App Store URL"]] as const;
const versionFields = [["currentVersion", "Current version"], ["productionVersion", "Production version"]] as const;

export function EditProjectForm({ project }: { project: EditableProject }) {
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
      const result = await updateProjectContent(data);
      if (!result.ok) { setError(t(result.error)); return; }
      setMessage(t("Project updated."));
      router.refresh();
    } catch {
      setError(t("Could not confirm the save. Check the project before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="workspace-panel mt-8 space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("Edit project")}</h2>
      <input type="hidden" name="projectId" value={project.id} />
      <label className="block text-sm font-medium">{t("Name")}
        <input name="name" defaultValue={project.name} required maxLength={200} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">{t("Slug")}
        <input name="slug" defaultValue={project.slug} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">{t("Description")}
        <textarea name="description" defaultValue={project.description} maxLength={20000} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {urlFields.map(([name, label]) => <label key={name} className="block text-sm font-medium">{t(label)}
          <input name={name} type="url" defaultValue={project[name] ?? ""} maxLength={2048} readOnly={pending} placeholder="https://" className="mt-2 w-full rounded-md border p-3" />
        </label>)}
        {versionFields.map(([name, label]) => <label key={name} className="block text-sm font-medium">{t(label)}
          <input name={name} defaultValue={project[name] ?? ""} maxLength={100} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
        </label>)}
      </div>
      <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Saving...") : t("Save project")}</button>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
