# Framework Orchestrator Workflow

Goal: preserve compass, sequence, shared state, and next-best-action without implementing product work.

## 1. Preflight

Run on first use, after update, after restart, or when state looks stale:

1. Run `node scripts/vydykhai.mjs doctor` when available.
2. Read Project State, latest explicit human decisions, active Alignment Window, tasks, PRs, and verified repo state.
3. Verify this thread is the registered active orchestrator for this participant/stream.
4. Compare dashboard timestamps and claims with the newest durable event.
5. Apply source precedence before trusting an old issue or agent plan.
6. Resolve `latest available flagship / xhigh` when the recorded check is missing, older than seven days, follows framework update/rotation, or the model was rejected/deprecated.

Compact state:

```md
Owner / stream:
Compass / DOD:
Project State:
Active Alignment Window:
Framework version / agent policy / resolved model / checked:
Active tasks: <task | owner | thread | PR | human checkpoint | DOD impact | status | next>
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
- `accept`: completion requires `$accept-work` in the task thread.
- `sequence`: choose what happens next.
- `health`: detect drift, stale context, repeated cost, or rotation need.

## 3. Check Shared Safety

Before work on a shared surface, check:

- latest relevant human decision and delta;
- participant packets and active tasks;
- overlapping flows, contracts, PRs, or DOD rows;
- requested Peer Compass Review;
- human checkpoint and safe continuation boundary.

Missing participants do not block unrelated work. Never infer their uncommitted state.

## 4. Dispatch

Require the minimum task contract:

- goal and DOD impact;
- scope and out of scope;
- product loop or linked enabler;
- human checkpoint;
- material burn/stop limit;
- verification and completion route.

Add research, lab, or peer review details only when relevant. Always pass the current resolved agent profile when thread tools support it; any fallback is human-visible and recorded.

When tools allow:

1. Create the separate task/research context from current approved base.
2. Name it from issue/sequence and short outcome.
3. Read back and correct the actual title.
4. Record the link/title in Project State and task issue.
5. Verify the child starts execution, names a blocker, or requests re-brief.

A plan-only response is not a launched task. Send it back to execute within scope or name the blocking decision.

## 5. Supervise

Use this state machine:

- No thread: create/prepare and record it.
- Plan only: request execution, blocker, or re-brief.
- Working inside scope: stay quiet and name the next checkpoint.
- Waiting at human checkpoint: give the human exact action, link, output location, safe continuation, and return sync.
- Research complete: incorporate the Research Packet, update durable state, archive the thread.
- Lab proof/cap reached: stop lab polish; route production transfer, tests, and real-flow smoke.
- Cross-owner overlap: request Peer Compass Review before affected work continues.
- Task claims completion without `$accept-work`: send it to `$accept-work` in the same thread.
- `NEEDS_FIXES`: return exact fixes to the same task thread.
- `BLOCKED`: record the missing decision/input and tell the human precisely.
- Accepted but smoke/merge pending: return human to the task thread.
- Accepted and merged: update DOD burn, parent closure, participant impact, and next-best-action.

Do not implement, smoke, or merge from the orchestrator.

## 6. Monitor

Use one monitor for one named gate. It may inspect or resume the existing task within approved scope. It must remain quiet while unchanged, avoid new scope/merge/spend, notify only on decision/drift/checkpoint/terminal state, and delete itself when finished.

## 7. Health And Rotation

Run Health Review after milestones, several slices, repeated follow-ups, stalled DOD burn, owner dropout, repeated context compaction, stale dashboards, or chat archaeology.

If rotation is needed:

1. Write the compact state to Project State.
2. Re-resolve the flagship profile and create a fresh orchestrator from current repo/framework.
3. Register it and mark the old thread superseded.
4. Ask the new thread to restate compass, DOD, tasks, blockers, latest delta, and next action.
5. Archive the old thread after successful reconstruction.

## 8. Finish

Do not stop at status. Return current state, durable links, safe continuation, one explicit next-best-action, and any named missing decision.
