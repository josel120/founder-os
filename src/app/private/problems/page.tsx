import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import { redirect } from "next/navigation";
import { CaptureProblemForm } from "@/modules/problems/components/capture-problem-form";
import { ProblemToIdeaButton } from "@/modules/ideas/components/problem-to-idea-button";
import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { listPrivateProblems } from "@/modules/problems/queries/problem.queries";

export const metadata: Metadata = { title: "Problems" };

export default async function ProblemsPage() {
  if (!(await requireAuth())) redirect("/login");
  const [problemList, ideas] = await Promise.all([listPrivateProblems(), listPrivateIdeas()]);
  const ideasByProblem = new Map<string, { id: string; title: string }[]>();
  for (const idea of ideas) if (idea.problemId) ideasByProblem.set(idea.problemId, [...(ideasByProblem.get(idea.problemId) ?? []), idea]);
  return <section>
    <div className="mb-8"><p className="workspace-eyebrow">Problem OS</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Problems</h1><p className="mt-3 text-sm leading-6 text-slate-500">Capture the needs worth understanding before you build anything.</p></div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">{problemList.length === 0 ? <div className="workspace-panel px-6 py-14 text-center"><h2 className="font-semibold">No problems captured yet.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Write down a problem you have seen. Turn it into ideas when you are ready.</p></div> : problemList.map((problem) => {
        const linked = ideasByProblem.get(problem.id) ?? [];
        return <article key={problem.id} id={`problem-${problem.id}`} className="workspace-panel scroll-mt-8 p-5">
          <div className="flex items-start justify-between gap-4"><h2 className="min-w-0 break-words font-semibold">{problem.title}</h2><time className="shrink-0 text-xs text-slate-500" dateTime={problem.createdAt.toISOString()}>{problem.createdAt.toISOString().slice(0, 10)}</time></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{problem.description}</p>
          {linked.length > 0 && <div className="mt-4"><p className="text-xs font-medium text-slate-500">Ideas from this problem</p><ul className="mt-2 flex flex-wrap gap-2">{linked.map((idea) => <li key={idea.id} className="min-w-0"><Link href={`/private/ideas/${idea.id}`} className="block max-w-full truncate rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{idea.title}</Link></li>)}</ul></div>}
          <ProblemToIdeaButton problemId={problem.id} />
        </article>;
      })}</div>
      <aside className="xl:sticky xl:top-8"><CaptureProblemForm /></aside>
    </div>
  </section>;
}
