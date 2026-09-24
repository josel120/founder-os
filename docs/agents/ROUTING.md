# Routing: who does what

Send each task to the cheapest agent that can do it well. Save the scarce budget for work that needs it.

| Work | Default owner | Why |
|---|---|---|
| Split a feature into cards, write goals and acceptance criteria, product questions | `chatgpt` (desktop chat; paste `prompts/chatgpt-planner.md`) | Needs no repo access; cheapest |
| Implement a clear S/M card with explicit files in scope | `codex` (paste `prompts/codex-task.md`) | Loads AGENTS.md natively; good at scoped edits |
| Cross-module design, security/ownership logic, auth, hard debugging, reviews | `claude` | Uses subagents to keep exploration cheap |
| Mechanical work: lint fixes, renames, test scaffolding, doc sync | `claude` → `implementer`/`scout` subagent, or `codex` at low reasoning effort | Cheap models are enough |
| Migrations against real data, secrets, `OWNER_EMAIL`, deploys, merges, pushes, deleting data | `human` (an agent prepares; the human approves and runs) | Irreversible |

## Card sizes (budget)

- **S**: ≤3 files, one behavior, one session.
- **M**: ≤8 files, may need a new test file, one or two sessions.
- **L**: not allowed as an implementation card. Split it into S/M cards first (ChatGPT or Claude).

## Handoff flow

```
chatgpt: plan → cards (todo, owner set)
   ↓
codex / claude: implement → Handoff block → status review
   ↓
claude reviewer (or the other agent): review → done  | back to todo with notes
   ↓
human: approve commit / PR / merge
```

## Escalation

- Same step fails twice, or the card is past 2× its size budget → set `blocked`, write the handoff with the exact error, set `Next owner` to the other implementer.
- Running out of quota mid-card → write the handoff immediately (even partial), then switch agents. A partial handoff beats lost context.
- Card is ambiguous → set `blocked`, set the next owner to `chatgpt` or `human`, and write the question in the handoff.
- Blocked by the environment (permissions, sandbox) → owner `human`, with the exact command to run.
