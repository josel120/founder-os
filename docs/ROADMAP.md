# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Phase 7: Distribution and portfolio** (ADR-018). Built and verified: the owner publishes a project from its page (summary, Public or Unlisted, a preview of exactly what becomes public, confirm steps); visitors see `/portfolio` and `/p/<slug>` with allowlisted fields only; making it private again is immediate. Full E2E suite green (41 tests), pre-public privacy audit done. **Waiting on the owner:** migration 0008 in production (T-067), then Claude merges the stacked PRs #46 → #47 → #48 → T-071. Nothing becomes public until the owner publishes a project.

**Phases 8 and 9 (ADR-019, ADR-020, planned by T-072)** are being built in parallel: read-only GitHub activity on projects (token and cron secret: T-074, owner) and CSV imports into the ledger with duplicate protection and undo.

Still open from Phase 6: the restore drill (T-057, owner). Deployed smoke check and privacy sweep passed (T-058).

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E (cross-owner gaps closed by T-038) | T-017..T-024, T-038 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas: domain, `/private/research`, idea evidence, cross-owner/anonymous E2E, privacy sweep | T-032..T-037, T-040 | merged (PR #32, #33, #34) |
| 5. Workspace cockpit | `/private` home (what needs attention, login landing), Problem detail + edit + evidence, Project → Idea/Finance chain, explicit query columns, cross-owner/anonymous E2E | T-041, T-046..T-051 | merged (PR #34, #35, #36, #37) |
| 6. Production readiness | Vercel + Neon deploy, one-command setup, fail-fast env, DB rate limits, runbook, `reportError`, lost-update fix, same-origin sign-in, deployed smoke check (`pnpm smoke`); restore drill T-057 still open | T-042, T-052..T-064 | merged (PR #37, #39..#43) |
| Process | Agent coordination, branch/PR per card, phase roadmap, review subagents | T-012, T-025, T-031, T-039, T-043 | done |

## Next (ADR-013; the owner reorders by merging a roadmap change)

Each phase starts with a planning card, as T-017, T-026 and T-032 did. Planning cards for phases 7–10 are created when the phase before ends.

| # | Phase | Scope | Planning card | Why here |
|---|---|---|---|---|
| 7 | Distribution / portfolio (current) | Publish chosen projects: `/portfolio`, `/p/<slug>`, allowlisted fields, stacked PRs behind migration 0008 | T-065 → ADR-018, T-066..T-071 | First public surface |
| 8 | GitHub integration (in progress) | Read-only repository snapshot per project (token, manual refresh, daily cron), stale-repo attention | T-072 → ADR-019, T-073..T-077 | Needs production for callbacks and webhooks |
| 9 | Finance imports (in progress) | CSV import with mapping, preview, duplicate keys and undo | T-072 → ADR-020, T-078..T-082 | Separate risk from GitHub |
| 10 | AI execution | A real provider behind `AIService` (ADR-004); humans still decide | later | Needs the data and the audits above |
