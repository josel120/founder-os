# Architecture decisions

## ADR-001: One Next.js application

Phase 0 uses one deployable Next.js repository. Domain modules provide boundaries without the operational cost of microservices.

## ADR-002: PostgreSQL and Drizzle

PostgreSQL is the system of record. Drizzle keeps schema and migrations close to TypeScript while preserving explicit SQL database behavior.

## ADR-003: Visibility is persisted

Visibility is a database enum with `PRIVATE` defaults, not merely a UI convention. Public exposure requires explicit publish behavior in a later phase.

## ADR-004: AI provider abstraction

`AIService` is an interface in the AI module. Provider credentials and implementation are intentionally absent from Phase 0.

## ADR-005: Owner identity and closed registration

Private Ideas and Problems operations obtain the authenticated user ID from Better Auth on every server call. The session email must match the server-only `OWNER_EMAIL` configuration (trimmed and case-normalized). Missing configuration denies access. Existing sessions for other accounts cannot read or mutate these domains; new sessions for those accounts are also rejected. No user ID from a form is trusted. Detail and update predicates include ID, owner ID and PRIVATE visibility; lists include owner ID and PRIVATE visibility.

For an existing account, set `OWNER_EMAIL` to that account's actual email and restart the app. Leave `OWNER_SETUP_TOKEN` unset. Public signup is disabled by default. No passwords or existing accounts are altered.

For a brand-new installation only, an operator can temporarily set a cryptographically random `OWNER_SETUP_TOKEN` of at least 32 characters, restart, and send a POST to Better Auth's `/api/auth/sign-up/email` with the `x-founder-setup-token` header and the configured owner email, name and password. Use localhost or HTTPS. The hook validates both email and token; knowing the owner's email alone is insufficient. Remove the setup token and restart immediately after creation. Do not embed it in client code, NEXT_PUBLIC variables, URLs, shell history, or logs. The ordinary public registration form cannot supply this privileged header. The email uniqueness constraint prevents a second account for the configured email.

## ADR-006: Preserve historical records during ownership migration

Migration `0001_owner_isolation.sql` adds nullable `owner_id` foreign keys to Idea and Problem, referencing user IDs with ON DELETE RESTRICT. It performs no UPDATE, DELETE, account selection, or automatic assignment. The nullable state is explicitly reserved for historical unclaimed records; all current creation actions supply a server-derived owner ID. Unclaimed rows cannot match the access predicates and therefore remain inaccessible until reviewed.

Before applying this migration, back up the database and review its four additive SQL statements. Stop writes during deployment, apply the migration, and configure OWNER_EMAIL. Inventory unclaimed Idea/Problem IDs and the existing users using an administrative database connection. Assign only explicitly reviewed record IDs to the verified existing user ID in a transaction; do not infer ownership from creation date, an arbitrary first user, or the number of accounts. Review related Problem/Idea records together. This task generated the migration but did not apply it or assign live records.

After every legacy record has been adjudicated, a separate reviewed migration may add NOT NULL constraints. Changing OWNER_EMAIL is an administrative ownership policy change: it does not transfer records. Projects, finance and decisions have no implemented access services yet; when implemented, they must use equivalent identity-scoped ownership checks before exposing data.

### Reviewed adoption procedure (administrative psql session)

The following is a template, not an automatic migration. Replace placeholders only after inspecting the records with the owner. Start with read-only inventory:

```sql
SELECT id, email FROM "user" ORDER BY created_at;
SELECT id, title, problem_id FROM idea WHERE owner_id IS NULL ORDER BY created_at;
SELECT id, title FROM problem WHERE owner_id IS NULL ORDER BY created_at;
```

Record the exact approved Idea/Problem IDs and expected row counts. In a private psql session set the verified account ID, then execute only explicit reviewed IDs (never an unrestricted bulk assignment):

```sql
\set reviewed_owner_id 'REPLACE_WITH_VERIFIED_USER_ID'
BEGIN;
SELECT id, email FROM "user" WHERE id = :'reviewed_owner_id' FOR UPDATE;
-- Verify that this is exactly the account configured in OWNER_EMAIL.
UPDATE problem SET owner_id = :'reviewed_owner_id'
WHERE owner_id IS NULL AND id IN ('REPLACE_WITH_REVIEWED_PROBLEM_UUID'::uuid)
RETURNING id, owner_id;
UPDATE idea SET owner_id = :'reviewed_owner_id'
WHERE owner_id IS NULL AND id IN ('REPLACE_WITH_REVIEWED_IDEA_UUID'::uuid)
RETURNING id, owner_id;
-- Inspect RETURNING IDs and counts against the approved list.
-- For linked ideas verify their problem has the same owner:
SELECT i.id, i.problem_id FROM idea i JOIN problem p ON p.id = i.problem_id
WHERE i.owner_id = :'reviewed_owner_id' AND p.owner_id IS DISTINCT FROM i.owner_id;
-- Only COMMIT after matching counts and no unexpected relationship rows.
-- Otherwise ROLLBACK; no record content is changed or deleted.
ROLLBACK;
```

