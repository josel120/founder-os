# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Phase 6: Production readiness** (in progress, ADR-016). Phase 5 closed with PR #37. The Phase 6 code and runbook are merged (T-052 fail-fast env, T-053 database rate limit with migration 0007, T-054 private-safe error reports, T-055 `docs/RUNBOOK.md`). The owner has connected Vercel (T-056); next they finish its setup and deploy a preview, then run production migrations and a restore drill (T-057). T-058 smoke-checks the deployment. Follow-ups from the reviews: T-059 (rate-limit IP retention), T-060 (E2E migration race), T-061 (client updates lost after server actions).

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E (cross-owner gaps closed by T-038) | T-017..T-024, T-038 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas: domain, `/private/research`, idea evidence, cross-owner/anonymous E2E, privacy sweep | T-032..T-037, T-040 | merged (PR #32, #33, #34) |
| 5. Workspace cockpit | `/private` home (what needs attention, login landing), Problem detail + edit + evidence, Project → Idea/Finance chain, explicit query columns, cross-owner/anonymous E2E | T-041, T-046..T-051 | merged (PR #34, #35, #36, #37) |
| Process | Agent coordination, branch/PR per card, phase roadmap, review subagents | T-012, T-025, T-031, T-039, T-043 | done |

## Next (ADR-013; the owner reorders by merging a roadmap change)

Each phase starts with a planning card, as T-017, T-026 and T-032 did. Planning cards for phases 7–10 are created when the phase before ends.

| # | Phase | Scope | Planning card | Why here |
|---|---|---|---|---|
| 6 | Production readiness (current) | Hosting and production DB, migration runbook, backup drill, auth rate limits, PII-free error reporting (T-054 done), privacy audit (headers done: ADR-014, T-045) | T-042 → ADR-016, T-052..T-058 | Nothing is deployed yet. Must come before anything is public |
| 7 | Distribution / portfolio | Explicit publishing of chosen records; everything else stays PRIVATE (ADR-003) | later | First public surface |
| 8 | GitHub integration | GitHub as source of truth for technical work, linked to Projects | later | Needs production for callbacks and webhooks |
| 9 | Finance imports | File or bank imports, duplicate `external_id` policy (ADR-011) | later | Separate risk from GitHub |
| 10 | AI execution | A real provider behind `AIService` (ADR-004); humans still decide | later | Needs the data and the audits above |
