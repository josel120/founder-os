import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env";
import { activeProvider, AI_PROVIDERS } from "../src/modules/ai/services/provider";

function source(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

const validProdEnv = {
  VERCEL: "1",
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://example.com",
  OWNER_EMAIL: "owner@example.com",
};
const groqKey = "gsk_".padEnd(30, "x");
const anthropicKey = "sk-ant-".padEnd(25, "x");

describe("ADR-021/ADR-024 env (GROQ_API_KEY, ANTHROPIC_API_KEY, AI_MODEL, AI_API_URL)", () => {
  it("leaves every AI setting unset by default, so no provider is active", () => {
    const parsed = parseEnv(source());
    expect([parsed.GROQ_API_KEY, parsed.ANTHROPIC_API_KEY, parsed.AI_MODEL, parsed.AI_API_URL]).toEqual([undefined, undefined, undefined, undefined]);
    expect(activeProvider(parsed)).toBeNull();
  });

  it("accepts valid keys and turns the feature off on invalid ones (ADR-019)", () => {
    expect(parseEnv(source({ GROQ_API_KEY: groqKey })).GROQ_API_KEY).toBe(groqKey);
    expect(parseEnv(source({ GROQ_API_KEY: "too-short" })).GROQ_API_KEY).toBeUndefined();
    expect(parseEnv(source({ ANTHROPIC_API_KEY: anthropicKey })).ANTHROPIC_API_KEY).toBe(anthropicKey);
    expect(parseEnv(source({ ANTHROPIC_API_KEY: "too-short" })).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("accepts a valid AI_MODEL, including provider/model names, and drops an invalid one", () => {
    expect(parseEnv(source({ AI_MODEL: "claude-opus-5.5" })).AI_MODEL).toBe("claude-opus-5.5");
    expect(parseEnv(source({ AI_MODEL: "openai/gpt-oss-120b" })).AI_MODEL).toBe("openai/gpt-oss-120b");
    expect(parseEnv(source({ AI_MODEL: "Claude-Sonnet" })).AI_MODEL).toBeUndefined();
    expect(parseEnv(source({ AI_MODEL: "" })).AI_MODEL).toBeUndefined();
  });

  it("accepts an https or localhost AI_API_URL override, and drops anything else", () => {
    expect(parseEnv(source({ AI_API_URL: "https://stub.test" })).AI_API_URL).toBe("https://stub.test");
    expect(parseEnv(source({ AI_API_URL: "http://localhost:4010" })).AI_API_URL).toBe("http://localhost:4010");
    expect(parseEnv(source({ AI_API_URL: "http://evil.example" })).AI_API_URL).toBeUndefined();
  });

  it("is not enforced with a fully valid production env and no AI_API_URL", () => {
    expect(() => parseEnv(source({ ...validProdEnv, GROQ_API_KEY: groqKey }))).not.toThrow();
  });

  it("refuses an overridden AI_API_URL under strict env, like GITHUB_API_URL", () => {
    expect(() => parseEnv(source({ ...validProdEnv, AI_API_URL: "https://stub.test" }))).toThrow(
      /AI_API_URL \(must not be overridden in production\)/,
    );
  });
});

describe("activeProvider (ADR-024)", () => {
  it("prefers Groq when its key is set, with its default model and URL", () => {
    expect(activeProvider(parseEnv(source({ GROQ_API_KEY: groqKey, ANTHROPIC_API_KEY: anthropicKey })))).toEqual({
      name: "groq", label: "Groq", apiKey: groqKey, apiUrl: AI_PROVIDERS.groq.apiUrl, model: AI_PROVIDERS.groq.model,
    });
    expect(AI_PROVIDERS.groq.apiUrl).toBe("https://api.groq.com/openai/v1");
  });

  it("falls back to Anthropic, and AI_MODEL and AI_API_URL override the defaults", () => {
    expect(activeProvider(parseEnv(source({ ANTHROPIC_API_KEY: anthropicKey })))).toMatchObject({ name: "anthropic", label: "Anthropic", apiUrl: "https://api.anthropic.com", model: "claude-sonnet-5" });
    expect(activeProvider(parseEnv(source({ GROQ_API_KEY: groqKey, AI_MODEL: "openai/gpt-oss-120b", AI_API_URL: "http://127.0.0.1:4011" }))))
      .toMatchObject({ name: "groq", model: "openai/gpt-oss-120b", apiUrl: "http://127.0.0.1:4011" });
  });
});
