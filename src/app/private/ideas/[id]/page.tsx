import { requireAuth } from "@/lib/require-auth";
import { getPrivateIdea } from "@/modules/ideas/queries/idea.queries";
import { getPrivateProblem } from "@/modules/problems/queries/problem.queries";
import { listDecisionsForIdea } from "@/modules/decisions/queries/decision.queries";
import { CaptureDecisionForm } from "@/modules/decisions/components/capture-decision-form";
import { DecisionList } from "@/modules/decisions/components/decision-list";
import { EditIdeaForm } from "@/modules/ideas/components/edit-idea-form";
import { IdeaToProjectButton } from "@/modules/projects/components/idea-to-project-button";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { StatusForm } from "./status-form";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const { id } = await params;
  const idea = await getPrivateIdea(id);
  if (!idea || idea.visibility !== "PRIVATE") notFound();
  const [problem, decisions] = await Promise.all([
    idea.problemId ? getPrivateProblem(idea.problemId) : null,
    listDecisionsForIdea(idea.id),
  ]);
  return <section className="max-w-2xl"><Link href="/private/ideas" className="text-sm text-slate-500 underline">← Back to ideas</Link><p className="mt-8 text-sm uppercase tracking-widest text-slate-500">Idea detail</p><h1 className="mt-2 text-3xl font-semibold">{idea.title}</h1>{problem && <p className="mt-3 text-sm text-slate-500">From problem: <Link href="/private/problems" className="font-medium text-indigo-700 underline-offset-4 hover:underline">{problem.title}</Link></p>}<p className="mt-5 whitespace-pre-wrap text-slate-700">{idea.description || "No description yet."}</p><IdeaToProjectButton ideaId={idea.id} /><EditIdeaForm ideaId={idea.id} initialTitle={idea.title} initialDescription={idea.description} /><StatusForm ideaId={idea.id} initialStatus={idea.status} />
    <div className="mt-12 space-y-5"><h2 className="text-xl font-semibold tracking-tight">Decisions</h2><DecisionList decisions={decisions} empty="No decisions about this idea yet." /><CaptureDecisionForm ideaId={idea.id} /></div>
  </section>;
}
