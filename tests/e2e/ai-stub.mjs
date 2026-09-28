// ADR-021 / ADR-024: a tiny local stub of Groq's OpenAI-compatible chat completions API (POST /chat/completions, the
// production path) and of the Anthropic Messages API (POST /v1/messages), used only by authenticated E2E runs
// (playwright.config.ts starts it next to the GitHub stub). No dependencies. Requests must carry the E2E key
// (`authorization: Bearer <E2E_AI_KEY>` for Groq, `x-api-key` for Anthropic) or get a 401.
// Each accepted request body is kept in memory and served at GET /__requests (localhost only), so the spec can check
// exactly what the app sent. Responses carry an obviously fake "SECRET" marker in a text block the app must ignore.

import http from "node:http";

const PORT = Number(process.env.AI_STUB_PORT || 4011);
const KEY = process.env.E2E_AI_KEY || "";
const SECRET = "SECRET-ai-stub-must-never-leak-5d1e07";
const requests = [];

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const ASSESSMENT = { recommendation: "INVESTIGATE_MORE", rationale: "Two interviews are not enough. <b>not bold</b>", risks: ["Small sample"], openQuestions: ["Who pays for it?"] };
const SUMMARY = { overview: "The evidence leans positive.", supports: ["Owners want it"], contradicts: [], openQuestions: ["Pricing"] };
const outputs = { idea_assessment: ASSESSMENT, research_summary: SUMMARY };

function groqAnswer(tool, input) {
  return {
    id: "chatcmpl-e2e", object: "chat.completion", model: "llama-e2e",
    choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: `Thinking out loud. ${SECRET}`, tool_calls: [{ id: "call_e2e", type: "function", function: { name: tool, arguments: JSON.stringify(input) } }] } }],
    usage: { prompt_tokens: 321, completion_tokens: 54 },
  };
}

function answer(tool, input) {
  return {
    id: "msg_e2e", type: "message", role: "assistant", model: "claude-sonnet-5-e2e",
    content: [{ type: "text", text: `Thinking out loud. ${SECRET}` }, { type: "tool_use", id: "toolu_e2e", name: tool, input }],
    stop_reason: "tool_use", usage: { input_tokens: 321, output_tokens: 54 },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (req.method === "GET" && url.pathname === "/__requests") return send(res, 200, requests);
  const groq = req.method === "POST" && url.pathname === "/chat/completions";
  if (!groq && (req.method !== "POST" || url.pathname !== "/v1/messages")) return send(res, 404, { type: "error", error: { type: "not_found_error" } });
  const authorized = groq ? req.headers.authorization === `Bearer ${KEY}` : req.headers["x-api-key"] === KEY;
  if (!authorized) return send(res, 401, { error: { type: "authentication_error", code: "invalid_api_key", message: SECRET } });

  let raw = "";
  req.on("data", (chunk) => { raw += chunk; });
  req.on("end", () => {
    let body;
    try { body = JSON.parse(raw); } catch { return send(res, 400, { type: "error", error: { type: "invalid_request_error" } }); }
    requests.push({ path: url.pathname, headers: { "anthropic-version": req.headers["anthropic-version"] }, body });
    const text = JSON.stringify(body.messages ?? []);
    if (text.includes("E2E-AI-FAIL-429")) return send(res, 429, { error: { type: "rate_limit_error", code: "rate_limit_exceeded", message: SECRET } });
    if (groq) {
      const tool = body.tool_choice?.function?.name;
      return outputs[tool] ? send(res, 200, groqAnswer(tool, outputs[tool])) : send(res, 400, { error: { type: "invalid_request_error" } });
    }
    const tool = body.tool_choice?.name;
    if (tool === "idea_assessment") {
      return send(res, 200, answer(tool, ASSESSMENT));
    }
    if (tool === "research_summary") {
      return send(res, 200, answer(tool, SUMMARY));
    }
    return send(res, 400, { type: "error", error: { type: "invalid_request_error" } });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ai-stub listening on ${PORT}`);
});
