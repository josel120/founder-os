import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import { redirect } from "next/navigation";
import { CaptureProblemForm } from "@/modules/problems/components/capture-problem-form";
import { listPrivateProblems } from "@/modules/problems/queries/problem.queries";

export default async function ProblemsPage() {
  if (!(await requireAuth())) redirect("/login");
  const problemList = await listPrivateProblems();
  return <section><Link href="/private/ideas" className="text-sm text-slate-500 underline">← Ideas</Link><div className="mb-8 mt-8"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Problem OS</p><h1 className="mt-2 text-3xl font-semibold">Problems</h1><p className="mt-2 text-slate-600">Capture the needs worth understanding.</p></div><CaptureProblemForm /><div className="space-y-3">{problemList.length === 0 ? <p className="text-slate-500">No problems captured yet.</p> : problemList.map((problem) => <article key={problem.id} className="rounded-lg border bg-white p-4"><h2 className="font-medium">{problem.title}</h2><p className="mt-2 text-sm text-slate-600">{problem.description}</p></article>)}</div></section>;
}
