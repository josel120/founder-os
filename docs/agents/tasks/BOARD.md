# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`. A dependency missing from this board is archived, so it is `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
| T-057 | Apply production migrations, create the owner and run a restore drill | todo | human | S | T-053, T-054, T-056 |
| T-065 | Plan Distribution and portfolio (Phase 7) and its boundaries | done | claude | M | T-058 |
| T-066 | Add the project_publication table (migration 0008) | review | claude | S | T-065 |
| T-067 | Apply migration 0008 in production, then merge the Phase 7 stack | todo | human | S | T-066 |
| T-068 | Publication domain: publish actions and allowlisted public queries | review | claude | M | T-066 |
| T-069 | Owner publish panel with a preview of what becomes public | review | claude | M | T-068 |
| T-070 | Public portfolio and project pages | review | claude | M | T-068 |
| T-071 | Verify the portfolio end to end and audit privacy before going public | todo | claude | M | T-069, T-070 |