The template deliberately ends in ROLLBACK. For an approved execution replace that final statement with COMMIT only after verification. Omit an UPDATE if there are no reviewed records of that type. Reload the application and verify these exact records are accessible to the configured owner; other accounts and unclaimed records remain inaccessible. Keep a private audit of reviewed IDs and the assignment result.

## ADR-007: File-based multi-agent coordination with a token budget

Several AI agents (ChatGPT desktop, Codex, Claude Code) work on this repo with limited token quotas. Coordination lives in the repo, not in chat history, so any agent can pick up work cheaply:

- Tiered context: `AGENTS.md` (+ `CLAUDE.md`, which imports it) is always loaded and kept short. `docs/agents/CONTEXT.md` replaces exploration: layout, invariants, known-good commands and known environment failures. Other docs are read only when a task card links them.
- Work unit: task cards (`docs/agents/tasks/T-XXX.md`) with explicit files in scope, acceptance criteria and a ≤15-line Handoff block. `BOARD.md` is the queue and lock (one `doing` owner per file set).
- Routing (`docs/agents/ROUTING.md`): planning goes to ChatGPT, scoped implementation to Codex, security and review work to Claude, irreversible operations to the human. Escalation after two failures on the same step, or when quota runs out.
- `docs/PROGRESS.md` is a rolling ≤40-line summary. History is archived under `docs/agents/archive/`.

Task cards are local rather than GitHub Issues because reading one file costs far fewer tokens than API calls. GitHub stays the source of truth for PRs and CI. If the team grows, cards can be mirrored to Issues.

## ADR-008: Decision Log is owner-scoped

Migration `0002_decision_log_ownership.sql` adds a nullable `owner_id` (FK to `user.id`, ON DELETE RESTRICT) and a `visibility` column (NOT NULL, default `PRIVATE`) to `decision_log`. It is purely additive, with no UPDATE or DELETE. As with ADR-006, rows without an owner stay inaccessible until adopted by explicit reviewed IDs. Decision queries and actions must use the same predicates as Ideas and Problems: id + session owner + `PRIVATE`. Decisions are recorded by the owner. They are never generated automatically from AI output (PRD: human decisions over AI recommendations). Apply the migration with a backup first (T-009).

## ADR-009: Project OS ownership and MVP boundary

Project OS starts as a private, owner-scoped workspace. The `project` table must gain a nullable `owner_id` foreign key to `user.id` with `ON DELETE RESTRICT`, using the same additive migration and explicit adoption procedure as ADR-006 and ADR-008. Project reads and mutations must use the session owner plus `id + owner_id + PRIVATE`; NULL-owner rows remain inaccessible until explicitly reviewed by a human.

The MVP keeps Project lifecycle and operational status independent, using the approved product requirements and existing database enums. Lifecycle: `PLANNING`, `BUILDING`, `TESTING`, `BETA`, `RELEASED`, `MONETIZING`, `PAUSED`, `ARCHIVED`. Operational status: `READY`, `ACTION_REQUIRED`, `WAITING_PLATFORM`, `WAITING_USERS`, `WAITING_REVIEW`, `WAITING_PAYMENT`, `BLOCKED`, `NO_ACTION_REQUIRED`. T-020 corrects the earlier planning-only aliases; no database enum migration is needed. Waiting statuses require a reason and an explicit ISO start timestamp; leaving waiting clears its reason and timestamp. Status updates take both independent values explicitly. Content updates never change either status. New projects start PRIVATE, PLANNING and NO_ACTION_REQUIRED, regardless of client-supplied status or visibility. These actions do not publish projects.

An Idea -> Project conversion verifies the source Idea with the session owner and PRIVATE visibility, sets the Project owner from the session, stores `origin_idea_id`, and returns an explicit result. Repeated conversion is rejected or returns the existing owned Project according to the implementation card; it never creates an unowned or duplicate Project silently. Project decisions use the existing owner-scoped Decision Log. Finance transactions, public publishing, integrations and AI execution remain outside this phase; nullable finance `project_id` must not be treated as an ownership boundary.

## ADR-010: One branch and one PR per task card

