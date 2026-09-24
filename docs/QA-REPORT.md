# QA report — 2026-09-23

## Actual validation

- `pnpm lint`: exit 0 after QA edits.
- `pnpm typecheck`: exit 0 after QA edits.
- `pnpm build`: exit 0, executed exclusively after UX stopped its build/dev sessions. All 8 pages generated. The earlier concurrent-build `/_document` failure did not reproduce.
- `pnpm test`: exit 1 before test collection. esbuild cannot read `../../../..` while loading vitest.config.ts. Additional approved read permission for the parent directory did not resolve the error. No new unit test is claimed as executed successfully.
- `$env:CI='true'; pnpm test:e2e`: production server started, five browser tests attempted with retries. Chromium launch failed with `spawn EPERM` before assertions. Command remained in teardown and was interrupted (exit 1). No browser assertions passed. Server port 3000 was no longer listening before interruption.
- GitHub Actions updated but not executed remotely by QA.

## Coverage added

- Drizzle PRIVATE default and NOT NULL assertions for Ideas, Problems, Projects (replaces table-existence smoke test).
- Anonymous create/update/list/detail calls must not touch the database.
- Creation must send PRIVATE and INBOX to the insert even if client input requests PUBLIC. Database insert is mocked; not a database integration test.
- Invalid status cannot reach update.
- Session absence and validation errors cannot grant access.
- Browser redirects for anonymous list/detail requests.
- Reviewed UX auth browser tests: API is intercepted, no real registration or account writes.
- Ownership remains an explicit TODO, not a passed assertion.

## Reproducible unresolved product findings

1. Ownership is absent: `requireAuth` returns only a boolean, Idea schema has no owner field, queries filter visibility or ID rather than user. Any authenticated account can address another account's idea. Reproduction requires a disposable database: register accounts A/B, create an idea as A, request its detail as B. Do not run against the owner's real data.
2. Single-user enforcement is absent in Better Auth: email/password signup remains enabled without an owner restriction.
3. `updateIdeaStatus` silently returns for unauthenticated/invalid requests. A client awaiting completion cannot distinguish rejection from success. Test follow-up should require an explicit failure result once the action contract is fixed.

These findings require product code/schema changes outside this QA task's scope. Do not describe Foundation security as complete or deploy with open signup until resolved.

## CI

CI uses the packageManager pnpm version instead of conflicting pnpm 11, Node 24, frozen install, lint, typecheck, unit tests, production build, Chromium installation, and E2E against `next start`. Failed E2E artifacts are retained 7 days. CI never reuses an existing server. Unit-test mocks and anonymous E2E do not establish real database ownership or successful login persistence.
