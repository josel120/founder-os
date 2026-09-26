# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Phase 5: Workspace cockpit** (in progress). Phase 4 closed with PR #33 and PR #34, which also merged the plans ADR-015 (cockpit) and ADR-016 (production readiness). PR #35 merged T-046, T-049, T-050 and T-054; PR #36 carries T-047 and T-048 (the `/private` home, now the login landing). T-051 (cockpit E2E and privacy sweep) closes the phase. Phase 6 cards T-052, T-053 and T-055 can run in parallel; T-056/T-057 are human.

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E (cross-owner gaps closed by T-038) | T-017..T-024, T-038 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas: domain, `/private/research`, idea evidence, cross-owner/anonymous E2E, privacy sweep | T-032..T-037, T-040 | merged (PR #32, #33, #34) |
| Process | Agent coordination, branch/PR per card, phase roadmap, review subagents | T-012, T-025, T-031, T-039, T-043 | done |

## Next (ADR-013; the owner reorders by merging a roadmap change)

Each phase starts with a planning card, as T-017, T-026 and T-032 did. Planning cards for phases 7–10 are created when the phase before ends.

| # | Phase | Scope | Planning card | Why here |
|---|---|---|---|---|
| 5 | Workspace cockpit | `/private` home with what needs attention, Problem detail and edit, Problem → Idea → Project → Finance links | T-041 → ADR-015, T-047..T-051 | Connects Phases 1–4, as the PRD promises. Private and read-mostly |
| 6 | Production readiness | Hosting and production DB, migration runbook, backup drill, auth rate limits, PII-free error reporting, privacy audit (headers done: ADR-014, T-045) | T-042 → ADR-016, T-052..T-058 | Nothing is deployed yet. Must come before anything is public |
| 7 | Distribution / portfolio | Explicit publishing of chosen records; everything else stays PRIVATE (ADR-003) | later | First public surface |
| 8 | GitHub integration | GitHub as source of truth for technical work, linked to Projects | later | Needs production for callbacks and webhooks |
| 9 | Finance imports | File or bank imports, duplicate `external_id` policy (ADR-011) | later | Separate risk from GitHub |
| 10 | AI execution | A real provider behind `AIService` (ADR-004); humans still decide | later | Needs the data and the audits above |
