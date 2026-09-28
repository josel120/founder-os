"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createFinanceTransaction } from "../actions/finance.actions";

type ProjectOption = { id: string; name: string };

export function CaptureFinanceForm({ projects }: { projects: ProjectOption[] }) {
  const t = useT();
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await createFinanceTransaction(new FormData(form));
      if (!result.ok) { setError(t(result.error)); return; }
      form.reset();
      setMessage(t("Transaction recorded privately."));
      router.refresh();
    } catch {
      setError(t("Could not confirm the save. Check your transactions before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <form onSubmit={submit} aria-busy={pending} className="workspace-panel space-y-4 p-6">
    <div><p className="workspace-eyebrow">{t("Keep the numbers visible")}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t("Record a transaction")}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t("Manual entries stay private and can be linked to one of your projects.")}</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">{t("Type")}
        <select name="type" defaultValue="EXPENSE" disabled={pending} className="mt-2 block w-full rounded-md border p-3"><option value="EXPENSE">{t("Expense")}</option><option value="INCOME">{t("Transaction type::Income")}</option></select>
      </label>
      <label className="block text-sm font-medium">{t("Currency")}
        <input name="currency" defaultValue="USD" required maxLength={3} pattern="[A-Za-z]{3}" readOnly={pending} className="mt-2 w-full rounded-md border p-3 uppercase" />
      </label>
    </div>
    <label className="block text-sm font-medium">{t("Amount")}
      <input name="amount" required inputMode="decimal" pattern="\d+([.,]\d{1,4})?" placeholder="0.00" readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">{t("Category")}
      <input name="category" required maxLength={160} placeholder={t("Hosting, subscriptions, sales")} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">{t("Source")}
      <input name="source" required maxLength={200} placeholder={t("Stripe, AWS, bank")} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">{t("Occurred at")}
      <input name="occurredAt" type="datetime-local" required readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <label className="block text-sm font-medium">{t("Project (optional)")}
      <select name="projectId" defaultValue="" disabled={pending} className="mt-2 block w-full rounded-md border p-3"><option value="">{t("Unlinked transaction")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
    </label>
    <label className="block text-sm font-medium">{t("External ID (optional)")}
      <input name="externalId" maxLength={200} readOnly={pending} className="mt-2 w-full rounded-md border p-3" />
    </label>
    <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" type="submit">{pending ? t("Saving...") : t("Record transaction")}</button>
    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
