import { describe, expect, it, vi } from "vitest";
import { runTool, type Fetch } from "../src/modules/ai/services/anthropic-client";
import { ASSESSMENT_TOOL_NAME, SUMMARY_TOOL_NAME } from "../src/modules/ai/services/output";
import { ASSESSMENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT, type IdeaPromptText } from "../src/modules/ai/services/prompt";

type Route = { status: number; body?: unknown; headers?: Record<string, string> } | Error;
function stub(route: Route) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    calls.push({ url, init });
    if (route instanceof Error) throw route;
    return new Response(route.body === undefined ? "" : JSON.stringify(route.body), { status: route.status, headers: route.headers });
  };
  return { calls, fetchImpl };
}

const base = { apiKey: "sk-ant-secret-key-1234567890", apiUrl: "https://api.test", model: "claude-sonnet-5", input: "<owner_notes>data</owner_notes>" as IdeaPromptText } as const;
const validAssessmentBody = {
  model: "claude-sonnet-5-20260101",
  content: [{ type: "tool_use", id: "toolu_1", name: ASSESSMENT_TOOL_NAME, input: { recommendation: "CONTINUE", rationale: "ok", risks: [], openQuestions: [] } }],
  usage: { input_tokens: 100, output_tokens: 40 },
};
const validSummaryBody = {
  model: "claude-sonnet-5-20260101",
  content: [{ type: "tool_use", id: "toolu_1", name: SUMMARY_TOOL_NAME, input: { supports: [], contradicts: [], openQuestions: [], overview: "ok" } }],
  usage: { input_tokens: 100, output_tokens: 40 },
};

describe("runTool request shape", () => {
  it("posts to /v1/messages with the expected headers, body and no redirect-follow", async () => {
    const { calls, fetchImpl } = stub({ status: 200, body: validAssessmentBody });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.test/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(base.apiKey);
    expect(headers.authorization).toBeUndefined();
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe(base.model);
    expect(body.max_tokens).toBe(2_000);
    expect(body.system).toBe(ASSESSMENT_SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: base.input }]);
    expect(body.tool_choice).toEqual({ type: "tool", name: ASSESSMENT_TOOL_NAME });
    expect((body.tools as { name: string }[])[0]!.name).toBe(ASSESSMENT_TOOL_NAME);
  });

  it("the key appears only in x-api-key, never elsewhere in the request", async () => {
    const { calls, fetchImpl } = stub({ status: 200, body: validAssessmentBody });
    await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    const { init } = calls[0]!;
    expect(init.body as string).not.toContain(base.apiKey);
    const headers = init.headers as Record<string, string>;
    expect(Object.entries(headers).filter(([, value]) => value === base.apiKey)).toEqual([["x-api-key", base.apiKey]]);
  });
});

