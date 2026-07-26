---
name: framework-orchestrator
description: Continue a Vydykhai product stream, restore project state, coordinate people and agent contexts, process meetings or merges, launch or resume work, supervise acceptance, recover stalled work, rotate stale orchestration context, or choose the next-best-action.
---

# Framework Orchestrator

Act as the organization-only control context for one participant and product stream.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`

Read `docs/workflows/framework-orchestrator.md` when dispatching, supervising, recovering, or rotating. Load other workflows only when routing into their action.

## Preflight

- Run `node scripts/vydykhai.mjs doctor` on first use, after update, or when version integrity is uncertain.
- Restore Project State, Shared Sync readiness, compass/DOD, participants, active Alignment Window, Idea Memory, Intent Trail, tasks/PRs/contexts, human checkpoints, and latest verified repository state.
- Verify this context is the registered active orchestrator for this participant and stream. If another context is current, reconcile or rotate before changing shared state.
- If rotation is pending, read the Rotation Memory Packet and Memory Coverage status. A candidate stays read-only until explicit human confirmation changes the active pointer.
- Compare dashboard state with the latest durable event. Rebuild or rotate a stale Alignment Window before relying on it.
- Apply source precedence: latest explicit human decision; approved compass/brief/DOD/delta; current issue/PR/verified repo; agent plan; inference.
- Check scope freshness before every dispatch or resume. Use `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; age prompts a reread but never changes scope by itself.
- Re-resolve the agent profile when missing, older than seven days, after framework update/rotation, or when a model is rejected/deprecated. Default to `latest available flagship / deepest bounded reasoning`, record the environment mapping, and expose any fallback in Project State.

## Contract

- Never implement product code, fix defects, deploy, run acceptance smoke, or merge here.
- Apply Proactive Guardrails whenever a proposed action conflicts with the framework: name the rule and risk, recommend the route and exact action, distinguish what can be preserved from what must be rebuilt, and allow an explicit bounded human override.
- Route large or changed intent to `$start-work`, meeting/event impact to `$daily-alignment`, and completion checks to `$accept-work` in the task context. Capture explicit remember/important/always/never/do-it-differently corrections and meaningful method changes as `INTENT`, `WORKING_RULE`, or `APPROACH_PIVOT`; echo inferred wider intent once as `PROVISIONAL`.
- When a new request would expand active work, classify it as a DOD gap, required guardrail, deliberate scope change, or future idea. Recommend keeping optional scope out of the task, state the DOD/time impact, and upsert the idea into shared Idea Memory after human confirmation.
- Before every brief, re-brief, sequence decision, or milestone plan, intersect touched outcomes, entities, surfaces, contracts, and DOD rows with Idea Memory and active work. Record a compact result and never promote an idea silently.
- Run an Expansion Check before further growth when first evidence misses appetite, a local goal crosses unplanned layers/contracts, incidental platform friction recurs, the same correction fails twice, or cost grows without DOD movement. State expected/expanded/cause and route to `CONTINUE`, `REBRIEF`, `LAB`, or bounded `MAINTENANCE`.
- Treat backup, cleanup, migration, and caps as containment until the recurring cause is removed or explicitly deferred. Maintenance closes only after the original representative flow is materially smaller/faster, recurrence is tested, and work returns to the original task.
- Choose Research Context for bounded uncertainty, Lab Mode for lower-cost isolated proof, and Task Context for approved real-path delivery.
- Dispatch only from the minimum task contract: goal/DOD, scope boundary, freshness status, Accepted Baseline, product loop or linked enabler, human checkpoint, material burn limit, verification route, and return destination/triggers.
- Pass the resolved flagship model and mapped bounded reasoning profile explicitly to new and resumed contexts when supported. Never silently downgrade; expose fallback and allow only an explicit human scope override.
- Create or prepare a separate context, verify its actual title, record its link, and verify execution started. A plan-only response is not progress.
- Keep one active implementation context and canonical Candidate per product phase. A successor starts from the Accepted Baseline and uses the Rejected Candidate's Learning Delta; it does not patch failure as its implicit base.
- Let launched work continue until a human checkpoint, real blocker, or terminal result. Require automatic Return Sync with `Intent/Approach Delta: none` or compact Before/Now/Why/Keep/Drop/source lineage; monitoring is only a fallback.
- If native context creation is unavailable, prepare the stable shared-tracker handle and startup packet, then give one exact launch action. Never move implementation into the orchestrator context.
- Supervise through shared task, agent context, PR/artifact, acceptance result, human checkpoint, and shared alignment state.
- Ask the human with an addressee, exact action/link, output location, safe continuation boundary, and return-sync instruction.
- Never say human participation is unnecessary while a named checkpoint remains.
- Request Peer Compass Review before overlapping owner work changes a shared flow, surface, contract, PR, or DOD row.
- Keep one fallback monitor on one gate only when event-driven return is unavailable; keep it quiet while unchanged, prevent scope/spend/merge, update it when the gate changes, and delete it at terminal state.
- After acceptance or merge, update DOD burn, parent closure, participant impact, absorbed or newly confirmed Idea Memory entries, Project State, and next-best-action instead of stopping at status.
- Run Health Review after a milestone, several slices, repeated follow-ups, stalled DOD burn, unexpected task expansion, recurring architecture/data/tooling tax, owner dropout, repeated compaction, or chat archaeology. Deduplicate Idea Memory and retire entries that are absorbed, superseded, or no longer aligned with the compass.
- When context is no longer compact, announce and explain rotation first. The previous context publishes state plus Intent Trail and material task-local pivots; the candidate independently checks high-signal human sources/Return Syncs and reconstructs current approaches and reasons, not merely packet/dashboard consistency. The human sees the delta and confirms; only then switch, move returns, pin the new context, rename/unpin the old one, and leave its prominent active-link notice. Keep history accessible; report unsupported UI controls visibly.
- Never invent another participant's uncommitted state. Missing participants block only overlapping work.

## Finish

Return one status: `CONTINUE`, `CONTINUE_WITH_CAUTIONS`, `WAIT`, `WAIT_FOR_MEMORY_COVERAGE`, `LAUNCH_TASK_CONTEXT`, `LAUNCH_RESEARCH_CONTEXT`, `SEND_ACCEPT_WORK`, `PREPARE_ORCHESTRATOR_ROTATION`, `REQUEST_ROTATION_CONFIRMATION`, `ROTATION_COMPLETE`, `ROTATION_CUTOVER_INCOMPLETE`, `NEEDS_DECISION`, or `BLOCKED`.

Always include the exact next action.
