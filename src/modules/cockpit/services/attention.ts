// Pure selection rules for the cockpit (ADR-015). They count and flag; the owner decides what to do.
export const WAITING_THRESHOLD_DAYS = 14;
export const FINANCE_WINDOW_DAYS = 30;
const day = 24 * 60 * 60 * 1000;

export const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * day);

/** A waiting project needs attention once it has waited longer than the threshold. */
export function waitingTooLong(waitingSince: Date | null, now: Date, thresholdDays = WAITING_THRESHOLD_DAYS): boolean {
  return waitingSince !== null && waitingSince.getTime() <= daysAgo(now, thresholdDays).getTime();
}

export type SignalCounts = { supports: number; contradicts: number; neutral: number };

/** An idea under research needs attention with no evidence yet, or with only contradicting evidence. */
export function needsResearch(counts: SignalCounts | undefined): boolean {
  if (!counts || counts.supports + counts.contradicts + counts.neutral === 0) return true;
  return counts.contradicts > 0 && counts.supports === 0;
}
