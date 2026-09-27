import type { AIRunView } from "../queries/ai.queries";
import { RunAIButtons } from "./run-ai-buttons";

const recommendationLabel: Record<string, string> = { CONTINUE: "Continue", INVESTIGATE_MORE: "Investigate more", PAUSE: "Pause", REJECT: "Reject" };
const errorText: Record<string, string> = {
  unauthorized: "Anthropic refused the API key.",
  rate_limited: "Anthropic's rate limit was reached.",
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

function RunBody({ run }: { run: AIRunView }) {
  if (run.status === "RUNNING") return <p className="text-sm text-slate-600">Running…</p>;
  if (run.status === "FAILED") return <p className="text-sm text-amber-800">{errorText[run.error ?? ""] ?? errorText.unavailable}</p>;
  if (!run.output) return <p className="text-sm text-slate-600">This answer can no longer be shown.</p>;
  // Plain text only: model output is never rendered as HTML or Markdown (ADR-021).
  if (run.kind === "ASSESSMENT") {
    const output = run.output;
    return <div className="space-y-3 text-sm text-slate-700">
      <p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">Suggests: {recommendationLabel[output.recommendation]}</span></p>
      <p className="whitespace-pre-wrap break-words">{output.rationale}</p>
      <List title="Risks" items={output.risks} />
      <List title="Open questions" items={output.openQuestions} />
    </div>;
  }
  const output = run.output;
  return <div className="space-y-3 text-sm text-slate-700">
    <p className="whitespace-pre-wrap break-words">{output.overview}</p>
    <List title="Supported" items={output.supports} />
    <List title="Contradicted" items={output.contradicts} />
    <List title="Still open" items={output.openQuestions} />
  </div>;
}

/**
 * ADR-021: an AI second opinion on one idea. Runs only on the owner's click; the disclosure says what is sent and to
 * whom. Nothing here changes the idea: the owner records any decision in the Decisions section.
 */
export function AIPanel({ ideaId, status, runs }: { ideaId: string; status: { configured: boolean; used: number; limit: number }; runs: AIRunView[] }) {
  const left = Math.max(0, status.limit - status.used);
  return <section aria-labelledby="ai-heading" className="workspace-panel mt-12 space-y-4 p-6">
    <h2 id="ai-heading" className="text-xl font-semibold tracking-tight">AI second opinion</h2>
    <p className="text-sm text-slate-600">Runs only when you click. It sends this idea&apos;s title, description, status and source, its problem, and up to 50 evidence titles and summaries to Anthropic. Nothing else: no links, decisions, projects or finance. It suggests; you decide.</p>
    {!status.configured
      ? <p className="text-sm text-slate-600">AI is not connected yet: set <code>ANTHROPIC_API_KEY</code> (see task T-085).</p>
      : <>
        <RunAIButtons ideaId={ideaId} disabled={left === 0} />
        <p className="text-xs text-slate-500 tabular-nums">{status.used} of {status.limit} runs used today (UTC).{left === 0 && " The limit resets at 00:00 UTC."}</p>
      </>}
    {runs.length > 0 && <ol aria-label="Past AI runs" className="space-y-4">
      {runs.map((run) => <li key={run.id} className="rounded-lg border border-slate-200 p-4">
        <article aria-labelledby={`ai-run-${run.id}`} className="space-y-2">
          <h3 id={`ai-run-${run.id}`} className="text-sm font-semibold">{run.kind === "ASSESSMENT" ? "Assessment" : "Research summary"} · <time dateTime={run.createdAt.toISOString()}>{stamp(run.createdAt)}</time></h3>
          <p className="text-xs text-slate-500">{run.model}</p>
          <RunBody run={run} />
        </article>
      </li>)}
    </ol>}
    {runs.some((run) => run.status === "SUCCEEDED") && <p className="text-sm"><a href="#decisions" className="font-medium text-indigo-700 underline-offset-4 hover:underline">Record a decision</a></p>}
  </section>;
}
