import { auth } from "@/lib/auth";
import { getPrivateIdea } from "@/modules/ideas/queries/idea.queries";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { StatusForm } from "./status-form";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!auth) redirect("/login");
  if (!(await auth.api.getSession({ headers: await headers() }))) redirect("/login");
  const { id } = await params;
  const idea = await getPrivateIdea(id);
  if (!idea || idea.visibility !== "PRIVATE") notFound();
  return <section className="max-w-2xl"><Link href="/private/ideas" className="text-sm text-slate-500 underline">← Back to ideas</Link><p className="mt-8 text-sm uppercase tracking-widest text-slate-500">Idea detail</p><h1 className="mt-2 text-3xl font-semibold">{idea.title}</h1><p className="mt-5 whitespace-pre-wrap text-slate-700">{idea.description || "No description yet."}</p><StatusForm ideaId={idea.id} initialStatus={idea.status} /></section>;
}
