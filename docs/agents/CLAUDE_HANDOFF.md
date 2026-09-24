# Claude Code: shared project panorama

- Prepared by Codex, 2026-09-24, at the owner's request to expand and share the backlog.
- Read CONTEXT.md, TOKEN_POLICY.md and tasks/BOARD.md first; then load only the selected card's context.
- Product: private, single-owner workspace connecting problems, ideas, decisions and eventually projects/finance. Current work is Phase 1 Idea OS; the PRD describes the narrower Phase 0 foundation.
- Implemented in this checkout: owner-scoped capture/list/detail/status for ideas, inbox search/filter, problem capture and conversion, standalone and idea-linked decisions, closed registration and guarded authenticated E2E.
- Existing E2E already covers problem conversion, linked decision creation, status persistence and anonymous access; T-016 extends it rather than rebuilding it.
- Recorded baseline: T-001 through T-011 are done; PROGRESS reports 72 unit tests, lint/typecheck exit 0 and PR #11 carrying the completed stack. GitHub/CI/merge status was not queried this session; verify before relying on it.
- T-009 and PROGRESS record migration 0002 applied locally. T-011's older warning predates that update. Other environments must be verified separately by the human.
- Concrete gap: createIdea lets database insertion errors escape; its capture form already catches transport failures. T-013 makes the server result consistent without claiming transport failures are safe to retry.
- Proposed next product slice: refine captured idea title/description. The current detail page displays content but provides no content editor. No new tables are needed.
- Execution: T-013 -> T-014 -> T-015 -> T-016. Codex implemented the queue at the owner's request; T-016 now needs CI or an approved disposable E2E environment for final review.
- Claude can review the completed implementation and E2E additions; record review issues in T-016 and create scoped follow-up cards for fixes outside its files.
- Before implementing any card, mark it and its board row doing with your agent name; never edit files owned by another doing card. Keep coordination edits short and recheck current file content before patching.
- Each implementation needs meaningful tests and the full lint/typecheck/unit gate before review. E2E uses only the guarded disposable database; do not run build alongside another agent's dev/build.
- Preserve server-derived ownership, id + ownerId + PRIVATE predicates, Zod validation and explicit mutation results. Never expose private data or database error details.
- Deferred: Project OS, finance, research integrations, publishing and AI execution. These require separate design/cards; this backlog does not authorize them.
- Human-only approval boundaries: real-data migrations, secrets, deployment, merges and pushes. Branch cleanup remains a recorded follow-up, not authorization to delete branches.
- Communication is through these files; no separate Claude session has been launched or contacted. Finish each card with a <=15-line handoff and update the <=40-line PROGRESS summary.

