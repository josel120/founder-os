# Token policy (all agents)

Goal: spend tokens on changing code, not on rediscovering context.

## Reading

- Load order: AGENTS.md → `docs/agents/CONTEXT.md` → your task card. Stop there unless the card needs more.
- Search before reading: grep/glob for the symbol, then read only the relevant line range.
- Never read: `node_modules/`, `.next/`, `pnpm-lock.yaml`, `src/db/migrations/meta/*.json`, `work/*.dump`, `test-results/`, `tsconfig.tsbuildinfo`.
- Do not open `docs/agents/archive/` or long ADRs unless the card links a specific section.
- Do not re-read a file you just wrote or edited.

## Running commands

- While iterating, run targeted checks: one test file, eslint on changed files, `pnpm typecheck`.
- Run the full gate (`pnpm lint`, `pnpm typecheck`, `node scripts/test-sandbox.mjs`) once, before moving a card to `review`.
- Truncate noisy output: `… 2>&1 | tail -40`. Never paste full logs into docs or chat.
- Check the known failures in CONTEXT.md before debugging an environment error.
- Do not re-run checks the last handoff already reported for unchanged files.

## Sessions

- One card per session. Open a fresh chat or session for the next card; the handoff carries the context.
- A size-S card should close in one short session. If a card grows, split it into new cards instead of extending the session.
- Use the cheapest capable agent or model (see `ROUTING.md`). Exploration goes to cheap subagents, and only their summary comes back.

## Writing

- Docs and handoffs: facts only, bullets, no narrative. Handoff ≤15 lines. `PROGRESS.md` ≤40 lines.
- Record exact commands and exit codes. Never write "tests pass" without them.
- Code: no speculative abstractions, no comments restating the code, no unrelated refactors.
