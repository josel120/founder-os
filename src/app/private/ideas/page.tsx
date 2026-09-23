import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { createIdeaAction } from "@/modules/ideas/actions/idea.actions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";

export default async function IdeasPage() {
  if (!auth) redirect("/login");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ideaList = await listPrivateIdeas();
  return <section><div className="mb-8"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Idea OS</p><h1 className="mt-2 text-3xl font-semibold">Ideas</h1><p className="mt-2 text-slate-600">Capture the thought before it disappears.</p></div><form action={createIdeaAction} className="mb-10 max-w-2xl space-y-4 rounded-lg border bg-white p-5 shadow-sm"><input name="title" required maxLength={160} placeholder="What is the idea?" className="w-full rounded-md border p-3" /><textarea name="description" maxLength={2000} placeholder="Optional context" className="min-h-24 w-full rounded-md border p-3" /><input type="hidden" name="source" value="OWN" /><SubmitButton /></form><div className="space-y-3">{ideaList.length === 0 ? <p className="text-slate-500">No ideas captured yet.</p> : ideaList.map((idea) => <article key={idea.id} className="rounded-lg border bg-white p-4"><div className="flex items-start justify-between gap-4"><a href={`/private/ideas/${idea.id}`} className="font-medium underline-offset-4 hover:underline">{idea.title}</a><span className="text-xs text-slate-500">{idea.status}</span></div>{idea.description && <p className="mt-2 text-sm text-slate-600">{idea.description}</p>}</article>)}</div></section>;
}
