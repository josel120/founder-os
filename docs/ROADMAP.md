# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**Between phases.** Finance OS (Phase 3) is merged (PR #25, 3cdbc76). The next phase has not been chosen.

Open before the next phase:
- `docs/QA-T024-FOLLOWUP.md`: cross-owner and anonymous-mutation E2E gaps for Projects. Needs a card.

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E | T-017..T-024 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| Process | Agent coordination, branch/PR per card | T-012, T-025 | done |

## Next (candidates, not ordered or approved)

From the product vision in `docs/PRD.md`. A phase starts with a planning card, as T-017 and T-026 did.

- **Research OS**: research workflows linked to problems and ideas.
- **Distribution / portfolio**: explicit publishing of chosen records; everything else stays PRIVATE (ADR-003).
- **Integrations**: GitHub as source of truth for technical work; finance imports.
- **AI execution**: a real provider behind the `AIService` interface (ADR-004); humans still decide.
