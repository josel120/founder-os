"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createIdeaFromProblem } from "../actions/idea.actions";

export function ProblemToIdeaButton({ problemId }: { problemId: string }) {
  const router = useRouter();
  const t = useT();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setError("");
    const data = new FormData();
    data.set("problemId", problemId);
    try {
      const result = await createIdeaFromProblem(data);
      if (!result.ok) { setError(t(result.error)); return; }
      router.push(`/private/ideas/${result.ideaId}`);
    } catch {
      setError(t("Could not confirm the idea was created. Check your ideas before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={convert} disabled={pending} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
        {pending ? t("Creating...") : t("Turn into idea")}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
