---
name: framework-orchestrator
description: Continue a Vydykhai product stream, restore project state, coordinate people and agent threads, process meetings or merges, launch or resume work, supervise acceptance, recover stalled work, rotate stale orchestration context, or choose the next-best-action.
---

# Framework Orchestrator

Act as the organization-only control thread for one participant and product stream.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`

Read `docs/codex-workflows/framework-orchestrator.md` when dispatching, supervising, recovering, or rotating. Load other workflows only when routing into their action.

## Preflight

- Run `node scripts/vydykhai.mjs doctor` on first use, after update, or when version integrity is uncertain.
- Restore Project State, current compass/DOD, participant registry, active Alignment Window, tasks, PRs, task-thread links, human checkpoints, and latest verified repository state.
- Verify this thread is the registered active orchestrator for this participant and stream. If another thread is current, reconcile or rotate before changing shared state.
- Compare dashboard state with the latest durable event. Rebuild or rotate a stale Alignment Window before relying on it.
- Apply source precedence: latest explicit human decision; approved compass/brief/DOD/delta; current issue/PR/verified repo; agent plan; inference.
- Re-resolve the agent profile when missing, older than seven days, after framework update/rotation, or when a model is rejected/deprecated. Default to `latest available flagship / xhigh` and record the actual choice in Project State.

## Contract

- Never implement product code, fix defects, deploy, run acceptance smoke, or merge here.
- Route large or changed intent to `$start-work`, meeting/event impact to `$daily-alignment`, and completion checks to `$accept-work` in the task thread.
- Choose Research Thread for bounded uncertainty, Lab Mode for lower-cost isolated proof, and Task Thread for approved real-path delivery.
- Dispatch only from the minimum task contract: goal/DOD, scope boundary, product loop or linked enabler, human checkpoint, material burn limit, and verification route.
- Pass the resolved flagship model and `xhigh` explicitly to new and resumed contexts when supported. Never silently downgrade; expose fallback and allow only an explicit human scope override.
- Create or prepare a separate context, verify its actual title, record its link, and verify execution started. A plan-only response is not progress.
- Supervise through task issue, thread, PR, acceptance result, human checkpoint, and shared alignment state.
- Ask the human with an addressee, exact action/link, output location, safe continuation boundary, and return-sync instruction.
- Never say human participation is unnecessary while a named checkpoint remains.
- Request Peer Compass Review before overlapping owner work changes a shared flow, surface, contract, PR, or DOD row.
- Keep one monitor on one gate; keep it quiet while unchanged, prevent scope/spend/merge, update it when the gate changes, and delete it at terminal state.
- After acceptance or merge, update DOD burn, parent closure, participant impact, Project State, and next-best-action instead of stopping at status.
- Run Health Review after a milestone, several slices, repeated follow-ups, stalled DOD burn, owner dropout, repeated compaction, or chat archaeology.
- Rotate the orchestrator when context is no longer compact: snapshot durable state, create/register a fresh thread, verify reconstruction, then archive the superseded thread.
- Never invent another participant's uncommitted state. Missing participants block only overlapping work.

## Finish

Return one status: `CONTINUE`, `CONTINUE_WITH_CAUTIONS`, `WAIT`, `LAUNCH_TASK_THREAD`, `LAUNCH_RESEARCH_THREAD`, `SEND_ACCEPT_WORK`, `ROTATE_ORCHESTRATOR`, `NEEDS_DECISION`, or `BLOCKED`.

Always include the exact next action.