describe("runTool success", () => {
  it("returns the validated assessment output with the recommendation and usage", async () => {
    const { fetchImpl } = stub({ status: 200, body: validAssessmentBody });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({
      ok: true,
      output: { recommendation: "CONTINUE", rationale: "ok", risks: [], openQuestions: [] },
      recommendation: "CONTINUE",
      inputTokens: 100,
      outputTokens: 40,
      model: "claude-sonnet-5-20260101",
    });
  });

  it("returns the validated summary output without a recommendation field", async () => {
    const { fetchImpl } = stub({ status: 200, body: validSummaryBody });
    const result = await runTool({ ...base, kind: "SUMMARY", fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect("recommendation" in result).toBe(false);
    expect(result.output).toEqual({ supports: [], contradicts: [], openQuestions: [], overview: "ok" });
    expect(result.model).toBe("claude-sonnet-5-20260101");
  });

  it("picks the system prompt from the kind and accepts only buildIdeaInput text", async () => {
    const { calls, fetchImpl } = stub({ status: 200, body: validSummaryBody });
    await runTool({ ...base, kind: "SUMMARY", fetchImpl });
    expect((JSON.parse(calls[0]!.init.body as string) as { system: string }).system).toBe(SUMMARY_SYSTEM_PROMPT);
    // @ts-expect-error a plain string is not IdeaPromptText, so unfiltered text cannot be sent
    await runTool({ ...base, input: "raw private text", kind: "SUMMARY", fetchImpl });
  });

  it("ignores a response model name longer than the stored column allows", async () => {
    const { fetchImpl } = stub({ status: 200, body: { ...validAssessmentBody, model: "m".repeat(101) } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    if (!result.ok) throw new Error("expected ok");
    expect(result.model).toBe(base.model);
  });

  it("falls back to the requested model when the response omits it", async () => {
    const { fetchImpl } = stub({ status: 200, body: { ...validAssessmentBody, model: undefined } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.model).toBe(base.model);
  });
});

describe("runTool error mapping", () => {
  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [413, "too_large"],
  ])("maps HTTP %i to %s", async (status, expected) => {
    const { fetchImpl } = stub({ status, body: { error: { type: "some_error" } } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: expected });
  });

  it.each([
    [500, { type: "api_error" }, "server_error"],
    [502, {}, "server_error"],
    [529, { type: "overloaded_error" }, "overloaded"],
    [404, { type: "not_found_error", message: "model: claude-x" }, "model_unavailable"],
    [402, { type: "billing_error" }, "billing"],
    [400, { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." }, "billing"],
    [400, { type: "invalid_request_error", message: "tools.0.input_schema: bad" }, "bad_request"],
  ])("maps HTTP %i %o to unavailable with reason %s", async (status, error, reason) => {
    const { fetchImpl } = stub({ status, body: { type: "error", error } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "unavailable", reason });
  });

  it("logs only the status and a well-formed error type, never the message or the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = stub({ status: 400, body: { error: { type: "invalid_request_error", message: "secret prompt text sk-ant-leak" } } });
    await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    const { fetchImpl: odd } = stub({ status: 500, body: { error: { type: "Weird Type <script>" } } });
    await runTool({ ...base, kind: "ASSESSMENT", fetchImpl: odd });
    const lines = warn.mock.calls.map((call) => call.join(" "));
    warn.mockRestore();
    expect(lines).toEqual([
      '[founder-os] ai provider error {"scope":"ai.provider","status":400,"type":"invalid_request_error"}',
      '[founder-os] ai provider error {"scope":"ai.provider","status":500,"type":"unknown"}',
    ]);
    expect(lines.join("")).not.toContain(base.apiKey);
    expect(lines.join("")).not.toContain("secret prompt");
  });

  it("maps a 400 whose error type mentions request_too_large to too_large", async () => {
    const { fetchImpl } = stub({ status: 400, body: { error: { type: "invalid_request_error: request_too_large" } } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "too_large" });
  });

  it("maps a 400 whose error type mentions 'too long' to too_large", async () => {
    const { fetchImpl } = stub({ status: 400, body: { error: { type: "prompt is too long" } } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "too_large" });
  });

  it("maps any other 400 to unavailable with reason bad_request", async () => {
    const { fetchImpl } = stub({ status: 400, body: { error: { type: "invalid_request_error" } } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "unavailable", reason: "bad_request" });
  });

  it("maps a network failure to unavailable", async () => {
    const { fetchImpl } = stub(new TypeError("network down"));
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "unavailable", reason: "network" });
  });

  it("maps a timeout (abort) to unavailable", async () => {
    const timeoutFetch: Fetch = () => {
      const error = new DOMException("The operation was aborted.", "TimeoutError");
      return Promise.reject(error);
    };
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl: timeoutFetch });
    expect(result).toEqual({ ok: false, error: "unavailable", reason: "network" });
  });
});

describe("runTool invalid output", () => {
  it("maps a missing tool_use block to invalid_output", async () => {
    const { fetchImpl } = stub({ status: 200, body: { model: "m", content: [{ type: "text", text: "hi" }] } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("maps a tool_use block for the wrong tool name to invalid_output", async () => {
    const { fetchImpl } = stub({ status: 200, body: { model: "m", content: [{ type: "tool_use", name: "some_other_tool", input: {} }] } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("maps a tool_use input that fails the output schema to invalid_output", async () => {
    const { fetchImpl } = stub({ status: 200, body: { model: "m", content: [{ type: "tool_use", name: ASSESSMENT_TOOL_NAME, input: { recommendation: "MAYBE" } }] } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("rejects a tool_use input with extra keys", async () => {
    const { fetchImpl } = stub({
      status: 200,
      body: { model: "m", content: [{ type: "tool_use", name: ASSESSMENT_TOOL_NAME, input: { recommendation: "CONTINUE", rationale: "ok", risks: [], openQuestions: [], score: 9 } }] },
    });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("maps unparseable JSON to invalid_output/unavailable, never throwing", async () => {
    const fetchImpl: Fetch = async () => new Response("not json", { status: 200 });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(result.ok).toBe(false);
  });
});

describe("runTool never leaks secrets or bodies", () => {
  it("never returns the api key or a response body in the result", async () => {
    const { fetchImpl } = stub({ status: 200, body: { ...validAssessmentBody, secretField: "leak-me" } });
    const result = await runTool({ ...base, kind: "ASSESSMENT", fetchImpl });
    expect(JSON.stringify(result)).not.toContain(base.apiKey);
    expect(JSON.stringify(result)).not.toContain("leak-me");
  });
});
