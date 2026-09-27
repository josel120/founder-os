# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-27)

- Merged on `master`: Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024, T-038), Finance OS (T-026..T-030), Research OS (T-032..T-037, T-040), audit T-043/T-044/T-045, plans T-041/T-042, Workspace cockpit T-046..T-051, Phase 6 T-052..T-056, T-058..T-064, Phase 7 T-065..T-071, Phase 8 T-072/T-073/T-075, process cards T-012/T-025/T-031/T-039.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-014, T-043): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 0 advisories (T-044).
- Migrations 0000..0010; production has all of them (0008–0010 applied 2026-09-27 by Claude with the owner's approval, after snapshot `pre-0008-20260927`). Historical rows were adopted per ADR-006.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phases 8–9 (built 2026-09-27)

- ADR-019 GitHub: read-only token (T-074 owner), `project_github` snapshot (0009), refresh + daily cron, quiet repos on home. ADR-020 imports: CSV mapping/preview/confirm/undo, `import_key` duplicate index (0010). PRs merge after Phase 7.

## Phase 7: Distribution and portfolio (merged)

- ADR-018: publish chosen projects only (`project_publication`, 0008), field allowlist, `/portfolio` and `/p/<slug>`, owner publish panel with preview, `noindex` kept. PRs #44–#49; full E2E and pre-public privacy audits clean.

## Phase 6: Production readiness (done except the T-057 restore drill)

- PRs #37, #39, #41, #43: fail-fast env, DB rate limits (0007), runbook, `reportError`, lost-update fix (ADR-017), `pnpm setup:production` with owner reset, same-origin sign-in, `pnpm smoke`. Deployed 2026-09-27; the owner signs in; production smoke check and privacy sweep clean (T-058).

## Phase 5: Workspace cockpit (done, PR #35–#37)

- ADR-015 merged in PR #34; its open questions run on the proposed defaults (14-day waiting threshold, land on `/private`, 30-day finance, search later).
- PR #35: T-046 (queries never select `owner_id`/`visibility`), T-049 (Problem detail + edit + evidence), T-050 (Project → Idea/Finance), T-054 (`reportError`). PR #36: T-047 `getAttention` and T-048 `/private` home, now the login landing.
- T-051: `cockpit.auth.spec.ts` (home items and links, problem edit/ideas/evidence, project chain, owner B absent everywhere incl. a B transaction on A's project and a cross-owner origin idea, anonymous replay) + `/private` in the anonymous spec. Local: 35/35 E2E.

## Plan and process (T-039, merged)

- ADR-013 extends the phase plan after Research: 5 Workspace cockpit (T-041, codex) → 6 Production readiness (T-042, claude) → 7 Distribution → 8 GitHub integration → 9 Finance imports → 10 AI execution. Merging T-039 approves it.
- New Claude subagents: `schema-reviewer` (schema/migration cards), `privacy-auditor` (phase-close and public-surface cards) and `ci-triager` (failed CI runs). `/next-task` now marks merged `review` cards `done`.

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
