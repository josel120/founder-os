# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-26)

- Merged on `master` (1815201): Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024, T-038), Finance OS (T-026..T-030), Research OS (T-032..T-037, T-040), audit T-043/T-044/T-045, plans T-041/T-042, Workspace cockpit T-046..T-051, Phase 6 code T-052..T-055 and T-059..T-062, process cards T-012/T-025/T-031/T-039.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-014, T-043): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 21 advisories (1 critical) → 3 dev-only (T-043) → 0 (T-044).
- Migrations 0000..0007 exist on `master`; 0000..0006 applied locally (T-034). The owner applies 0007 (`rate_limit`, T-053) with `pnpm db:migrate` on master; the T-053 code in production mode needs it. Historical rows were adopted per ADR-006.
- Last CI verification (PR #39, run `36275054185`): lint, typecheck, 420 unit tests, build, 37/37 authenticated/anonymous E2E passed.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 6: Production readiness (code done; deploy is the owner's one command)

- PR #37: T-052 fail-fast env on Vercel, pooled DB options; T-053 DB-backed auth rate limit (migration 0007); T-055 `docs/RUNBOOK.md`.
- PR #39: T-059 prunes `rate_limit` IPs after 24 h; T-060 `migrate` E2E project; T-061 fixes lost client updates (bundled React ping bug, `patches/next@15.5.26.patch`, ADR-017: 0/100 lost after); T-062 `pnpm setup:production` (Vercel login, Neon via Marketplace for production only, secrets generated locally, migrations, owner, deploy, smoke check).
- **Deployed (2026-09-27):** the owner ran `pnpm setup:production`, reset the owner credentials (T-063) and signs in on production after the same-origin sign-in fix (T-064, PR #41). Remaining: T-057 restore drill (owner), T-058 smoke check.

## Phase 5: Workspace cockpit (done, PR #35–#37)

- ADR-015 merged in PR #34; its open questions run on the proposed defaults (14-day waiting threshold, land on `/private`, 30-day finance, search later).
- PR #35: T-046 (queries never select `owner_id`/`visibility`), T-049 (Problem detail + edit + evidence), T-050 (Project → Idea/Finance), T-054 (`reportError`). PR #36: T-047 `getAttention` and T-048 `/private` home, now the login landing.
- T-051: `cockpit.auth.spec.ts` (home items and links, problem edit/ideas/evidence, project chain, owner B absent everywhere incl. a B transaction on A's project and a cross-owner origin idea, anonymous replay) + `/private` in the anonymous spec. Local: 35/35 E2E.

## Plan and process (T-039, merged)

- ADR-013 extends the phase plan after Research: 5 Workspace cockpit (T-041, codex) → 6 Production readiness (T-042, claude) → 7 Distribution → 8 GitHub integration → 9 Finance imports → 10 AI execution. Merging T-039 approves it.
- New Claude subagents: `schema-reviewer` (schema/migration cards), `privacy-auditor` (phase-close and public-surface cards) and `ci-triager` (failed CI runs). `/next-task` now marks merged `review` cards `done`.

## Audit (T-043, done, PR #31 merged)

- Owner-requested security/bug/UX sweep on `claude/vibrant-sagan-e95o5p`. Fixes: idea description limit < problem limit (converted ideas could not be saved), server-time-zone shift of Finance dates, lowercase currency rejected, numeric overflow, truncated slugs ending in `-` (project became uneditable), generic slug-collision error, base CSS overriding Tailwind utilities. Adds Finance totals per currency (exact BigInt), cross-links between decisions/problems/ideas/projects, mobile nav, private error/loading/404. Local gate: 208 unit, build, 20/20 E2E.
- Follow-ups: T-044 done in PR #33; T-045 nonce-based `script-src` CSP (claude; overlaps Production readiness, T-042).

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
