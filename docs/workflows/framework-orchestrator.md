# Framework Orchestrator Workflow

Goal: preserve compass, sequence, shared state, and next-best-action without implementing product work.

## 1. Preflight

Run during normal orchestrator activity; do not create a background model wake-up only to check the framework:

1. Read Project State, including this participant's framework version/check, Shared Sync readiness, latest explicit human decisions, active Alignment Window, Idea Memory, Intent Trail decision map, safe operational sources, tasks/PRs/contexts, and verified repo state.
2. Run `node scripts/vydykhai.mjs doctor` for a new orchestrator, after update, when integrity is uncertain, or on the first active use after that participant's check becomes 24 hours old. Record installed/latest version and check time; remain silent when current, and keep an unavailable check pending without blocking otherwise safe work.
3. Verify this context is the registered active orchestrator for this participant/stream.
4. Compare dashboard timestamps and claims with the newest durable event. Reject duplicate or contradictory current sections; rebuild one current DOD, active-work view, framework/agent policy, and next-best-action.
5. Apply source precedence and run scope freshness before trusting, dispatching, or resuming an old task. Record `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; age is only a re-read signal.
6. Resolve `latest available flagship / deepest bounded reasoning` and its environment mapping when the recorded check is missing, older than seven days, follows framework update/rotation, or the model was rejected/deprecated.

Compact state:
```md
Owner / stream / Compass / DOD:
Project State / Shared Sync: <link | READY or SYNC_LIMITED with gaps>
Active Alignment Window:
Idea Memory / Intent Trail decision map / operational sources / last reconciliation:
Framework version / agent policy / resolved model / checked:
Active tasks: <task | owner | context | Accepted Baseline -> Candidate | freshness | checkpoint | DOD impact | status | next>
Pending decisions / participants:
Can continue:
Next-best-action:
```
Rebuild a stale dashboard or rotate an unreadable Alignment Window before relying on it.

When upstream is newer, read every changelog release where `installed < release <= latest` oldest first. Report the range, release count, one concise delta per release, and the combined project impact; never omit a skipped release. Put one shared plan in Project State and next-best-action: update now before next dispatch when no active work depends on old rules or the change addresses a current coordination/safety risk; otherwise update after a named task/checkpoint. At that window prepare or reuse one update branch, run `update` and `doctor`, open or refresh its PR, and report the short delta. Never duplicate update work, overwrite conflicts, merge silently, or change active-task rules mid-flight. Re-read the updated core; rotate only when migration or context health requires it.

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
- `expansion`: unexpected surface/cost growth before evidence -> Expansion Check.

## 3. Protect DOD Focus And Shared Safety

Before changing active work, classify a new idea or request:

- DOD gap: required for the promised outcome; keep it in the task or re-brief.
- Guardrail: required for safe or correct delivery; add it visibly without pretending it is optional polish.
- Scope change: changes the promised outcome; show the DOD, burn, and sequence impact and ask the human.
- Future idea: useful but not required now; recommend finishing the current DOD first.

For a future idea, tell the human what remains in scope, why adding the idea would delay the DOD, and when it should return. After confirmation, upsert one entry in shared Idea Memory using `idea-memory-template.md`. Task, research, and lab contexts may return an Idea Candidate, but the orchestrator deduplicates and owns the current view.

At every brief, re-brief, resume, consultation, sequence decision, acceptance, and milestone, derive a Touch Set from outcomes, entities, actors/surfaces, contracts/authorities, and data/operational realms. Intersect it with the current Intent Trail decision map, Idea Memory, accepted/rejected task lineage, safe operational sources, and active work. Return a compact Memory Brief with applicable decisions/invariants, rejected-path lessons, relevant ideas without scope growth, safe source links, and conflicts or `MEMORY_COVERAGE_GAP`; never make the human tag or scan memory.

On a natural request for more possibilities, return relevant active ideas filtered by the named topic, horizon, or compass. Do not dump the full register or require the human to know its location.
Before work on a shared surface or any instruction to a running task, check:

- Shared Sync and relevant source access;
- latest relevant human decision and delta;
- participant packets and active tasks;
- overlapping flows, contracts, PRs, or DOD rows;
- requested Peer Compass Review;
- human checkpoint and safe continuation boundary.
- task events newer than the last Return Sync, especially direct human corrections.

Missing participants do not block unrelated work. Never infer their uncommitted state.

When a human says remember/important/always/never/do it differently, or meaningfully changes the method, layer, baseline, sequence, boundary, or verification, record an Intent/Approach Delta with Before/Now/Why/Keep/Drop/touch keys/source. Explicit pivots are confirmed; echo inferred wider intent once as `PROVISIONAL`. Merge reusable changes into an existing decision family, keep local-only lineage in its task, and apply Proactive Guardrails to conflicts without repeated warnings absent new risk.
## 4. Dispatch

Require the minimum task contract:

- goal and DOD impact;
- scope, outcome owner, and dependency/recipient boundary;
- scope freshness, Accepted Baseline, Touch Set, Memory Brief, accepted mechanism, and 1-3 applicable invariants;
- product loop or linked enabler with `Unlocks / Still missing / next product slice`;
- human checkpoint;
- material burn/stop limit;
- verification/completion route and `Consult when / Return to` plus terminal Return Sync triggers including Intent/Approach Delta and Memory Delta.

Add research, lab, peer review, or expansion appetite only when relevant. A Lab contract names its decision, one main variable, human-verifiable proof, stop/burn limit, and production exit. A patch, split, or re-brief maps `Preserved / Replaced / Added / Remaining`. Always pass the current resolved agent profile when context tools support it; any fallback is human-visible and recorded.
When tools allow:

1. Create the separate task/research context from current approved base.
2. Name it from issue/sequence and short outcome.
3. Read back and correct the actual title.
4. Record the link/title in Project State and task issue.
5. Verify the child starts execution and continues to a human checkpoint, real blocker, or terminal result; plan-only is not progress. Before any later instruction, read newer task events and reconcile newer human direction.

Without native context creation, prepare the stable shared-tracker handle and startup packet, record both in Project State, and give one exact launch action. Do not implement in the orchestrator context.

A plan-only response is not a launched task. Send it back to execute within scope or name the blocking decision.

## 5. Supervise

Use this state machine:

- No context: create/prepare and record it.
- Plan only: request execution, blocker, or re-brief.
- Working inside scope: stay quiet; the task continues the accepted mechanism and pushes Return Sync at checkpoint, blocker, or terminal state without human polling.
- Unexpected expansion: pause only affected growth; state `Expected`, `Expanded into`, `Likely cause`, then route `CONTINUE`, `REBRIEF`, `LAB`, or `MAINTENANCE`.
- Waiting at human checkpoint: name the judgment that person owns and give an observable action, link, output location, safe continuation, and return sync; keep technical verification with agents.
- Research complete: incorporate the Research Packet, update durable state, close or archive the context.
- Lab proof/cap reached: stop lab polish; route production transfer, tests, and real-flow smoke.
- Maintenance proof reached: verify the original representative flow is materially smaller/faster and recurrence is covered, then return to the original task; containment alone is not closure.
- Optional extension surfaced: keep the task inside its DOD, return an Idea Candidate, and continue unless the human explicitly changes scope.
- Boundary consultation (`CONSULT`): from `Boundary/Evidence/Proposed move/Safe continuation`, use existing `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, Peer Compass Review, or `NEEDS_DECISION` routes; pause only the affected boundary.
- Task claims completion without `$accept-work`: send it to `$accept-work` in the same context.
- Rejected Candidate, `NEEDS_FIXES`, or human «do it differently»: record the `APPROACH_PIVOT` and `Keep/Rebuild/Drop/Unknown`, merge any reusable Memory Delta into its decision family, then build the successor from the Accepted Baseline plus refreshed Memory Brief, not the failed state.
- `BLOCKED`: record the missing decision/input and tell the human precisely.
- Accepted but smoke/merge pending: return the human to the task context.
- Cross-person handoff: keep delivery open until the recipient confirms the exact shared artifact/revision and performs the agreed receipt check; runnable work includes a representative scenario in their environment.
- Accepted enabler: report what it unlocks, what product behavior is still missing, and its next product slice; keep the parent open.
- Accepted and merged: deduplicate reusable Memory Delta into the current decision family, atomically rebuild affected memory bodies, then update DOD burn, parent closure, participant impact, and next-best-action.
Do not implement, smoke, or merge from the orchestrator.

