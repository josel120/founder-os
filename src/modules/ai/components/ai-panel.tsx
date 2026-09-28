"use client";

import { useT } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/translate";
import type { AIRunView } from "../queries/ai.queries";
import { RunAIButtons } from "./run-ai-buttons";

const recommendationLabel: Record<string, string> = { CONTINUE: "Continue", INVESTIGATE_MORE: "Investigate more", PAUSE: "Pause", REJECT: "Reject" };
const errorText: Record<string, string> = {
  unauthorized: "The AI provider refused the API key.",
  rate_limited: "The AI provider's rate limit was reached.",
  unavailable: "The provider did not answer or returned an error.",
  invalid_output: "The answer did not have the expected shape, so it was not kept.",
  too_large: "The notes were too long to send.",
  interrupted: "The run was interrupted before it finished.",
};
const stamp = (value: Date) => `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul></div>;
}

function RunBody({ run, t }: { run: AIRunView; t: Translate }) {
  if (run.status === "RUNNING") return <p className="text-sm text-slate-600">{t("Running…")}</p>;
  if (run.status === "FAILED") return <p className="text-sm text-amber-800">{t(errorText[run.error ?? ""] ?? errorText.unavailable!)}</p>;
  if (!run.output) return <p className="text-sm text-slate-600">{t("This answer can no longer be shown.")}</p>;
  // Plain text only: model output is never rendered as HTML or Markdown (ADR-021).
  if (run.kind === "ASSESSMENT") {
    const output = run.output;
    return <div className="space-y-3 text-sm text-slate-700">
      <p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">{t("Suggests: {recommendation}", { recommendation: t(recommendationLabel[output.recommendation]!) })}</span></p>
      <p className="whitespace-pre-wrap break-words">{output.rationale}</p>
      <List title={t("Risks")} items={output.risks} />
      <List title={t("Open questions")} items={output.openQuestions} />
    </div>;
  }
  const output = run.output;
  return <div className="space-y-3 text-sm text-slate-700">
    <p className="whitespace-pre-wrap break-words">{output.overview}</p>
    <List title={t("Supported")} items={output.supports} />
    <List title={t("Contradicted")} items={output.contradicts} />
    <List title={t("Still open")} items={output.openQuestions} />
  </div>;
}

/**
 * ADR-021: an AI second opinion on one idea. Runs only on the owner's click; the disclosure says what is sent and to
 * whom. Nothing here changes the idea: the owner records any decision in the Decisions section.
 */
export function AIPanel({ ideaId, status, runs }: { ideaId: string; status: { configured: boolean; provider: string; used: number; limit: number }; runs: AIRunView[] }) {
  const t = useT();
  const left = Math.max(0, status.limit - status.used);
  return <section aria-labelledby="ai-heading" className="workspace-panel mt-12 space-y-4 p-6">
    <h2 id="ai-heading" className="text-xl font-semibold tracking-tight">{t("AI second opinion")}</h2>
    <p className="text-sm text-slate-600">{t("Runs only when you click. It sends this idea's title, description, status and source, its problem, and up to 50 evidence titles and summaries to {provider}. Nothing else: no links, decisions, projects or finance. It suggests; you decide.", { provider: status.provider })}</p>
    {!status.configured
      ? <p className="text-sm text-slate-600">{t("AI is not connected yet: set")} <code>GROQ_API_KEY</code> {t("(see task T-102).")}</p>
      : <>
        <RunAIButtons ideaId={ideaId} disabled={left === 0} />
        <p className="text-xs text-slate-500 tabular-nums">{t("{used} of {limit} runs used today (UTC).", { used: status.used, limit: status.limit })}{left === 0 && ` ${t("The limit resets at 00:00 UTC.")}`}</p>
      </>}
    {runs.length > 0 && <ol aria-label={t("Past AI runs")} className="space-y-4">
      {runs.map((run) => <li key={run.id} className="rounded-lg border border-slate-200 p-4">
        <article aria-labelledby={`ai-run-${run.id}`} className="space-y-2">
          <h3 id={`ai-run-${run.id}`} className="text-sm font-semibold">{run.kind === "ASSESSMENT" ? t("Assessment") : t("Research summary")} · <time dateTime={run.createdAt.toISOString()}>{stamp(run.createdAt)}</time></h3>
          <p className="text-xs text-slate-500">{run.model}</p>
          <RunBody run={run} t={t} />
        </article>
      </li>)}
    </ol>}
    {runs.some((run) => run.status === "SUCCEEDED") && <p className="text-sm"><a href="#decisions" className="font-medium text-indigo-700 underline-offset-4 hover:underline">{t("Record a decision")}</a></p>}
  </section>;
}
