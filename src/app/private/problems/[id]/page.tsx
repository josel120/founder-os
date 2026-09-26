import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { ProblemToIdeaButton } from "@/modules/ideas/components/problem-to-idea-button";
import { listIdeasForProblem } from "@/modules/ideas/queries/idea.queries";
import { statusLabel } from "@/modules/ideas/services/inbox";
import { EditProblemForm } from "@/modules/problems/components/edit-problem-form";
import { getPrivateProblem } from "@/modules/problems/queries/problem.queries";
import { CaptureEvidenceForm } from "@/modules/research/components/capture-evidence-form";
import { EvidenceList } from "@/modules/research/components/evidence-list";
import { listEvidenceForProblem } from "@/modules/research/queries/evidence.queries";
import { summarizeSignals } from "@/modules/research/services/signals";

// Generic on purpose: private titles never go into metadata.
export const metadata: Metadata = { title: "Problem" };

export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const { id } = await params;
  const problem = await getPrivateProblem(id);
  if (!problem) notFound();
  const [ideas, evidenceRows] = await Promise.all([listIdeasForProblem(problem.id), listEvidenceForProblem(problem.id)]);
  const signals = summarizeSignals(evidenceRows);
  return <section className="max-w-2xl"><Link href="/private/problems" className="text-sm text-slate-500 underline">← Back to problems</Link>
    <p className="mt-8 text-sm uppercase tracking-widest text-slate-500">Problem detail</p>
    <h1 className="mt-2 break-words text-3xl font-semibold">{problem.title}</h1>
    <p className="mt-5 whitespace-pre-wrap break-words text-slate-700">{problem.description}</p>
    <ProblemToIdeaButton problemId={problem.id} />
    <EditProblemForm problemId={problem.id} initialTitle={problem.title} initialDescription={problem.description} />
    <section aria-labelledby="ideas-heading" className="mt-12 space-y-4"><h2 id="ideas-heading" className="text-xl font-semibold tracking-tight">Ideas from this problem</h2>
      {ideas.length === 0 ? <p className="text-sm text-slate-500">No ideas yet. Turn this problem into one when you are ready.</p> : <ul className="space-y-2">{ideas.map((idea) => <li key={idea.id} className="workspace-panel flex items-center justify-between gap-3 px-5 py-3"><Link href={`/private/ideas/${idea.id}`} className="min-w-0 break-words font-medium hover:text-indigo-700">{idea.title}</Link><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{statusLabel(idea.status)}</span></li>)}</ul>}
    </section>
    <section aria-labelledby="evidence-heading" className="mt-12 space-y-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="evidence-heading" className="text-xl font-semibold tracking-tight">Evidence</h2><p className="text-sm text-slate-500 tabular-nums"><span className="font-medium text-emerald-700">{signals.supports} supports</span> · <span className="font-medium text-red-700">{signals.contradicts} contradicts</span> · {signals.neutral} neutral</p></div><EvidenceList rows={evidenceRows} empty="No evidence about this problem yet." /><CaptureEvidenceForm fixedParent={{ value: `problem:${problem.id}`, label: problem.title }} /></section>
  </section>;
}
