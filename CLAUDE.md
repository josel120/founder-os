@AGENTS.md

## Claude Code notes

- Commands: `/next-task` takes the next card, `/handoff` closes the session, `/new-task <request>` creates a card.
- Delegate broad searches to the `scout` subagent (Haiku). Delegate S/M cards to `implementer` (Sonnet). Use `reviewer` before a card moves to `done`.
- Use Bash, not PowerShell, for the commands in `docs/agents/CONTEXT.md`.
