import { z } from "zod";
import type { AIRecommendation } from "../types";
import { ASSESSMENT_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT, type IdeaPromptText } from "./prompt";
import { assessmentOutputSchema, assessmentTool, summaryOutputSchema, summaryTool, type AssessmentOutput, type SummaryOutput } from "./output";

/** ADR-021 error codes: the only thing stored or shown when a run fails. Never a response body. */
export type AIClientError = "unauthorized" | "rate_limited" | "unavailable" | "invalid_output" | "too_large";
/**
 * Why the provider refused, for the owner's message and one diagnostic log line. Not stored (the `ai_run.error` CHECK
 * keeps the codes above); derived from the HTTP status and the provider's error type, never from free text we echo.
 */
export type AIFailureReason = "billing" | "model_unavailable" | "bad_request" | "overloaded" | "server_error" | "network";
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 2_000;

// The system prompt follows from the kind, and the input must come from `buildIdeaInput` (ADR-021 allowlist).
export type RunToolArgs = { kind: "ASSESSMENT" | "SUMMARY"; input: IdeaPromptText; apiKey: string; apiUrl: string; model: string; fetchImpl?: Fetch };

export type RunToolResult =
  | { ok: true; output: AssessmentOutput; recommendation: AIRecommendation; inputTokens: number | null; outputTokens: number | null; model: string }
  | { ok: true; output: SummaryOutput; inputTokens: number | null; outputTokens: number | null; model: string }
  | { ok: false; error: AIClientError; reason?: AIFailureReason };

const contentBlockSchema = z.union([
  z.object({ type: z.literal("tool_use"), name: z.string(), input: z.unknown() }),
  z.object({ type: z.string() }).loose(),
]);
const messageSchema = z.object({
  model: z.string().min(1).max(100).optional().catch(undefined),
  content: z.array(contentBlockSchema),
  usage: z.object({ input_tokens: z.number().int().min(0).optional(), output_tokens: z.number().int().min(0).optional() }).optional(),
});
const errorBodySchema = z.object({ error: z.object({ type: z.string().optional(), message: z.string().optional() }).loose() }).loose();
const ERROR_TYPE = /^[a-z_]{1,40}$/;

class RunFailure extends Error {
  constructor(readonly code: AIClientError, readonly reason?: AIFailureReason) {
    super(code);
  }
}

/** One line per provider refusal: the HTTP status and the provider's error-type code only. No body, message, key or prompt. */
export function logProviderFailure(status: number, type: string | undefined) {
  console.warn("[founder-os] ai provider error", JSON.stringify({ scope: "ai.provider", status, type: type && ERROR_TYPE.test(type) ? type : "unknown" }));
}

async function failureFor(response: Response): Promise<RunFailure> {
  let type: string | undefined;
  let message = "";
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) {
      type = parsed.data.error.type;
      message = parsed.data.error.message ?? "";
    }
  } catch {
    // Not the expected JSON shape: classify by status alone.
  }
  logProviderFailure(response.status, type);
  const status = response.status;
  // The message is only matched here, never logged, stored or returned.
  if (status === 402 || type === "billing_error" || /credit balance/i.test(message)) return new RunFailure("unavailable", "billing");
  if (status === 401 || status === 403 || type === "authentication_error" || type === "permission_error") return new RunFailure("unauthorized");
  if (status === 429 || type === "rate_limit_error") return new RunFailure("rate_limited");
  if (status === 413 || /too[ _]long|request_too_large/i.test(`${type ?? ""} ${message}`)) return new RunFailure("too_large");
  if (status === 404 || type === "not_found_error") return new RunFailure("unavailable", "model_unavailable");
  if (status === 529 || type === "overloaded_error") return new RunFailure("unavailable", "overloaded");
  if (status === 400 || type === "invalid_request_error") return new RunFailure("unavailable", "bad_request");
  return new RunFailure("unavailable", "server_error");
}

/**
 * Calls the Anthropic Messages API with forced tool use for one kind of run, and validates the tool's
 * input with the matching Zod schema. Never logs, throws or returns the request/response body, the key
 * or the prompt; on any failure only an error code crosses this function's boundary.
 */
export async function runTool(args: RunToolArgs): Promise<RunToolResult> {
  const fetchImpl = args.fetchImpl ?? ((url, init) => fetch(url, init));
  const tool = args.kind === "ASSESSMENT" ? assessmentTool : summaryTool;
  const system = args.kind === "ASSESSMENT" ? ASSESSMENT_SYSTEM_PROMPT : SUMMARY_SYSTEM_PROMPT;
  const base = args.apiUrl.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetchImpl(`${base}/v1/messages`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "x-api-key": args.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: args.input }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
    });
  } catch {
    return { ok: false, error: "unavailable", reason: "network" };
  }

  try {
    if (!response.ok) throw await failureFor(response);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new RunFailure("unavailable");
    }
    const message = messageSchema.safeParse(body);
    if (!message.success) throw new RunFailure("invalid_output");

    const block = message.data.content.find((item): item is { type: "tool_use"; name: string; input: unknown } => item.type === "tool_use" && item.name === tool.name);
    if (!block) throw new RunFailure("invalid_output");

    const model = message.data.model ?? args.model;
    const inputTokens = message.data.usage?.input_tokens ?? null;
    const outputTokens = message.data.usage?.output_tokens ?? null;

    if (args.kind === "ASSESSMENT") {
      const output = assessmentOutputSchema.safeParse(block.input);
      if (!output.success) throw new RunFailure("invalid_output");
      return { ok: true, output: output.data, recommendation: output.data.recommendation, inputTokens, outputTokens, model };
    }
    const output = summaryOutputSchema.safeParse(block.input);
    if (!output.success) throw new RunFailure("invalid_output");
    return { ok: true, output: output.data, inputTokens, outputTokens, model };
  } catch (error) {
    if (error instanceof RunFailure) return error.reason ? { ok: false, error: error.code, reason: error.reason } : { ok: false, error: error.code };
    return { ok: false, error: "unavailable" };
  }
}
