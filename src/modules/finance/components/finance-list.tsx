import type { financeTransactions, projects } from "@/db/schema";

type Transaction = typeof financeTransactions.$inferSelect;
type Project = typeof projects.$inferSelect;

export function FinanceList({ transactions, projects }: { transactions: Transaction[]; projects: Project[] }) {
  const names = new Map(projects.map((project) => [project.id, project.name]));
  if (transactions.length === 0) return <div className="workspace-panel px-6 py-14 text-center"><div aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">$</div><h2 className="font-semibold">No transactions yet.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Record the first income or expense to start your private ledger.</p></div>;
  return <div className="space-y-3">{transactions.map((transaction) => <article key={transaction.id} className="workspace-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-widest text-slate-400">{transaction.type === "INCOME" ? "Income" : "Expense"} · {transaction.category}</p><h2 className="mt-2 text-lg font-semibold">{transaction.amount} {transaction.currency}</h2></div><time className="text-sm text-slate-500" dateTime={transaction.occurredAt.toISOString()}>{transaction.occurredAt.toISOString().slice(0, 10)}</time></div><div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{transaction.source}</span>{transaction.projectId && <span>Project: {names.get(transaction.projectId) ?? "Linked project"}</span>}{transaction.externalId && <span>External ID: {transaction.externalId}</span>}<span className="ml-auto">Private</span></div></article>)}</div>;
}
