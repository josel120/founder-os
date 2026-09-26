# Independent QA follow-up: T-024

- Review source: QA agent, static review of commit 5638cea on 2026-09-24. No demonstrated authorization bypass; these are test coverage findings.
- Current coordination checkpoint: c53a8b3; T-024 marked done and T-026 planning present. This report does not reopen or modify another agent's task files.
- Delivery through the app to the implementation task repeatedly failed with `already has an active writer`. Findings are saved here for the next implementer.

## Required follow-up

1. Test authenticated owner A attempting reads and content/status mutations on a project owned by B, plus creation of a decision against B's project. Seed B's records only in the guarded disposable `_e2e` database; assert rejected access and unchanged persisted records. A no-cookie GET or rejected second-user signup does not exercise these boundaries.
2. Test anonymous project mutations, not only anonymous navigation. Assert rejection and unchanged rows.
3. Recheck the project-description assertion in `tests/e2e/authenticated/workflows.auth.spec.ts` (line 102 in reviewed commit). `getByText` may match both rendered description and textarea initial content; prefer the labeled textbox's value and/or an explicit paragraph locator. This was a static concern, not a reproduced browser failure.

Positive findings in reviewed commit: decision presence on its project and absence on another project are asserted; BETA and WAITING_REVIEW persistence are checked separately. Independent T-020 review found no actionable authorization defect.

Next step: compare these findings with current tests, create a scoped follow-up card for remaining gaps, execute it against the disposable test database in CI, and record exact results. Do not infer complete cross-owner E2E coverage from a green suite lacking these cases. No production data, migrations, or secrets were accessed for this report.

## Resolution

- Resolved by T-038 (`docs/agents/tasks/T-038.md`, PR #29), in `tests/e2e/authenticated/workflows.auth.spec.ts`. CI run `36259034146`: 18/18 E2E passed.
- Item 1: owner B (user, project, decision) is seeded by SQL only in the guarded `*_e2e` database. Owner A gets no B data on B's detail page, the project list or decisions. A's content, status and decision server-action requests are rewritten to target B's project; each is rejected ("Project not found"), and B's and A's rows are identical before and after.
- Item 2: real createProject, updateProjectContent, updateProjectStatus and createDecision requests are replayed with no cookies; each returns "Sign in again", rows are unchanged and nothing is created.
- Item 3: description is checked with an explicit paragraph locator and the `textarea[name="description"]` value. `getByLabel("Description")` fails once the textarea has content, because the label's accessible name includes it.
- No product bug found; no product code changed.
