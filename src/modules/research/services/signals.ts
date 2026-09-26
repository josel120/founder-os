import type { EvidenceKind, EvidenceSignal } from "../schemas/evidence.limits";

export type SignalSummary = { total: number; supports: number; contradicts: number; neutral: number };

/** How the evidence leans: counts per signal. The human reads it; nothing here decides (PRD). */
export function summarizeSignals(rows: readonly { signal: EvidenceSignal }[]): SignalSummary {
  const summary: SignalSummary = { total: rows.length, supports: 0, contradicts: 0, neutral: 0 };
  for (const { signal } of rows) {
    if (signal === "SUPPORTS") summary.supports += 1;
    else if (signal === "CONTRADICTS") summary.contradicts += 1;
    else summary.neutral += 1;
  }
  return summary;
}

const kindLabels: Record<EvidenceKind, string> = { NOTE: "Note", INTERVIEW: "Interview", MARKET: "Market", COMPETITOR: "Competitor", SOURCE: "Source" };
const signalLabels: Record<EvidenceSignal, string> = { SUPPORTS: "Supports", CONTRADICTS: "Contradicts", NEUTRAL: "Neutral" };

export const kindLabel = (kind: EvidenceKind) => kindLabels[kind];
export const signalLabel = (signal: EvidenceSignal) => signalLabels[signal];
