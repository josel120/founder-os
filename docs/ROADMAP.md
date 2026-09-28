# Roadmap

Where development stands, phase by phase. Card detail lives in `docs/agents/tasks/`; daily state in `docs/PROGRESS.md`.
Update this file when a phase starts or ends (AGENTS.md, workflow step 5).

## Now

**All planned phases (0–10) are merged and live** on `founder-os-nine-pi.vercel.app`. Production has migrations 0000–0011; merges to `master` deploy to production automatically (Vercel production branch set 2026-09-27).
- Portfolio, GitHub sync (token set, T-074), finance imports, owner data export at `/private/export` (T-092, ADR-022).
- AI execution (ADR-021): deployed with the key set; runs succeed once the owner adds Anthropic credit and a spend limit (T-085). Failures name their reason (T-091).
- Restore drill passed 2026-09-27 (T-057).

## Done

| Phase | Scope | Cards | Status |
|---|---|---|---|
| 0. Secure foundation | Next.js app, Better Auth, owner-only access, PRIVATE-by-default schema, CI | pre-card (see `docs/PRD.md`, ADR-001..006) | merged |
| 1. Idea OS | Ideas and Problems capture/search, Problem → Idea, Decision Log, content editing, signed-in E2E | T-001..T-016 | merged |
| 2. Project OS | Owned Projects, lifecycle/operational status, Idea → Project, project decisions, E2E (cross-owner gaps closed by T-038) | T-017..T-024, T-038 | merged |
| 3. Finance OS | Owned transactions, exact decimals, optional project link, private UI, E2E | T-026..T-030 | merged (PR #25) |
| 4. Research OS | Owned evidence on problems and ideas: domain, `/private/research`, idea evidence, cross-owner/anonymous E2E, privacy sweep | T-032..T-037, T-040 | merged (PR #32, #33, #34) |
| 5. Workspace cockpit | `/private` home (what needs attention, login landing), Problem detail + edit + evidence, Project → Idea/Finance chain, explicit query columns, cross-owner/anonymous E2E | T-041, T-046..T-051 | merged (PR #34, #35, #36, #37) |
| 7. Distribution / portfolio | Publish chosen projects (`project_publication`, 0008), allowlisted public pages, owner publish panel with preview, pre-public privacy audit | T-065..T-071 | merged (PR #44..#49) |
| 8. GitHub integration | Read-only snapshot per project (0009), refresh + daily cron, quiet repositories; token set (T-074) | T-072..T-077 | merged (PR #50, #51, #53, #55, #58) |
| 10. AI execution | Owner-triggered idea assessment and research summary via Anthropic (ADR-021), `ai_run` (0011), daily cap, failure reasons (T-091); audit T-090; data export T-092 (ADR-022) | T-083..T-092 | merged (PR #60, #66, #68..#70) |
| 9. Finance imports | CSV import with mapping, preview, duplicate keys (0010) and undo | T-078..T-082 | merged (PR #52, #54, #56, #57, #59) |
| 6. Production readiness | Vercel + Neon deploy, one-command setup, fail-fast env, DB rate limits, runbook, `reportError`, lost-update fix, same-origin sign-in, deployed smoke check (`pnpm smoke`); restore drill passed 2026-09-27 (T-057) | T-042, T-052..T-064 | merged (PR #37, #39..#43) |
| Process | Agent coordination, branch/PR per card, phase roadmap, review subagents | T-012, T-025, T-031, T-039, T-043 | done |

## Next (ADR-013; the owner reorders by merging a roadmap change)

No phase is planned after 10. The owner picks the next one; it starts with a planning card, as T-017, T-026 and T-032 did.
