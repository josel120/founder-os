# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
| T-001 | Finish Ideas inbox search/filter and workspace layout (uncommitted WIP) | done | claude | S | – |
| T-002 | Manually verify authenticated Ideas workflow with the real owner account | done | human | S | T-001 |
| T-003 | Explicit creation result for createProblem (Ideas already done) | done | claude | S | – |
| T-004 | Problem → Idea conversion (link an idea to an owned problem) | todo | claude | M | T-003 |
| T-005 | Decision Log MVP (owner-scoped create/list) | todo | chatgpt | M | – |
| T-006 | Authenticated E2E with a disposable test database | todo | claude | M | T-002 |
| T-007 | Investigate the CI browser-stage hang | todo | codex | S | – |
