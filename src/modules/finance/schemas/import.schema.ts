import { z } from "zod";

import { IMPORT_FILE_NAME_MAX } from "./import.limits";

const importCurrencyMappingSchema = z.union([
  z.object({ column: z.string().trim().min(1) }).strict(),
  z.object({
    fixed: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code"),
  }).strict(),
]);

export const importMappingSchema = z.object({
  date: z.string().trim().min(1),
  amount: z.string().trim().min(1),
  debit: z.string().trim().min(1).optional(),
  currency: importCurrencyMappingSchema,
  description: z.string().trim().min(1),
  externalId: z.string().trim().min(1).optional(),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]),
  decimalSeparator: z.enum([".", ","]),
  fileName: z.string().trim().min(1).max(IMPORT_FILE_NAME_MAX),
}).strict();

export type ImportMapping = z.infer<typeof importMappingSchema>;
export type ImportDateFormat = ImportMapping["dateFormat"];
export type ImportDecimalSeparator = ImportMapping["decimalSeparator"];
