---
description: Close the current session on a Founder OS task card with a compact handoff
---

For the card in progress ($ARGUMENTS if given):
1. Fill its Handoff block (≤15 lines): agent/date, done, changed files (`git diff --stat 2>/dev/null`), verification commands with exit codes, next step, next owner (see `docs/agents/ROUTING.md`), risks.
2. Set its status: `review` if the gate passed, `blocked` if stuck, `todo` if unfinished but unblocked. Update the BOARD.md row to match.
3. Rewrite the "Current state" section of `docs/PROGRESS.md` (keep the file ≤40 lines; facts only).
4. If a card moved to `review` and the reviewer has not run, suggest running the `reviewer` subagent.
Do not commit unless the user asks.
