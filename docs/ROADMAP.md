# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Phase 4: Research OS (planning done).** Private evidence records on problems and ideas (ADR-012). Queue: T-033 schema + migration 0005 (claude) → T-034 apply locally (human) → T-035 domain (codex) → T-036 UI (codex) → T-037 E2E (claude).

In parallel: T-038 closes the Projects cross-owner and anonymous E2E gaps in `docs/QA-T024-FOLLOWUP.md`.

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E | T-017..T-024 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas | T-032..T-037 | in progress |
| Process | Agent coordination, branch/PR per card, phase roadmap | T-012, T-025, T-031 | done |

## Next (order approved by the owner, 2026-09-26)

Each phase starts with a planning card, as T-017, T-026 and T-032 did.

1. **Research OS**: research workflows linked to problems and ideas. Current phase.
2. **Distribution / portfolio**: explicit publishing of chosen records; everything else stays PRIVATE (ADR-003).
3. **Integrations**: GitHub as source of truth for technical work; finance imports.
4. **AI execution**: a real provider behind the `AIService` interface (ADR-004); humans still decide.
