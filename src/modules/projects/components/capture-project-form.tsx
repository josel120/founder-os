"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "../actions/project.actions";

export function CaptureProjectForm() {
  const router = useRouter();
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
      const result = await createProject(data);
      if (!result.ok) { setError(result.error); return; }
      form.reset();
      setMessage("Project created privately.");
      router.refresh();
    } catch {
      setError("Could not confirm the save. Check your projects before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form id="capture-project" onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
      <div><p className="workspace-eyebrow">Commit to building</p><h2 className="mt-2 text-xl font-semibold tracking-tight">New project</h2><p className="mt-2 text-sm leading-6 text-slate-500">Starts in Planning. Add links and versions later.</p></div>
      <label className="block text-sm font-medium">Name
        <input name="name" required maxLength={200} readOnly={pending} placeholder="What are you building?" className="mt-2 w-full rounded-md border p-3" />
      </label>
      <label className="block text-sm font-medium">Slug
        <input name="slug" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={pending} placeholder="my-project" className="mt-2 w-full rounded-md border p-3" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Lowercase letters, numbers and single hyphens.</span>
      </label>
      <label className="block text-sm font-medium">Description (optional)
        <textarea name="description" maxLength={20000} readOnly={pending} className="mt-2 min-h-24 w-full rounded-md border p-3" />
      </label>
      <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? "Saving..." : "+ Create project"}</button>
      <p className="text-xs text-slate-500">Private by default · Planning</p>
      <p role="status" className="text-sm text-green-700">{message}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
