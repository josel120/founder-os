import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateIdeas } from "@/modules/ideas/queries/idea.queries";
import { listPrivateProblems } from "@/modules/problems/queries/problem.queries";
import { CaptureEvidenceForm } from "@/modules/research/components/capture-evidence-form";
import { EvidenceList } from "@/modules/research/components/evidence-list";
import { listPrivateEvidence } from "@/modules/research/queries/evidence.queries";
import { evidenceKinds, evidenceSignals } from "@/modules/research/schemas/evidence.limits";
import { evidenceFilterSchema } from "@/modules/research/schemas/evidence.schema";
import { kindLabel, signalLabel, summarizeSignals } from "@/modules/research/services/signals";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Research") };
}

export default async function ResearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await requireAuth())) redirect("/login");
  const t = await getT();
  const params = await searchParams;
  const filter = evidenceFilterSchema.parse({ kind: params.kind || undefined, signal: params.signal || undefined });
  const filtered = Boolean(filter.kind || filter.signal);
  const [all, problems, ideas] = await Promise.all([listPrivateEvidence(), listPrivateProblems(), listPrivateIdeas()]);
  const rows = filtered ? await listPrivateEvidence(filter) : all;
  const summary = summarizeSignals(all);
  // Parent names come from the owner's own lists, so a link only points at a record the owner can open.
  const problemNames = new Map(problems.map((problem) => [problem.id, problem.title]));
  const ideaNames = new Map(ideas.map((idea) => [idea.id, idea.title]));
  const parentOf = (row: { ideaId: string | null; problemId: string | null }) => {
    if (row.ideaId && ideaNames.has(row.ideaId)) return { href: `/private/ideas/${row.ideaId}`, label: t("Idea: {name}", { name: ideaNames.get(row.ideaId)! }) };
    if (row.problemId && problemNames.has(row.problemId)) return { href: `/private/problems/${row.problemId}`, label: t("Problem: {name}", { name: problemNames.get(row.problemId)! }) };
    return undefined;
  };
  return <section>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-eyebrow">{t("Research OS")}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("Evidence, before you build.")}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{t("What interviews, markets and competitors tell you about each problem and idea. You decide what it means.")}</p></div><a href="#capture-evidence" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">{t("+ Record evidence")}</a></div>
    <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-5">{[{ label: t("All evidence"), value: summary.total, tone: "" }, { label: t("Supports"), value: summary.supports, tone: "text-emerald-700" }, { label: t("Contradicts"), value: summary.contradicts, tone: "text-red-700" }].map((item) => <div key={item.label} className="workspace-panel p-4 sm:p-5"><p className="text-xs font-medium text-slate-500">{item.label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${item.tone}`}>{item.value}</p></div>)}</div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <form className="mb-5 flex flex-wrap items-end gap-3" method="get" aria-label={t("Filter evidence")}>
          <label className="text-xs font-medium text-slate-600">{t("Kind")}<select name="kind" defaultValue={filter.kind ?? ""} className="mt-2 block rounded-xl border px-3 py-3 text-sm"><option value="">{t("All kinds")}</option>{evidenceKinds.map((kind) => <option key={kind} value={kind}>{t(kindLabel(kind))}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-600">{t("Signal")}<select name="signal" defaultValue={filter.signal ?? ""} className="mt-2 block rounded-xl border px-3 py-3 text-sm"><option value="">{t("All signals")}</option>{evidenceSignals.map((signal) => <option key={signal} value={signal}>{t(signalLabel(signal))}</option>)}</select></label>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50">{t("Filter")}</button>
          {filtered && <Link href="/private/research" className="py-3 text-sm font-semibold text-indigo-700">{t("Clear filters")}</Link>}
        </form>
        <p className="mb-4 text-xs text-slate-500">{rows.length} {t(rows.length === 1 ? "record" : "records")}{filtered ? t(" matching your filters") : t(" in your workspace")}</p>
        <EvidenceList rows={rows} parentOf={parentOf} empty={filtered ? t("No evidence matches these filters.") : t("No evidence yet. Record what you learn about a problem or idea.")} t={t} />
      </div>
      <aside className="xl:sticky xl:top-8"><CaptureEvidenceForm parents={{ problems: problems.map((problem) => ({ value: `problem:${problem.id}`, label: problem.title })), ideas: ideas.map((idea) => ({ value: `idea:${idea.id}`, label: idea.title })) }} /></aside>
    </div>
  </section>;
}
