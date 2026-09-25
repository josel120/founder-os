import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { financeTransactions, users } from "../src/db/schema";

describe("finance transaction ownership contract", () => {
  it("is private by default and keeps historical ownership nullable", () => {
    expect(financeTransactions.visibility.default).toBe("PRIVATE");
    expect(financeTransactions.visibility.notNull).toBe(true);
    expect(financeTransactions.ownerId.notNull).toBe(false);
  });

  it("references users with restrictive deletion", () => {
    const ownerFk = getTableConfig(financeTransactions).foreignKeys.find((fk) =>
      fk.reference().columns.includes(financeTransactions.ownerId),
    );
    expect(ownerFk?.reference().foreignTable).toBe(users);
    expect(ownerFk?.onDelete).toBe("restrict");
  });
});
