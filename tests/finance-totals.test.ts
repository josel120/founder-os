import { expect, it } from "vitest";
import { formatAmount, totalsByCurrency } from "../src/modules/finance/services/totals";

it.each([
  ["12.3400", "12.34"], ["99.9900", "99.99"], ["0.0001", "0.0001"], ["1234.5000", "1,234.50"],
  ["5.0000", "5.00"], ["99999999999999.9999", "99,999,999,999,999.9999"], ["0.1230", "0.123"],
])("formats %s exactly as %s", (amount, expected) => {
  expect(formatAmount(amount)).toBe(expected);
});

it("sums per currency without floating point drift", () => {
  const totals = totalsByCurrency([
    { type: "INCOME", amount: "0.1000", currency: "USD" },
    { type: "INCOME", amount: "0.2000", currency: "USD" },
    { type: "EXPENSE", amount: "0.3000", currency: "USD" },
    { type: "EXPENSE", amount: "12.3400", currency: "EUR" },
    { type: "INCOME", amount: "99999999999999.9999", currency: "COP" },
    { type: "INCOME", amount: "0.0001", currency: "COP" },
  ]);
  expect(totals).toEqual([
    { currency: "COP", count: 2, income: "100,000,000,000,000.00", expense: "0.00", net: "100,000,000,000,000.00", netNegative: false },
    { currency: "EUR", count: 1, income: "0.00", expense: "12.34", net: "−12.34", netNegative: true },
    { currency: "USD", count: 3, income: "0.30", expense: "0.30", net: "0.00", netNegative: false },
  ]);
});

it("returns nothing for an empty ledger and rejects corrupt amounts", () => {
  expect(totalsByCurrency([])).toEqual([]);
  expect(() => formatAmount("12,34")).toThrow();
});
