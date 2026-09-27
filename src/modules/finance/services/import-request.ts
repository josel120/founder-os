import { importMappingSchema, type ImportMapping } from "../schemas/import.schema";
import { IMPORT_MAX_BYTES } from "../schemas/import.limits";
import { parseCsv, type ParseCsvResult } from "./csv";

export type ParsedImportRequest =
  | { ok: true; csv: Extract<ParseCsvResult, { ok: true }>; mapping: ImportMapping | null }
  | { ok: false; error: string };

/**
 * Reads the CSV text and (optional) JSON mapping from a form. The server always re-parses the file itself; it never
 * trusts rows sent by the client (ADR-020). Messages never quote the file's contents.
 */
export function parseImportRequest(formData: FormData): ParsedImportRequest {
  const csvText = formData.get("csv");
  if (typeof csvText !== "string" || csvText.length === 0) return { ok: false, error: "Choose a CSV file." };
  if (new TextEncoder().encode(csvText).length > IMPORT_MAX_BYTES) return { ok: false, error: "The file is larger than 1 MB." };
  const csv = parseCsv(csvText);
  if (!csv.ok) return csv;
  const rawMapping = formData.get("mapping");
  if (rawMapping === null || rawMapping === "") return { ok: true, csv, mapping: null };
  let json: unknown;
  try {
    json = JSON.parse(String(rawMapping));
  } catch {
    return { ok: false, error: "Invalid column mapping." };
  }
  const mapping = importMappingSchema.safeParse(json);
  if (!mapping.success) return { ok: false, error: mapping.error.issues[0]?.message ?? "Invalid column mapping." };
  return { ok: true, csv, mapping: mapping.data };
}
