# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`. A dependency missing from this board is archived, so it is `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
| T-057 | Apply production migrations, create the owner and run a restore drill | review | claude + human | S | T-053, T-054, T-056 |
| T-065 | Plan Distribution and portfolio (Phase 7) and its boundaries | done | claude | M | T-058 |
| T-066 | Add the project_publication table (migration 0008) | done | claude | S | T-065 |
| T-067 | Apply migrations 0008–0010 in production, then merge the waiting PRs | done | human | S | T-066 |
| T-068 | Publication domain: publish actions and allowlisted public queries | done | claude | M | T-066 |
| T-069 | Owner publish panel with a preview of what becomes public | done | claude | M | T-068 |
| T-070 | Public portfolio and project pages | done | claude | M | T-068 |
| T-071 | Verify the portfolio end to end and audit privacy before going public | done | claude | M | T-069, T-070 |
| T-072 | Plan GitHub integration (Phase 8) and Finance imports (Phase 9) | done | claude | M | T-065 |
| T-073 | Add the project_github table (migration 0009) | done | claude | S | T-072 |
| T-074 | Create a read-only GitHub token and set GITHUB_TOKEN and CRON_SECRET | done | human | S | T-072 |
| T-075 | GitHub client and sync service | done | claude | M | T-073 |
| T-076 | Project GitHub panel, refresh, daily cron and stale-repo attention | done | claude | M | T-075 |
| T-077 | Verify GitHub integration end to end and audit privacy | done | claude | M | T-076 |
| T-078 | Finance import schema (migration 0010) | done | claude | S | T-073 |
| T-079 | CSV parser, column mapping and duplicate keys | done | claude | M | T-078 |
| T-080 | Import preview, confirm and undo actions | done | claude | M | T-079 |
| T-081 | Import UI in /private/finance | done | claude | M | T-080 |
| T-082 | Verify finance imports end to end and audit privacy | done | claude | M | T-081 |
| T-083 | Plan AI execution (Phase 10) and its boundaries | done | claude | M | T-072 |
| T-084 | Add the ai_run table (migration 0011) | done | claude | S | T-083 |
| T-085 | Set ANTHROPIC_API_KEY, a spend limit, and apply migration 0011 in production | doing | human | S | T-084 |
| T-086 | Anthropic client, prompt builder and output schema | done | claude | M | T-084 |
| T-087 | AI run actions, daily cap and run queries | done | claude | M | T-086 |
| T-088 | Idea AI panel with disclosure and run history | done | claude | M | T-087 |
| T-089 | Verify AI execution end to end and audit privacy | done | claude | M | T-088 |
| T-090 | Audit Phases 7–10 for bugs, security and UX, and fix what is found | done | claude | M | T-089 |
| T-091 | Say why the AI provider refused a run | done | claude | S | T-089 |
| T-092 | Owner data export as one JSON file | done | claude | M | T-089 |
