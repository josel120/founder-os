# Codex prompt (copy-paste into a fresh Codex session)

---
Do task T-XXX. Follow the AGENTS.md workflow: read `docs/agents/CONTEXT.md` and `docs/agents/tasks/T-XXX.md` only, mark it doing, stay inside its files in scope, use the known-good commands, and finish by filling the Handoff block and updating BOARD.md and docs/PROGRESS.md. Follow "Git per card" in AGENTS.md: create the task/T-XXX branch before editing; when the gate passes, commit only the card's files, push the branch and open a PR with `gh pr create`. Never merge.
---

Out of quota mid-task? Send: "Write the handoff for T-XXX now with what is done and what remains, then stop."
