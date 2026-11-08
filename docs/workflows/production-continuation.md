# Production Continuation

Goal: a service interruption must not make the person say "continue" again when agreed work can safely advance. Apply [Bounded Autonomous Assignment](context-routing.md#bounded-autonomous-assignment) for finite continuation and independent disposition; native Goals does not grant retries or turn a consultation into product success.

## Responsibility Contract
The current assignment, not the last visible message, governs dispatch, restoration, Return application, waiting and closure. Keep work, owner, revision, DOD, original human direction, applicable restrictions, remaining obligations and cumulative allowance in existing State/lease. A Return changes evidence, not human authority. Apply ready owner work before ending; a pending State write is not an external wait.

Existing task-disposition and task-resume receipts require `assignment` with `work,owner,revision,contextEpoch,evidence,humanEvent,directions,readback,obligations`. `directions` projects original scoped AUTHORIZE/PAUSE/RESUME decisions with `id,source,orderSource,sequence,work,kind,supersedes`. AUTHORIZE represents initial approval, not a fabricated resume; it has no predecessor. A bounded suffix may retain `predecessor:{id,source,orderSource,sequence,work}` pointing to its original archived predecessor. Without an anchor first supersedes=null; otherwise each entry supersedes its predecessor in verified original-source order. Do not erase links or load all history. Resolve delegated commands against original human sources, never delivery timestamps. Incomparable order is UNVERIFIED. A resume cannot lift unrelated restrictions. `readback` binds humanEvent, revision, contextEpoch and evidence. Each obligation has id, owner, READY/WAITING/DONE, evidence and, for WAITING, resumeWhen. Acceptance leaves no open assignment obligations; consultation cannot replace ready owner work. Review and budget checks still apply.

A safety stop needs no permission or reviewer; calling it a human PAUSE requires the current original source. On conflict, hold affected effects and reconcile only conflicting originals, not the whole history or a new permission request. After compaction refresh State before interpreting retained commands. Replayed history, summaries and worker reports cannot supersede human authority.

Supply current assignment evidence through the existing receipt path before dependent actions. Older receipts without it remain UNVERIFIED, not retroactively invalid historical results; migrate on safe boundaries, never invent evidence. The enrolled reference runner enforces this, but ordinary native chat finals are not intercepted. Outstanding work requires authorized proven native continuation or bounded waiting, not a prompt-only guarantee.

Manage an outstanding obligation, not a message or chat lifetime. Its existing lease retains one accountable owner until accepted completion, explicit cancellation, or a successor's evidenced acceptance of responsibility. Delegating execution does not transfer responsibility for obtaining and applying its outcome. The cycle is assign -> observe execution -> receive outcome -> apply outcome -> continue or close. Delivery, observation and application are distinct evidence; none alone is task acceptance. A first-action receipt proves only that transition. Keep checkpoint, source authority, effects, spend and independent review obligations in existing State/Return records.

For every outcome, reconcile the exact task/turn, retained progress, latest human direction and effects before deciding the next step. Partial answers, errors, interruptions and missing reports neither erase obligations nor authorize replay. Unknown cause/effects hold affected actions; human pauses and required independent acceptance remain binding. Continue the same saved task when authorized; repeated failure uses bounded no-progress consultation. Before releasing control, apply available outcomes and retain an evidenced return path for both results and stops, or use bounded waiting. Unavailable/exhausted observation is an owned LIMITED gap with a concrete return trigger, never "work continues". Do not invent subscriptions, extend budgets or add reminder controllers. This contract cannot resurrect an ended application. Accepted completion ends this obligation's waiting, not unrelated project health.

## One Next Action

Use the existing `Next-Best-Action` section in Project State, not a second plan or memory node. Keep one JSON record there. It points to the current productive step and its existing work/lease; other concurrent work remains in `Execution Leases`.

```json
{"schemaVersion":1,"id":"NEXT-1","work":"WORK-1","action":"Dispatch the accepted increment",
 "owner":"active-manager-context","state":"READY","evidence":"accepted-brief-reference"}
```

- `READY`: the active orchestrator owns a safe management step. Its matching `PREPARED` lease may be published before dispatch; structural validity does not prove execution. Perform the step in the current control turn; a plan or promise is not a dispatch. Reconcile an existing lease before any launch.
- `WORKING`: the named task context has performed its first action; its matching lease is `STARTED` or `WORKING`. Record the launch/action receipt, not the prompt. Qualify terminal/error delivery before turn release; otherwise retain bounded native waiting below.
- `WAITING`: record the actual gate in `evidence` and a concrete `resumeWhen`. It may be a human decision, dependency, safety repair, or next goal after accepted completion. Do not invent a wait to excuse an idle task. Check the other canonical leases for independent ready work first.

Use the exact current context handle from `Orchestrator health` or the matching lease's `Owner / context` cell. A work reference is its stable key, not a PR number. Evidence is a safe reference, never a secret. Change the record only on a material action, owner, gate, or human-intent transition, not on every tool call or timer tick. Keep the action id stable until that step is completed or explicitly superseded with a source and reason; a service report does neither.

## Across An Interruption
For human resume, use the existing task-resume Action Receipt before reporting that work resumed. Resolve the latest human event against current work, owner, checkpoint, next action and newer pauses; reconcile retained effects. Perform the authorized dispatch in the same control turn (or reconcile an existing dispatch), then observe the matching worker turn's first action. A final promise, acknowledgement or successful send is not execution. Missing observation never authorizes resend: use the existing bounded Return/wait route. A real blocker remains an owned WAIT, not resume PASS. Use `action-receipt --input <resume-receipt.json>` on the installed CLI. Input: boundary=task-resume; work, owner, humanEvent, checkpoint, action; pause=CLEARED only after source-backed authority reconciliation; effects=RECONCILED or UNKNOWN. Both dispatch and observed repeat those five identity fields, turnId and evidence; observed.kind must be FIRST_ACTION. Keep this receipt in the existing transition, not another journal. Non-PASS exits 2. This validates declared evidence consistency, not authenticity: never invent observations or erase a newer pause. UNKNOWN forbids replay. UNVERIFIED cannot close resume or justify a “working” report. The helper does not intercept arbitrary native final messages or wake an ended manager; unsupported host enforcement remains LIMITED.

An ordinary task retains the whole useful outcome across local attempts. Its executor continues reasoning, tests, corrections and documentation within the agreed scope/budget until DOD, then reports self-check evidence and obtains fresh final REVIEW when the shared mandate or explicit DOD requires it. An internal failed test is neither an acceptance event nor a reason to ask “continue”. Bounded no-progress consultation, explicit pauses, unknown effects and real authority limits still apply. Protected-host admission remains unchanged; ordinary continuation never overrides a pending protected review.

On a Guard or service event, retain this productive step and the separate Pending Human Action. Route maintenance to its focused owner. If repair is independent, immediately continue the management step; if it blocks that step, record `WAITING` with the repair's return gate and continue any other safe work. After the repair return, re-read only the affected state and newer human decisions, then resume or explicitly supersede the step. Rotation carries both the next action and human request to the new manager.

At a completed stage also reconcile preparation and deferred maintenance due at that boundary. Preserve the productive obligation separately from service work and Pending Human Action. Apply the Responsibility Contract to partial returns and stops alike; neither maintenance dispatch nor a side answer closes the accepted outcome.

## Terminal Delivery Before Turn Release

On ordinary dispatch/resume with a project-local durable Return, use the installed `context-run --wait-for <receipt-id>` entry once. In .vydykhai/manager-wait-plan.json record owner (the actual bound session), receipt, the agreed UTC deadline, outerBudgetMs and a compact view with string fields dod, obligations, pause, effects, spend and sources. Keep original sources and executor identity. This snapshot is for resumption; refresh changed authority, pauses and effects before action. Set the actual outer tool budget to cover the event deadline plus completion slack. If a process API yields a session handle, drain it inside that same bounded outer call rather than returning the handle to the manager model. The recorded budget is a caller contract, not host enforcement. A duplicate dispatch or same-dependency timeout must not start another outer wait. A LIMIT holds the named obligation; return only on new evidence or a verified delivery. When no delivery is available report LIMITED to the owner. The shared local cursor applies the Return observation once; downstream action or message delivery requires separate evidence.

Event mode requires current-host evidence of results and stops delivered to this owner, including termination before Return Sync. A file watcher covers only its registered file events, not all native lifecycle events; entry hooks cover entry, not background wake-up. Installing either does not establish this coverage.

Without qualified delivery, use bounded native waiting after other ready management actions. Prefer one terminal-event wait for the remaining approved observation bound when the host supports it; for local child processes, await `runControlChild` and align the enclosing tool wait with that bound. Do not deliberately split supported waiting into short model-returning intervals. Where only bounded `wait_threads` or a host equivalent is available, reuse existing handles and saved cursors, batching dependent owners; this fallback does not establish model-free desktop wakeup. A wait timeout means no terminal event, not worker failure: continue waiting only within the existing approved observation deadline/budget, without messages or unchanged-state writes. If no bound is recorded, native waiting is unavailable, or that bound is exhausted, retain an owned LIMITED observation gap with a concrete return trigger/checkpoint and release the turn; do not declare worker failure, restart it or renew the wait allowance automatically. Do not busy-poll or infer permission from elapsed time. Waiting itself is not inference, but resumed owner processing incurs usage. New human input takes precedence; a human gate suspends dependent recovery, without repeating or hiding the question.

Use the existing work/context/turn incident identity to deduplicate recovery. A cursor acknowledges observation only. Local Return waiting yields RETURN once, APPLICATION_PENDING on subsequent explicit reads until a valid existing Return Route records consumption/routing, and ALREADY_RECONCILED only for that route. These are declared evidence, not semantic acceptance or retry authority. An observed Return disappearing from the current outbox is LIMITED, not completion; preserve history. PAUSED remains PAUSED. Do not turn APPLICATION_PENDING into a polling loop or another notification: the owner applies the saved outcome.

Capacity failure is availability, not a capability verdict. Use one already-authorized available fallback within the same task/budget, preserving checkpoint, model/effort history and reviewer; no implicit effort upgrade or allocation. No authorized fallback or repeated failure retains the concrete gate and bounded no-progress route, not endless retries. Read back the first resumed action: sending a message is not recovery proof. DONE ends task waiting, not due project Health.

## Current Task Identity

Use the existing task checkpoint and execution lease, not a new memory graph, plan or controller. At dispatch/material rebrief retain a compact current assignment: stable work key, revision of the approved outcome, checkpoint reference, latest applicable human event, owner, Candidate, remaining outcome, limits and next safe action. Revise identity only for a material change; source timestamps and old annotations do not become new instructions when replayed after compaction. The transport's chat message order is not the authority order.

After restoration, read the current checkpoint and newer permitted source events before acting or answering. Bind readback to current turn/contextEpoch. Resume receipts carry this taskIdentity plus readback {evidence,contextEpoch,sequence} and observed {contextEpoch,sequence}: actual host event ordering must place the action after readback. Never fabricate sequence numbers; unavailable ordering is UNVERIFIED. For a known resume transition the existing activity adapter sets resumeRequired=true and supplies resumeReceipt on the owner/lease view; normal continuation consumes it and routes RECONCILE_RESUME on missing/non-PASS evidence, never resend. Legacy unenrolled observations do not prove resume protection. Replayed history or a worker report is not a new human command: resolve the original event and explicit supersession. A genuinely newer pause wins; unclear chronology holds affected actions. Recover only conflicting sources, not full history.

The existing activity adapter may supply `owner.taskIdentity` (and the same projection in applicable `leases[]`). `current` comes from the authenticated current checkpoint/lease plus `contextEpoch`, the observed native context restoration/compaction boundary; `seen` comes from the exact worker turn's readback after that boundary. A readback before compaction in the same turn is stale. Never construct both from the manager's own expectation, relabel old readback as current or invent an unobservable epoch:

```json
{
  "schemaVersion": 1,
  "current": {"work":"WORK-1","owner":"worker","revision":"brief-2","checkpoint":"checkpoint-2","humanEvent":"human-2","contextEpoch":"compaction-2","evidence":"current-checkpoint-and-native-epoch"},
  "seen": {"work":"WORK-1","revision":"brief-2","checkpoint":"checkpoint-2","humanEvent":"human-2","contextEpoch":"compaction-2","turnId":"turn-2","evidence":"actual-turn-readback"},
  "failedRestorations": []
}
```

`evaluateTaskIdentity` is exported by the installed CLI and feeds existing production/whole-lease routing. A mismatch yields `RESTORE_CURRENT_TASK`. After one failed targeted restoration, retain `{turnId,evidence}` in `failedRestorations` from the existing incident/checkpoint history; a repeated mismatch yields `REBRIEF_FRESH_CONTEXT`. Do not reset that history on unrelated edits, new timer ticks or relabeling the same assignment. These are routing recommendations, not permission to create a chat, replace the root manager or repeat an external action. Missing, wrong-turn, wrong-owner or malformed evidence is `LIMITED / RECOVER_OBSERVATION`. Absent enrollment is `NOT_REQUESTED`, not proof of this protection; legacy recovery still works. Matching identity is not semantic or product acceptance.

Read `continuation.identityCoverage` separately from legacy activity coverage; whole-lease results expose corresponding `taskIdentities` when evaluated. `COVERED` here means the comparison had valid observations, even if it found a mismatch: inspect the routing action too. The helper's `observationKey` compares actual identity fields across projections, not merely their matching verdicts; it excludes evidence wording and is not an authentication token. An unevaluated wait/blocker remains `NOT_EVALUATED`, not a successful identity check.

At repeated loss, the manager reviews one bounded transfer to a fresh focused context under existing human/host authority: keep the same outcome and fixed Candidate, reconcile uncertain actions and pending Returns, stop the old owner's execution at a safe boundary, move the sole lease/return ownership, then prove the new owner read back the checkpoint and took its first authorized action. Never run both owners. If transfer is unavailable or needs consent, retain one concrete wait/question and continue independent work. Root-orchestrator rotation keeps its separate confirmation procedure. A new module/Discovery assignment in a context already exhibiting repeated identity loss needs this review before dispatch, not another same-chat retry. A large context or one successful compaction alone does not justify replacement.

Real access blockers, unavailable external outcomes and explicit human waits take precedence. Active-manager deferral and the existing incident budget still apply; a fresh chat does not reset the incident budget. Record the observed failure and recovery in the current health scope; historical HEALTHY or acknowledged recovery does not reset recurrence. Installation tests prove only the classifier. Live adoption must demonstrate current checkpoint -> compaction -> actual readback -> next authorized action/Return, preservation of a new human pause, and a quiet subsequent check. Without that host proof the continuation guarantee remains LIMITED; do not block independent product work or claim interception of arbitrary native finals.

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

The key binds the stable action id/work/owner/state, current orchestrator, and matching lease identity/state/owner, not receipt wording, evidence prose, or global snapshot/graph hashes. A refreshed receipt description and unrelated memory change retain the same observation; a changed action identity, state, lease, or recipient requires a fresh one. Re-read those exact sources before delivery. Keep the existing delta inventory and durable outbox discovery; this check neither reloads chat history nor replaces checks on other leases.

## Route The Result

- Ready work with an idle manager, an idle task still recorded as working, or a changed wait gate produces `WAKE` to the current manager. Reconcile the existing owner and receipts; never automatically start a replacement worker.
- Working owners and unchanged valid waits stay quiet. A known active manager defers wake-only input (`action: NOOP`, `requiredAction: WAKE`, `deferred: true`); it is still pending, not consumed or healthy. Check it again through the existing event/timer route after that turn. Safety and structural mismatches still audit.
- Keep one delivery owner per semantic incident. While delivery is in flight, do not enqueue another message. At the next check reconcile actual progress; one unresolved wake goes to the existing bounded audit/repair path, not endless reminders. An accepted incident id alone cannot erase an observed unfinished continuation.
- After repair, restore or explicitly supersede the human request as well as the productive step. The person sees the result, next decision, or real blocker from their orchestrator, not Guard mechanics.

## Execution Boundary And Terminal Evidence

At launch or material resume use [Execution Readiness](task-context-handoff-template.md#execution-readiness). `evaluateExecutionReadiness(checks)` checks the four existing receipt dimensions: `cwd`, `sources`, `report`, `delivery`. Each has `status` and a concrete `evidence` reference to the actual context/path/policy/route. Status is `AVAILABLE`, `MISSING`, `DENIED`, or `UNKNOWN`; only report/delivery may be `NOT_REQUIRED` when the accepted contract genuinely requires neither. Missing/denied checks also name `resumeWhen`. The helper returns `READY`, `BLOCKED`, or `LIMITED`; absence returns `NOT_REQUESTED`, never certified readiness. It does not probe a host or grant permissions.

The same fresh activity `owner` and applicable `leases[]` entries may carry `readiness` with those checks. Missing paths route `REPAIR_ENVIRONMENT`; denied actions route `RESOLVE_ACCESS`, not execute-or-block again. The adapter must collect actual evidence in the affected worker, not copy another context's settings or label read-only Discovery capable of writing.

If an idle current turn has an empty native view, inspect only authorized exact-turn public action/final/blocker metadata or durable receipts. Do not read hidden reasoning, all history, or achieve a denied disclosure by another route. Include the actual current `turnId` on the view and:

```json
{"terminal":{"turnId":"current-turn-id","status":"BLOCKED","evidence":"authorized-exact-turn-blocker","resumeWhen":"Named report scope is permitted by host policy"}}
```

Terminal status is `RESULT`, `BLOCKED`, or `UNAVAILABLE`. A `RESULT` routes `RECONCILE_RESULT`; it does not prove task acceptance, create Return Sync, or require the executor to redo work. `BLOCKED` requires its concrete resume condition and routes `RESOLVE_BLOCKER`. A missing report may be the blocked write, not missing execution. If outcome evidence is unavailable, emit `UNAVAILABLE` and its exact observation-gap reference: the checker returns `LIMITED` with `RECOVER_OBSERVATION`, never an instruction to restart. Wrong-turn, malformed or conflicting active/terminal observations also remain limited. Fresh enclosing context/key/time checks still apply; stale finals do not describe newer turns.

`continuation.nextAction` and `leaseActivity.nextActions` refine the existing Guard route, not a second dispatcher. The manager consumes that distinction under current authority. Reconciled access waits use existing `WAITING/PENDING` and stay quiet; changed gates trigger one routing decision and same-owner resume, not automatic replay of external actions. An unavailable final takes precedence over environment repair; a verified result takes precedence over recreating a now-missing checkout. Legacy observations remain readable without these optional fields but cannot certify this recovery coverage. Adoption must supply them when applicable and prove the missing-cwd, denied-report and empty-view cases; installing a new parser alone does not change a running adapter.

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
