import { describe, expect, it } from "vitest";
import { AI_API_DEFAULT, parseEnv } from "../src/lib/env";

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

describe("ADR-021 env (ANTHROPIC_API_KEY, AI_MODEL, AI_API_URL)", () => {
  it("defaults AI_MODEL and AI_API_URL, with no key configured", () => {
    const parsed = parseEnv(source());
    expect(parsed.ANTHROPIC_API_KEY).toBeUndefined();
    expect(parsed.AI_MODEL).toBe("claude-sonnet-5");
    expect(parsed.AI_API_URL).toBe(AI_API_DEFAULT);
  });

  it("accepts a valid key and turns the feature off on an invalid one (ADR-019)", () => {
    expect(parseEnv(source({ ANTHROPIC_API_KEY: "sk-ant-".padEnd(25, "x") })).ANTHROPIC_API_KEY).toBe("sk-ant-xxxxxxxxxxxxxxxxxx");
    expect(parseEnv(source({ ANTHROPIC_API_KEY: "too-short" })).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("accepts a valid AI_MODEL and falls back to the default on an invalid one", () => {
    expect(parseEnv(source({ AI_MODEL: "claude-opus-5.5" })).AI_MODEL).toBe("claude-opus-5.5");
    expect(parseEnv(source({ AI_MODEL: "Claude-Sonnet" })).AI_MODEL).toBe("claude-sonnet-5");
    expect(parseEnv(source({ AI_MODEL: "" })).AI_MODEL).toBe("claude-sonnet-5");
  });

  it("accepts an https or localhost AI_API_URL override, and falls back otherwise", () => {
    expect(parseEnv(source({ AI_API_URL: "https://stub.test" })).AI_API_URL).toBe("https://stub.test");
    expect(parseEnv(source({ AI_API_URL: "http://localhost:4010" })).AI_API_URL).toBe("http://localhost:4010");
    expect(parseEnv(source({ AI_API_URL: "http://evil.example" })).AI_API_URL).toBe(AI_API_DEFAULT);
  });

  it("is not enforced with a fully valid production env plus AI_API_URL at its default", () => {
    expect(() => parseEnv(source(validProdEnv))).not.toThrow();
  });

  it("refuses an overridden AI_API_URL under strict env, like GITHUB_API_URL", () => {
    expect(() => parseEnv(source({ ...validProdEnv, AI_API_URL: "https://stub.test" }))).toThrow(
      /AI_API_URL \(must not be overridden in production\)/,
    );
  });
});
