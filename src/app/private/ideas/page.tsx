import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { CaptureIdeaForm } from "@/modules/ideas/components/capture-idea-form";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";


export default async function IdeasPage() {
  if (!auth) redirect("/login");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ideaList = await listPrivateIdeas();
  return <section><div className="mb-8"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Idea OS</p><h1 className="mt-2 text-3xl font-semibold">Ideas</h1><p className="mt-2 text-slate-600">Capture the thought before it disappears.</p></div><CaptureIdeaForm /><div className="space-y-3">{ideaList.length === 0 ? <p className="text-slate-500">No ideas captured yet.</p> : ideaList.map((idea) => <article key={idea.id} className="rounded-lg border bg-white p-4"><div className="flex items-start justify-between gap-4"><a href={`/private/ideas/${idea.id}`} className="font-medium underline-offset-4 hover:underline">{idea.title}</a><span className="text-xs text-slate-500">{idea.status}</span></div>{idea.description && <p className="mt-2 text-sm text-slate-600">{idea.description}</p>}</article>)}</div></section>;
}
