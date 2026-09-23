export type AIRecommendation = "CONTINUE" | "INVESTIGATE_MORE" | "PAUSE" | "REJECT";
export interface AIService { researchIdea(ideaId: string): Promise<unknown>; analyzeEvidence(evidenceId: string): Promise<unknown>; scoreIdea(ideaId: string): Promise<unknown>; assessIdea(ideaId: string): Promise<AIRecommendation>; summarizeResearch(ideaId: string): Promise<string>; }
