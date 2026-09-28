"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { confirmFinanceImport, previewFinanceImport } from "../actions/import.actions";
import { IMPORT_FILE_NAME_MAX, IMPORT_MAX_BYTES } from "../schemas/import.limits";

const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"] as const;
const DECIMAL_SEPARATORS = [".", ","] as const;
const OPTIONAL = "";

type DateFormat = (typeof DATE_FORMATS)[number];
type DecimalSeparator = (typeof DECIMAL_SEPARATORS)[number];
type Step = "choose" | "map" | "preview";
type PreviewRow = { line: number; date: string; type: "INCOME" | "EXPENSE"; amount: string; currency: string; category: string };
type PreviewError = { line: number; message: string };
type MappedPreview = { newCount: number; duplicateCount: number; errorCount: number; errors: PreviewError[]; rows: PreviewRow[]; totals: { currency: string; income: string; expense: string; net: string; netNegative: boolean }[] };

type Mapping = {
  date: string;
  amount: string;
  debit: string;
  currency: { column: string } | { fixed: string };
  description: string;
  externalId: string;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  fileName: string;
};

const GUESSES: Record<"date" | "amount" | "debit" | "description" | "currency" | "externalId", RegExp> = {
  date: /^(date|fecha|booking date)$/i,
  amount: /^(amount|importe|monto|value)$/i,
  debit: /^(debit|cargo)$/i,
  description: /^(description|concepto|details|payee)$/i,
  currency: /^(currency|moneda)$/i,
  externalId: /^(id|reference|ref)$/i,
};

function guessHeader(headers: string[], pattern: RegExp) {
  return headers.find((header) => pattern.test(header.trim())) ?? "";
}

function buildMapping(headers: string[], fileName: string): Mapping {
  const currencyHeader = guessHeader(headers, GUESSES.currency);
  return {
    date: guessHeader(headers, GUESSES.date) || headers[0] || "",
    amount: guessHeader(headers, GUESSES.amount) || "",
    debit: guessHeader(headers, GUESSES.debit),
    currency: currencyHeader ? { column: currencyHeader } : { fixed: "EUR" },
    description: guessHeader(headers, GUESSES.description) || "",
    externalId: guessHeader(headers, GUESSES.externalId),
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ".",
    fileName: fileName.slice(0, IMPORT_FILE_NAME_MAX),
  };
}

function mappingPayload(mapping: Mapping) {
  const payload: Record<string, unknown> = {
    date: mapping.date,
    amount: mapping.amount,
    currency: mapping.currency,
    description: mapping.description,
    dateFormat: mapping.dateFormat,
    decimalSeparator: mapping.decimalSeparator,
    fileName: mapping.fileName,
  };
  if (mapping.debit) payload.debit = mapping.debit;
  if (mapping.externalId) payload.externalId = mapping.externalId;
  return payload;
}

