import { z } from "zod";

const decimalAmount = z.string()
  .trim()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Amount must be a positive decimal with up to four decimals")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

export const createFinanceTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().trim().min(1, "Category is required").max(160),
  amount: decimalAmount,
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code"),
  source: z.string().trim().min(1, "Source is required").max(200),
  externalId: z.string().trim().max(200).optional(),
  occurredAt: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Occurred date is required"),
  projectId: z.string().uuid().optional(),
});

export type CreateFinanceTransactionInput = z.infer<typeof createFinanceTransactionSchema>;
