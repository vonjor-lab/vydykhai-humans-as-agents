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

- Restore product intent, latest explicit human decisions, compass, DOD, related epics, issues, PRs, and verified repo state.
- Apply source precedence before using an old plan or issue as current intent.
- Start from actor, problem, desired outcome, non-goals, and product loop; then identify entities, surfaces, contracts, dependencies, risks, and verification.
- Route a narrow unresolved question into Research Context instead of filling the orchestrator with speculation.
- Propose Lab Mode only when isolation lowers cost or risk; include proof, stop condition, burn cap, production transfer, and real-flow verification.
- Propose Peer Compass Review when another owner can prevent drift on an overlapping flow, surface, contract, PR, or DOD row.
- Build autonomous tasks with the minimum contract: goal/DOD impact, scope/out of scope, product loop or linked enabler, human checkpoint, material burn limit, and verification/completion route.
- Add detailed metadata only when it changes execution safety.
- Use the current resolved flagship / deepest bounded reasoning profile and expose its environment mapping or fallback.
- Show parent closure: what is already closed, what remains, and why another slice is needed.
- Recommend sequence, owner, backup/failover, and parallel-safe boundaries.
- Ask for human approval before creating or changing shared-tracker tasks.
- Return approved work to the Framework Orchestrator. Do not implement in this workflow.

## Finish

Return `READY_FOR_APPROVAL`, `NEEDS_DECISION`, or `NEEDS_RESEARCH_OR_SPLIT`, with the first next-best-action.
