"use client";

import { useT } from "@/lib/i18n/client";
import type { listPrivateFinanceTransactions } from "../queries/finance.queries";
import { formatAmount } from "../services/totals";

type Transaction = Awaited<ReturnType<typeof listPrivateFinanceTransactions>>[number];
type Project = { id: string; name: string };

export function FinanceList({ transactions, projects }: { transactions: Transaction[]; projects: Project[] }) {
  const t = useT();
  const names = new Map(projects.map((project) => [project.id, project.name]));
  if (transactions.length === 0) return <div className="workspace-panel px-6 py-14 text-center"><div aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">$</div><h2 className="font-semibold">{t("No transactions yet.")}</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{t("Record the first income or expense to start your private ledger.")}</p></div>;
  return <div className="space-y-3">{transactions.map((transaction) => {
    const income = transaction.type === "INCOME";
    return <article key={transaction.id} className="workspace-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs font-medium uppercase tracking-widest text-slate-500">{income ? t("Transaction type::Income") : t("Expense")} · {transaction.category}</p><h2 className={`mt-2 text-lg font-semibold tabular-nums ${income ? "text-emerald-700" : "text-slate-900"}`}><span className="sr-only">{income ? t("Income of ") : t("Expense of ")}</span><span aria-hidden="true">{income ? "+" : "−"}</span>{formatAmount(transaction.amount)} {transaction.currency}</h2></div><time className="text-sm text-slate-500" dateTime={transaction.occurredAt.toISOString()}>{transaction.occurredAt.toISOString().slice(0, 10)}</time></div><div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500"><span className="break-words">{transaction.source}</span>{transaction.projectId && <span>{t("Project: {name}", { name: names.get(transaction.projectId) ?? t("Linked project") })}</span>}{transaction.externalId && <span className="break-all">{t("External ID: {id}", { id: transaction.externalId })}</span>}<span className="ml-auto">{t("Private")}</span></div></article>;
  })}</div>;
}
