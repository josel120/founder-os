import { describe, expect, it } from "vitest";

import { parseCsv } from "../src/modules/finance/services/csv";
import { buildImportRows, parseAmount, parseDate } from "../src/modules/finance/services/import";
import type { ImportMapping } from "../src/modules/finance/schemas/import.schema";

describe("parseAmount", () => {
  it("parses a plain dot-decimal amount", () => {
    expect(parseAmount("10.50", ".")).toBe("10.50");
  });

  it("parses a plain comma-decimal amount", () => {
    expect(parseAmount("10,50", ",")).toBe("10.50");
  });

  it("parses thousands separators (dot decimal, comma grouping)", () => {
    expect(parseAmount("1,234.56", ".")).toBe("1234.56");
  });

  it("parses thousands separators (comma decimal, dot grouping)", () => {
    expect(parseAmount("1.234,56", ",")).toBe("1234.56");
  });

  it("parses space and apostrophe thousands separators", () => {
    expect(parseAmount("1 234.56", ".")).toBe("1234.56");
    expect(parseAmount("1'234.56", ".")).toBe("1234.56");
  });

  it("parses a leading minus sign", () => {
    expect(parseAmount("-10.50", ".")).toBe("-10.50");
  });

  it("parses a leading plus sign", () => {
    expect(parseAmount("+10.50", ".")).toBe("10.50");
  });

  it("parses parentheses as negative", () => {
    expect(parseAmount("(10.50)", ".")).toBe("-10.50");
  });

  it("parses a trailing minus as negative", () => {
    expect(parseAmount("10.50-", ".")).toBe("-10.50");
  });

  it("parses an integer amount with no decimal part", () => {
    expect(parseAmount("100", ".")).toBe("100");
  });

  it("parses up to four decimal places", () => {
    expect(parseAmount("1.2345", ".")).toBe("1.2345");
  });

  it("returns '0' (unsigned) for zero, including negative zero forms", () => {
    expect(parseAmount("0", ".")).toBe("0");
    expect(parseAmount("0.00", ".")).toBe("0");
    expect(parseAmount("-0.00", ".")).toBe("0");
  });

  it("rejects more than four decimal places", () => {
    expect(parseAmount("1.23456", ".")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseAmount("", ".")).toBeNull();
    expect(parseAmount("   ", ".")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmount("abc", ".")).toBeNull();
    expect(parseAmount("12.34.56", ".")).toBeNull();
  });

  it("rejects a magnitude beyond numeric(18,4) (14 integer digits max)", () => {
    expect(parseAmount("1".repeat(14), ".")).toBe("1".repeat(14));
    expect(parseAmount("1".repeat(15), ".")).toBeNull();
  });

  it("never produces a floating-point rounding artifact", () => {
    expect(parseAmount("0.1", ".")).toBe("0.1");
    expect(parseAmount("999999999999.9999", ".")).toBe("999999999999.9999");
  });
});

