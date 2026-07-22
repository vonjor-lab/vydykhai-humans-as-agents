# Framework Orchestrator Workflow

Goal: preserve compass, sequence, shared state, and next-best-action without implementing product work.

## 1. Preflight

Run on first use, after update, after restart, or when state looks stale:

1. Run `node scripts/vydykhai.mjs doctor` when available.
2. Read Project State, latest explicit human decisions, active Alignment Window, tasks, PRs, and verified repo state.
3. Verify this context is the registered active orchestrator for this participant/stream.
4. Compare dashboard timestamps and claims with the newest durable event.
5. Apply source precedence and run scope freshness before trusting, dispatching, or resuming an old task. Record `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; age is only a re-read signal.
6. Resolve `latest available flagship / deepest bounded reasoning` and its environment mapping when the recorded check is missing, older than seven days, follows framework update/rotation, or the model was rejected/deprecated.

Compact state:

```md
Owner / stream:
Compass / DOD:
Project State:
Active Alignment Window:
Idea Memory / last intersection:
Framework version / agent policy / resolved model / checked:
Active tasks: <task | owner | context | Accepted Baseline -> Candidate | freshness | checkpoint | DOD impact | status | next>
Pending decisions / participants:
Can continue:
Next-best-action:
```

Rebuild a stale dashboard or rotate an unreadable Alignment Window before relying on it.

## 2. Classify The Request

- `launch`: project activation or missing operating memory -> `$project-launch`.
- `shape`: raw goal, major change, or task-map revision -> `$start-work`.
- `align`: meeting/event changed another participant's safe action -> `$daily-alignment`.
- `research`: bounded uncertainty before brief/task, no product code.
- `lab`: isolated proof reduces cost or risk and has an exit plan.
- `dispatch`: launch or resume an approved task.
- `accept`: completion requires `$accept-work` in the task context.
- `sequence`: choose what happens next.
- `health`: detect drift, stale context, repeated cost, or rotation need.

## 3. Protect DOD Focus And Shared Safety

Before changing active work, classify a new idea or request:

- DOD gap: required for the promised outcome; keep it in the task or re-brief.
- Guardrail: required for safe or correct delivery; add it visibly without pretending it is optional polish.
- Scope change: changes the promised outcome; show the DOD, burn, and sequence impact and ask the human.
- Future idea: useful but not required now; recommend finishing the current DOD first.

For a future idea, tell the human what remains in scope, why adding the idea would delay the DOD, and when it should return. After confirmation, upsert one entry in shared Idea Memory using `idea-memory-template.md`. Task, research, and lab contexts may return an Idea Candidate, but the orchestrator deduplicates and owns the current view.

At every brief, re-brief, sequence decision, and milestone plan, intersect the touched outcome, entities, surfaces, contracts, and DOD rows with Idea Memory and active tasks. Check relevance, duplication, conflict, and whether work already absorbed the idea. Record one compact result: use as guard, shape separately, keep remembered, or retire. No match is a valid explicit result.

On a natural request for more possibilities, return relevant active ideas filtered by the named topic, horizon, or compass. Do not dump the full register or require the human to know its location.

Before work on a shared surface, check:

- latest relevant human decision and delta;
- participant packets and active tasks;
- overlapping flows, contracts, PRs, or DOD rows;
- requested Peer Compass Review;
- human checkpoint and safe continuation boundary.

Missing participants do not block unrelated work. Never infer their uncommitted state.

When a proposed action conflicts with a framework rule, apply Proactive Guardrails: name the rule and risk, recommend the route and exact next action, and distinguish what can be preserved from what must be rebuilt. Record a human override with limits and a re-entry condition; do not repeat the warning without new risk.

## 4. Dispatch

Require the minimum task contract:

- goal and DOD impact;
- scope and out of scope;
- scope freshness and Accepted Baseline;
- product loop or linked enabler;
- human checkpoint;
- material burn/stop limit;
- verification/completion route and Return Sync destination/triggers.

Add research, lab, or peer review details only when relevant. A Lab contract names its decision, one main variable, human-verifiable proof, stop/burn limit, and production exit. Always pass the current resolved agent profile when context tools support it; any fallback is human-visible and recorded.

When tools allow:

1. Create the separate task/research context from current approved base.
2. Name it from issue/sequence and short outcome.
3. Read back and correct the actual title.
4. Record the link/title in Project State and task issue.
5. Verify the child starts execution and continues to a human checkpoint, real blocker, or terminal result; plan-only is not progress.

Without native context creation, prepare the stable shared-tracker handle and startup packet, record both in Project State, and give one exact launch action. Do not implement in the orchestrator context.

A plan-only response is not a launched task. Send it back to execute within scope or name the blocking decision.

## 5. Supervise

Use this state machine:

- No context: create/prepare and record it.
- Plan only: request execution, blocker, or re-brief.
- Working inside scope: stay quiet; the task continues and pushes Return Sync at checkpoint, blocker, or terminal state without human polling.
- Waiting at human checkpoint: give the human exact action, link, output location, safe continuation, and return sync.
- Research complete: incorporate the Research Packet, update durable state, close or archive the context.
- Lab proof/cap reached: stop lab polish; route production transfer, tests, and real-flow smoke.
- Optional extension surfaced: keep the task inside its DOD, return an Idea Candidate, and continue unless the human explicitly changes scope.
- Cross-owner overlap: request Peer Compass Review before affected work continues.
- Task claims completion without `$accept-work`: send it to `$accept-work` in the same context.
- Rejected Candidate / `NEEDS_FIXES`: record `Keep`, `Rebuild`, `Drop`, and `Unknown`; build the successor from the Accepted Baseline, not the failed state.
- `BLOCKED`: record the missing decision/input and tell the human precisely.
- Accepted but smoke/merge pending: return the human to the task context.
- Accepted and merged: update DOD burn, parent closure, participant impact, and next-best-action.

Do not implement, smoke, or merge from the orchestrator.

## 6. Monitor

Use one monitor for one named gate only when direct context return and durable tracker events are unavailable. It may inspect or resume the existing task within approved scope. It must remain quiet while unchanged, avoid new scope/merge/spend, notify only on decision/drift/checkpoint/terminal state, and delete itself when finished.

## 7. Health And Rotation

Run Health Review after milestones, several slices, repeated same-class corrections, stalled DOD burn, owner dropout, repeated context compaction, stale scope/dashboards, or chat archaeology.

During Health Review, compare Idea Memory with the current compass, DOD, active tasks, accepted work, and repository state. Merge duplicates, refresh recall triggers, and retire absorbed, superseded, or irrelevant entries without deleting their evidence trail.

If rotation is needed:

1. Freeze new dispatch, but keep the previous orchestrator active and intact.
2. Publish one Rotation Memory Packet from the previous context:
   - compass, DOD, decisions, and explicit corrections;
   - active, queued, promised, deferred, paused, and conditional work;
   - human requests to remember and project working rules;
   - checkpoints, burn/privacy constraints, monitors, follow-ups, and return-sync obligations;
   - participants, ownership, overlap, backups, and missing packets;
   - ambiguous, contradictory, stale, or chat-only items.
3. For every item record evidence, classification (`ALREADY_DURABLE`, `MISSING_DURABLE`, `AMBIGUOUS`, or `STALE/SUPERSEDED`), and correct durable destination.
4. Re-resolve the flagship profile and create a read-only candidate from current repo/framework. Do not register it active yet.
5. Candidate independently compares the packet with Project State, issues/PRs, project instructions/docs, repo state, and available history. It returns covered, missing, conflicting, and human-decision items.
6. Show the coverage delta to the human. Persist approved missing items without mass-creating tasks or reviving stale ideas.
7. After explicit human confirmation, change the active pointer and verify the new context can reconstruct compass, DOD, queue, remembered rules, blockers, latest delta, and next action.
8. Keep the previous context pinned and linked as history/reference. Archive or delete it only on an explicit human request.

If the previous context is unavailable, mark `MEMORY_RECOVERY_INCOMPLETE`, let only clearly safe work continue, and request human confirmation before the candidate becomes authoritative.

## 8. Finish

Do not stop at status. Return current state, durable links, safe continuation, one explicit next-best-action, and any named missing decision.
