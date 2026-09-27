import { createHash } from "node:crypto";

import type { ImportDateFormat, ImportDecimalSeparator, ImportMapping } from "../schemas/import.schema";
import type { ParseCsvResult } from "./csv";

// finance_transaction.amount is numeric(18, 4): at most 14 integer digits.
const MAX_INTEGER_DIGITS = 14;

export type ImportRow = {
  line: number;
  occurredAt: Date;
  type: "INCOME" | "EXPENSE";
  amount: string;
  currency: string;
  category: string;
  externalId?: string;
  importKey: string;
};

export type ImportRowError = { line: number; message: string };

export type BuildImportRowsResult = { rows: ImportRow[]; errors: ImportRowError[] };

/**
 * Parses a locale-formatted amount into an exact decimal string ("-12.5", "0.0001", …), using
 * string/BigInt arithmetic only (never floating point). Returns null for anything invalid,
 * including more than 4 decimals or a magnitude beyond numeric(18,4).
 */
export function parseAmount(raw: string, decimalSeparator: ImportDecimalSeparator): string | null {
  let s = raw.trim();
  if (s === "") return null;

  let negative = false;

  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1).trim();
  }

  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  // Strip whitespace (including a non-breaking space) and apostrophe thousands separators,
  // then the digit-grouping character (whichever of "." or "," is not the decimal separator).
  s = s.replace(/[  ']/g, "");
  const thousands = decimalSeparator === "." ? "," : ".";
  s = s.split(thousands).join("");

  if (s === "") return null;

  const parts = s.split(decimalSeparator);
  if (parts.length > 2) return null;

  const intPartRaw = parts[0] ?? "";
  const fracPart = parts[1] ?? "";

  if (fracPart.length > 4) return null;
  if (intPartRaw !== "" && !/^\d+$/.test(intPartRaw)) return null;
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) return null;
  if (intPartRaw === "" && fracPart === "") return null;

  const intPart = (intPartRaw === "" ? BigInt(0) : BigInt(intPartRaw)).toString();
  if (intPart.length > MAX_INTEGER_DIGITS) return null;

  const isZero = intPart === "0" && (fracPart === "" || BigInt(fracPart) === BigInt(0));
  const magnitude = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;

  if (isZero) return "0";
  return negative ? `-${magnitude}` : magnitude;
}

/**
 * Parses a calendar date in the given format into a Date at 12:00 UTC of that day (matching how
 * the manual entry form stores dates — avoids any time-zone-driven day shift). Validates real
 * calendar dates (e.g. rejects 31/02). Returns null for anything invalid.
 */
