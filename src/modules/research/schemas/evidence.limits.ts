// Plain constants (no Zod) so client forms can share them without bundling the validation library.
export const evidenceTitleMax = 160;
export const evidenceSummaryMax = 5000;
export const evidenceSourceUrlMax = 2048;
export const evidenceKinds = ["NOTE", "INTERVIEW", "MARKET", "COMPETITOR", "SOURCE"] as const;
export const evidenceSignals = ["SUPPORTS", "CONTRADICTS", "NEUTRAL"] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];
export type EvidenceSignal = (typeof evidenceSignals)[number];