Each card is implemented on its own `task/T-XXX-<slug>` branch cut from `origin/master` (or from an unmerged dependency's branch, which then becomes the PR base). When the gate passes, the agent commits only the card's files, pushes that branch and opens a PR; the branch and PR URL go in the card's Handoff. This replaces the earlier rule that agents never commit or push: pushing a card's own `task/` branch and opening its PR are pre-approved by the owner. Merges, force pushes, pushes to `master`, branch deletion, real-data migrations, secrets and deploys still require explicit human approval. Stacked PRs must be retargeted to `master` once their base merges, so work never stops in a task branch.

## ADR-011: Finance OS starts with owner-scoped manual transactions

Finance OS begins as a private ledger for manually recorded income and expenses. Every transaction read and mutation must derive the owner from the authenticated server session and enforce the owner plus `PRIVATE` boundary. The existing nullable `finance_transaction.project_id` is only a relationship; it cannot authorize access. A project link is accepted only after verifying that the referenced project belongs to the same owner and is private.

The first implementation slice supports transaction type (`INCOME` or `EXPENSE`), category, positive decimal amount, ISO currency code, source, optional external ID, occurred-at timestamp and optional owned-project link. Amounts remain exact decimal values at the database boundary; calculations must not use binary floating point. Duplicate external IDs are not rejected globally until an integration-specific uniqueness policy exists. No external imports, payment-provider synchronization, portfolio publishing or tax/accounting claims are included in the MVP.

The current `finance_transaction` table has no `owner_id` or `visibility`, so implementation starts with an additive ownership migration generated and reviewed in a separate card. A human must apply that migration to real data and explicitly adopt any historical rows before the Finance UI or queries expose them. Follow-up cards are: T-027 generate the ownership migration and schema contract, T-028 implement owner-scoped transaction actions and queries, T-029 add the private Finance UI and project linking, and T-030 verify ledger behavior and privacy end to end. T-028 and T-029 depend on T-027; T-030 depends on both.

## ADR-012: Research OS starts with owner-scoped evidence on problems and ideas

Phase order approved by the owner on 2026-09-26: 1) Research OS, 2) Distribution/portfolio, 3) Integrations, 4) AI execution.

Research OS begins as a private evidence log. One record (`evidence`) captures something the owner learned while researching: a title, a summary, a kind (`NOTE`, `INTERVIEW`, `MARKET`, `COMPETITOR`, `SOURCE`), a signal (`SUPPORTS`, `CONTRADICTS`, `NEUTRAL`) and an optional source URL. This matches the existing `AIService.analyzeEvidence(evidenceId)` interface, which stays interface-only (ADR-004).

Ownership and visibility:
- `evidence` is a new table, so it has no historical rows. `owner_id` is `NOT NULL` (FK to `user.id`, `ON DELETE RESTRICT`), unlike the nullable legacy columns of ADR-006/008/009/011. `visibility` defaults to `PRIVATE`. The migration is purely additive (new enums and table, no UPDATE or DELETE).
- Reads and mutations derive the owner from the session and use `id + owner_id + PRIVATE`, as ADR-005 requires.
- Each record belongs to exactly one parent: a Problem or an Idea (`problem_id` and `idea_id` nullable FKs with `ON DELETE RESTRICT`, plus a `CHECK (num_nonnulls(problem_id, idea_id) = 1)`). The server verifies that the parent belongs to the same owner and is `PRIVATE` before inserting. A foreign key never authorizes access by itself.

Behavior:
- The MVP covers create, content edit (title, summary, kind, signal, source URL) and listing. The parent cannot be changed after creation. There is no delete, which matches Ideas, Projects and Decisions.
- Mutations return explicit results, and updates check `UPDATE … RETURNING`.
- Source URLs must be `http` or `https` (Zod). The server stores them and never fetches them, so there is no SSRF surface. They render as external links with `rel="noopener noreferrer nofollow"`.
- Evidence never changes an Idea's status, never creates decisions and never publishes anything. The human decides (PRD).
- Out of scope: file uploads, web clipping, imports, AI summaries, scoring, publishing and cross-owner sharing.

Follow-up cards: T-033 schema contract and migration 0005 (generate only). T-034 human applies 0005 locally. T-035 owner-scoped evidence domain. T-036 private Research UI. T-037 Research workflow and privacy E2E. T-035 depends on T-033; T-036 depends on T-034 and T-035; T-037 depends on T-036.

Amendment (T-040, migration 0006): `problem_id` and `idea_id` are indexed; `kind` and `signal` have no defaults, so every insert states both; `updated_at` is set on every update. Owner/parent consistency (the parent belongs to the same owner) cannot be a composite FK while `problem.owner_id` and `idea.owner_id` are nullable (ADR-006), so the server enforces it; T-035 tests it and T-037 proves it end to end.