describe("parseDate", () => {
  it("parses ISO dates at 12:00 UTC", () => {
    const date = parseDate("2026-03-15", "YYYY-MM-DD");
    expect(date?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
  });

  it("parses DD/MM/YYYY", () => {
    const date = parseDate("15/03/2026", "DD/MM/YYYY");
    expect(date?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
  });

  it("parses MM/DD/YYYY", () => {
    const date = parseDate("03/15/2026", "MM/DD/YYYY");
    expect(date?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
  });

  it("accepts a leap day", () => {
    expect(parseDate("2024-02-29", "YYYY-MM-DD")).not.toBeNull();
  });

  it("rejects an invalid calendar day (31 Feb)", () => {
    expect(parseDate("2026-02-31", "YYYY-MM-DD")).toBeNull();
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
  });

  it("rejects a non-leap-year 29 Feb", () => {
    expect(parseDate("2026-02-29", "YYYY-MM-DD")).toBeNull();
  });

  it("rejects an out-of-range month", () => {
    expect(parseDate("2026-13-01", "YYYY-MM-DD")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseDate("2026/03/15", "YYYY-MM-DD")).toBeNull();
    expect(parseDate("not-a-date", "YYYY-MM-DD")).toBeNull();
  });
});

function csvOf(text: string) {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const baseMapping: ImportMapping = {
  date: "date",
  amount: "amount",
  currency: { fixed: "USD" },
  description: "description",
  dateFormat: "YYYY-MM-DD",
  decimalSeparator: ".",
  fileName: "bank.csv",
};

describe("buildImportRows", () => {
  it("maps a positive amount to INCOME and a negative amount to EXPENSE", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,10.00,Salary\n2026-01-02,-5.00,Coffee\n");
    const { rows, errors } = buildImportRows(csv, baseMapping);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "INCOME", amount: "10.00", currency: "USD", category: "Salary" });
    expect(rows[1]).toMatchObject({ type: "EXPENSE", amount: "5.00", currency: "USD", category: "Coffee" });
  });

  it("errors when the amount is zero", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,0,Nothing\n");
    const { rows, errors } = buildImportRows(csv, baseMapping);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 2, message: "Amount must not be zero" }]);
  });

  it("uses a debit column: debit populated means EXPENSE, credit populated means INCOME", () => {
    const csv = csvOf("date,credit,debit,description\n2026-01-01,10.00,,Salary\n2026-01-02,,5.00,Coffee\n");
    const mapping: ImportMapping = { ...baseMapping, amount: "credit", debit: "debit" };
    const { rows, errors } = buildImportRows(csv, mapping);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ type: "INCOME", amount: "10.00" });
    expect(rows[1]).toMatchObject({ type: "EXPENSE", amount: "5.00" });
  });

  it("errors when both credit and debit are set on the same row", () => {
    const csv = csvOf("date,credit,debit,description\n2026-01-01,10.00,5.00,Both\n");
    const mapping: ImportMapping = { ...baseMapping, amount: "credit", debit: "debit" };
    const { errors } = buildImportRows(csv, mapping);
    expect(errors).toEqual([{ line: 2, message: "Amount and debit must not both be set" }]);
  });

  it("errors when neither credit nor debit are set on the same row", () => {
    const csv = csvOf("date,credit,debit,description\n2026-01-01,,,Neither\n");
    const mapping: ImportMapping = { ...baseMapping, amount: "credit", debit: "debit" };
    const { errors } = buildImportRows(csv, mapping);
    expect(errors).toEqual([{ line: 2, message: "Amount is required" }]);
  });

  it("reads currency from a mapped column, uppercased", () => {
    const csv = csvOf("date,amount,ccy,description\n2026-01-01,10.00,eur,Salary\n");
    const mapping: ImportMapping = { ...baseMapping, currency: { column: "ccy" } };
    const { rows, errors } = buildImportRows(csv, mapping);
    expect(errors).toEqual([]);
    expect(rows[0]?.currency).toBe("EUR");
  });

  it("errors on an invalid currency column value", () => {
    const csv = csvOf("date,amount,ccy,description\n2026-01-01,10.00,US,Salary\n");
    const mapping: ImportMapping = { ...baseMapping, currency: { column: "ccy" } };
    const { errors } = buildImportRows(csv, mapping);
    expect(errors).toEqual([{ line: 2, message: "Invalid currency" }]);
  });

  it("collapses and trims the category from description", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,10.00,  Coffee   with   friends  \n");
    const { rows } = buildImportRows(csv, baseMapping);
    expect(rows[0]?.category).toBe("Coffee with friends");
  });

  it("errors when the description is empty after trimming", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,10.00,   \n");
    const { errors } = buildImportRows(csv, baseMapping);
    expect(errors).toEqual([{ line: 2, message: "Description is empty" }]);
  });

  it("shortens a description longer than the ledger's 160-character category, keeping the key on the full text", () => {
    const long = (tail: string) => csvOf(`date,amount,description\n2026-01-01,10.00,${"a".repeat(170)}${tail}\n`);
    const first = buildImportRows(long("x"), baseMapping);
    const second = buildImportRows(long("y"), baseMapping);
    expect(first.errors).toEqual([]);
    expect(first.rows[0]!.category).toHaveLength(160);
    expect(first.rows[0]!.category.endsWith("…")).toBe(true);
    expect(first.rows[0]!.category).toBe(second.rows[0]!.category);
    expect(first.rows[0]!.importKey).not.toBe(second.rows[0]!.importKey);
  });

  it("keeps a 160-character description whole", () => {
    const { rows } = buildImportRows(csvOf(`date,amount,description\n2026-01-01,10.00,${"b".repeat(160)}\n`), baseMapping);
    expect(rows[0]!.category).toBe("b".repeat(160));
  });

  it("errors when the date is invalid", () => {
    const csv = csvOf("date,amount,description\n2026-02-31,10.00,Coffee\n");
    const { errors } = buildImportRows(csv, baseMapping);
    expect(errors).toEqual([{ line: 2, message: "Invalid date" }]);
  });

  it("errors when the amount is unparseable", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,abc,Coffee\n");
    const { errors } = buildImportRows(csv, baseMapping);
    expect(errors).toEqual([{ line: 2, message: "Invalid amount" }]);
  });

  it("reports a mapping error, not a row error, when a mapped column is missing", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n");
    const mapping: ImportMapping = { ...baseMapping, date: "when" };
    const { rows, errors } = buildImportRows(csv, mapping);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 0, message: "Mapped column not found: when" }]);
  });

  it("never includes cell values in error messages", () => {
    const csv = csvOf("date,amount,description\n2026-01-01,SECRET-VALUE-123,Coffee\n");
    const { errors } = buildImportRows(csv, baseMapping);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).not.toContain("SECRET-VALUE-123");
  });

  describe("importKey", () => {
    it("uses the external ID when mapped and non-empty", () => {
      const csv = csvOf("date,amount,description,ref\n2026-01-01,10.00,Coffee,ABC123\n");
      const mapping: ImportMapping = { ...baseMapping, externalId: "ref" };
      const { rows } = buildImportRows(csv, mapping);
      expect(rows[0]?.importKey).toMatch(/^ext:[0-9a-f]{64}$/);
      expect(rows[0]?.externalId).toBe("ABC123");
    });

    it("falls back to a row-based key when the external ID column is empty", () => {
      const csv = csvOf("date,amount,description,ref\n2026-01-01,10.00,Coffee,\n");
      const mapping: ImportMapping = { ...baseMapping, externalId: "ref" };
      const { rows } = buildImportRows(csv, mapping);
      expect(rows[0]?.importKey).toMatch(/^row:[0-9a-f]{64}$/);
      expect(rows[0]?.externalId).toBeUndefined();
    });

    it("gives two identical rows on the same day different keys (occurrence number)", () => {
      const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n2026-01-01,10.00,Coffee\n");
      const { rows } = buildImportRows(csv, baseMapping);
      expect(rows[0]?.importKey).not.toBe(rows[1]?.importKey);
    });

    it("gives the same file the same keys across two runs (stable, deterministic)", () => {
      const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n2026-01-01,10.00,Coffee\n");
      const first = buildImportRows(csv, baseMapping);
      const second = buildImportRows(csv, baseMapping);
      expect(first.rows.map((r) => r.importKey)).toEqual(second.rows.map((r) => r.importKey));
    });

    it("gives different keys when the amount differs", () => {
      const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n2026-01-01,11.00,Coffee\n");
      const { rows } = buildImportRows(csv, baseMapping);
      expect(rows[0]?.importKey).not.toBe(rows[1]?.importKey);
    });

    it("gives different keys when the description differs, case/space-insensitively normalized", () => {
      const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n2026-01-01,10.00,Tea\n");
      const { rows } = buildImportRows(csv, baseMapping);
      expect(rows[0]?.importKey).not.toBe(rows[1]?.importKey);
    });

    it("gives the same key for descriptions differing only by case or spacing", () => {
      const csvA = csvOf("date,amount,description\n2026-01-01,10.00,Coffee Shop\n");
      const csvB = csvOf("date,amount,description\n2026-01-01,10.00,  coffee   shop \n");
      const a = buildImportRows(csvA, baseMapping);
      const b = buildImportRows(csvB, baseMapping);
      expect(a.rows[0]?.importKey).toBe(b.rows[0]?.importKey);
    });

    it("distinguishes income and expense of the same magnitude via the signed amount", () => {
      const csv = csvOf("date,amount,description\n2026-01-01,10.00,Coffee\n2026-01-01,-10.00,Coffee\n");
      const { rows } = buildImportRows(csv, baseMapping);
      expect(rows[0]?.importKey).not.toBe(rows[1]?.importKey);
    });
  });
});
