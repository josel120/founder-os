# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
| T-012 | Expand backlog and prepare Claude handoff | done | codex | M | none |
| T-013 | Return a safe result when idea creation fails | done | codex | S | none |
| T-014 | Add owner-scoped editing of idea content | done | codex | M | T-013 |
| T-015 | Let the owner refine an idea on its detail page | done | codex | S | T-014 |
| T-016 | Verify idea refinement and decision isolation end to end | done | codex | S | T-015 |
| T-017 | Plan Project OS MVP and ownership boundaries | done | codex | M | none |
| T-018 | Add owner isolation to projects (migration generation) | done | claude | S | T-017 |
| T-019 | Apply project ownership migration locally | done | human | S | T-018 |
| T-020 | Build owner-scoped Projects domain | done | codex | M | T-019 |
| T-021 | Add Projects list, detail and edit UI | done | codex | M | T-020 |
| T-022 | Convert a candidate Idea into a Project | done | codex | M | T-020 |
| T-023 | Link project decisions with owner checks | done | codex | M | T-020 |
| T-024 | Verify Project OS workflows and privacy end to end | done | codex | M | T-021, T-022, T-023 |
| T-001 | Finish Ideas inbox search/filter and workspace layout (uncommitted WIP) | done | claude | S | – |
| T-002 | Manually verify authenticated Ideas workflow with the real owner account | done | human | S | T-001 |
| T-003 | Explicit creation result for createProblem (Ideas already done) | done | claude | S | – |
| T-004 | Problem → Idea conversion (link an idea to an owned problem) | done | claude | M | T-003 |
| T-005 | Decision Log MVP (owner-scoped create/list) | done | claude | M | – |
| T-006 | Authenticated E2E with a disposable test database | done | claude | M | T-002 |
| T-007 | Investigate the CI browser-stage hang | done | claude | S | – |
| T-008 | Decision Log ownership migration (generate only) | done | claude | S | – |
| T-009 | Apply migration 0002 to the local database | done | human | S | T-008 |
| T-010 | Decisions domain: schema, actions, queries | done | claude | M | T-008 |
| T-011 | Decisions page and idea-level decision log | done | claude | S | T-010, T-009 |
| T-025 | Require a task branch, commit and PR for every card | done | claude | S | none |
| T-026 | Plan Finance OS MVP and ownership boundaries | done | codex | M | T-024 |
| T-027 | Add Finance ownership and schema contract | done | codex | M | T-026 |
| T-028 | Implement owner-scoped Finance transactions | done | codex | M | T-027 |
| T-029 | Build the private Finance UI | done | codex | M | T-028 |
| T-030 | Verify Finance workflows and privacy end to end | done | codex | M | T-029 |
| T-031 | Add a phase roadmap | done | claude | S | T-030 |
| T-032 | Plan Research OS MVP and ownership boundaries | done | claude | M | T-031 |
| T-033 | Add Research evidence schema and migration 0005 (generate only) | review | claude | S | T-032 |
| T-034 | Apply migration 0005 to the local database | todo | human | S | T-033 |
| T-035 | Build the owner-scoped Research evidence domain | todo | codex | M | T-033 |
| T-036 | Build the private Research UI | todo | codex | M | T-034, T-035 |
| T-037 | Verify Research workflows and privacy end to end | todo | claude | M | T-036 |
| T-038 | Close the Projects cross-owner and anonymous E2E gaps | doing | claude | M | none |