## 6. Monitor
Use one monitor for one named gate only when direct context return and durable tracker events are unavailable. It may inspect or resume the existing task within approved scope. While unchanged it creates no context message, no-op trace, or model wake-up. It avoids new scope/merge/spend, notifies only on decision/drift/checkpoint/terminal state, and deletes itself when finished.

## 7. Health And Rotation

Run Health Review after milestones, several slices, repeated same-class corrections, stalled DOD burn, unexpected expansion, recurring architecture/data/tooling tax, owner dropout, repeated context compaction, stale scope/dashboards, or chat archaeology.

During Health Review, compare Idea Memory and Intent Trail with compass, DOD, active tasks, accepted work, operational sources, and repository state. Atomically rebuild stale current bodies, merge decision families and duplicates, refresh touch/recall keys, retire absorbed or superseded entries without deleting evidence, and test one representative Memory Intersection.

If rotation is needed:

1. Freeze new dispatch, but keep the previous orchestrator active and intact. Before creating the candidate, tell the human why rotation is needed, what will move, what will not change, how memory will be verified, and what confirmation activates the replacement.
2. Publish one Rotation Memory Packet from the previous context: compass/DOD, current decision families and material task-local pivots, active/queued/promised/deferred work, remembered requests, safe operational source pointers, checkpoints, constraints, monitors/returns, participants/ownership, and ambiguous, stale, or chat-only items.
3. Rebuild stale Idea Memory and Intent Trail bodies from their evidence, grouping related decisions instead of copying chronology. For every item record evidence, classification (`ALREADY_DURABLE`, `MISSING_DURABLE`, `AMBIGUOUS`, or `STALE/SUPERSEDED`), relations, and correct durable destination.
4. Re-resolve the flagship profile and create a read-only candidate from current repo/framework. Do not register it active yet.
5. Candidate independently checks Project State, tasks, high-signal human sources and Return Syncs, then runs Memory Intersection on representative current/upcoming Touch Sets. It must recover applicable decisions, rejected paths, ideas, and safe operational sources; for relevant operations it locates the runbook/secret reference and performs only a non-destructive access check. It returns covered, missing, conflicting, and human-decision items; packet/dashboard consistency alone is insufficient.
6. Show the coverage delta to the human. Persist approved missing items without mass-creating tasks or reviving stale ideas.
7. After explicit human confirmation, change the active pointer and verify the new context can reconstruct compass, DOD, queue, remembered intent/rules, active-task approach lineage, blockers, latest delta, and next action.
8. Retarget native returns, tracker hooks, and monitors so no new event can land in the previous context. Remove obsolete rotation monitors.
9. Bring the new context forward, pin it when the environment supports pinning, verify its title, and publish one activation message with the old-history link, current state, and next-best-action.
10. Rename the previous context with a localized retired/superseded prefix, unpin it, and send its final message only after all routing has moved. The message must be visually prominent and equivalent to:
```md
# THIS ORCHESTRATOR IS RETIRED - DO NOT CONTINUE HERE
Active orchestrator: <title and link>
Continue all new coordination there. This context remains available only as read-only project history.
```
11. Verify Project State, links, titles, pin state, routing, and the previous context's latest message. Report `ROTATION_COMPLETE` only when they agree. Otherwise give one exact human action and report `ROTATION_CUTOVER_INCOMPLETE`. Keep the previous context as unpinned history; archive or delete it only on explicit request.
If the previous context is unavailable, mark `MEMORY_RECOVERY_INCOMPLETE`, let only clearly safe work continue, and request human confirmation before the candidate becomes authoritative.

## 8. Finish
Do not stop at status. Return current state, durable links, safe continuation, one explicit next-best-action, and any named missing decision.
