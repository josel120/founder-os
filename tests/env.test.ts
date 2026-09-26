import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env";
import { resolvePostgresOptions } from "../src/db";

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

describe("parseEnv", () => {
  it("is not enforced outside Vercel and without the opt-in (anonymous E2E / plain dev)", () => {
    expect(() => parseEnv(source())).not.toThrow();
    expect(parseEnv(source()).BETTER_AUTH_URL).toBe("http://localhost:3000");
  });

  it("is not enforced with an http BETTER_AUTH_URL and no other auth env (authenticated E2E shape)", () => {
    expect(() => parseEnv(source({ BETTER_AUTH_URL: "http://localhost:3000" }))).not.toThrow();
  });

  it("is not enforced during next build, even on Vercel", () => {
    expect(() => parseEnv(source({ VERCEL: "1", NEXT_PHASE: "phase-production-build" }))).not.toThrow();
  });

  it("fails fast on Vercel when required variables are missing, naming each one", () => {
    expect(() => parseEnv(source({ VERCEL: "1" }))).toThrow(
      /DATABASE_URL.*BETTER_AUTH_SECRET.*BETTER_AUTH_URL.*OWNER_EMAIL/,
    );
  });

  it("fails fast with the FOUNDER_OS_STRICT_ENV opt-in outside Vercel", () => {
    expect(() => parseEnv(source({ FOUNDER_OS_STRICT_ENV: "1" }))).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-https BETTER_AUTH_URL when enforced", () => {
    expect(() => parseEnv(source({ ...validProdEnv, BETTER_AUTH_URL: "http://example.com" }))).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it("passes with a fully valid production env", () => {
    const parsed = parseEnv(source({ ...validProdEnv, OWNER_EMAIL: "Owner@Example.com" }));
    expect(parsed.OWNER_EMAIL).toBe("owner@example.com");
    expect(parsed.DATABASE_URL).toBe(validProdEnv.DATABASE_URL);
  });

  it("never includes a variable's value in the thrown message", () => {
    // Every value is present; only BETTER_AUTH_URL is invalid (http), so the error must name it without echoing any value.
    const values = { ...validProdEnv, BETTER_AUTH_URL: "http://leaky.example.com" };
    let thrown: unknown;
    try {
      parseEnv(source(values));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toContain("BETTER_AUTH_URL");
    for (const value of [values.BETTER_AUTH_SECRET, values.DATABASE_URL, values.BETTER_AUTH_URL, values.OWNER_EMAIL]) expect(String(thrown)).not.toContain(value);
  });
});

describe("resolvePostgresOptions", () => {
  it("uses prepare: false and a small max for a Neon pooled URL", () => {
    expect(
      resolvePostgresOptions("postgresql://user:pass@ep-cool-thing-123-pooler.us-east-2.aws.neon.tech/db", source()),
    ).toEqual({ prepare: false, max: 3 });
  });

  it("uses the pooled options when DATABASE_POOLED=1, even for a non-pooled host", () => {
    expect(
      resolvePostgresOptions("postgresql://user:pass@localhost:5432/db", source({ DATABASE_POOLED: "1" })),
    ).toEqual({ prepare: false, max: 3 });
  });

  it("keeps the current (empty) options for a direct/unpooled URL", () => {
    expect(
      resolvePostgresOptions("postgresql://user:pass@ep-cool-thing-123.us-east-2.aws.neon.tech/db", source()),
    ).toEqual({});
  });
});
