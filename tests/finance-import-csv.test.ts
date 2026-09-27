import { describe, expect, it } from "vitest";

import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "../src/modules/finance/schemas/import.limits";
import { parseCsv } from "../src/modules/finance/services/csv";

describe("parseCsv", () => {
  it("parses a simple comma CSV", () => {
    const result = parseCsv("date,amount,description\n2026-01-01,10.00,Coffee\n");
    expect(result).toEqual({
      ok: true,
      headers: ["date", "amount", "description"],
      rows: [["2026-01-01", "10.00", "Coffee"]],
    });
  });

  it("trims header names", () => {
    const result = parseCsv(" date , amount \n2026-01-01,10.00\n");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.headers).toEqual(["date", "amount"]);
  });

  it("auto-detects a semicolon delimiter", () => {
    const result = parseCsv("date;amount;description\n2026-01-01;10,00;Coffee\n");
    expect(result).toEqual({
      ok: true,
      headers: ["date", "amount", "description"],
      rows: [["2026-01-01", "10,00", "Coffee"]],
    });
  });

  it("handles quoted fields with a doubled quote", () => {
    const result = parseCsv('date,description\n2026-01-01,"He said ""hi"""\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([["2026-01-01", 'He said "hi"']]);
  });

  it("handles a quoted field containing the delimiter", () => {
    const result = parseCsv('date,description\n2026-01-01,"a,b,c"\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([["2026-01-01", "a,b,c"]]);
  });

  it("handles an embedded newline inside a quoted field", () => {
    const result = parseCsv('date,description\n2026-01-01,"line one\nline two"\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([["2026-01-01", "line one\nline two"]]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("date,amount\r\n2026-01-01,10.00\r\n2026-01-02,5.00\r\n");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toEqual([
        ["2026-01-01", "10.00"],
        ["2026-01-02", "5.00"],
      ]);
    }
  });

  it("handles bare CR line endings", () => {
    const result = parseCsv("date,amount\r2026-01-01,10.00\r2026-01-02,5.00");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toEqual([
        ["2026-01-01", "10.00"],
        ["2026-01-02", "5.00"],
      ]);
    }
  });

  it("strips a UTF-8 BOM", () => {
    const result = parseCsv("﻿date,amount\n2026-01-01,10.00\n");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.headers).toEqual(["date", "amount"]);
  });

  it("ignores fully empty lines", () => {
    const result = parseCsv("date,amount\n\n2026-01-01,10.00\n\n2026-01-02,5.00\n");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(2);
  });

  it("rejects empty input", () => {
    expect(parseCsv("")).toEqual({ ok: false, error: "CSV file is empty" });
    expect(parseCsv("   \n  \n")).toEqual({ ok: false, error: "CSV file is empty" });
  });

  it("rejects a file over the byte limit", () => {
    const big = `date,amount\n${"2026-01-01,10.00\n".repeat(Math.ceil(IMPORT_MAX_BYTES / 17))}`;
    const result = parseCsv(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too large");
  });

  it("rejects more than IMPORT_MAX_ROWS data rows", () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => "2026-01-01,10.00").join("\n");
    const result = parseCsv(`date,amount\n${rows}\n`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too many rows");
  });

  it("accepts exactly IMPORT_MAX_ROWS data rows", () => {
    const rows = Array.from({ length: IMPORT_MAX_ROWS }, () => "2026-01-01,10.00").join("\n");
    const result = parseCsv(`date,amount\n${rows}\n`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
  });

  it("rejects an unterminated quote", () => {
    const result = parseCsv('date,description\n2026-01-01,"unterminated\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unterminated quote");
  });

  it("rejects a row with the wrong column count and names the line", () => {
    const result = parseCsv("date,amount,description\n2026-01-01,10.00\n2026-01-02,5.00,Coffee\n");
    expect(result).toEqual({
      ok: false,
      error: "Line 2: expected 3 columns, found 2",
    });
  });

  it("names the correct line for a mismatch further into the file", () => {
    const result = parseCsv("date,amount\n2026-01-01,10.00\n2026-01-02,5.00\n2026-01-03,5.00,extra\n");
    expect(result).toEqual({
      ok: false,
      error: "Line 4: expected 2 columns, found 3",
    });
  });

  it("rejects duplicate header names", () => {
    const result = parseCsv("date,date,amount\n2026-01-01,x,10.00\n");
    expect(result).toEqual({ ok: false, error: "Duplicate header name: date" });
  });

  it("rejects empty header names", () => {
    const result = parseCsv("date,,amount\n2026-01-01,x,10.00\n");
    expect(result).toEqual({ ok: false, error: "Header names must not be empty" });
  });
});