export function ImportCsv() {
  const t = useT();
  const router = useRouter();
  const inFlight = useRef(false);
  const [step, setStep] = useState<Step>("choose");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [preview, setPreview] = useState<MappedPreview | null>(null);
  const [confirming, setConfirming] = useState(false);

  const currencyIsColumn = mapping ? "column" in mapping.currency : false;

  function reset() {
    setStep("choose"); setError(""); setMessage(""); setCsvText(""); setFileName("");
    setHeaders([]); setSample([]); setTotalRows(0); setMapping(null); setPreview(null); setConfirming(false);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    if (file.size > IMPORT_MAX_BYTES) { setError(t("The file is larger than 1 MB.")); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const text = await file.text();
      const formData = new FormData();
      formData.set("csv", text);
      const result = await previewFinanceImport(formData);
      if (!result.ok) { setError(t(result.error)); return; }
      setCsvText(text);
      setFileName(file.name.slice(0, IMPORT_FILE_NAME_MAX));
      setHeaders(result.headers);
      setSample(result.sample);
      setTotalRows(result.totalRows);
      setMapping(buildMapping(result.headers, file.name));
      setStep("map");
    } catch {
      setError(t("Could not read the file. Check it is a CSV export."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function submitMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !mapping) return;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const formData = new FormData();
      formData.set("csv", csvText);
      formData.set("mapping", JSON.stringify(mappingPayload(mapping)));
      const result = await previewFinanceImport(formData);
      if (!result.ok) { setError(t(result.error)); return; }
      if (!result.mapped) { setError(t("Could not preview the mapping.")); return; }
      setPreview(result.mapped);
      setStep("preview");
    } catch {
      setError(t("Could not preview the file. Check your mapping and try again."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function doImport() {
    if (inFlight.current || !mapping) return;
    inFlight.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const formData = new FormData();
      formData.set("csv", csvText);
      formData.set("mapping", JSON.stringify(mappingPayload(mapping)));
      const result = await confirmFinanceImport(formData);
      if (!result.ok) { setError(t(result.error)); return; }
      setMessage(t("Imported {imported}, skipped {skipped}.", { imported: result.imported, skipped: result.skipped }));
      setConfirming(false);
      router.refresh();
    } catch {
      setError(t("Could not confirm the import. Check your transactions before retrying."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const newCount = preview?.newCount ?? 0;

  return <div className="workspace-panel space-y-4 p-6" aria-busy={pending}>
    <div><p className="workspace-eyebrow">{t("Bring in past history")}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{t("Import from CSV")}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t("Map your export's columns, preview it, then confirm. The file itself is never stored.")}</p></div>

    {step === "choose" && <div className="space-y-3">
      <label className="block text-sm font-medium">{t("CSV file")}
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={pending} className="mt-2 block w-full text-sm" />
      </label>
    </div>}

    {step === "map" && mapping && <form onSubmit={submitMapping} className="space-y-4">
      <p className="text-sm text-slate-500">{fileName} · {t(totalRows === 1 ? "{count} row" : "{count} rows", { count: totalRows })}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">{t("Date column")}
          <select name="date" value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })} disabled={pending} required className="mt-2 w-full rounded-md border p-3">
            <option value="" disabled>{t("Choose a column")}</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Date format")}
          <select name="dateFormat" value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as DateFormat })} disabled={pending} className="mt-2 w-full rounded-md border p-3">
            {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Amount column")}
          <select name="amount" value={mapping.amount} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })} disabled={pending} required className="mt-2 w-full rounded-md border p-3">
            <option value="" disabled>{t("Choose a column")}</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Decimal separator")}
          <select name="decimalSeparator" value={mapping.decimalSeparator} onChange={(e) => setMapping({ ...mapping, decimalSeparator: e.target.value as DecimalSeparator })} disabled={pending} className="mt-2 w-full rounded-md border p-3">
            {DECIMAL_SEPARATORS.map((s) => <option key={s} value={s}>{s === "." ? t("Period (1.23)") : t("Comma (1,23)")}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Debit column (optional)")}
          <select name="debit" value={mapping.debit} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })} disabled={pending} className="mt-2 w-full rounded-md border p-3">
            <option value={OPTIONAL}>—</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Description column")}
          <select name="description" value={mapping.description} onChange={(e) => setMapping({ ...mapping, description: e.target.value })} disabled={pending} required className="mt-2 w-full rounded-md border p-3">
            <option value="" disabled>{t("Choose a column")}</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("Currency")}
          <select value={currencyIsColumn ? "column" : "fixed"} onChange={(e) => setMapping({ ...mapping, currency: e.target.value === "column" ? { column: headers[0] ?? "" } : { fixed: "EUR" } })} disabled={pending} className="mt-2 w-full rounded-md border p-3">
            <option value="fixed">{t("One fixed currency")}</option>
            <option value="column">{t("A column")}</option>
          </select>
        </label>
        {currencyIsColumn
          ? <label className="block text-sm font-medium">{t("Currency column")}
              <select value={"column" in mapping.currency ? mapping.currency.column : ""} onChange={(e) => setMapping({ ...mapping, currency: { column: e.target.value } })} disabled={pending} required className="mt-2 w-full rounded-md border p-3">
                <option value="" disabled>{t("Choose a column")}</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          : <label className="block text-sm font-medium">{t("Currency code")}
              <input value={"fixed" in mapping.currency ? mapping.currency.fixed : ""} onChange={(e) => setMapping({ ...mapping, currency: { fixed: e.target.value.toUpperCase() } })} maxLength={3} pattern="[A-Za-z]{3}" required readOnly={pending} className="mt-2 w-full rounded-md border p-3 uppercase" />
            </label>}
        <label className="block text-sm font-medium">{t("External ID column (optional)")}
          <select name="externalId" value={mapping.externalId} onChange={(e) => setMapping({ ...mapping, externalId: e.target.value })} disabled={pending} className="mt-2 w-full rounded-md border p-3">
            <option value={OPTIONAL}>—</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
      </div>

      {sample.length > 0 && <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs"><thead><tr className="border-b bg-slate-50">{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>)}</tr></thead>
          <tbody>{sample.map((row, i) => <tr key={i} className="border-b last:border-0">{row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-700">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>}

      <div className="flex gap-3">
        <button disabled={pending} type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Previewing...") : t("Preview")}</button>
        <button disabled={pending} type="button" onClick={reset} className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700">{t("Start over")}</button>
      </div>
    </form>}

    {step === "preview" && preview && <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="workspace-panel p-3"><dt className="text-xs text-slate-500">{t("New")}</dt><dd className="text-lg font-semibold tabular-nums">{preview.newCount}</dd></div>
        <div className="workspace-panel p-3"><dt className="text-xs text-slate-500">{t("Already imported")}</dt><dd className="text-lg font-semibold tabular-nums">{preview.duplicateCount}</dd></div>
        <div className="workspace-panel p-3"><dt className="text-xs text-slate-500">{t("Errors")}</dt><dd className="text-lg font-semibold tabular-nums">{preview.errorCount}</dd></div>
      </dl>

      {preview.totals.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{preview.totals.map((total) => <div key={total.currency} className="rounded-lg border p-3 text-sm"><span className="font-semibold">{total.currency}</span><span className="ml-2 tabular-nums">{t("net")} {total.net}</span></div>)}</div>}

      {preview.rows.length > 0 && <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs"><thead><tr className="border-b bg-slate-50"><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Line")}</th><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Date")}</th><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Type")}</th><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Amount")}</th><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Currency")}</th><th className="px-3 py-2 text-left font-medium text-slate-500">{t("Category")}</th></tr></thead>
          <tbody>{preview.rows.map((row) => <tr key={row.line} className="border-b last:border-0"><td className="px-3 py-2">{row.line}</td><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.type}</td><td className="px-3 py-2 tabular-nums">{row.amount}</td><td className="px-3 py-2">{row.currency}</td><td className="px-3 py-2">{row.category}</td></tr>)}</tbody>
        </table>
      </div>}

      {preview.errors.length > 0 && <ul className="space-y-1 text-xs text-red-700">{preview.errors.map((e, i) => <li key={i}>{t("Line {line}", { line: e.line })}: {t(e.message)}</li>)}</ul>}

      {!confirming && <div className="flex gap-3">
        <button disabled={pending || newCount === 0} type="button" onClick={() => setConfirming(true)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{t(newCount === 1 ? "Import {count} transaction" : "Import {count} transactions", { count: newCount })}</button>
        <button disabled={pending} type="button" onClick={reset} className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700">{t("Start over")}</button>
      </div>}
      {confirming && <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-medium">{t(newCount === 1 ? "Import {count} transaction into your private ledger?" : "Import {count} transactions into your private ledger?", { count: newCount })}</p>
        <div className="flex gap-3">
          <button disabled={pending} type="button" onClick={doImport} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? t("Importing...") : t("Confirm")}</button>
          <button disabled={pending} type="button" onClick={() => setConfirming(false)} className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700">{t("Cancel")}</button>
        </div>
      </div>}
    </div>}

    <p role="status" className="text-sm text-green-700">{message}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
