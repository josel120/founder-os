---
description: Take the next Founder OS task card for Claude, lock it and start work
---

1. Read `docs/agents/tasks/BOARD.md`. Pick $ARGUMENTS if given. Otherwise pick the first `todo` row with owner `claude` whose dependencies are `done`. If none exists, say so, list the `todo` rows for other owners and stop.
2. Read `docs/agents/CONTEXT.md` and the card. Create the card's `task/T-XXX-<slug>` branch per "Git per card" in AGENTS.md, then set Status: doing / Owner: claude in the card and the BOARD row.
3. For an S card, or anything security-sensitive, implement it directly. For a mechanical M card, delegate it to the `implementer` subagent with the card path. Use `scout` for any search wider than 2–3 greps.
4. When done, run `/handoff`.
