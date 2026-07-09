---
name: accept-work
description: Accept, reject, or classify readiness of a task, PR, milestone, epic, lab result, or product capability against the latest human intent, brief, DOD, alignment, product loop, burn limits, and exact-current-code verification.
---

# Accept Work

Run the final self-check in the task context before claiming completion.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/codex-workflows/accept-work.md`

Load the task issue, current PR/diff, latest explicit human decision, relevant deltas/patches, verification output, and neighboring contracts.

## Contract

- Reconstruct the baseline using source precedence. Do not let an old issue or agent plan override a later human correction.
- Compare delivered behavior with goal/DOD, scope, product loop or linked enabler, human checkpoint, material burn, and verification route.
- Keep accepted sub-slices distinct from parent closure.
- Require the promised visible user/operator loop for product capability closure. Backend state, route, UI shell, test, readiness card, or lab proof alone is insufficient.
- Require Lab Mode proof, production transfer, tests, and real-flow verification before product acceptance.
- Incorporate or resolve required Peer Compass Review and material alignment conflicts.
- For runtime work, prove repo/worktree, branch, commit, dirty state, frontend/backend commands and URLs, browser target, and smoke result from the exact code being accepted.
- Treat missing or inconclusive current-code smoke as `NEEDS_FIXES` or `BLOCKED`.
- Complete the declared human checkpoint. Do not state that the human is unnecessary when visual review, paid approval, product decision, or manual smoke/merge remains.
- Keep corrective fixes, smoke, and manual merge in the task thread.
- After human confirmation, update task/PR status and durable memory; tell the orchestrator the DOD impact, parent state, participant impact, and next-best-action.

## Finish

Return `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED` with verified evidence, unresolved risk, human checkpoint state, and recommended orchestrator action.
