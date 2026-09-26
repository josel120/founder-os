# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-26)

- Merged on `master` (f26ff40): Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024), Finance OS (T-026..T-030), process cards T-012/T-025/T-031.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Migrations 0000..0005 exist (0005 not applied); the owner reports 0001..0004 applied locally. Historical rows were adopted per ADR-006.
- Last CI verification (PR #25, run `36086346324`): lint, typecheck, 145 unit tests, build, 16 authenticated/anonymous E2E passed.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 4: Research OS (current)

- Owner approved the phase order on 2026-09-26: Research OS → Distribution/portfolio → Integrations → AI execution.
- T-032 (planning) done, PR #27 merged: ADR-012 defines owner-scoped `evidence` records (kind, signal, optional http(s) source URL) attached to exactly one owned Problem or Idea. New table, `owner_id NOT NULL`, no historical rows to adopt.
- T-033 in review: `evidence` schema + migration `0005_research_evidence.sql` generated, not applied; 149 unit tests, lint, typecheck pass.
- Queue: T-034 apply locally (human) → T-035 domain (codex) → T-036 UI (codex) → T-037 E2E/privacy (claude).
- In parallel: T-038 (claude) closes the Projects cross-owner/anonymous E2E gaps from `docs/QA-T024-FOLLOWUP.md` (still untracked; T-038 commits it).

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
