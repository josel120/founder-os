import { env, type Env } from "@/lib/env";

/**
 * ADR-024: which AI provider runs are sent to. Groq (free tier) is used when its key is set, otherwise Anthropic
 * (ADR-021). Both receive exactly the same allowlisted input and must answer through the same forced tool.
 */
export type AIProviderName = "groq" | "anthropic";

export const AI_PROVIDERS = {
  groq: { label: "Groq", apiUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  anthropic: { label: "Anthropic", apiUrl: "https://api.anthropic.com", model: "claude-sonnet-5" },
} as const satisfies Record<AIProviderName, { label: string; apiUrl: string; model: string }>;

export type ActiveProvider = { name: AIProviderName; label: string; apiKey: string; apiUrl: string; model: string };

/** The configured provider, or null when no key is set. `AI_MODEL` and the test-only `AI_API_URL` override the defaults. */
export function activeProvider(source: Pick<Env, "GROQ_API_KEY" | "ANTHROPIC_API_KEY" | "AI_MODEL" | "AI_API_URL"> = env): ActiveProvider | null {
  const name: AIProviderName | null = source.GROQ_API_KEY ? "groq" : source.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (!name) return null;
  const defaults = AI_PROVIDERS[name];
  const apiKey = name === "groq" ? source.GROQ_API_KEY! : source.ANTHROPIC_API_KEY!;
  return { name, label: defaults.label, apiKey, apiUrl: source.AI_API_URL ?? defaults.apiUrl, model: source.AI_MODEL ?? defaults.model };
}