## ADR-013: Phase plan extended; specialized review subagents

Supersedes the phase order in ADR-012. After Research OS, the order is: 5) Workspace cockpit, 6) Production readiness, 7) Distribution/portfolio, 8) GitHub integration, 9) Finance imports, 10) AI execution. The owner approves it by merging T-039 and can reorder later phases in the same way.

- Workspace cockpit: the PRD promises a workspace that connects problems, ideas, research, projects and finance, but Phases 1–4 build separate domains. Problems have no detail or edit page, and nothing shows what needs attention across domains. The phase is private and read-mostly.
- Production readiness: nothing is deployed yet (no hosting config, security headers, backup drill or production migration runbook). Distribution is the first phase that puts data on the public internet, so a hardened deployment comes first.
- Integrations is split: GitHub (OAuth or app tokens, webhooks, source of truth for technical work) and finance imports (file or bank formats, the duplicate `external_id` policy ADR-011 deferred) have different risks and no shared code.

Review: the generic `reviewer` approved T-033, and two later reviews then found gaps in indexes, defaults and test strength. `schema-reviewer` now runs on every card that changes the schema or adds a migration. `privacy-auditor` sweeps the whole tree at each phase's closing E2E card and on any card that adds a public or outbound surface. `ci-triager` reads failed CI runs and returns a short diagnosis, because Playwright only runs in CI and its logs are expensive to read in the main session. E2E test patterns are shared as helpers referenced from CONTEXT.md, not as a separate subagent, so Codex can reuse them too. No external agent is added. Cards are routed across claude, codex and chatgpt per `ROUTING.md` to keep claude from being the bottleneck.

## ADR-014: Defense-in-depth for the web layer (T-043)

Authorization stays where ADR-005 put it: every private page, query and action calls `requireAuth()` and scopes by owner. The web layer adds cheap outer checks that never replace it:

