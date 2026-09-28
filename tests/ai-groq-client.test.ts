import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fetch } from "../src/modules/ai/services/anthropic-client";
import { runGroqTool } from "../src/modules/ai/services/groq-client";
import { ASSESSMENT_TOOL_NAME, SUMMARY_TOOL_NAME } from "../src/modules/ai/services/output";
import { ASSESSMENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT, type IdeaPromptText } from "../src/modules/ai/services/prompt";

type Route = { status: number; body?: unknown; raw?: string } | Error;
function stub(route: Route) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    calls.push({ url, init });
    if (route instanceof Error) throw route;
    return new Response(route.raw ?? (route.body === undefined ? "" : JSON.stringify(route.body)), { status: route.status });
  };
  return { calls, fetchImpl };
}

const SECRET = "SECRET-groq-body-must-not-leak";
const base = { apiKey: "gsk_secret-key-1234567890abcdef", apiUrl: "https://api.groq.test/openai/v1/", model: "llama-3.3-70b-versatile", input: "<owner_notes>data</owner_notes>" as IdeaPromptText } as const;
const completion = (name: string, args: unknown, extra: Record<string, unknown> = {}) => ({
  model: "llama-3.3-70b-versatile",
  choices: [{ index: 0, message: { role: "assistant", content: SECRET, tool_calls: [{ id: "call_1", type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } }] }, finish_reason: "tool_calls" }],
  usage: { prompt_tokens: 120, completion_tokens: 45 },
  ...extra,
});
const assessment = { recommendation: "PAUSE", rationale: "Thin evidence.", risks: ["Small sample"], openQuestions: [] };
const summary = { supports: ["Demand"], contradicts: [], openQuestions: [], overview: "Mixed." };

afterEach(() => vi.restoreAllMocks());

describe("runGroqTool request (ADR-024)", () => {
  it("posts to chat/completions with a bearer key, the system prompt and one forced function", async () => {
    const { calls, fetchImpl } = stub({ status: 200, body: completion(ASSESSMENT_TOOL_NAME, assessment) });
    await runGroqTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.groq.test/openai/v1/chat/completions");
    expect([init.method, init.redirect, init.cache]).toEqual(["POST", "error", "no-store"]);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ authorization: `Bearer ${base.apiKey}`, "content-type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(base.model);
    expect(body.messages).toEqual([{ role: "system", content: ASSESSMENT_SYSTEM_PROMPT }, { role: "user", content: base.input }]);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe(ASSESSMENT_TOOL_NAME);
    expect(body.tools[0].function.parameters.required).toEqual(["recommendation", "rationale", "risks", "openQuestions"]);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: ASSESSMENT_TOOL_NAME } });
  });

  it("uses the summary prompt and function for a summary", async () => {
    const { calls, fetchImpl } = stub({ status: 200, body: completion(SUMMARY_TOOL_NAME, summary) });
    expect(await runGroqTool({ ...base, kind: "SUMMARY", fetchImpl })).toEqual({ ok: true, output: summary, inputTokens: 120, outputTokens: 45, model: "llama-3.3-70b-versatile" });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.messages[0].content).toBe(SUMMARY_SYSTEM_PROMPT);
    expect(body.tool_choice.function.name).toBe(SUMMARY_TOOL_NAME);
  });
});

describe("runGroqTool answers", () => {
  it("returns the validated assessment, its recommendation and token counts, ignoring free text", async () => {
    const { fetchImpl } = stub({ status: 200, body: completion(ASSESSMENT_TOOL_NAME, assessment) });
    const result = await runGroqTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: true, output: assessment, recommendation: "PAUSE", inputTokens: 120, outputTokens: 45, model: "llama-3.3-70b-versatile" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("refuses answers that are not exactly the forced function with valid arguments", async () => {
    const bad = [
      completion("other_tool", assessment),
      completion(ASSESSMENT_TOOL_NAME, "{not json"),
      completion(ASSESSMENT_TOOL_NAME, { ...assessment, recommendation: "MAYBE" }),
      completion(ASSESSMENT_TOOL_NAME, { ...assessment, extra: true }),
      { choices: [{ message: { content: "no tool call" } }] },
      { choices: [] },
      { nothing: true },
    ];
    for (const body of bad) {
      const { fetchImpl } = stub({ status: 200, body });
      expect(await runGroqTool({ ...base, kind: "ASSESSMENT", fetchImpl })).toEqual({ ok: false, error: "invalid_output" });
    }
    const { fetchImpl } = stub({ status: 200, raw: "not json" });
    expect(await runGroqTool({ ...base, kind: "ASSESSMENT", fetchImpl })).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("runGroqTool failures", () => {
  const cases: [number, Record<string, string>, unknown][] = [
    [401, { type: "invalid_request_error", code: "invalid_api_key" }, { ok: false, error: "unauthorized" }],
    [429, { type: "tokens", code: "rate_limit_exceeded" }, { ok: false, error: "rate_limited" }],
    [413, {}, { ok: false, error: "too_large" }],
    [400, { code: "context_length_exceeded" }, { ok: false, error: "too_large" }],
    [404, { code: "model_not_found" }, { ok: false, error: "unavailable", reason: "model_unavailable" }],
    [400, { code: "model_decommissioned" }, { ok: false, error: "unavailable", reason: "model_unavailable" }],
    [400, { code: "tool_use_failed" }, { ok: false, error: "invalid_output" }],
    [400, { type: "invalid_request_error" }, { ok: false, error: "unavailable", reason: "bad_request" }],
    [503, {}, { ok: false, error: "unavailable", reason: "overloaded" }],
    [500, {}, { ok: false, error: "unavailable", reason: "server_error" }],
  ];

  it("maps each refusal to a code, and logs only the status and error code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const [status, error, expected] of cases) {
      const { fetchImpl } = stub({ status, body: { error: { ...error, message: `${SECRET} ${base.apiKey}` } } });
      expect(await runGroqTool({ ...base, kind: "ASSESSMENT", fetchImpl }), `${status} ${JSON.stringify(error)}`).toEqual(expected);
    }
    const logged = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(base.apiKey);
    expect(logged).toContain('"type":"rate_limit_exceeded"');
  });

  it("reports a network failure without throwing", async () => {
    const { fetchImpl } = stub(new Error(`${SECRET} connect refused`));
    expect(await runGroqTool({ ...base, kind: "SUMMARY", fetchImpl })).toEqual({ ok: false, error: "unavailable", reason: "network" });
  });
});
