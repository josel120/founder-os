"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { runIdeaAssessment, runResearchSummary } from "../actions/ai.actions";

type Kind = "assessment" | "summary";

/** Starts one run at a time; the owner clicks, nothing runs on its own (ADR-021). */
export function RunAIButtons({ ideaId, disabled }: { ideaId: string; disabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState<Kind | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(kind: Kind) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(kind); setMessage(""); setError("");
    try {
      const data = new FormData();
      data.set("ideaId", ideaId);
      const result = await (kind === "assessment" ? runIdeaAssessment(data) : runResearchSummary(data));
      if (result.ok) setMessage(t(result.message)); else setError(t(result.error));
      router.refresh();
    } catch {
      setError(t("Could not reach the server. Try again."));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  const button = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-slate-500 disabled:opacity-50";
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => run("assessment")} disabled={disabled || pending !== null} className={button}>{pending === "assessment" ? t("Assessing… (up to a minute)") : t("Get an assessment")}</button>
      <button type="button" onClick={() => run("summary")} disabled={disabled || pending !== null} className={button}>{pending === "summary" ? t("Summarizing… (up to a minute)") : t("Summarize the evidence")}</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
