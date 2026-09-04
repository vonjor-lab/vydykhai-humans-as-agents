---
name: accept-work
description: Run the final acceptance of a task, PR, lab/maintenance result, or product increment in its owning execution context. Verify the delivered contract and exact current artifact; do not perform project-wide orchestration, alignment, parent sequencing, or implementation from another context.
---

# Accept Work

Run the final self-check in the task context before claiming completion.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/accept-work.md`

Load the task contract, current PR/diff or artifact, direct human corrections in this context, targeted patches delivered by the orchestrator, and verification output. Do not reconstruct unrelated Project State or raw meeting history.

## Contract

- Reconstruct the Accepted Baseline, Candidate, executable Memory Brief, its goal-to-evidence Context Route and task-local approach lineage using source precedence. When an atomic envelope is present, load `docs/workflows/memory-brief-envelope.md` and validate its application receipt before accepting any claimed applied ids. Compare actual scope and affected consumers with the supplied constraints; apply `docs/workflows/context-route.md` without rebuilding unrelated memory. Do not let an old issue, plan, or Rejected Candidate override a later proven state, direct human correction, or targeted orchestrator patch.
- Compare delivered behavior with goal/DOD, scope, declared continuation basis/invariants, product loop or linked enabler, progress continuity, human checkpoint, material burn, and verification route. An enabler must state `Unlocks`, `Still missing`, and the next product slice. Classify material deltas as `Inherited`, `Deliberately changed`, or `Unexpectedly changed`; unexplained unexpected change is `NEEDS_FIXES`.
- Keep accepted sub-slices distinct from parent closure. Report DOD impact; the orchestrator decides parent closure, cross-person impact, and next-best-action.
- Verify the task's Execution Lease identity and report its DOD Control Line contribution; the orchestrator alone closes the lease after consuming and routing the durable return.
- Separate required DOD follow-ups from optional future ideas. Required gaps keep the parent open; optional ideas do not expand accepted scope and return to the orchestrator as `IDEA` candidates.
- Require the promised visible user/operator loop for product capability closure. Backend state, route, UI shell, test, readiness card, or lab proof alone is insufficient.
- For Lab Mode, verify its decision, one-variable contract, proof, Learning Delta, production transfer, tests, and risk-based real-flow verification before product acceptance.
- Incorporate resolved boundary consultations and targeted Peer Compass Review or alignment patches; do not run their project-wide workflows here. A task cannot silently turn an undeclared boundary into a new shared mechanism.
- If this is maintenance triggered by expansion, verify the named recurring cause was removed or explicitly deferred, the original representative flow became materially smaller/faster, recurrence is covered, and the return to delivery is explicit. Containment alone is not acceptance of root-cause repair.
- Verify the risks changed by the Candidate. For runtime/integration/state work, prove repo/worktree, branch, commit, dirty state, frontend/backend commands and URLs, browser target, and smoke result from the exact code being accepted. For auth/data/storage/migration/deploy work, verify exact environment, least-privilege access, safe runbook, backup/recovery route, and a non-destructive preflight without exposing secret values; an incomplete protected pointer is `MEMORY_COVERAGE_GAP / BLOCKED`, not permission to search history or ask for the value again. For runnable data-backed handoffs, also prove schema/migration revision, a reproducible safe test-data source such as fixture/seed/snapshot/shared test environment, and recipient access; missing required data is `BLOCKED`, not product-failure evidence. For zero-spend/no-mutation work, disable the dangerous capability when practical, record counters before/after, and never erase or relabel a breach as zero.
- Treat missing or inconclusive current-code smoke as `NEEDS_FIXES` or `BLOCKED`.
- Complete the declared human checkpoint with observable questions that match the judgment that person owns; agents retain technical verification. Do not state that the human is unnecessary when visual review, paid approval, product decision, or manual smoke/merge remains.
- Classify every Memory Brief item as `applied`, `missed`, `contradicted`, or `not exercised` with evidence. If the Candidate is rejected, the human says «do it differently», or says the direction was already known, record Before/Now/Why/Keep/Drop/anchors/source and return a reusable `DECISION` or `LESSON` candidate. Apply clear task-local correction, but leave full graph reflection and impact analysis to the orchestrator. Build any successor from the Accepted Baseline plus refreshed Memory Brief.
- Keep corrective fixes, smoke, and manual merge in the task context. Promote the Candidate to Accepted Baseline only after acceptance and the required human checkpoint.
- Before merge, deploy, spend, or shared-state mutation, read back owning acceptance plus fresh exact actor, environment, revision, permitted mutation, and stop conditions. Acceptance, merge, and deploy are separate authorities; an absent, stale, or cross-environment Action Receipt is `BLOCKED` for that action.
- At a named readiness result, human checkpoint, irreducible blocker, or terminal result, write one complete marked Return Sync to the durable task/tracker outbox, then attempt the same id as a native wakeup. An Action Receipt never substitutes for Return Sync. Include learning evidence, memory candidates or `NO_MEMORY_DELTA`, and `Artifact disposition`. Report only through `SENT`; the orchestrator owns receipt, routing, the paired marked Return Route receipt, memory integration, and lease closure. Native final text and task/thread reads are non-authoritative and may be empty. Do not emit routine returns. Cross-person delivery remains incomplete until recipient proof.
- After a possible external/shared-state action with missing output or lost context, return `OUTCOME_UNKNOWN`, freeze replay, and reconcile durable/provider/runtime evidence before retrying.

## Finish

Return `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED` with verified evidence, unresolved risk, human checkpoint state, and recommended orchestrator action.
