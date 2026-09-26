// Exact decimal arithmetic for ledger amounts (ADR-011): amounts are numeric(18, 4) strings, summed as
// integer ten-thousandths in BigInt. Binary floating point never touches a money value.
const scale = 4;
const zero = BigInt(0);
const factor = BigInt(10 ** scale);

function toUnits(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) throw new Error("Invalid stored amount");
  const [, sign, whole, fraction = ""] = match;
  const units = BigInt(whole!) * factor + BigInt(fraction.padEnd(scale, "0").slice(0, scale));
  return sign ? -units : units;
}

/** Exact display value with thousands separators and two to four decimals: "1,234.5" → "1,234.50". */
function formatUnits(units: bigint): string {
  const negative = units < zero;
  const absolute = negative ? -units : units;
  const whole = (absolute / factor).toLocaleString("en-US");
  const fraction = (absolute % factor).toString().padStart(scale, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "−" : ""}${whole}.${fraction}`;
}

export function formatAmount(amount: string): string {
  return formatUnits(toUnits(amount));
}

export type CurrencyTotal = { currency: string; count: number; income: string; expense: string; net: string; netNegative: boolean };

/** Income, expense and net per currency. Currencies are never mixed or converted. */
export function totalsByCurrency(transactions: readonly { type: "INCOME" | "EXPENSE"; amount: string; currency: string }[]): CurrencyTotal[] {
  const totals = new Map<string, { count: number; income: bigint; expense: bigint }>();
  for (const { type, amount, currency } of transactions) {
    const total = totals.get(currency) ?? { count: 0, income: zero, expense: zero };
    total.count += 1;
    if (type === "INCOME") total.income += toUnits(amount);
    else total.expense += toUnits(amount);
    totals.set(currency, total);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, { count, income, expense }]) => {
    const net = income - expense;
    return { currency, count, income: formatUnits(income), expense: formatUnits(expense), net: formatUnits(net), netNegative: net < zero };
  });
}
