import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "../schemas/import.limits";

export type ParseCsvResult =
  | { ok: true; headers: string[]; rows: string[][] }
  | { ok: false; error: string };

const BOM = "﻿";

/**
 * Detects the delimiter (comma or semicolon) by counting each outside of quotes on the
 * header line only. Semicolons win on a tie-break toward "more semicolons than commas".
 */
function detectDelimiter(text: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          i++;
          continue;
        }
        inQuotes = false;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === "\n" || char === "\r") break;
    if (char === ",") commas++;
    else if (char === ";") semicolons++;
  }

  return semicolons > commas ? ";" : ",";
}

type RawRecord = { line: number; values: string[] };

function tokenize(text: string, delimiter: string): { records: RawRecord[]; unterminatedAt: number | null } {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let quoteStartLine: number | null = null;

  const finishRecord = () => {
    if (fields.length === 0 && field === "") {
      // Fully empty physical line: ignore it entirely.
      return;
    }
    fields.push(field);
    records.push({ line: recordStartLine, values: fields });
    fields = [];
    field = "";
  };

  let i = 0;
  const n = text.length;
  while (i < n) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (char === "\r") {
        field += "\n";
        line++;
        i += text[i + 1] === "\n" ? 2 : 1;
        continue;
      }
      if (char === "\n") {
        field += "\n";
        line++;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      quoteStartLine = line;
      i++;
      continue;
    }
    if (char === delimiter) {
      fields.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      finishRecord();
      line++;
      recordStartLine = line;
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (char === "\n") {
      finishRecord();
      line++;
      recordStartLine = line;
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (inQuotes) {
    return { records, unterminatedAt: quoteStartLine ?? recordStartLine };
  }

  // Flush the final record (files without a trailing newline).
  finishRecord();

  return { records, unterminatedAt: null };
}

export function parseCsv(text: string): ParseCsvResult {
  if (text.trim().length === 0) {
    return { ok: false, error: "CSV file is empty" };
  }

  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > IMPORT_MAX_BYTES) {
    return { ok: false, error: `CSV file is too large (max ${IMPORT_MAX_BYTES} bytes)` };
  }

  const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const delimiter = detectDelimiter(body);
  const { records, unterminatedAt } = tokenize(body, delimiter);

  if (unterminatedAt !== null) {
    return { ok: false, error: `Unterminated quote starting at line ${unterminatedAt}` };
  }

  if (records.length === 0) {
    return { ok: false, error: "CSV file is empty" };
  }

  const headerRecord = records[0]!;
  const headers = headerRecord.values.map((header) => header.trim());

  if (headers.some((header) => header === "")) {
    return { ok: false, error: "Header names must not be empty" };
  }

  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) {
      return { ok: false, error: "Two columns have the same header name. Rename one and try again." };
    }
    seen.add(header);
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > IMPORT_MAX_ROWS) {
    return { ok: false, error: `CSV file has too many rows (max ${IMPORT_MAX_ROWS})` };
  }

  for (const record of dataRecords) {
    if (record.values.length !== headers.length) {
      return {
        ok: false,
        error: `Line ${record.line}: expected ${headers.length} columns, found ${record.values.length}`,
      };
    }
  }

  return { ok: true, headers, rows: dataRecords.map((record) => record.values) };
}
