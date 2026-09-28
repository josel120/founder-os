"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { undoFinanceImport } from "../actions/import.actions";
import type { FinanceImportSummary } from "../queries/import.queries";

export function ImportHistory({ imports }: { imports: FinanceImportSummary[] }) {
  const t = useT();
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function undo(importId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const formData = new FormData();
      formData.set("importId", importId);
      const result = await undoFinanceImport(formData);
      if (!result.ok) { setError(t(result.error)); return; }
      setMessage(t(result.removed === 1 ? "Removed {count} transaction." : "Removed {count} transactions.", { count: result.removed }));
      setConfirmingId(null);
      router.refresh();
    } catch {
      setError(t("Could not confirm the undo. Check your transactions before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (imports.length === 0) return null;

  return <div className="workspace-panel space-y-4 p-6" aria-busy={pending}>
    <div><p className="workspace-eyebrow">{t("Past imports")}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t("Import history")}</h2></div>
    <ul className="space-y-3">
      {imports.map((imp) => <li key={imp.id} className="rounded-lg border p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="break-words font-medium">{imp.fileName}</p><p className="mt-1 text-xs text-slate-500">{imp.createdAt.toISOString().slice(0, 10)} · {t("{imported} imported, {skipped} skipped", { imported: imp.importedCount, skipped: imp.skippedCount })}</p></div>
          {confirmingId !== imp.id && <button disabled={pending} type="button" onClick={() => setConfirmingId(imp.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700">{t("Undo")}</button>}
        </div>
        {confirmingId === imp.id && <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium">{t("Remove the {count} transactions from this import?", { count: imp.importedCount })}</p>
          <div className="flex gap-2">
            <button disabled={pending} type="button" onClick={() => undo(imp.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? t("Removing...") : t("Confirm")}</button>
            <button disabled={pending} type="button" onClick={() => setConfirmingId(null)} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700">{t("Cancel")}</button>
          </div>
        </div>}
      </li>)}
    </ul>
    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
