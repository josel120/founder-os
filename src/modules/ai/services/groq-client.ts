import { z } from "zod";
import { logProviderFailure, type AIClientError, type AIFailureReason, type RunToolArgs, type RunToolResult } from "./anthropic-client";
import { ASSESSMENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./prompt";
import { assessmentOutputSchema, assessmentTool, summaryOutputSchema, summaryTool } from "./output";

const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 2_000;

const responseSchema = z.object({
  model: z.string().min(1).max(100).optional().catch(undefined),
  choices: z.array(z.object({
    message: z.object({
      tool_calls: z.array(z.object({ function: z.object({ name: z.string(), arguments: z.string().max(20_000) }) })).optional(),
    }).loose(),
  }).loose()).min(1),
  usage: z.object({ prompt_tokens: z.number().int().min(0).optional(), completion_tokens: z.number().int().min(0).optional() }).loose().optional(),
});
const errorBodySchema = z.object({ error: z.object({ type: z.string().optional(), code: z.string().optional(), message: z.string().optional() }).loose() }).loose();

type Failure = { code: AIClientError; reason?: AIFailureReason };

async function failureFor(response: Response): Promise<Failure> {
  let type: string | undefined;
  let code = "";
  let message = "";
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) ({ type, code = "", message = "" } = parsed.data.error);
  } catch {
    // Not the expected JSON shape: classify by status alone.
  }
  logProviderFailure(response.status, code || type);
  const status = response.status;
  // The message is only matched here, never logged, stored or returned.
  if (status === 401 || status === 403) return { code: "unauthorized" };
  if (status === 429) return { code: "rate_limited" };
  if (status === 413 || code === "context_length_exceeded" || /too (long|large)|context length/i.test(message)) return { code: "too_large" };
  if (status === 404 || code === "model_not_found" || code === "model_decommissioned") return { code: "unavailable", reason: "model_unavailable" };
  // The model answered but not through the forced tool: the same outcome as a malformed answer.
  if (code === "tool_use_failed") return { code: "invalid_output" };
  if (status === 402) return { code: "unavailable", reason: "billing" };
  if (status === 498 || status === 503) return { code: "unavailable", reason: "overloaded" };
  if (status === 400 || status === 422) return { code: "unavailable", reason: "bad_request" };
  return { code: "unavailable", reason: "server_error" };
}

const fail = ({ code, reason }: Failure): RunToolResult => (reason ? { ok: false, error: code, reason } : { ok: false, error: code });

/**
 * ADR-024: the same run as `runTool`, against Groq's OpenAI-compatible chat completions API with a forced function
 * call. The function's arguments are validated with the same Zod schema. Never logs, throws or returns the request or
 * response body, the key or the prompt; on any failure only an error code crosses this function's boundary.
 */
export async function runGroqTool(args: RunToolArgs): Promise<RunToolResult> {
  const fetchImpl = args.fetchImpl ?? ((url, init) => fetch(url, init));
  const tool = args.kind === "ASSESSMENT" ? assessmentTool : summaryTool;
  const system = args.kind === "ASSESSMENT" ? ASSESSMENT_SYSTEM_PROMPT : SUMMARY_SYSTEM_PROMPT;
  const base = args.apiUrl.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { authorization: `Bearer ${args.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: args.model,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        messages: [{ role: "system", content: system }, { role: "user", content: args.input }],
        tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });
  } catch {
    return { ok: false, error: "unavailable", reason: "network" };
  }

  try {
    if (!response.ok) return fail(await failureFor(response));
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return fail({ code: "unavailable" });
    }
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) return fail({ code: "invalid_output" });
    const call = parsed.data.choices[0]!.message.tool_calls?.find((item) => item.function.name === tool.name);
    if (!call) return fail({ code: "invalid_output" });
    let input: unknown;
    try {
      input = JSON.parse(call.function.arguments);
    } catch {
      return fail({ code: "invalid_output" });
    }

    const model = parsed.data.model ?? args.model;
    const inputTokens = parsed.data.usage?.prompt_tokens ?? null;
    const outputTokens = parsed.data.usage?.completion_tokens ?? null;
    if (args.kind === "ASSESSMENT") {
      const output = assessmentOutputSchema.safeParse(input);
      if (!output.success) return fail({ code: "invalid_output" });
      return { ok: true, output: output.data, recommendation: output.data.recommendation, inputTokens, outputTokens, model };
    }
    const output = summaryOutputSchema.safeParse(input);
    if (!output.success) return fail({ code: "invalid_output" });
    return { ok: true, output: output.data, inputTokens, outputTokens, model };
  } catch {
    return fail({ code: "unavailable" });
  }
}
