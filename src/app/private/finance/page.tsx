import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { listPrivateProjects } from "@/modules/projects/queries/project.queries";
import { CaptureFinanceForm } from "@/modules/finance/components/capture-finance-form";
import { FinanceList } from "@/modules/finance/components/finance-list";
import { ImportCsv } from "@/modules/finance/components/import-csv";
import { ImportHistory } from "@/modules/finance/components/import-history";
import { listPrivateFinanceTransactions } from "@/modules/finance/queries/finance.queries";
import { listFinanceImports } from "@/modules/finance/queries/import.queries";
import { totalsByCurrency } from "@/modules/finance/services/totals";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  if (!(await requireAuth())) redirect("/login");
  const [transactions, projects, imports] = await Promise.all([listPrivateFinanceTransactions(), listPrivateProjects(), listFinanceImports()]);
  const totals = totalsByCurrency(transactions);
  return <section>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-eyebrow">Finance OS</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your numbers, in context.</h1><p className="mt-3 text-sm leading-6 text-slate-500">A private ledger for the money moving through your work.</p></div><a href="#capture-finance" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ Record transaction</a></div>
    {totals.length > 0 && <section aria-labelledby="totals-heading" className="mb-8"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="totals-heading" className="text-lg font-semibold">Totals by currency</h2><span className="text-xs text-slate-500">{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"} · currencies are never converted</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{totals.map((total) => <div key={total.currency} className="workspace-panel p-5"><p className="text-xs font-semibold tracking-widest text-slate-500">{total.currency}</p><p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${total.netNegative ? "text-red-700" : "text-slate-900"}`}>{total.net}<span className="ml-2 text-xs font-medium text-slate-500">net</span></p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums"><div><dt className="text-slate-500">Income</dt><dd className="font-medium text-emerald-700">{total.income}</dd></div><div><dt className="text-slate-500">Expenses</dt><dd className="font-medium text-slate-700">{total.expense}</dd></div></dl></div>)}</div>
    </section>}
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="min-w-0"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Ledger</h2><span className="text-xs text-slate-500">Newest first</span></div><FinanceList transactions={transactions} projects={projects} /></div><aside id="capture-finance" className="xl:sticky xl:top-8 space-y-7"><CaptureFinanceForm projects={projects.map((project) => ({ id: project.id, name: project.name }))} /><ImportCsv /><ImportHistory imports={imports} /></aside></div>
  </section>;
}
