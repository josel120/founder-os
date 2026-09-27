# Archived board rows (done)

Moved from `docs/agents/tasks/BOARD.md` by T-039 on 2026-09-26. Card detail stays in `docs/agents/tasks/T-XXX.md`.

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
| T-033 | Add Research evidence schema and migration 0005 (generate only) | done | claude | S | T-032 |
| T-038 | Close the Projects cross-owner and anonymous E2E gaps | done | claude | M | none |
| T-040 | Harden the evidence schema before migration 0005 is applied | done | claude | S | T-033 |
| T-034 | Apply migrations 0005 and 0006 to the local database | done | human | S | T-033, T-040 |
| T-035 | Build the owner-scoped Research evidence domain | done | claude | M | T-033, T-040 |
| T-036 | Build the private Research UI | done | claude | M | T-034, T-035 |
| T-037 | Verify Research workflows and privacy end to end | done | claude | M | T-036 |
| T-039 | Extend the phase plan and add specialized review subagents | done | claude | M | T-033 |
| T-041 | Plan the Workspace cockpit (Phase 5) and its boundaries | done | claude | M | T-037 |
| T-042 | Plan Production readiness (Phase 6) and its boundaries | done | claude | M | T-041 |
| T-043 | Project-wide audit: security hardening, bug fixes and UX polish | done | claude | M | none |
| T-044 | Upgrade Vitest to 4.x to clear the remaining dev-only advisories | done | claude | S | T-043 |
| T-045 | Add a nonce-based script-src Content Security Policy | done | claude | M | T-043 |
| T-046 | Select explicit columns in the older domain queries | done | claude | S | none |
| T-047 | Cockpit aggregation queries | done | claude | M | T-041 |
| T-048 | `/private` home and login landing | done | claude | M | T-047 |
| T-049 | Problem detail page with content edit and evidence | done | claude | M | T-041 |
| T-050 | Show the Project → Idea and Project → Finance chain | done | claude | S | T-041 |
| T-051 | Verify the cockpit end to end and sweep privacy | done | claude | M | T-048, T-049, T-050 |
| T-052 | Fail fast on production env and tune the DB client for serverless | done | claude | M | T-042 |
| T-053 | Store auth rate limits in the database and pin session settings | done | claude | M | T-042 |
| T-054 | Report server errors without private data | done | claude | S | T-042 |
| T-055 | Write the production runbook | done | claude | S | T-042 |
| T-056 | Provision Vercel and Neon and deploy a preview | done | human | S | T-052, T-055 |
| T-058 | Smoke-check the deployment and sweep privacy | done | claude | S | T-057 |
| T-059 | Prune stale rate-limit rows so client IPs are not kept indefinitely | done | claude | S | T-053 |
| T-060 | Make anonymous E2E wait for the migrated database | done | claude | S | T-053 |
| T-061 | Fix lost client updates after server actions and navigations | done | claude | M | none |
| T-062 | One-command production setup for Vercel and Neon | done | claude | M | T-052, T-053, T-055 |
| T-063 | Let the owner reset a forgotten email or password with the setup command | done | claude | S | T-062 |
| T-064 | Sign-in always calls the page's own origin | done | claude | S | T-062 |
