# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Phases 7, 8 and 9 are merged and live** (ADR-018, ADR-019, ADR-020). Production has migrations 0000–0010 (0008–0010 applied 2026-09-27 after snapshot `pre-0008-20260927`).
- Portfolio: the owner publishes chosen projects; `/portfolio` and `/p/<slug>` show allowlisted fields only, `noindex`.
- GitHub: a private repository snapshot per project, refresh button, daily cron, quiet repositories on the home. Waits on the owner's read-only token and cron secret (T-074); until then the panel says GitHub is not connected.
- Finance imports: CSV mapping, preview, confirm, duplicates skipped on re-import, undo per import.

**Phase 10, AI execution** (ADR-021) is built and verified in stacked PRs #60–#65: an owner-triggered second opinion on an idea (assessment and research summary) from Anthropic's API, recorded in `ai_run` (0011); it never changes a status. It waits on the owner: API key, spend limit and approval to apply 0011 (T-085), then the merges. Still open: the restore drill (T-057) and T-074.

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E (cross-owner gaps closed by T-038) | T-017..T-024, T-038 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas: domain, `/private/research`, idea evidence, cross-owner/anonymous E2E, privacy sweep | T-032..T-037, T-040 | merged (PR #32, #33, #34) |
| 5. Workspace cockpit | `/private` home (what needs attention, login landing), Problem detail + edit + evidence, Project → Idea/Finance chain, explicit query columns, cross-owner/anonymous E2E | T-041, T-046..T-051 | merged (PR #34, #35, #36, #37) |
| 7. Distribution / portfolio | Publish chosen projects (`project_publication`, 0008), allowlisted public pages, owner publish panel with preview, pre-public privacy audit | T-065..T-071 | merged (PR #44..#49) |
| 8. GitHub integration | Read-only snapshot per project (0009), refresh + daily cron, quiet repositories; token pending (T-074) | T-072..T-077 | merged (PR #50, #51, #53, #55, #58) |
| 9. Finance imports | CSV import with mapping, preview, duplicate keys (0010) and undo | T-078..T-082 | merged (PR #52, #54, #56, #57, #59) |
| 6. Production readiness | Vercel + Neon deploy, one-command setup, fail-fast env, DB rate limits, runbook, `reportError`, lost-update fix, same-origin sign-in, deployed smoke check (`pnpm smoke`); restore drill T-057 still open | T-042, T-052..T-064 | merged (PR #37, #39..#43) |
| Process | Agent coordination, branch/PR per card, phase roadmap, review subagents | T-012, T-025, T-031, T-039, T-043 | done |

## Next (ADR-013; the owner reorders by merging a roadmap change)

Each phase starts with a planning card, as T-017, T-026 and T-032 did.

| # | Phase | Scope | Planning card | Why here |
|---|---|---|---|---|
| 10 | AI execution | Owner-triggered idea assessment and research summary via Anthropic behind `AIService` (ADR-004, ADR-021); `ai_run` record (0011); humans still decide | T-083 (done) | Needs the data and the audits above |
