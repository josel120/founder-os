# Founder OS agent guide

## Engineering rules

- Respect the modular architecture and domain boundaries under `src/modules`.
- Keep TypeScript strict and do not use `any` without exceptional, documented justification.
- Keep important domain logic out of React components; use actions, queries, schemas and services.
- Never expose `PRIVATE` information through public routes, metadata, logs or client payloads.
- Enforce authorization server-side and validate external inputs with Zod.
- Do not add dependencies without a clear justification; do not create duplicate APIs or services.
- Never rewrite old migrations casually. Add a new migration for schema changes.
- Add or update tests whenever behavior changes; run lint, typecheck and tests before declaring work complete.
- Document important architectural decisions in `docs/DECISIONS.md`.

## Workflow (token budget)

Several agents (ChatGPT, Codex, Claude Code) share this repo and pass tasks through files.

1. Read `docs/agents/CONTEXT.md` and follow `docs/agents/TOKEN_POLICY.md`.
2. Work only on a task card: `docs/agents/tasks/T-XXX.md`. No card → create one from `_TEMPLATE.md` first.
3. Before editing, set the card and its `BOARD.md` row to `doing` with your agent name. Never edit files in scope of another `doing` card.
4. Stay inside the card's "Files in scope". Read other files only if needed, and note why in the handoff.
5. Finish every session by filling the card's Handoff block and updating `BOARD.md` and `docs/PROGRESS.md`.
6. Stuck twice on the same step, or past 2× the size budget: stop, set `blocked`, hand off per `docs/agents/ROUTING.md`.
7. Migrations against real data, secrets, deploys, merges and pushes need explicit human approval.
