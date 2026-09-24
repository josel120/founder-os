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

The MVP keeps Project lifecycle and operational status independent. Lifecycle describes the product state (`PLANNING`, `ACTIVE`, `PAUSED`, `RELEASED`, `ARCHIVED`); operational status describes attention needed (`NO_ACTION_REQUIRED`, `NEXT_ACTION_DUE`, `WAITING`, `BLOCKED`, `REVIEW_DUE`). Waiting fields are meaningful only for waiting state, and status changes must not silently change lifecycle.

An Idea -> Project conversion verifies the source Idea with the session owner and PRIVATE visibility, sets the Project owner from the session, stores `origin_idea_id`, and returns an explicit result. Repeated conversion is rejected or returns the existing owned Project according to the implementation card; it never creates an unowned or duplicate Project silently. Project decisions use the existing owner-scoped Decision Log. Finance transactions, public publishing, integrations and AI execution remain outside this phase; nullable finance `project_id` must not be treated as an ownership boundary.

## ADR-010: One branch and one PR per task card

Each card is implemented on its own `task/T-XXX-<slug>` branch cut from `origin/master` (or from an unmerged dependency's branch, which then becomes the PR base). When the gate passes, the agent commits only the card's files, pushes that branch and opens a PR; the branch and PR URL go in the card's Handoff. This replaces the earlier rule that agents never commit or push: pushing a card's own `task/` branch and opening its PR are pre-approved by the owner. Merges, force pushes, pushes to `master`, branch deletion, real-data migrations, secrets and deploys still require explicit human approval. Stacked PRs must be retargeted to `master` once their base merges, so work never stops in a task branch.
