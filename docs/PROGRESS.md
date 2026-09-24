# Development progress

Rolling summary, ≤40 lines. Facts only. Per-task detail lives in the task cards' Handoff blocks (`docs/agents/tasks/`). Full history until 2026-09-24: `docs/agents/archive/progress-2026-09.md`.

## Current state (2026-09-24)

- PR #11 (`task/T-011-decisions-ui` → `master`) carries T-004..T-011; CI passes. PRs #4–#10 were stacked into task branches, not `master`.
- Done: owner-scoped Ideas/Problems (ADR-005), closed registration, migration 0001 applied locally, 2 historical ideas adopted by the owner (ADR-006), explicit results for idea status updates and idea creation, capture form with error feedback.
- Last full verification: 72/72 unit tests (15 files), lint exit 0, typecheck exit 0. Before T-001: build exit 0, 5/5 anonymous E2E. CI passed install/lint/typecheck/unit/build; a browser-stage hang was traced to server shutdown and fixed (T-007).
- T-001 done (Ideas inbox search/filter, sidebar layout); owner verified it in the browser (T-002).
- T-003 done: createProblem returns explicit results, and the Problems page has a capture form with error feedback. Owner verified it in the browser.
- T-004 done: Problem → Idea conversion with owner-checked linking.
- T-005 planned the Decision Log (T-008..T-011). T-008 generated migration 0002; the owner applied it locally (T-009). T-010 added the owner-scoped decisions domain. T-011 added the Decisions UI.
- T-006 done: signed-in E2E on a disposable DB (10/10 in CI). It also fixed requireAuth so private pages stay dynamic.
- Agent coordination layer added: `docs/agents/` (ADR-007).

## Next

- T-012 done: Codex added T-013..T-016 and `docs/agents/CLAUDE_HANDOFF.md`; documentation only, no implementation gates run.
- Ready queue: T-013 safe idea-creation errors -> T-014 owner-scoped content editing -> T-015 editor UI -> T-016 Claude review/E2E persistence and decision-isolation coverage.
- Codex completed T-013..T-016 implementation work; T-016 awaits CI or approved disposable E2E verification. This session did not contact a separate Claude process.
- Earlier PR/CI status below is historical and was not rechecked during backlog planning; human approval remains required for merges/pushes/branch cleanup.
- PR #13 merged at 0275995 after CI passed lint, typecheck, unit, build and 11 authenticated/anonymous E2E tests.
- T-013..T-016 are done. Project OS MVP is next: T-017 planning, T-018/T-019 ownership migration, T-020 domain, T-021 UI, T-022 conversion, T-023 project decisions and T-024 E2E review.
- T-017 done (ADR-009). T-018 done: migration 0003 (`project.owner_id`) generated, not applied; 87/87 unit tests, lint/typecheck exit 0.
- Next: human applies 0003 locally (T-019), then T-020 (codex). Claude's T-022/T-023/T-024 wait on T-020.

See docs/agents/tasks/BOARD.md. T-001..T-018 are done.

## Deployment prerequisites

- `OWNER_EMAIL` must be set wherever the app runs. Restart after changing it.
- Any other environment must follow the ADR-006 adoption procedure before historical records are visible.
