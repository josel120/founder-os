# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-27)

- Merged on `master`: Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024, T-038), Finance OS (T-026..T-030), Research OS (T-032..T-037, T-040), audit T-043/T-044/T-045, plans T-041/T-042, Workspace cockpit T-046..T-051, Phase 6 T-052..T-056, T-058..T-064, Phase 7 T-065/T-066, process cards T-012/T-025/T-031/T-039.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-014, T-043): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 21 advisories (1 critical) → 3 dev-only (T-043) → 0 (T-044).
- Migrations 0000..0008 exist on `master`; production has 0000..0007 (applied by `pnpm setup:production`). Historical rows were adopted per ADR-006.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 7: Distribution and portfolio (built; waits on migration 0008 in production)

- T-065 ADR-018 (PR #44) and T-066 `project_publication` + migration 0008 (PR #45) merged; 0008 is not yet applied in production (T-067, owner).
- Stacked draft PRs: #46 T-068 publish actions + allowlisted public queries, #47 T-070 `/portfolio` and `/p/<slug>`, #48 T-069 owner publish panel, T-071 E2E. Merge in that order after T-067.
- Verified: 482 unit tests; full E2E 41/41 on a production build (anonymous HTML/RSC has no private sentinels, forged owner-mismatched publication shows nothing, private and unknown slugs share one 404, cross-owner and anonymous publish/unpublish refused, unpublish immediate). Privacy audits (stronger model) on T-068, T-070 and the phase.

## Phase 6: Production readiness (code done; deploy is the owner's one command)

- PR #37: T-052 fail-fast env on Vercel, pooled DB options; T-053 DB-backed auth rate limit (migration 0007); T-055 `docs/RUNBOOK.md`.
- PR #39: T-059 prunes `rate_limit` IPs after 24 h; T-060 `migrate` E2E project; T-061 fixes lost client updates (bundled React ping bug, `patches/next@15.5.26.patch`, ADR-017: 0/100 lost after); T-062 `pnpm setup:production` (Vercel login, Neon via Marketplace for production only, secrets generated locally, migrations, owner, deploy, smoke check).
- **Deployed (2026-09-27):** the owner ran `pnpm setup:production`, reset the owner credentials (T-063) and signs in on production after the same-origin sign-in fix (T-064, PR #41). Remaining: T-057 restore drill (owner).
- T-058 (2026-09-27): production smoke check passes (CSP nonce, HSTS, frame/referrer/permissions, noindex, `/register` closed, anonymous session `null`); `pnpm smoke <url>` is now the single check (also used by `pnpm setup:production`, RUNBOOK section 10). Privacy-auditor sweep: clean.

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
