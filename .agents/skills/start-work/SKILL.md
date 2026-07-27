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

Load `$daily-alignment` inputs when this is a re-brief from a meeting or execution event.

## Contract

- Restore product intent, latest explicit human decisions, compass, DOD, Idea Memory, Intent Trail, related epics/issues/PRs, and verified repo state.
- Apply source precedence before using an old plan or issue as current intent.
- Before dispatch or resume, classify scope freshness as `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; a material delta needs human approval.
- Start from actor, problem, desired outcome, non-goals, and product loop; then identify entities, surfaces, contracts, dependencies, risks, and verification.
- Intersect the proposed brief or sequence with Idea Memory, Intent Trail, and active work. Recall future options without silently expanding scope; apply confirmed intent/rules and reconstruct applicable `APPROACH_PIVOT` lineage before choosing the method.
- Route a narrow unresolved question into Research Context instead of filling the orchestrator with speculation.
- Propose Lab Mode only when isolation lowers cost or risk; include the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, production transfer, and risk-based real-flow verification.
- Propose Peer Compass Review when another owner can prevent drift on an overlapping flow, surface, contract, PR, or DOD row.
- When expansion risk is material, name the expected touched surface, first human-verifiable evidence, and task-specific appetite. Do not use universal file/line/time thresholds as a verdict.
- Route recurring cross-task architecture/data/tooling friction into bounded maintenance only when it blocks efficient delivery; require proof that the original representative flow becomes smaller/faster and an explicit return to that task.
- Build autonomous tasks with the minimum contract: goal/DOD, scope, freshness/Baseline, accepted mechanism plus 1-3 applicable invariants, product loop, checkpoint, burn/expansion, verification, and `Consult when / Return to` plus terminal return triggers.
- Keep one Success Line per product phase. A new Candidate starts from the Accepted Baseline and may carry forward proven changes and lessons, never a rejected state as its implicit correction base.
- Add detailed metadata only when it changes execution safety.
- Use the current resolved flagship / deepest bounded reasoning profile and expose its environment mapping or fallback.
- Show parent closure: what is already closed, what remains, why another slice is needed, and which optional ideas stay outside the nearest DOD.
- Recommend sequence, owner, backup/failover, and parallel-safe boundaries.
- Ask for human approval before creating or changing shared-tracker tasks.
- Instruct every launched context to continue the accepted mechanism, send compact `CONSULT` at an undeclared semantic boundary, execute through checkpoint/blocker/terminal state, run `$accept-work`, and publish Return Sync automatically. Return approved work to the Framework Orchestrator; do not implement here.

## Finish

Return `READY_FOR_APPROVAL`, `NEEDS_DECISION`, or `NEEDS_RESEARCH_OR_SPLIT`, with the first next-best-action.
