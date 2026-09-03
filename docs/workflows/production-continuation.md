# Production Continuation

Goal: a service interruption must not make the person say "continue" again when agreed work can safely advance.

## One Next Action

Use the existing `Next-Best-Action` section in Project State, not a second plan or memory node. Keep one JSON record there. It points to the current productive step and its existing work/lease; other concurrent work remains in Execution Leases and Safe Continuation.

```json
{
  "schemaVersion": 1,
  "id": "NEXT-1",
  "work": "WORK-1",
  "action": "Dispatch the accepted increment",
  "owner": "active-manager-context",
  "state": "READY",
  "evidence": "accepted-brief-reference"
}
```

- `READY`: the active orchestrator owns a safe management step. Its matching `PREPARED` lease may be published before dispatch; structural validity does not prove execution. Perform the step in the current control turn; a plan or promise is not a dispatch. Reconcile an existing lease before any launch.
- `WORKING`: the named task context has performed its first action; its matching lease is `STARTED` or `WORKING`. Record the launch/action receipt, not the prompt. The orchestrator remains available without polling.
- `WAITING`: record the actual gate in `evidence` and a concrete `resumeWhen`. It may be a human decision, dependency, safety repair, or next goal after accepted completion. Do not invent a wait to excuse an idle task. Check Safe Continuation for independent ready work first.

Use the exact current context handle from `Orchestrator health` or the matching lease's `Owner / context` cell. A work reference is its stable key, not a PR number. Evidence is a safe reference, never a secret. Change the record only on a material action, owner, gate, or human-intent transition, not on every tool call or timer tick. Keep the action id stable until that step is completed or explicitly superseded with a source and reason; a service report does neither.

## Across An Interruption

On a Guard or service event, retain this productive step and the separate Pending Human Action. Route maintenance to its focused owner. If repair is independent, immediately continue the management step; if it blocks that step, record `WAITING` with the repair's return gate and continue any other safe work. After the repair return, re-read only the affected state and newer human decisions, then resume or explicitly supersede the step. Rotation carries both the next action and human request to the new manager.

Before ending a control turn, verify that ready management work has been acted on and the productive route now has observable execution or a real wait. Dispatching maintenance alone does not satisfy this condition. Do not keep the manager busy waiting for a worker. A task's side answer or service exchange likewise does not finish its accepted contract: continue inside scope or return the actual checkpoint/blocker through the existing Return Sync route.

## Fresh Activity, No Model

The project-owned adapter reads fresh native activity, calls `readProductionContinuation(state)` from the installed CLI, and supplies `guard-check --activity <observation.json>`. This is a bounded observation, not a new shared artifact or scheduler. Build it during each existing check; do not relabel cached evidence with a fresh timestamp.

```json
{
  "schemaVersion": 1,
  "continuationKey": "hash-returned-by-readProductionContinuation",
  "observedAt": "2026-01-01T12:00:00Z",
  "orchestrator": {
    "context": "active-manager-context",
    "status": "IDLE",
    "evidence": "native-status-reference"
  }
}
```

For `WORKING`, also supply `owner` with the same shape for the exact task context. For `WAITING`, supply `wait: {"status":"PENDING","evidence":"current-gate-reference"}`; use `CHANGED` only after observing the relevant answer, return, or gate change. A changed gate calls for interpretation, not permission to merge, deploy, spend, or repeat an uncertain action. A review-by expiry calls for reconciliation, not assumed completion.

Activity status is `ACTIVE`, `IDLE`, or `UNKNOWN`. Only authoritative native status or equivalent independent runtime evidence establishes idle; an empty chat view, old final answer, or absence of messages does not. Observations expire after five minutes; timestamps more than five seconds in the future are rejected. Missing, stale, malformed, wrong-context, or unobservable data returns coverage `LIMITED`, not a fabricated stall or a healthy result. One accepted observation limitation may stay quiet through the existing incident mechanism, but it remains `LIMITED` and cannot certify adoption.

The key binds the action, current orchestrator, and matching lease identity/state/owner, not global snapshot or graph hashes. Unrelated memory changes retain the pending step; a changed action, lease, or recipient requires fresh observation. Re-read those exact sources before delivery. Keep the existing delta inventory and durable outbox discovery; this check neither reloads chat history nor replaces checks on other leases.

## Route The Result

