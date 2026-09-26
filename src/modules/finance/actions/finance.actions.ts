"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { financeTransactions, projects } from "@/db/schema";
import { reportError } from "@/lib/report-error";
import { requireAuth } from "@/lib/require-auth";
import { createFinanceTransactionSchema } from "../schemas/finance.schema";

type Result = { ok: true; transactionId: string } | { ok: false; error: string };
const failure = { ok: false as const, error: "Could not save the transaction. Please try again." };

export async function createFinanceTransaction(formData: FormData): Promise<Result> {
  const owner = await requireAuth();
  if (!owner) return { ok: false, error: "Sign in again to save this transaction." };
  const raw = Object.fromEntries(formData);
  const parsed = createFinanceTransactionSchema.safeParse({
    ...raw,
    externalId: raw.externalId || undefined,
    projectId: raw.projectId || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid transaction." };
  if (!db) return failure;
  try {
    if (parsed.data.projectId) {
      const [project] = await db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.id, parsed.data.projectId), eq(projects.ownerId, owner.id), eq(projects.visibility, "PRIVATE")))
        .limit(1);
      if (!project) return { ok: false, error: "Project not found. The transaction was not saved." };
    }
    const [created] = await db.insert(financeTransactions).values({
      ownerId: owner.id,
      projectId: parsed.data.projectId ?? null,
      type: parsed.data.type,
      category: parsed.data.category,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      source: parsed.data.source,
      externalId: parsed.data.externalId || null,
      occurredAt: new Date(parsed.data.occurredAt),
      visibility: "PRIVATE",
    }).returning({ id: financeTransactions.id });
    if (!created) return failure;
    revalidatePath("/private/finance");
    return { ok: true, transactionId: created.id };
  } catch (error) { reportError("finance.create", error); return failure; }
}
