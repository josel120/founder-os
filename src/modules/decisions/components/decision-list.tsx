import Link from "next/link";
import { createTranslator, type Translate } from "@/lib/i18n/translate";

type Decision = { id: string; title: string; decision: string; reason: string; createdAt: Date; context?: { href: string; label: string } };

// `t` is optional so component tests can render it without a request; pages pass the viewer's translator.
export function DecisionList({ decisions, empty, t = createTranslator(null) }: { decisions: Decision[]; empty: string; t?: Translate }) {
  if (decisions.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div className="space-y-3">{decisions.map((item) => <article key={item.id} className="workspace-panel p-5">
    <div className="flex items-start justify-between gap-4"><h3 className="min-w-0 break-words font-semibold">{item.title}</h3><time className="shrink-0 text-xs text-slate-500" dateTime={item.createdAt.toISOString()}>{item.createdAt.toISOString().slice(0, 10)}</time></div>
    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{item.decision}</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500"><span className="font-medium">{t("Why:")} </span>{item.reason}</p>
    {item.context && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{t("About")} <Link href={item.context.href} className="font-semibold text-indigo-700 underline-offset-4 hover:underline">{item.context.label}</Link></p>}
  </article>)}</div>;
}
