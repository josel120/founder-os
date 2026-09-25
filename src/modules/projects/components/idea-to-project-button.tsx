"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectFromIdea } from "../actions/project.actions";

export function IdeaToProjectButton({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const data = new FormData();
    data.set("ideaId", ideaId);
    try {
      const result = await createProjectFromIdea(data);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/private/projects/${result.projectId}`);
    } catch {
      setError("Could not confirm the project was created. Check your projects before retrying.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <div className="mt-5"><button type="button" onClick={convert} disabled={pending} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">{pending ? "Creating..." : "Turn into project"}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
