import Link from "next/link";
import type { EvidenceRow } from "../queries/evidence.queries";
import { kindLabel, signalLabel } from "../services/signals";
import { EditEvidenceForm } from "./edit-evidence-form";

const signalTone = { SUPPORTS: "bg-emerald-50 text-emerald-700", CONTRADICTS: "bg-red-50 text-red-700", NEUTRAL: "bg-slate-100 text-slate-600" } as const;

type Parent = { href: string; label: string };

export function EvidenceList({ rows, parentOf, empty }: { rows: EvidenceRow[]; parentOf?: (row: EvidenceRow) => Parent | undefined; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div className="space-y-3">{rows.map((row) => {
    const parent = parentOf?.(row);
    // Only the fields the client form edits cross into the client bundle (T-037 privacy sweep).
    return <article key={row.id} className="workspace-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">{kindLabel(row.kind)}</p><h3 className="mt-1 break-words font-semibold">{row.title}</h3></div>
        <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${signalTone[row.signal]}`}>{signalLabel(row.signal)}</span><time className="text-xs text-slate-500" dateTime={row.createdAt.toISOString()}>{row.createdAt.toISOString().slice(0, 10)}</time></span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{row.summary}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {parent && <span>About <Link href={parent.href} className="font-semibold text-indigo-700 underline-offset-4 hover:underline">{parent.label}</Link></span>}
        {/* Stored, never fetched (ADR-012). nofollow keeps it from lending the workspace's reputation. */}
        {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-indigo-700 underline-offset-4 hover:underline">Source</a>}
        <span className="ml-auto">Private</span>
      </div>
      <details className="mt-2"><summary className="w-fit cursor-pointer text-sm font-medium text-indigo-700">Edit</summary><EditEvidenceForm evidence={{ id: row.id, title: row.title, summary: row.summary, kind: row.kind, signal: row.signal, sourceUrl: row.sourceUrl }} /></details>
    </article>;
  })}</div>;
}
