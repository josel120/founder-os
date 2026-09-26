# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-26)

- Merged on `master` (bedac22): Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024, E2E gaps closed by T-038), Finance OS (T-026..T-030), Research T-032/T-033, process cards T-012/T-025/T-031.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-014, T-043): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 21 advisories (1 critical) → 3 moderate, dev-only (T-044).
- Migrations 0000..0005 exist (0005 not applied); the owner reports 0001..0004 applied locally. Historical rows were adopted per ADR-006.
- Last CI verification (PR #29, run `36259034146`): lint, typecheck, 149 unit tests, build, 18/18 authenticated/anonymous E2E passed.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 4: Research OS (current)

- T-032 (planning) done, PR #27 merged: ADR-012 defines owner-scoped `evidence` records (kind, signal, optional http(s) source URL) attached to exactly one owned Problem or Idea. New table, `owner_id NOT NULL`, no historical rows to adopt.
- T-033 done, PR #28 merged: `evidence` schema + migration `0005_research_evidence.sql`, not applied. Two later reviews found missing parent indexes, silent kind/signal defaults, no `$onUpdate` and weak schema tests → T-040 (migration 0006) runs before T-034 so the human applies both at once.
- T-040 in review: migration `0006_evidence_hardening.sql` drops the kind/signal defaults and indexes problem_id/idea_id; `updatedAt.$onUpdate`. Applied cleanly with 0000..0005 on a fresh Postgres; 214 unit tests.
- Queue: T-034 apply 0005+0006 (human) → T-035 domain → T-036 UI → T-037 E2E + privacy audit.
- T-038 done, PR #29 merged: cross-owner (seeded owner B) and anonymous server-action E2E for Projects; `docs/QA-T024-FOLLOWUP.md` resolved. No product bug found.

## Plan and process (T-039, in review)

- ADR-013 extends the phase plan after Research: 5 Workspace cockpit (T-041, codex) → 6 Production readiness (T-042, claude) → 7 Distribution → 8 GitHub integration → 9 Finance imports → 10 AI execution. Merging T-039 approves it.
- New Claude subagents: `schema-reviewer` (schema/migration cards), `privacy-auditor` (phase-close and public-surface cards) and `ci-triager` (failed CI runs). `/next-task` now marks merged `review` cards `done`.
- Done board rows moved to `docs/agents/archive/board-done.md`.

## Audit (T-043, done, PR #31 merged)

- Owner-requested security/bug/UX sweep on `claude/vibrant-sagan-e95o5p`. Fixes: idea description limit < problem limit (converted ideas could not be saved), server-time-zone shift of Finance dates, lowercase currency rejected, numeric overflow, truncated slugs ending in `-` (project became uneditable), generic slug-collision error, base CSS overriding Tailwind utilities. Adds Finance totals per currency (exact BigInt), cross-links between decisions/problems/ideas/projects, mobile nav, private error/loading/404. Local gate: 208 unit, build, 20/20 E2E.
- Follow-ups: T-044 Vitest 4 (codex), T-045 nonce-based `script-src` CSP (claude; overlaps Production readiness, T-042).

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