- **Middleware** (`src/middleware.ts`, Edge runtime) redirects `GET`/`HEAD` page requests under `/private` without a Better Auth session cookie to `/login?next=<path>`. It only checks that a cookie exists, never that it is valid. Server action POSTs (`Next-Action` header) always pass through so they keep returning explicit `{ ok: false }` results (T-038 E2E). The cookie names mirror `getSessionCookie` from `better-auth/cookies`, which the Edge runtime cannot import (it pulls in `jose`); `tests/middleware.test.ts` asserts both agree. Node.js middleware was tried and rejected: it reads request bodies and logged uncaught `ECONNRESET` when clients aborted server actions.
- **`?next=`** is accepted only through `safePrivatePath` (same-origin `/private` paths), so it cannot become an open redirect. A signed-in owner visiting `/login` is sent straight there.
- **Headers** (`next.config.ts`): `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` and HSTS on every response; `X-Robots-Tag: noindex, nofollow` on `/private`, auth pages and `/api`. No `script-src` yet: Next.js inline scripts would need per-request nonces (follow-up T-045).
- **Registration UI**: `/register` explains that registration is closed instead of offering a form that can never succeed (ADR-005: only an operator request with the setup token creates the owner).
- **Dependencies**: `@better-auth/cli` was unused and pulled a vulnerable `better-auth` < 1.6.22 (critical advisory), `lodash` and Prisma build scripts; it is removed. `drizzle-orm` moves to ^0.45.3 (GHSA-gpj5-g38j-94v9; also the peer range `better-auth` 1.7 declares). `next>postcss` is overridden to ^8.5.28 in `pnpm-workspace.yaml`. Remaining advisories are dev-only (Vitest 3, drizzle-kit's esbuild), tracked in T-044.
- **Finance timestamps**: `occurredAt` from the form has no offset. It is stored as that wall-clock time in UTC, so the saved date no longer depends on the server's time zone. Explicit offsets from other callers are kept as given.

Amendment (T-045): the Content-Security-Policy moved from `next.config.ts` into the middleware, which now runs on every page (not API routes or static assets). Each request gets a nonce (`btoa(crypto.randomUUID())`) in `script-src 'self' 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` only under `next dev`), alongside `default-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `connect-src 'self'` and the earlier `frame-ancestors`/`object-src`/`base-uri`/`form-action` directives. The same policy is forwarded on the request so Next.js stamps the nonce on its scripts, and the root layout is `force-dynamic`, because a prerendered page would ship unstamped scripts. Styles keep `'unsafe-inline'`: the risk is CSS injection, not script execution. The `/private` redirect and server-action pass-through are unchanged. `X-Frame-Options: DENY` still covers responses outside the middleware.

## ADR-015: Workspace cockpit MVP (Phase 5, T-041)

Phases 1–4 built separate domains. The cockpit connects them for the owner. It is private and read-mostly, uses no new tables and does no AI scoring (ADR-004): it counts and lists, and the owner decides.

Accepted:
- **`/private` home** (today it returns 404). A read-only "needs attention" view: projects in `ACTION_REQUIRED` or `BLOCKED`; projects waiting (`WAITING_*`) longer than a threshold; projects whose `review_at` is today or past; ideas still in `INBOX`, oldest first; ideas in `RESEARCHING`/`VALIDATING` with no evidence, or with contradicting and no supporting evidence; the latest decisions; the last 30 days of finance per currency (exact decimals, ADR-011). Each item links to its detail page. Signed-in owners land here after login (the `safePrivatePath` fallback moves from `/private/ideas` to `/private`).
- **Problem detail page** `/private/problems/[id]`: content edit (a new owner-scoped `updateProblemContent`, `UPDATE … RETURNING`), the ideas made from it, and its evidence with a capture form bound to the problem (reusing T-036 components). The problems list links to it.
- **Chain on detail pages**: Problem → Ideas (list), Idea → Problem and Project (exists), Project → origin Idea and its finance transactions with per-currency totals (reusing `totalsByCurrency`).

Rules: every count and list uses the session owner and `PRIVATE`, with one aggregation service per domain query module (no cross-owner joins; related rows are joined only with owner-scoped predicates on both sides). Thresholds are constants in code until the owner asks for settings. Nothing is cached across requests.

Rejected for this phase: AI scoring or recommendations (ADR-004, Phase 10); notifications or email; a settings table; global cross-domain search (open question); decision links to problems (the `decision_log` table has no `problem_id`, so this would need a schema change).

Open questions for the owner (the plan uses the proposed default until answered): 1) waiting threshold, proposed 14 days; 2) land on `/private` after login instead of Ideas, proposed yes; 3) show the 30-day finance snapshot on the home, proposed yes; 4) cross-domain search, proposed later.

Cards: T-047 aggregation queries (codex) → T-048 `/private` home and login landing (codex); T-049 Problem detail and edit (codex); T-050 Project → Idea/Finance chain (codex); T-051 cockpit E2E and privacy sweep (claude), after T-048..T-050.

## ADR-016: Production readiness (Phase 6, T-042)

Nothing is deployed yet. This phase takes the private app to a hardened deployment before anything is published (Phase 7). Agents prepare; every deploy, secret and real-data step is a `human` card with exact commands (ROUTING.md).

- **Hosting**: Vercel for the app and Neon Postgres, as SYSTEM_DESIGN names. The app keeps `postgres-js`. On Vercel it uses Neon's pooled URL with `prepare: false` and a small `max`, and migrations use the direct (unpooled) URL. The unused `@neondatabase/serverless` dependency is removed.
- **Environment**: in production, `src/lib/env.ts` fails at boot if `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (https) or `OWNER_EMAIL` is missing, instead of running with auth disabled. `OWNER_SETUP_TOKEN` exists only during first-owner setup (ADR-005). Secrets live only in Vercel env settings, never in the repo or logs. *Amended by T-052:* "in production" means `VERCEL=1` (preview and production deploys) or an explicit `FOUNDER_OS_STRICT_ENV=1`, and never during `next build`; not `NODE_ENV=production`, because CI and local E2E run `next start` with no auth env (anonymous) or an http `BETTER_AUTH_URL` (authenticated). The error names the variables, never their values. Pooled client options (`prepare: false`, `max: 3`) apply to hosts containing `-pooler.` or with `DATABASE_POOLED=1`. *Amended by T-062:* on Vercel, an unset `BETTER_AUTH_URL` defaults to the deployment's own https origin from Vercel system variables (production: `VERCEL_PROJECT_PRODUCTION_URL`; previews: `VERCEL_BRANCH_URL`, else `VERCEL_URL`); an explicit value wins and the https check still fails boot when nothing yields one. Better Auth's `trustedOrigins` adds only this deployment's own Vercel origins, and the browser client uses the page's origin unless `NEXT_PUBLIC_BETTER_AUTH_URL` is set, so the owner never types a URL. `pnpm setup:production` (`scripts/setup-production.ts`, RUNBOOK "One command") runs RUNBOOK sections 1–5 on the owner's machine with a pinned `npx vercel@60.1.3`: Neon through the Vercel Marketplace connected to production only (previews have no database by design: they build, then refuse to boot), secrets only through a child's stdin or env, migrations on the unpooled URL from a temporary env pull, the owner created in-process through Better Auth's sign-up with an ephemeral setup token that never reaches Vercel, and `vercel deploy --prod` from a fresh clone of a clean `master` equal to `origin/master`, because the CLI uploads gitignored files such as `work/` backups.
- **Migrations**: runbook in `docs/RUNBOOK.md`: Neon branch or `pg_dump` backup → `pnpm db:migrate` against the direct URL → ADR-006 adoption when historical rows exist → verification queries → rollback by restoring the branch or dump. A restore drill is done once before go-live.
- **Security headers**: done in ADR-014 and T-045 (nonce CSP, HSTS, frame, referrer and permissions policies). Phase 6 verifies them on the deployed URL.
- **Auth**: Better Auth rate limiting is on in production, but its default memory storage is per instance on serverless. Switch it to database storage (new `rate_limit` table, additive migration, `schema-reviewer`), with a stricter rule on `/sign-in/email`. Sessions keep the 7-day expiry and 1-day refresh; secure cookies on https. Better Auth telemetry is disabled explicitly. *Amended by T-053:* the limiter keys on `x-forwarded-for` + path; Vercel overwrites that header with the client IP, while a self-hosted deployment needs a proxy that does the same or the limit is bypassable. Every `/api/auth/*` request reads `rate_limit`, so migration 0007 is applied before this code is deployed (RUNBOOK section 6). *Amended by T-059:* `rate_limit` rows are personal data (an IP) with no owner, and Better Auth never deletes one once its key stops returning. `src/modules/auth/services/rate-limit-retention.ts` prunes rows whose `last_request` is more than 24h old (well past the 60s longest window) from Better Auth's request-level `hooks.after` in `src/lib/auth.ts` (every auth endpoint, including sign-in attempts and the per-page session check), throttled to at most once per hour per server instance with an in-memory timestamp. A sign-in-only hook was rejected: rows come from any visitor, and the owner may sign in weekly. A Vercel Cron route was rejected: it needs a new route, secret and config, while traffic that creates rows also triggers the prune. Errors are caught and reported (`reportError("auth.rateLimitRetention", …)`), never raised into the sign-in request (RUNBOOK section 9).
- **Errors**: server actions swallow errors today, which is private but blind. A `reportError(scope, error)` helper logs only the scope, error class, Postgres code and Next digest (never messages, SQL, parameters or form values) to Vercel runtime logs. A third-party monitor is an open question: it adds a dependency and an outbound flow.
- **Privacy**: a `privacy-auditor` sweep of the tree plus a smoke check of the deployed app (headers, anonymous redirects, `noindex`) closes the phase; findings become cards.

