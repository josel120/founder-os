import type { Metadata } from "next";
import { requireAuth } from "@/lib/require-auth";
import { getPrivateIdea } from "@/modules/ideas/queries/idea.queries";
import { inboxStatuses, statusLabel } from "@/modules/ideas/services/inbox";
import { getPrivateProblem } from "@/modules/problems/queries/problem.queries";
import { listDecisionsForIdea } from "@/modules/decisions/queries/decision.queries";
import { findPrivateProjectForIdea } from "@/modules/projects/queries/project.queries";
import { CaptureEvidenceForm } from "@/modules/research/components/capture-evidence-form";
import { EvidenceList } from "@/modules/research/components/evidence-list";
import { listEvidenceForIdea } from "@/modules/research/queries/evidence.queries";
import { summarizeSignals } from "@/modules/research/services/signals";
import { CaptureDecisionForm } from "@/modules/decisions/components/capture-decision-form";
import { DecisionList } from "@/modules/decisions/components/decision-list";
import { EditIdeaForm } from "@/modules/ideas/components/edit-idea-form";
import { IdeaToProjectButton } from "@/modules/projects/components/idea-to-project-button";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { StatusForm } from "./status-form";

// Generic on purpose: private titles never go into metadata.
export const metadata: Metadata = { title: "Idea" };

const statusOptions = inboxStatuses.map((value) => ({ value, label: statusLabel(value) }));

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const { id } = await params;
  const idea = await getPrivateIdea(id);
  if (!idea) notFound();
  const [problem, decisions, project, evidenceRows] = await Promise.all([
    idea.problemId ? getPrivateProblem(idea.problemId) : null,
    listDecisionsForIdea(idea.id),
    findPrivateProjectForIdea(idea.id),
    listEvidenceForIdea(idea.id),
  ]);
  const signals = summarizeSignals(evidenceRows);
  return <section className="max-w-2xl"><Link href="/private/ideas" className="text-sm text-slate-500 underline">← Back to ideas</Link><p className="mt-8 text-sm uppercase tracking-widest text-slate-500">Idea detail</p><h1 className="mt-2 break-words text-3xl font-semibold">{idea.title}</h1>{problem && <p className="mt-3 text-sm text-slate-500">From problem: <Link href={`/private/problems#problem-${problem.id}`} className="font-medium text-indigo-700 underline-offset-4 hover:underline">{problem.title}</Link></p>}<p className="mt-5 whitespace-pre-wrap break-words text-slate-700">{idea.description || "No description yet."}</p>
    {project ? <p className="mt-5 text-sm text-slate-600">Became a project: <Link href={`/private/projects/${project.id}`} className="font-semibold text-indigo-700 underline-offset-4 hover:underline">{project.name}</Link></p> : <IdeaToProjectButton ideaId={idea.id} />}
    <EditIdeaForm ideaId={idea.id} initialTitle={idea.title} initialDescription={idea.description} /><StatusForm ideaId={idea.id} initialStatus={idea.status} options={statusOptions} />
    <section aria-labelledby="evidence-heading" className="mt-12 space-y-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="evidence-heading" className="text-xl font-semibold tracking-tight">Evidence</h2><p className="text-sm text-slate-500 tabular-nums"><span className="font-medium text-emerald-700">{signals.supports} supports</span> · <span className="font-medium text-red-700">{signals.contradicts} contradicts</span> · {signals.neutral} neutral</p></div><EvidenceList rows={evidenceRows} empty="No evidence about this idea yet." /><CaptureEvidenceForm fixedParent={{ value: `idea:${idea.id}`, label: idea.title }} /></section>
    <div className="mt-12 space-y-5"><h2 className="text-xl font-semibold tracking-tight">Decisions</h2><DecisionList decisions={decisions} empty="No decisions about this idea yet." /><CaptureDecisionForm ideaId={idea.id} /></div>
  </section>;
}
