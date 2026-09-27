export type AIRecommendation = "CONTINUE" | "INVESTIGATE_MORE" | "PAUSE" | "REJECT";

export interface AIService {
  assessIdea(ideaId: string): Promise<AIRecommendation>;
  summarizeResearch(ideaId: string): Promise<string>;
}