Open questions for the owner: 1) confirm Vercel + Neon, and the region; 2) the production domain; 3) logs only, or a third-party error monitor; 4) the sign-in rate limit, proposed 5 attempts per minute per IP.

Cards: T-052 production env + DB client (claude) · T-053 auth rate limit storage, session and telemetry settings, migration 0007 (claude) · T-054 `reportError` (claude) · T-055 `docs/RUNBOOK.md` (claude) · T-056 provision Vercel + Neon and deploy a preview (human) · T-057 production migrations, owner setup and restore drill (human) · T-058 deployed smoke check and privacy sweep (claude).

## ADR-017: Patch Next's vendored React DOM so render-phase pings are not dropped (T-061)

Symptom: after a server action, `router.refresh()` or a link click, the page sometimes never showed the result (missing list item, stale title, navigation never committed) until a reload.

Cause: Next 15.5.26 bundles its own React for the App Router (`19.2.0-canary-0bdb9206-20250818`), not the installed `react`/`react-dom` 19.3.0 (that copy only serves the unused Pages Router). In that React build, a transition that suspends on a lazy Flight chunk yields once; if the chunk's row arrives during that yield, it stays `resolved_model` (nobody is listening yet). On resume React unwinds and attaches a ping listener, and Flight's `then()` parses the chunk and calls the ping synchronously, inside the render. `pingSuspendedRoot` ignores a ping that arrives during the render once the render is "suspended with delay", so the lane is marked suspended with no listener left, and the update never commits. A busy main thread and large, multi-chunk RSC payloads widen the window. React fixed it upstream by recording the ping (`workInProgressRootPingedLanes |= pingedLanes`), and react-dom 19.3.0 ships that fix.

Decision: a pnpm patch (`patches/next@15.5.26.patch`, `patchedDependencies` in `pnpm-workspace.yaml`) applies that one-line upstream change to the four stable-channel React DOM client builds vendored in `next` (production, development, profiling). The experimental channel is not patched, because the app enables no experimental React features. `tests/react-render-phase-ping.test.ts` reproduces the race against the vendored build (it fails without the patch) and guards it.

