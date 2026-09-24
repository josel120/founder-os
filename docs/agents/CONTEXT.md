# Project context (read this instead of exploring)

Founder OS: private, single-owner workspace connecting problems, ideas, projects, decisions and finance.
Phase 0 (secure foundation) is mostly done; Phase 1 (Idea OS) is in progress. Current state: `docs/PROGRESS.md`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Drizzle ORM + PostgreSQL (Neon/postgres-js) · Better Auth · Zod 4 · Vitest + Testing Library · Playwright · pnpm · Node ≥22 (CI: Node 24).

## Layout

| Path | Owns |
|---|---|
| `src/app` | Routing and composition only. `private/` = authenticated area, `login`, `register`, `api/auth/[...all]` |
| `src/modules/<domain>/{actions,queries,schemas,services,components}` | Domain behavior. Domains: `ideas`, `problems`, `ai` (interface only) |
| `src/db/schema/index.ts` | All tables (auth tables + Problem, Idea, Project, DecisionLog, FinanceTransaction) |
| `src/db/migrations` | Generated SQL. Never edit existing files; add new migrations |
| `src/lib/auth.ts`, `require-auth.ts`, `env.ts` | Better Auth config, owner check, env validation |
| `src/middleware.ts` | Redirects anonymous users away from `/private` |
| `tests/*.test.ts(x)` | Vitest unit tests. `tests/e2e/*.spec.ts` = Playwright |
| `work/` | Git-ignored scratch space (backups, temp). Never read `*.dump` files |

## Security invariants (see ADR-003, ADR-005, ADR-006 in `docs/DECISIONS.md`)

- Visibility defaults to `PRIVATE` in the database.
- Every private query or mutation gets the owner ID from the server session (`src/lib/require-auth.ts`). Never trust an ID sent by the client.
- `requireAuth()` always reads request headers first, so private pages stay dynamic. Never short-circuit before `headers()`, or builds without auth env prerender private pages as static login redirects.
- Access requires the session email to match `OWNER_EMAIL`. Public signup is closed.
- Predicates include `id + owner_id + PRIVATE`. Rows with a null `owner_id` stay inaccessible.
- Mutations return explicit results. Updates check `UPDATE … RETURNING` before reporting success.

## Known-good commands (Windows machine; use Bash)

| Purpose | Command |
|---|---|
| Unit tests (local) | `node scripts/test-sandbox.mjs` — plain `pnpm test` fails locally (esbuild "Access denied") |
| Single test file | `TEMP=work/test-temp TMP=work/test-temp pnpm exec vitest run --configLoader runner tests/<file>` |
| Typecheck | `pnpm typecheck` |
| Lint changed files | `pnpm exec eslint <files>` (full: `pnpm lint`) |
| Build | `pnpm build` — do not run it while another agent's dev/build is running |
| E2E | `pnpm test:e2e` — needs browser permission; Chromium may fail with `spawn EPERM` in sandboxes |
| Diff summary | `git diff --stat 2>/dev/null` (hides CRLF warnings) |

## Known environment failures (do not re-debug)

- `pnpm test` locally → esbuild cannot read `../../../..` → use `scripts/test-sandbox.mjs`.
- `pnpm db:seed` / tsx → `uv_os_get_passwd ENOMEM` inside sandbox. Seed is a no-op anyway.
- PowerShell scripts are blocked by execution policy. Use Node scripts; do not change the policy.
- Playwright in sandbox → `spawn EPERM`. Report it as blocked, not as failed.
- CI (`.github/workflows/ci.yml`) runs install, lint, typecheck, unit tests, build and E2E on Linux. CI is the source of truth for full E2E.

## Doc map (Tier 2: open only when a card links it)

`docs/PRD.md` product invariants · `docs/SYSTEM_DESIGN.md` runtime/boundaries · `docs/DECISIONS.md` ADRs · `docs/QA-REPORT.md` last QA · `docs/agents/archive/` old progress logs.