- Ready work with an idle manager, an idle task still recorded as working, or a changed wait gate produces `WAKE` to the current manager. Reconcile the existing owner and receipts; never automatically start a replacement worker.
- Working owners and unchanged valid waits stay quiet. A known active manager defers wake-only input (`action: NOOP`, `requiredAction: WAKE`, `deferred: true`); it is still pending, not consumed or healthy. Check it again through the existing event/timer route after that turn. Safety and structural mismatches still audit.
- Keep one delivery owner per semantic incident. While delivery is in flight, do not enqueue another message. At the next check reconcile actual progress; one unresolved wake goes to the existing bounded audit/repair path, not endless reminders. An accepted incident id alone cannot erase an observed unfinished continuation.
- After repair, restore or explicitly supersede the human request as well as the productive step. The person sees the result, next decision, or real blocker from their orchestrator, not Guard mechanics.

## Whole-Lease Coverage When Needed

Before enabling a bounded Discovery lead, extend the same fresh `--activity` observation with `leaseKey` from `readLeaseActivityScope(state)` and a `leases` array for every `STARTED`, `WORKING` or `WAITING` row. This is transient adapter input, not a new shared artifact, model call or timer. Reuse bounded native status and durable dependency/checkpoint metadata; do not reload discussion history. The existing CLI calls `evaluateLeaseActivity` and returns `leaseActivity.coverage` separately from the next-action check.

```json
{
  "leaseKey": "hash-returned-by-readLeaseActivityScope",
  "leases": [
    {"work":"LEAD-1","context":"lead-context","status":"IDLE","evidence":"native-lead-status",
     "wait":{"status":"PENDING","resumeWhen":"Implementation evidence arrives","dependsOn":["WORK-1"],"evidence":"current-task-dependency"}},
    {"work":"WORK-1","context":"worker-context","status":"ACTIVE","evidence":"native-worker-status"}
  ]
}
```

Merge these fields into the normal observation, retaining `schemaVersion`, `observedAt`, `continuationKey` and orchestrator/next-owner evidence. Use exact work keys and context handles from the current leases. `wait.dependsOn` lists local work dependencies; use an empty list for a genuine human or external gate and supply its actual condition/evidence. Derive waits from current task contracts and observed events, never from silence. A whole-lease observation is complete only when every live owner and wait is visible; unavailable participant machines remain `LIMITED`, not inferred idle.

Missing, stale, duplicate, unknown-owner, incomplete or ambiguous supplied observations are `LIMITED`. A working owner observed idle or a changed/closed dependency produces one existing `WAKE`; a circular pending wait produces `AUDIT_REQUIRED`. A waiting lead with an unchanged actual gate stays silent. These are routing decisions, never permission to retry an external action, duplicate a worker or close a parent. Reconcile an in-flight incident before delivery; an accepted incident cannot erase still-unfinished observed work. The existing active-manager deferral and human-attention preservation still apply.

Absent `leases` yields `NOT_REQUESTED` and preserves legacy adapter behavior; it does not certify leading mode. Test the candidate adapter on a waiting lead, active parallel worker, changed dependency, mutual wait, lost return, rotation and the quiet follow-up schedule before enabling that mode. Without such proof use bounded Discovery and ordinary tasks. A checker verifies supplied relationships and activity, not the truth or completeness of product understanding; semantic checks remain with the orchestrator and focused reviewers.

## Adoption And Proof

This is an additive contract inside Project State v2; the graph schema and roles are unchanged. `continuationPolicy.turnRelease` defines the productive release condition; the older `humanAttentionPolicy.orchestratorAvailability` value remains for updater compatibility, not an exception for service dispatch. A focused update task converts the current next action from durable evidence, prepares the adapter Candidate, and uses the existing guarded switch. Do not silently infer `WORKING` or a wait when evidence is absent. Older free-text state remains available as the migration source; it cannot pass the new continuation check until converted.

Local tests prove parsing and routing decisions, not model behavior or a live scheduler. Before claiming active protection, the project owner must prove one real interrupted ready step resumes through its existing lease, a working task receives no duplicate launch, a pending human decision stays quiet, and the installed scheduled route is quiet afterward. Record unavailable native visibility as `LIMITED`. Pending adapter proof blocks only that guarantee, not unrelated safe work. No framework-maintenance context performs product adoption.
