# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Phase view: `docs/ROADMAP.md`. Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-26)

- Merged on `master` (bedac22): Phase 0 foundation, Idea OS (T-001..T-016), Project OS (T-017..T-024), Finance OS (T-026..T-030), T-033, T-038, process cards T-012/T-025/T-031.
- Security model: owner-only access via `OWNER_EMAIL`, closed signup, every private query/mutation uses session owner + `id + owner_id + PRIVATE` (ADR-005/006/008/009/011).
- Web layer (ADR-013, T-039): security headers, `noindex`, cookie-presence middleware for `/private` pages with a validated `?next=`, sign-out, closed `/register` page. `pnpm audit`: 21 advisories (1 critical) → 3 moderate, dev-only (T-040).
- Migrations 0000..0005 exist (0005 not applied); the owner reports 0001..0004 applied locally. Historical rows were adopted per ADR-006.
- Last CI verification (PR #25, run `36086346324`): lint, typecheck, 145 unit tests, build, 16 authenticated/anonymous E2E passed.
- Branch/PR per card (ADR-010). Merges, force pushes, pushes to `master`, real-data migrations and secrets stay human.

## Phase 4: Research OS (current)

- Owner approved the phase order on 2026-09-26: Research OS → Distribution/portfolio → Integrations → AI execution.
- T-032 (planning) done, PR #27 merged: ADR-012 defines owner-scoped `evidence` records (kind, signal, optional http(s) source URL) attached to exactly one owned Problem or Idea. New table, `owner_id NOT NULL`, no historical rows to adopt.
- T-033 done, PR #28 merged: `evidence` schema + migration `0005_research_evidence.sql` generated, not applied.
- Queue: T-034 apply locally (human) → T-035 domain (codex) → T-036 UI (codex) → T-037 E2E/privacy (claude).
- T-039 (claude) in review, PR #31 (`claude/vibrant-sagan-e95o5p`): owner-requested audit. Fixes: idea description limit < problem limit (converted ideas could not be saved), server-time-zone shift of Finance dates, lowercase currency rejected, numeric overflow, truncated slugs ending in `-` (project became uneditable), generic slug-collision error, CSS base styles overriding Tailwind utilities. Adds Finance totals per currency (exact BigInt), decision/problem/idea/project cross-links, mobile nav, private error/loading/404. Local gate: 208 unit, build, 20/20 E2E.
- Follow-ups: T-040 Vitest 4 (codex), T-041 nonce-based `script-src` CSP (claude).
- T-038 done, PR #29 merged. It adds cross-owner (seeded owner B) and anonymous server-action E2E for Projects and commits `docs/QA-T024-FOLLOWUP.md` with a resolution. CI run `36259034146`: 149 unit and 18/18 E2E passed. No product bug found.

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
