import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { CaptureIdeaForm } from "@/modules/ideas/components/capture-idea-form";
import { filterInbox, inboxStatuses, statusLabel, summarizeInbox } from "@/modules/ideas/services/inbox";

export const metadata: Metadata = { title: "Ideas" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const query = z.string().max(160).catch("").parse(params.q ?? "");
  const status = z.enum(inboxStatuses).or(z.literal("")).catch("").parse(params.status ?? "");
  const ideas = await listPrivateIdeas();
  const filtered = filterInbox(ideas, query, status);
  const summary = summarizeInbox(ideas);
  return <section>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-eyebrow">From a thought to a possibility</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your ideas, with room to grow.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Capture freely. Explore thoughtfully. Decide what deserves your time.</p></div><a href="#capture-idea" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ New idea</a></div>
    <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-5">{[{ label: "All ideas", value: summary.total, note: "Your collection" }, { label: "Inbox", value: summary.inbox, note: "Awaiting a first look" }, { label: "In exploration", value: summary.exploring, note: "Research to planning" }].map((item) => <div key={item.label} className="workspace-panel p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p><p className="mt-2 hidden text-xs text-slate-500 sm:block">{item.note}</p></div>)}</div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Idea collection</h2><span className="text-xs text-slate-500">Newest first</span></div>
        <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
          <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Search<input name="q" defaultValue={query} maxLength={160} placeholder="Search your ideas..." className="mt-2 w-full rounded-xl border px-4 py-3 text-sm" /></label>
          <label className="text-xs font-medium text-slate-600">Status<select name="status" defaultValue={status} className="mt-2 block rounded-xl border px-3 py-3 text-sm"><option value="">All statuses</option>{inboxStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50">Filter</button>
        </form>
        <p className="mb-4 text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? "idea" : "ideas"}{query || status ? " matching your filters" : " in your workspace"}</p>
        <div className="space-y-3">{filtered.map((idea) => <article key={idea.id} className="workspace-panel p-5 transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-4"><h3 className="min-w-0 break-words font-semibold"><Link href={`/private/ideas/${idea.id}`} className="hover:text-indigo-700">{idea.title}</Link></h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${idea.status === "INBOX" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(idea.status)}</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{idea.description || "A starting point. Add more context as you explore."}</p><div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{statusLabel(idea.source)}</span><span>Private</span><time className="ml-auto" dateTime={idea.createdAt.toISOString()}>{idea.createdAt.toISOString().slice(0, 10)}</time></div></article>)}</div>
        {filtered.length === 0 && <div className="workspace-panel px-6 py-14 text-center"><div aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">+</div><h3 className="font-semibold">{ideas.length ? "No matching ideas" : "Every product starts with a thought."}</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{ideas.length ? "Try a different search or clear your filters." : "Capture your first idea. It does not need to be polished or validated yet."}</p>{ideas.length > 0 && <Link href="/private/ideas" className="mt-5 inline-block text-sm font-semibold text-indigo-600">Clear filters</Link>}</div>}
      </div><aside className="xl:sticky xl:top-8"><CaptureIdeaForm /><p className="px-4 pt-4 text-xs leading-5 text-slate-500">Capture now. Research before building. Nothing here is published automatically.</p></aside>
    </div>
  </section>;
}
