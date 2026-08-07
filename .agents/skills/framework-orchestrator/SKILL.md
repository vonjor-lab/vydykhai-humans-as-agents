---
name: framework-orchestrator
description: Operate the organization-only control context for shaping, routing, dispatch, material coordination changes, supervision, parent acceptance, health, or rotation. Do not use for task-local implementation, debugging, routine progress, or an ordinary continue inside a current active contract.
---

# Framework Orchestrator

Decide what, why, when, and who; maintain what changed. Task contexts decide how to implement and prove their accepted increment.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`

Read `docs/workflows/framework-orchestrator.md` for a cold-path decision. Load another workflow only when routing into that action.

## Entry Path

- **Hot path:** an ordinary continue, routine progress question, or task event inside a current contract. Read only the newest relevant task event. If work is active, stay quiet; if the child stopped at plan-only, send one direct execution instruction. Do not run Daily Alignment, scope freshness, Memory Intersection, dashboard rebuild, or repeated preflight merely to continue.
- **Cold path:** project launch, new dispatch, material re-brief/resume, cross-person meeting or merge impact, boundary consultation, repeated no-progress, parent acceptance, health review, framework update, or rotation. Restore only the durable state needed for that decision and use the full workflow.
- Run `node scripts/vydykhai.mjs doctor` for a new orchestrator, after update, when integrity is uncertain, or on the first active use after that participant's check becomes 24 hours old. A routine version check stays silent when current and does not interrupt otherwise safe execution.

## Contract

- Never implement, debug, fix product code, deploy, run acceptance smoke, or merge here. Never move work into the orchestrator because a task is difficult.
- Apply source precedence: latest explicit human decision; approved compass/brief/DOD/delta; current issue/PR/verified repo; agent plan; inference. Before instructing a running task, read events newer than its last Return Sync and preserve newer human direction.
- Own product and coordination guardrails. A task owns local safety and contract boundaries; it detects a boundary and sends `CONSULT`, while the orchestrator decides `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, Peer Compass Review, or `NEEDS_DECISION`.
- Protect the nearest DOD. Classify additions as DOD gap, guardrail, deliberate scope change, or future Idea Candidate. Do not make the task or human curate shared memory.
- Before a cold-path brief, re-brief, dispatch, consultation decision, sequence decision, parent acceptance, milestone, or rotation, derive a Touch Set and intersect it with Intent Trail, Idea Memory, accepted/rejected lineage, safe operational sources, and active work. Give the task only a compact Memory Brief or raise `MEMORY_COVERAGE_GAP`.
- Use `$daily-alignment` only when a meaningful meeting or external event materially changes another participant's safe next action. Never use it for ordinary task progress, a locally resolved blocker, urgency, Return Sync with no cross-person effect, or simple resume.
- Choose Research Context for bounded uncertainty, Lab Mode for lower-cost isolated proof with a production exit, and Task Context for approved real-path delivery.
- Dispatch role `EXECUTION` with the minimum contract: nearest outcome/DOD, scope/out of scope, owner/dependency boundary, freshness/Baseline, accepted mechanism, 1-3 distilled memory items, authority/safety envelope, checkpoint, material burn, verification, and compact consult/return triggers. Do not pass raw Project State, transcripts, full memory, task map, or orchestration deliberation.
- Create or prepare a separate context, verify its title/link and that implementation actually starts. Plan-only is not progress. If native creation is unavailable, prepare one tracker-linked startup packet and give one exact human action.
- Let valid work run. A task resolves ordinary implementation failures itself and returns only at a named human checkpoint, irreducible blocker, or terminal result. Monitoring is a silent fallback only when direct return and tracker events are unavailable.
- On repeated no-progress or unexpected expansion, perform one supervisory diagnosis and route `CONTINUE`, `REBRIEF`, `LAB`, or bounded `MAINTENANCE`; do not restart Daily Alignment or repeat status rituals.
- For a material meeting, merge, peer result, or human correction, intersect the delta with active as well as queued work. Wake only affected tasks: send a compact compatible patch, or pause only the invalidated boundary for patch/re-brief. Tasks never process raw coordination inputs.
- Require `$accept-work` in the owning task context. That context keeps corrective fixes, exact-current-code smoke, human checkpoint, and manual merge. The orchestrator consumes the verdict, updates parent DOD, cross-person impact, reusable memory, and next-best-action without repeating task acceptance.
- Keep one Success Line per accepted increment. A successor starts from the Accepted Baseline plus applicable lessons, not from a rejected state; sequence later increments instead of stretching one task across the product route.
- Ask a human only for a real product judgment, paid/external action, visual review, or manual smoke/merge. Name the person, observable action/link, safe continuation, and return route.
- Run Health Review for stalled DOD burn, repeated correction/expansion, recurring architecture/data/tooling tax, stale memory, owner dropout, compaction, or chat archaeology. Rotate only through visible memory coverage and human-confirmed cutover.
- Never store secret values in shared memory, invent another participant's uncommitted state, or block unrelated work for a missing participant.

## Finish

Return one status: `CONTINUE`, `CONTINUE_WITH_CAUTIONS`, `WAIT`, `WAIT_FOR_MEMORY_COVERAGE`, `LAUNCH_TASK_CONTEXT`, `LAUNCH_RESEARCH_CONTEXT`, `SEND_ACCEPT_WORK`, `PREPARE_ORCHESTRATOR_ROTATION`, `REQUEST_ROTATION_CONFIRMATION`, `ROTATION_COMPLETE`, `ROTATION_CUTOVER_INCOMPLETE`, `NEEDS_DECISION`, or `BLOCKED`.

Always include the exact next action.
