import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createProblem } from "@/modules/problems/actions/problem.actions";
import { listPrivateProblems } from "@/modules/problems/queries/problem.queries";

export default async function ProblemsPage() {
  if (!auth) redirect("/login");
  if (!(await auth.api.getSession({ headers: await headers() }))) redirect("/login");
  const problemList = await listPrivateProblems();
  return <section><Link href="/private/ideas" className="text-sm text-slate-500 underline">← Ideas</Link><div className="mb-8 mt-8"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Problem OS</p><h1 className="mt-2 text-3xl font-semibold">Problems</h1><p className="mt-2 text-slate-600">Capture the needs worth understanding.</p></div><form action={createProblem} className="mb-10 max-w-2xl space-y-4 rounded-lg border bg-white p-5 shadow-sm"><input name="title" required maxLength={160} placeholder="What problem exists?" className="w-full rounded-md border p-3" /><textarea name="description" required maxLength={3000} placeholder="Who experiences it and why does it matter?" className="min-h-28 w-full rounded-md border p-3" /><button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">Capture problem</button></form><div className="space-y-3">{problemList.length === 0 ? <p className="text-slate-500">No problems captured yet.</p> : problemList.map((problem) => <article key={problem.id} className="rounded-lg border bg-white p-4"><h2 className="font-medium">{problem.title}</h2><p className="mt-2 text-sm text-slate-600">{problem.description}</p></article>)}</div></section>;
}