Rejected: upgrading to Next 16 (a major migration outside this card; 15.5.26 is the last 15.5 backport and still ships the old React); aliasing the App Router to the installed react-dom 19.3.0 (mixes React versions with Next's vendored `react` and Flight client); product-code workarounds such as wrapping actions in transitions or paging lists (they only narrow the race, and plain link navigations hit it too).

Removal: when Next is upgraded, pnpm refuses to install with an unused or failing patch. Drop the patch once the new Next's vendored `react-dom-client.production.js` records render-phase pings in `pingSuspendedRoot`, and keep the regression test.

## ADR-018: Distribution and portfolio (Phase 7, T-065)

Phase 7 is the first public surface. The owner publishes chosen **projects** as a portfolio; nothing else becomes public. Publishing is opt-in, per project, reversible at once, and it exposes only an explicit allowlist of fields.

Accepted:
- **Publication is a separate record.** A new owner-scoped table `project_publication` (one row per published project: `project_id` primary key and FK with cascade delete, `owner_id` FK, `visibility` limited to `PUBLIC` or `UNLISTED` by a CHECK, `summary` 1–500 characters, `published_at`, `updated_at`; migration 0008, additive). The `project` row keeps `visibility = PRIVATE`, so every private query and ADR-005/006/009 invariant stays unchanged. Unpublishing deletes the row. The unused `project.visibility`/`published_at` columns stay as they are.
- **Allowlist.** Public pages show only: the project name, slug, lifecycle, `released_at`, the website and store URLs, and the publication's `summary` (written for the public by the owner) and `published_at`. Never: the private `description`, `repository`, versions, next action, waiting reason or dates, review dates, origin idea, decisions, finance, evidence, owner id or email. The public query selects those columns only, joins `project_publication` on `project_id` **and** `owner_id`, and returns nothing for a private project.
- **Visibility.** `PUBLIC`: listed on `/portfolio` and shown at `/p/<slug>`. `UNLISTED`: shown at `/p/<slug>` only. Private and unknown slugs get the same 404 (no existence oracle), including in `generateMetadata`.
- **Owner flow.** The project detail page gets a "Publish" panel: summary, visibility, and a preview of exactly what becomes public, then an explicit confirm. Owner-scoped server actions `publishProject`/`unpublishProject` (Zod, `id + owner_id` on the project, `INSERT … ON CONFLICT … RETURNING`/`DELETE … RETURNING`).
- **Rendering.** Public routes are dynamic and uncached, so unpublishing takes effect on the next request. They keep the ADR-014 headers and nonce CSP. Search engines stay blocked (`noindex`) for now.
- **Order.** The code reads `project_publication`, so migration 0008 must be applied in production before the code reaches `master` (RUNBOOK section 6: migrate first). The phase's cards are stacked PRs; they merge after the owner applies 0008 (T-067).

Rejected for this phase: publishing ideas, problems, decisions, finance or evidence; a public API or RSS; comments, analytics or tracking; custom domains (Vercel settings, human); per-field toggles beyond the allowlist.

Open questions for the owner (safe defaults apply until answered): 1) allow search engines to index `PUBLIC` pages, proposed no until the owner reviews the portfolio live; 2) show the repository link, proposed no (repositories may be private); 3) a portfolio intro on `/portfolio`, proposed a fixed line with no personal data; 4) a custom domain, proposed later.

Cards: T-066 `project_publication` schema and migration 0008 (claude) · T-067 apply 0008 in production, then merge the stack (human) · T-068 publication domain: actions and allowlisted public queries (claude) · T-069 owner publish panel with preview (claude) · T-070 public `/portfolio` and `/p/[slug]` (claude) · T-071 portfolio E2E and pre-public privacy audit (claude).

## ADR-019: GitHub integration (Phase 8, T-072)

GitHub becomes the source of truth for a project's technical activity, read-only and private. The owner already stores a repository URL on each project; Phase 8 reads that repository's state from GitHub and shows it where decisions are made.

