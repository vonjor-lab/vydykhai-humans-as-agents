---
name: start-work
description: Turn a raw goal, meeting insight, broad product theme, changed compass, or large request into an approved epic brief, task map, ownership proposal, sequence, and shared-tracker work ready for autonomous agent execution.
---

# Start Work

Shape large work before implementation begins. The first-action receipt proves execution has started; it does not add a pause or approval between already authorized steps.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/start-work.md`

Use an already reconciled `$daily-alignment` delta when this is a re-brief from a meeting. Do not pass raw meeting inputs into a task context.

## Contract

- Restore the atomic Project State control snapshot and DOD Control Line first, then product intent, latest explicit human decisions, Project Memory Graph, related work, tracker projection, and verified repo state.
- Apply source precedence before using an old plan or issue as current intent.
- For explicitly declared `retained-progress-v1`, follow `docs/workflows/context-preparation.md`: the orchestrator prepares independently enumerated sources and confirms the reviewed plan; the assigned worker reads and acknowledges the actual context before `context-run` execution. Keep pending gaps and the supported-route limit visible; installing commands does not activate existing tasks.
- Before dispatch, re-brief, or material resume of stale/paused work, classify scope freshness as `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; a material delta needs human approval. Ordinary continue inside a current active contract is not a freshness event.
- Start from actor, problem, desired outcome, non-goals, and product loop; then identify journeys, modules/capabilities, entities, surfaces, contracts, data/artifacts, systems, dependencies, risks, and verification.
- Resolve the vertical goal-to-entity spine and reverse consumer routes before filtering. For every touched durable module or capability, supply its current project Module Contract shaped by `docs/workflows/module-contract-template.md` and exact implementation/test boundary. Tasks read graph route -> Module Contract -> current code; a missing or contradictory link is `MEMORY_COVERAGE_GAP`, not implicit permission to rediscover or replace behavior.
- Derive a Touch Set and follow `docs/workflows/context-route.md`: resolve anchors/aliases, inherited goal/brief/architecture constraints, consumers, prior decisions and accepted artifacts; filter by authority, status, scope, applicability and supersession. Give the task complete relevant meaning and rationale as executable `Because / Apply / Avoid / Verify / Source` items, with no fixed node or hop cap, or raise `MEMORY_COVERAGE_GAP`. For only an indivisible sequence, matrix, safety gate or proven compression miss, compile the relevant portion through `docs/workflows/memory-brief-envelope.md` and require its application receipt; ordinary context remains prose. The orchestrator prepares the route; the task reads it and consults at a real gap.
- Choose direct execution, bounded context-recovery `DISCOVERY`, or Discovery with a bounded lead through `context-route.md`. Use a lead only when one accepted outcome needs ongoing coherence across several tasks; preserve the existing roles and require proven return/wait coverage. Require a Decision Packet before implementation; explain the purpose and next visible checkpoint without making the human choose internal modes.
- Propose Lab Mode only when isolation lowers cost or risk; include the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, production transfer, and risk-based real-flow verification.
- Propose Peer Compass Review when another owner can prevent drift on an overlapping flow, surface, contract, PR, or DOD row.
- When expansion risk is material, name the expected touched surface, first human-verifiable evidence, and task-specific appetite. Do not use universal file/line/time thresholds as a verdict.
- Route recurring cross-task architecture/data/tooling friction into bounded maintenance only when it blocks efficient delivery; require proof that the original representative flow becomes smaller/faster and an explicit return to that task.
- Build role-`EXECUTION` only when it is Low-ready: one outcome and first action, no unresolved product/architecture choice, explicit boundaries, objective acceptance, current inputs/access/environment, and compact material consult triggers. Add nearest goal/DOD, owner and dependency/recipient boundary, freshness/Baseline, accepted mechanism, complete Memory Brief, Module Contracts and implementation boundary, expected documentation impact, product loop or enabler continuation, authority/safety envelope, checkpoint, burn, and verification. Require affected Module Contracts to change in the same Candidate when behavior changes. Do not pass full Project State, unrelated transcripts, whole memory graph, task map, or orchestration deliberation.
- Keep one Success Line and one unresolved Execution Lease per accepted increment. A new Candidate starts from the Accepted Baseline plus applicable Memory Brief, never a rejected state as its implicit correction base. Record a deliberate detour with owner, target DOD/lease, return condition, and review-by; block duplicate launch until disposition is known. A side question or service exchange does not end the accepted task: continue within scope or return its actual checkpoint/blocker through Return Sync.
- Add detailed metadata only when it changes execution safety.
- Assign the resolved `DISCOVERY` profile to solution work and `EXECUTION` profile to Low-ready delivery; expose the environment mapping or fallback only in dispatch metadata.
- Show parent closure and progress continuity: what is preserved, replaced, added, and remaining; what the slice unlocks; what still blocks the product loop; and which optional ideas stay outside the nearest DOD.
- Recommend sequence, outcome owner, backup/failover, recipient/dependency boundary, and parallel-safe purpose as well as file boundaries.
- Ask for human approval before creating or changing shared-tracker tasks.
- Instruct every launched task to make a first safe observable action in the launch/resume turn, resolve ordinary failures autonomously, use `CONSULT` only at an undeclared boundary, keep its profile, and run `$accept-work`. Every readiness, checkpoint, blocker, or terminal outcome writes the marked Return Sync to a durable outbox before attempting the same receipt id as a native wakeup; an Action Receipt never substitutes, and the orchestrator later writes the paired marked Return Route receipt. The orchestrator records `PREPARED`, then reads back title/link/profile/exact base/action evidence/route before `STARTED`; plan-only is not progress. Return approved work to the Framework Orchestrator; do not implement there.

## Finish

Return `READY_FOR_APPROVAL`, `NEEDS_DECISION`, or `NEEDS_RESEARCH_OR_SPLIT`, with the first next-best-action.
