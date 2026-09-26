# Task board

Rules: one row per active card. Update the row whenever the card's status or owner changes. Move `done` rows to `docs/agents/archive/board-done.md` when this file passes 30 rows.
Take the first `todo` row whose owner is you and whose dependencies are `done`. A dependency missing from this board is archived, so it is `done`.

| ID | Title | Status | Owner | Size | Depends |
|---|---|---|---|---|---|
| T-040 | Harden the evidence schema before migration 0005 is applied | todo | claude | S | T-033 |
| T-034 | Apply migrations 0005 and 0006 to the local database | todo | human | S | T-033, T-040 |
| T-035 | Build the owner-scoped Research evidence domain | todo | codex | M | T-033, T-040 |
| T-036 | Build the private Research UI | todo | codex | M | T-034, T-035 |
| T-037 | Verify Research workflows and privacy end to end | todo | claude | M | T-036 |
| T-039 | Extend the phase plan and add specialized review subagents | review | claude | M | T-033 |
| T-041 | Plan the Workspace cockpit (Phase 5) and its boundaries | todo | codex | M | T-037 |
| T-042 | Plan Production readiness (Phase 6) and its boundaries | todo | claude | M | T-041 |
| T-043 | Project-wide audit: security hardening, bug fixes and UX polish | done | claude | M | none |
| T-044 | Upgrade Vitest to 4.x to clear the remaining dev-only advisories | todo | codex | S | T-043 |
| T-045 | Add a nonce-based script-src Content Security Policy | todo | claude | M | T-043 |
