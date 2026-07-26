---
name: accept-work
description: Accept, reject, or classify readiness of a task, PR, milestone, epic, lab result, or product capability against the latest human intent, brief, DOD, alignment, product loop, burn limits, and exact-current-code verification.
---

# Accept Work

Run the final self-check in the task context before claiming completion.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/accept-work.md`

Load the task issue, current PR/diff, latest explicit human decision, relevant deltas/patches, verification output, and neighboring contracts.

## Contract

- Reconstruct the Accepted Baseline, Candidate, applicable Intent Trail, and task-local approach lineage using source precedence. Do not let an old issue, plan, or Rejected Candidate override a later proven state or human correction.
- Compare delivered behavior with goal/DOD, scope, product loop or linked enabler, human checkpoint, material burn, and verification route.
- Keep accepted sub-slices distinct from parent closure.
- Separate required DOD follow-ups from optional future ideas. Required gaps keep the parent open; optional ideas do not expand accepted scope and return to the orchestrator as Idea Candidates.
- Require the promised visible user/operator loop for product capability closure. Backend state, route, UI shell, test, readiness card, or lab proof alone is insufficient.
- For Lab Mode, verify its decision, one-variable contract, proof, Learning Delta, production transfer, tests, and risk-based real-flow verification before product acceptance.
- Incorporate or resolve required Peer Compass Review and material alignment conflicts.
- If this is maintenance triggered by expansion, verify the named recurring cause was removed or explicitly deferred, the original representative flow became materially smaller/faster, recurrence is covered, and the return to delivery is explicit. Containment alone is not acceptance of root-cause repair.
- Verify the risks changed by the Candidate. For runtime/integration/state work, prove repo/worktree, branch, commit, dirty state, frontend/backend commands and URLs, browser target, and smoke result from the exact code being accepted; avoid a paid setup path when an equivalent controlled entry is valid and that path did not change.
- Treat missing or inconclusive current-code smoke as `NEEDS_FIXES` or `BLOCKED`.
- Complete the declared human checkpoint. Do not state that the human is unnecessary when visual review, paid approval, product decision, or manual smoke/merge remains.
- If the Candidate is rejected or the human says «do it differently», record the `APPROACH_PIVOT`: Before/Now/Why/Keep/Drop/scope/source. Build any successor from the Accepted Baseline while carrying forward proven changes and lessons.
- Keep corrective fixes, smoke, and manual merge in the task context. Promote the Candidate to Accepted Baseline only after acceptance and the required human checkpoint.
- At every human checkpoint, real blocker, or terminal result, publish Return Sync with `Intent/Approach Delta: none` or the compact lineage through native context messaging or a durable tracker event without waiting for a human prompt.

## Finish

Return `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED` with verified evidence, unresolved risk, human checkpoint state, and recommended orchestrator action.
