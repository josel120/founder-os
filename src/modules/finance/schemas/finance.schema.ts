import { z } from "zod";

// finance_transaction.amount is numeric(18, 4): at most 14 integer digits.
const maxIntegerDigits = 14;

const decimalAmount = z.string()
  .trim()
  // Accept a comma as the decimal separator ("12,50"), as many locales write it.
  .overwrite((value) => /^\d+,\d{1,4}$/.test(value) ? value.replace(",", ".") : value)
  .regex(/^\d+(?:\.\d{1,4})?$/, "Amount must be a positive decimal with up to four decimals")
  .refine((value) => value.split(".")[0]!.replace(/^0+(?=\d)/, "").length <= maxIntegerDigits, "Amount is too large")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");

// The form sends the wall-clock time the owner typed (datetime-local, no offset). It is stored as that time in UTC,
// so the saved date never depends on the server's time zone. Explicit offsets from other callers are kept.
const occurredAt = z.iso.datetime({ local: true, offset: true, error: "Enter when the transaction happened" })
  .transform((value) => new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`).toISOString());

export const createFinanceTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().trim().min(1, "Category is required").max(160),
  amount: decimalAmount,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code"),
  source: z.string().trim().min(1, "Source is required").max(200),
  externalId: z.string().trim().max(200).optional(),
  occurredAt,
  projectId: z.string().uuid().optional(),
});

export type CreateFinanceTransactionInput = z.infer<typeof createFinanceTransactionSchema>;
