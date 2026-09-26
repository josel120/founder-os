@AGENTS.md

## Claude Code notes

- Commands: `/next-task` takes the next card, `/handoff` closes the session, `/new-task <request>` creates a card.
- Delegate broad searches to the `scout` subagent (Haiku). Delegate S/M cards to `implementer` (Sonnet). Use `reviewer` before a card moves to `done`. Also run `schema-reviewer` when a card changes the schema or adds a migration, and `privacy-auditor` on each phase's closing E2E card and on any card that adds routes outside `/private`, metadata, publishing, logging or outbound calls.
- Use Bash, not PowerShell, for the commands in `docs/agents/CONTEXT.md`.
