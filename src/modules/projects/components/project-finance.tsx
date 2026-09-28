import Link from "next/link";
import { createTranslator, type Translate } from "@/lib/i18n/translate";
import { formatAmount, totalsByCurrency } from "@/modules/finance/services/totals";

type Transaction = { id: string; type: "INCOME" | "EXPENSE"; category: string; amount: string; currency: string; occurredAt: Date };

/** The money linked to a project, with exact per-currency totals. Rows come from the owner-scoped finance query. */
export function ProjectFinance({ transactions, t = createTranslator(null) }: { transactions: Transaction[]; t?: Translate }) {
  const totals = totalsByCurrency(transactions);
  return <section aria-labelledby="project-finance-heading" className="mt-12 space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="project-finance-heading" className="text-xl font-semibold tracking-tight">{t("Finance")}</h2><Link href="/private/finance" className="text-sm font-semibold text-indigo-700">{t("Record a transaction")}</Link></div>
    {transactions.length === 0 ? <p className="text-sm text-slate-500">{t("No transactions linked to this project yet.")}</p> : <>
      <div className="grid gap-3 sm:grid-cols-2">{totals.map((total) => <div key={total.currency} className="workspace-panel p-4"><p className="text-xs font-semibold tracking-widest text-slate-500">{total.currency}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${total.netNegative ? "text-red-700" : "text-slate-900"}`}>{total.net} <span className="text-xs font-medium text-slate-500">{t("net")}</span></p><p className="mt-1 text-xs text-slate-500 tabular-nums">{t("Income")} {total.income} · {t("Expenses")} {total.expense}</p></div>)}</div>
      <ul className="workspace-panel divide-y divide-slate-100">{transactions.map((transaction) => <li key={transaction.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm"><span className="min-w-0 break-words text-slate-600">{transaction.type === "INCOME" ? t("Income") : t("Expense")} · {transaction.category}</span><span className="flex items-baseline gap-3"><span className={`font-semibold tabular-nums ${transaction.type === "INCOME" ? "text-emerald-700" : "text-slate-900"}`}>{transaction.type === "INCOME" ? "+" : "−"}{formatAmount(transaction.amount)} {transaction.currency}</span><time className="text-xs text-slate-500" dateTime={transaction.occurredAt.toISOString()}>{transaction.occurredAt.toISOString().slice(0, 10)}</time></span></li>)}</ul>
    </>}
  </section>;
}
