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

- Restore product intent, latest explicit human decisions, compass, DOD, Idea Memory, Intent Trail, related epics/issues/PRs, and verified repo state.
- Apply source precedence before using an old plan or issue as current intent.
- Before dispatch, re-brief, or material resume of stale/paused work, classify scope freshness as `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; a material delta needs human approval. Ordinary continue inside a current active contract is not a freshness event.
- Start from actor, problem, desired outcome, non-goals, and product loop; then identify entities, surfaces, contracts, dependencies, risks, and verification.
- Derive a Touch Set from outcomes, entities, actors/surfaces, contracts/authorities, and data/operational realms. Intersect it with the current Intent Trail decision map, Idea Memory, accepted/rejected task lineage, safe operational sources, and active work; retain that project-wide reasoning in the orchestrator and give the task only a compact Memory Brief or raise `MEMORY_COVERAGE_GAP`.
- Route unresolved solution work into a role-`DISCOVERY` Research Context or disposable Lab instead of filling the orchestrator with speculation or sending ambiguity to execution. Require a compact Decision Packet before implementation tasks are written.
- Propose Lab Mode only when isolation lowers cost or risk; include the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, production transfer, and risk-based real-flow verification.
- Propose Peer Compass Review when another owner can prevent drift on an overlapping flow, surface, contract, PR, or DOD row.
- When expansion risk is material, name the expected touched surface, first human-verifiable evidence, and task-specific appetite. Do not use universal file/line/time thresholds as a verdict.
- Route recurring cross-task architecture/data/tooling friction into bounded maintenance only when it blocks efficient delivery; require proof that the original representative flow becomes smaller/faster and an explicit return to that task.
- Build role-`EXECUTION` only when it is Low-ready: one outcome and first action, no unresolved product/architecture choice, explicit boundaries, objective acceptance, current inputs/access/environment, and compact material consult triggers. Add nearest goal/DOD, owner and dependency/recipient boundary, freshness/Baseline, accepted mechanism plus 1-3 distilled memory items, product loop or enabler continuation, authority/safety envelope, checkpoint, burn, and verification. Do not pass full Project State, transcripts, memory views, task map, or orchestration deliberation.
- Keep one Success Line per accepted increment. A new Candidate starts from the Accepted Baseline plus applicable Memory Brief and may carry forward proven changes and lessons, never a rejected state as its implicit correction base. Sequence later increments instead of stretching one task across the product route.
- Add detailed metadata only when it changes execution safety.
- Assign the resolved `DISCOVERY` profile to solution work and `EXECUTION` profile to Low-ready delivery; expose the environment mapping or fallback only in dispatch metadata.
- Show parent closure and progress continuity: what is preserved, replaced, added, and remaining; what the slice unlocks; what still blocks the product loop; and which optional ideas stay outside the nearest DOD.
- Recommend sequence, outcome owner, backup/failover, recipient/dependency boundary, and parallel-safe purpose as well as file boundaries.
- Ask for human approval before creating or changing shared-tracker tasks.
- Instruct every launched execution context to start implementation, resolve ordinary failures autonomously, send compact `CONSULT` only at an undeclared boundary, never change its reasoning profile mechanically, run `$accept-work`, and publish Return Sync only at a named human checkpoint, irreducible blocker, or terminal result. Return approved work to the Framework Orchestrator; do not implement or run orchestration/alignment workflows there.

## Finish

Return `READY_FOR_APPROVAL`, `NEEDS_DECISION`, or `NEEDS_RESEARCH_OR_SPLIT`, with the first next-best-action.
