# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`. A dependency missing from this board is archived, so it is `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
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
| T-051 | Verify the cockpit end to end and sweep privacy | todo | claude | M | T-048, T-049, T-050 |
| T-052 | Fail fast on production env and tune the DB client for serverless | todo | claude | M | T-042 |
| T-053 | Store auth rate limits in the database and pin session settings | todo | claude | M | T-042 |
| T-054 | Report server errors without private data | done | claude | S | T-042 |
| T-055 | Write the production runbook | todo | claude | S | T-042 |
| T-056 | Provision Vercel and Neon and deploy a preview | todo | human | S | T-052, T-055 |
| T-057 | Apply production migrations, create the owner and run a restore drill | todo | human | S | T-053, T-054, T-056 |
| T-058 | Smoke-check the deployment and sweep privacy | todo | claude | S | T-057 |
