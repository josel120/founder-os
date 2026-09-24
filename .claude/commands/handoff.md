---
description: Close the current session on a Founder OS task card with a compact handoff
---

For the card in progress ($ARGUMENTS if given):
1. Fill its Handoff block (≤15 lines): agent/date, done, changed files (`git diff --stat 2>/dev/null`), verification commands with exit codes, next step, next owner (see `docs/agents/ROUTING.md`), risks.
2. Set its status: `review` if the gate passed, `blocked` if stuck, `todo` if unfinished but unblocked. Update the BOARD.md row to match.
3. Rewrite the "Current state" section of `docs/PROGRESS.md` (keep the file ≤40 lines; facts only).
4. If a card moved to `review` and the reviewer has not run, run the `reviewer` subagent first.
5. If the card is `review` or `done`, follow "Git per card" in AGENTS.md: commit only the card's files, push its `task/` branch, open the PR with `gh pr create`, then record the PR URL in the Handoff in a small follow-up commit and push it. Never merge. `blocked` or unfinished cards are not committed.