Accepted:
- **Access**: one fine-grained personal access token, read-only (Metadata, Contents, Issues, Pull requests), for the repositories the owner picks, stored as `GITHUB_TOKEN` in Vercel (human card). No OAuth app, no GitHub App and no webhooks in this phase: they add a public callback, a signing secret and more permissions for a single-owner app. Without the token the feature is off and says so; nothing breaks.
- **Link**: a project is linked when its `repository` field is a `https://github.com/<owner>/<repo>` URL; the owner/repo pair is parsed and validated there, never taken from free text elsewhere.
- **Snapshot**: a new owner-scoped table `project_github` (migration 0009: `project_id` PK/FK cascade, `owner_id`, `repo_full_name`, `default_branch`, `last_push_at`, `open_issues`, `open_pull_requests`, `latest_release_tag`, `latest_release_at`, `synced_at`, `sync_error` code). Only these fields are stored: no code, commit messages, issue titles or bodies.
- **Sync**: an owner-scoped "Refresh from GitHub" action on the project page, and a daily Vercel Cron job (`/api/cron/github`, authorized by `CRON_SECRET`, human card) that refreshes every linked project. Requests go only to `https://api.github.com` with a timeout; failures store an error code (`not_found`, `unauthorized`, `rate_limited`, `unavailable`), never a response body. The token is never logged or sent to the client.
- **Use**: the project page shows the snapshot; the `/private` home lists linked projects with no push for 30 days or more. Nothing changes a project's status automatically: the owner decides (ADR-004, ADR-015).
- **Privacy**: GitHub data is PRIVATE. It is not in the ADR-018 allowlist, so the portfolio never shows it.

Hosting note: the `GITHUB_API_URL` override (tests only) is refused wherever the strict env check runs: on Vercel, or with `FOUNDER_OS_STRICT_ENV=1`. Any other self-hosted production must set that flag, or the token could be sent to an overridden host.

Rejected for this phase: webhooks, OAuth or a GitHub App, writing to GitHub, storing code or text, per-repository tokens, private repository names on public pages.

Open questions (defaults apply): 1) stale threshold, proposed 30 days; 2) cron hour, proposed 06:00 UTC daily (Vercel Hobby allows one daily cron).

Cards: T-073 `project_github` schema and migration 0009 (claude) · T-074 create the token and set `GITHUB_TOKEN` and `CRON_SECRET` (human) · T-075 GitHub client and sync service (claude) · T-076 project GitHub panel, refresh action, daily cron route and the stale-repo attention list (claude) · T-077 GitHub E2E against a local stub API and privacy audit (claude).

## ADR-020: Finance imports (Phase 9, T-072)

The owner imports bank or payment-provider exports as CSV files into the private ledger. This closes ADR-011's open duplicate policy for imports.

Accepted:
- **Format**: CSV only (RFC 4180: quotes, escaped quotes, commas or semicolons, CRLF), at most 1 MB and 5,000 rows, parsed on the server with a small in-repo parser (no dependency). No bank APIs or aggregators: they need third-party credentials and an outbound data flow.
- **Mapping**: the owner maps columns to date, amount, currency (a column or one fixed currency), description (becomes the category) and optionally an external ID; picks the date format (ISO, DD/MM/YYYY, MM/DD/YYYY) and the decimal separator. A negative amount (or a debit column) is an expense, positive is income. Amounts stay exact decimals (ADR-011).
- **Preview then confirm**: the server parses and validates every row and returns a preview with per-row errors and duplicates; nothing is written until the owner confirms. The file itself is never stored.
- **Duplicates**: each imported row gets an `import_key`: the external ID when mapped, else a SHA-256 of date, amount, currency, normalized description and the row's occurrence number among identical rows in the same file. A partial unique index on (`owner_id`, `import_key`) makes re-importing the same file a no-op; manual transactions (no key) are unaffected.
- **Batches**: a new owner-scoped `finance_import` record (file name, row counts, created_at) and a nullable `finance_transaction.import_id`, so the owner sees past imports and can undo one (deletes only that import's transactions). Migration 0010, additive.
- **Privacy**: all of it is PRIVATE; errors never echo row contents into logs (`reportError` only).

Limits: the server-action body limit is 2 MB for the whole app (Next.js has one setting), so a 1 MB file fits; the import itself still refuses more than 1 MB.

Rejected: bank APIs, OFX/QIF/XLSX (later), automatic categorization (Phase 10), currency conversion, editing rows inside the importer.

Open questions (defaults apply): 1) row limit, proposed 5,000; 2) keep the original file name, proposed yes (private).

Cards: T-078 `finance_import`, `import_id`, `import_key` and migration 0010 (claude) · T-079 CSV parser, mapping and duplicate keys (claude) · T-080 preview, confirm and undo actions (claude) · T-081 import UI in `/private/finance` (claude) · T-082 import E2E and privacy audit (claude).

Order: migrations 0009 and 0010 follow 0008. Schema-only PRs merge first (nothing reads the tables); code PRs wait until the owner applies 0008–0010 in production (T-067 covers all three).
