# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-26)

- Merged on `master` (26d4d5b): Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024, T-038), Finance OS (T-026..T-030), Research OS (T-032..T-037, T-040), audit T-043/T-044/T-045, plans T-041/T-042, Workspace cockpit T-046..T-051, Phase 6 code T-052..T-055, process cards T-012/T-025/T-031/T-039.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-014, T-043): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 21 advisories (1 critical) → 3 dev-only (T-043) → 0 (T-044).
- Migrations 0000..0007 exist on `master`; 0000..0006 applied locally (T-034). The owner applies 0007 (`rate_limit`, T-053) with `pnpm db:migrate` on master; the T-053 code in production mode needs it. Historical rows were adopted per ADR-006.
- Last CI verification (PR #37, run `36270241621`): lint, typecheck, 329 unit tests, build, 36/36 authenticated/anonymous E2E passed.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 4: Research OS (done: PR #33 merged, E2E in PR #34)

- ADR-012 (+ T-040 amendment): owner-scoped `evidence` on exactly one owned problem or idea; no kind/signal defaults; parent indexes. Migrations 0005 + 0006 merged (PR #28, #32) and applied locally (T-034).
- T-035 domain, T-036 UI (`/private/research`, idea Evidence section) and T-037 E2E (happy path, `javascript:` link, seeded owner B, anonymous replays) in PR #33 (merged) and #34. Local: 262 unit, 29/29 E2E. privacy-auditor: clean; optional finding → T-046.
- Bug found in T-035: the Projects URL refine threw inside `safeParse` on non-URL input; fixed with `z.url({ protocol })`.

## Phase 5: Workspace cockpit (done, PR #35–#37)

- ADR-015 merged in PR #34; its open questions run on the proposed defaults (14-day waiting threshold, land on `/private`, 30-day finance, search later).
- PR #35: T-046 (queries never select `owner_id`/`visibility`), T-049 (Problem detail + edit + evidence), T-050 (Project → Idea/Finance), T-054 (`reportError`). PR #36: T-047 `getAttention` and T-048 `/private` home, now the login landing.
- T-051: `cockpit.auth.spec.ts` (home items and links, problem edit/ideas/evidence, project chain, owner B absent everywhere incl. a B transaction on A's project and a cross-owner origin idea, anonymous replay) + `/private` in the anonymous spec. Local: 35/35 E2E.
- Phase 6 code merged in PR #37: T-052 (fail-fast env on Vercel or `FOUNDER_OS_STRICT_ENV=1`, pooled DB options, `@neondatabase/serverless` removed), T-053 (DB-backed auth rate limit, 5 sign-ins/60 s/IP, migration 0007), T-055 (`docs/RUNBOOK.md`). Written by subagents in worktrees, reviewed and integrated here. Human T-056 started: Vercel is connected, but its first preview build failed (likely pnpm 12 without corepack; see the PR #37 comment and RUNBOOK section 3). Open claude cards: T-059, T-060, T-061 (client updates lost after server actions, with a reproduction).

## Plan and process (T-039, merged)

- ADR-013 extends the phase plan after Research: 5 Workspace cockpit (T-041, codex) → 6 Production readiness (T-042, claude) → 7 Distribution → 8 GitHub integration → 9 Finance imports → 10 AI execution. Merging T-039 approves it.
- New Claude subagents: `schema-reviewer` (schema/migration cards), `privacy-auditor` (phase-close and public-surface cards) and `ci-triager` (failed CI runs). `/next-task` now marks merged `review` cards `done`.

## Audit (T-043, done, PR #31 merged)

- Owner-requested security/bug/UX sweep on `claude/vibrant-sagan-e95o5p`. Fixes: idea description limit < problem limit (converted ideas could not be saved), server-time-zone shift of Finance dates, lowercase currency rejected, numeric overflow, truncated slugs ending in `-` (project became uneditable), generic slug-collision error, base CSS overriding Tailwind utilities. Adds Finance totals per currency (exact BigInt), cross-links between decisions/problems/ideas/projects, mobile nav, private error/loading/404. Local gate: 208 unit, build, 20/20 E2E.
- Follow-ups: T-044 done in PR #33; T-045 nonce-based `script-src` CSP (claude; overlaps Production readiness, T-042).

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