export function parseDate(raw: string, format: ImportDateFormat): Date | null {
  const trimmed = raw.trim();
  let year: number;
  let month: number;
  let day: number;

  if (format === "YYYY-MM-DD") {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if (format === "DD/MM/YYYY") {
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    month = Number(match[1]);
    day = Number(match[2]);
    year = Number(match[3]);
  }

  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validates and converts parsed CSV rows into ledger-ready rows using the owner's column
 * mapping. Never throws: invalid rows are collected as line-numbered errors (never including
 * cell values, since they are private financial data that could reach logs). A mapping that
 * references a column absent from the CSV headers is reported once, at line 0.
 */
export function buildImportRows(csv: Extract<ParseCsvResult, { ok: true }>, mapping: ImportMapping): BuildImportRowsResult {
  const { headers, rows } = csv;
  const columnIndex = (name: string) => headers.indexOf(name);

  const missing: string[] = [];
  if (columnIndex(mapping.date) < 0) missing.push(mapping.date);
  if (columnIndex(mapping.amount) < 0) missing.push(mapping.amount);
  if (mapping.debit !== undefined && columnIndex(mapping.debit) < 0) missing.push(mapping.debit);
  if ("column" in mapping.currency && columnIndex(mapping.currency.column) < 0) missing.push(mapping.currency.column);
  if (columnIndex(mapping.description) < 0) missing.push(mapping.description);
  if (mapping.externalId !== undefined && columnIndex(mapping.externalId) < 0) missing.push(mapping.externalId);

  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 0, message: `Mapped column not found: ${missing.join(", ")}` }] };
  }

  const dateIdx = columnIndex(mapping.date);
  const amountIdx = columnIndex(mapping.amount);
  const debitIdx = mapping.debit !== undefined ? columnIndex(mapping.debit) : -1;
  const currencyIdx = "column" in mapping.currency ? columnIndex(mapping.currency.column) : -1;
  const descriptionIdx = columnIndex(mapping.description);
  const externalIdIdx = mapping.externalId !== undefined ? columnIndex(mapping.externalId) : -1;

  const importRows: ImportRow[] = [];
  const errors: ImportRowError[] = [];
  const occurrenceCounts = new Map<string, number>();

  rows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;

    const occurredAt = parseDate(row[dateIdx]!, mapping.dateFormat);
    if (!occurredAt) {
      errors.push({ line, message: "Invalid date" });
      return;
    }

    let type: "INCOME" | "EXPENSE";
    let amount: string;

    if (mapping.debit !== undefined) {
      const creditRaw = row[amountIdx]!.trim();
      const debitRaw = row[debitIdx]!.trim();
      const creditEmpty = creditRaw === "";
      const debitEmpty = debitRaw === "";

      if (creditEmpty && debitEmpty) {
        errors.push({ line, message: "Amount is required" });
        return;
      }
      if (!creditEmpty && !debitEmpty) {
        errors.push({ line, message: "Amount and debit must not both be set" });
        return;
      }

      const parsed = parseAmount(debitEmpty ? creditRaw : debitRaw, mapping.decimalSeparator);
      if (parsed === null) {
        errors.push({ line, message: "Invalid amount" });
        return;
      }
      if (parsed === "0") {
        errors.push({ line, message: "Amount must not be zero" });
        return;
      }
      type = debitEmpty ? "INCOME" : "EXPENSE";
      amount = parsed.startsWith("-") ? parsed.slice(1) : parsed;
    } else {
      const parsed = parseAmount(row[amountIdx]!, mapping.decimalSeparator);
      if (parsed === null) {
        errors.push({ line, message: "Invalid amount" });
        return;
      }
      if (parsed === "0") {
        errors.push({ line, message: "Amount must not be zero" });
        return;
      }
      type = parsed.startsWith("-") ? "EXPENSE" : "INCOME";
      amount = parsed.startsWith("-") ? parsed.slice(1) : parsed;
    }

    let currency: string;
    if ("fixed" in mapping.currency) {
      currency = mapping.currency.fixed;
    } else {
      const currencyRaw = row[currencyIdx]!.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currencyRaw)) {
        errors.push({ line, message: "Invalid currency" });
        return;
      }
      currency = currencyRaw;
    }

    const category = row[descriptionIdx]!.trim().replace(/\s+/g, " ");
    if (category.length < 1 || category.length > 200) {
      errors.push({ line, message: "Description must be 1-200 characters" });
      return;
    }

    let externalId: string | undefined;
    if (mapping.externalId !== undefined) {
      const externalIdRaw = row[externalIdIdx]!.trim();
      if (externalIdRaw !== "") externalId = externalIdRaw;
    }

    let importKey: string;
    if (externalId !== undefined) {
      importKey = `ext:${sha256Hex(`${currency}|${externalId}`)}`;
    } else {
      const normalizedDescription = category.toLowerCase();
      const signedAmount = type === "EXPENSE" ? `-${amount}` : amount;
      const tupleKey = `${formatDateOnly(occurredAt)}|${signedAmount}|${currency}|${normalizedDescription}`;
      const occurrence = (occurrenceCounts.get(tupleKey) ?? 0) + 1;
      occurrenceCounts.set(tupleKey, occurrence);
      importKey = `row:${sha256Hex(`${tupleKey}|${occurrence}`)}`;
    }

    importRows.push({ line, occurredAt, type, amount, currency, category, externalId, importKey });
  });

  return { rows: importRows, errors };
}
