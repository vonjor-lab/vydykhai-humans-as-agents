---
name: start-work
description: Turn a raw goal, meeting insight, broad product theme, changed compass, or large request into an approved epic brief, task map, ownership proposal, sequence, and shared-tracker work ready for autonomous agent execution.
---

# Start Work

Shape large work before implementation begins.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/start-work.md`

Use an already reconciled `$daily-alignment` delta when this is a re-brief from a meeting. Do not pass raw meeting inputs into a task context.

## Contract

- Restore product intent, latest explicit human decisions, compass, DOD, Project Memory Graph, related epics/issues/PRs, tracker projection, and verified repo state.
- Apply source precedence before using an old plan or issue as current intent.
- Before dispatch, re-brief, or material resume of stale/paused work, classify scope freshness as `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; a material delta needs human approval. Ordinary continue inside a current active contract is not a freshness event.
- Start from actor, problem, desired outcome, non-goals, and product loop; then identify entities, surfaces, contracts, dependencies, risks, and verification.
- Derive a Touch Set; resolve stable anchors/aliases for outcomes, actors, entities, surfaces, contracts, data, and operations; add semantic candidates; traverse typed relations one or two hops; filter by authority, status, scope, applicability, and supersession. Give the task no more than seven executable `Because / Apply / Avoid / Verify / Source` items or raise `MEMORY_COVERAGE_GAP`; ids alone are invalid and retrieval reasoning stays in the orchestrator.
- Route unresolved solution work into a role-`DISCOVERY` Research Context or disposable Lab instead of filling the orchestrator with speculation or sending ambiguity to execution. Require a compact Decision Packet before implementation tasks are written.
- Propose Lab Mode only when isolation lowers cost or risk; include the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, production transfer, and risk-based real-flow verification.
- Propose Peer Compass Review when another owner can prevent drift on an overlapping flow, surface, contract, PR, or DOD row.
- When expansion risk is material, name the expected touched surface, first human-verifiable evidence, and task-specific appetite. Do not use universal file/line/time thresholds as a verdict.
- Route recurring cross-task architecture/data/tooling friction into bounded maintenance only when it blocks efficient delivery; require proof that the original representative flow becomes smaller/faster and an explicit return to that task.
- Build role-`EXECUTION` only when it is Low-ready: one outcome and first action, no unresolved product/architecture choice, explicit boundaries, objective acceptance, current inputs/access/environment, and compact material consult triggers. Add nearest goal/DOD, owner and dependency/recipient boundary, freshness/Baseline, accepted mechanism plus the smallest complete Memory Brief, product loop or enabler continuation, authority/safety envelope, checkpoint, burn, and verification. Do not pass full Project State, transcripts, memory graph, task map, or orchestration deliberation.
- Keep one Success Line per accepted increment. A new Candidate starts from the Accepted Baseline plus applicable Memory Brief and may carry forward proven changes and lessons, never a rejected state as its implicit correction base. Sequence later increments instead of stretching one task across the product route.
- Add detailed metadata only when it changes execution safety.
- Assign the resolved `DISCOVERY` profile to solution work and `EXECUTION` profile to Low-ready delivery; expose the environment mapping or fallback only in dispatch metadata.
- Show parent closure and progress continuity: what is preserved, replaced, added, and remaining; what the slice unlocks; what still blocks the product loop; and which optional ideas stay outside the nearest DOD.
- Recommend sequence, outcome owner, backup/failover, recipient/dependency boundary, and parallel-safe purpose as well as file boundaries.
- Ask for human approval before creating or changing shared-tracker tasks.
- Instruct every launched execution context to start implementation, resolve ordinary failures autonomously, send compact `CONSULT` only at an undeclared boundary, never change its reasoning profile mechanically, run `$accept-work`, record each executable Memory Brief item as applied/missed/contradicted/not exercised, and publish Return Sync with a unique receipt id plus `NO_MEMORY_DELTA` or compact candidates only at a named human checkpoint, irreducible blocker, or terminal result. Its canonical title is `<work-id> [<track>] [<mode>] — <short outcome>` using the owning Issue or stable tracker key, never a PR; normal execution omits the mode. The orchestrator reads back and corrects that title plus actual link, role/profile, active start, and Return Sync route before declaring launch. Publish the task's current contract and tracker fields in the same approved operation. Return approved work to the Framework Orchestrator; do not implement or run orchestration/alignment workflows there.

## Finish

Return `READY_FOR_APPROVAL`, `NEEDS_DECISION`, or `NEEDS_RESEARCH_OR_SPLIT`, with the first next-best-action.
