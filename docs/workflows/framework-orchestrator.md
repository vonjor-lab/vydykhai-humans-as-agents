# Framework Orchestrator Workflow
Goal: preserve compass, sequence, shared state, and next-best-action without implementing product work.
## 1. Choose Hot Or Cold Path
Do not create a background model wake-up only to check the framework.
**Hot path:** an ordinary continue, routine progress question, or task event still inside a current execution contract. Read only the latest relevant task event and direct human correction. If the task is working, stay quiet. If it stopped at plan-only, send one direct instruction to execute. Do not run Daily Alignment, scope freshness, Memory Intersection, dashboard rebuild, or repeated preflight merely to continue.

**Cold path:** project launch, new dispatch, stale/paused work requiring material resume, re-brief, cross-person meeting/merge impact, boundary consultation, repeated no-progress, parent acceptance, health review, framework update, or rotation. Then:
1. Read only the relevant Project State, compass/DOD, decisions, shared state, memory, tasks/contexts, and verified repo evidence.
2. Run `node scripts/vydykhai.mjs doctor` for a new orchestrator, after update, when integrity is uncertain, or on the first active use after that participant's check becomes 24 hours old. Record installed/latest version and check time; remain silent when current, and keep an unavailable check pending without blocking otherwise safe work.
3. Verify this is the registered active orchestrator and reconcile the current dashboard with the newest durable event.
4. Apply source precedence and, for dispatch/re-brief/material resume, classify scope `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`; age is only a re-read signal.
5. Re-resolve role-routed profiles on the latest available flagship only when their recorded check is missing/stale, follows update/rotation, or the model was rejected/deprecated: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, efficient bounded for `EXECUTION`.
Compact state:
```md
Owner / stream / Compass / DOD:
Project State / Shared Sync: <link | READY or SYNC_LIMITED with gaps>
Active Alignment Window:
Idea Memory / Intent Trail decision map / operational sources / last reconciliation:
Framework version / agent routing / resolved model and role mappings / checked:
Active tasks: <task | owner | context | Accepted Baseline -> Candidate | freshness | checkpoint | DOD impact | status | next>
Pending decisions / participants:
Can continue:
Next-best-action:
```
Rebuild a stale dashboard only when the cold-path decision depends on it; ordinary execution never waits for cosmetic dashboard maintenance.
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
- `continue`: current task remains inside its contract -> hot path, no alignment ritual.

Before creating a context, classify it as `ORCHESTRATOR_WORK` for project-wide synthesis/priority/sequence/owner decisions; `DISCOVERY` when the solution needs deep research, product/architecture/UX/visual work, or experiment design; `EXECUTION` when solution and acceptance are Low-ready; or `STALE_OR_REBRIEF` when the card is outdated, mixed, too broad, contradictory, or missing inputs.

## 3. Protect DOD Focus And Shared Safety
Before changing active work, classify a new idea or request:

- DOD gap: required for the promised outcome; keep it in the task or re-brief.
- Guardrail: required for safe or correct delivery; add it visibly without pretending it is optional polish.
- Scope change: changes the promised outcome; show the DOD, burn, and sequence impact and ask the human.
- Future idea: useful but not required now; recommend finishing the current DOD first.

For a future idea, tell the human what remains in scope, why adding the idea would delay the DOD, and when it should return. After confirmation, upsert one entry in shared Idea Memory using `idea-memory-template.md`. Task, research, and lab contexts may return an Idea Candidate, but the orchestrator deduplicates and owns the current view.

At every cold-path brief, re-brief, dispatch, consultation decision, sequence decision, parent acceptance, milestone, and rotation, derive a Touch Set from outcomes, entities, actors/surfaces, contracts/authorities, and data/operational realms. Intersect it with the current Intent Trail decision map, Idea Memory, accepted/rejected task lineage, safe operational sources, and active work. Keep that intersection here and return only a compact Memory Brief with applicable decisions/invariants, rejected-path lessons, safe source links, and conflicts or `MEMORY_COVERAGE_GAP`; never make the human or task scan memory. Do not repeat this on hot-path continue.

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
Launch `EXECUTION` only when all Low-ready checks pass: one outcome and first action; no unresolved product/architecture choice; explicit scope/touch boundaries/non-goals; objective DOD and acceptance oracle; current baseline/data/access/environment; and compact material consult triggers. Otherwise resolve the gap, re-brief or split, or launch `DISCOVERY`.
Discovery returns a compact Decision Packet with the chosen approach, rejected options and lessons, affected entities/interfaces, acceptance or visual evidence, risks, and unresolved owner decisions. Integrate it with compass and memory before writing execution tasks; it does not produce production implementation by default.
Require one role-`EXECUTION` contract:
- goal and DOD impact;
- scope/out of scope, outcome owner, and dependency/recipient boundary;
- scope freshness, Accepted Baseline, accepted mechanism, and 1-3 distilled Memory Brief items;
- product loop or linked enabler with `Unlocks / Still missing / next product slice`;
- authority/safety envelope and human checkpoint;
- material burn/stop limit;
- verification/completion route, narrow `Consult when`, and `Return to` at a named human checkpoint, irreducible blocker, or terminal result.

Keep Project State, raw Touch Set, transcripts, full memory views, task map, and orchestration deliberation out of the task. Add research, lab, peer review, or expansion appetite only when relevant. A patch, split, or re-brief maps `Preserved / Replaced / Added / Remaining`. Pass the resolved `EXECUTION` profile when supported; any fallback is visible.
When tools allow:

1. Create the separate task/research context from current approved base.
2. Name it from issue/sequence and short outcome.
3. Read back and correct the actual title.
4. Record the link/title in Project State and task issue.
5. Verify the child starts execution and continues to a named human checkpoint, irreducible blocker, or terminal result; plan-only is not progress. Before any later instruction, read newer task events and reconcile newer human direction.

Without native context creation, prepare the stable shared-tracker handle and startup packet, record both in Project State, and give one exact launch action. Do not implement in the orchestrator context.

A plan-only response is not a launched task. Send it back to execute within scope or name the blocking decision.

## 5. Supervise

Use this state machine:

- No context: create/prepare and record it.
- Plan only: request execution, blocker, or re-brief.
- Working inside scope: stay quiet; the task owns local planning, implementation, debugging, tests, and corrective fixes, and returns only at a declared trigger.
- Ordinary local failure: task resolves it inside scope/burn without Daily Alignment or orchestrator ceremony.
- Unexpected expansion: pause only affected growth; state `Expected`, `Expanded into`, `Likely cause`, then route `CONTINUE`, `REBRIEF`, `LAB`, or `MAINTENANCE`.
- Waiting at human checkpoint: name the judgment that person owns and give an observable action, link, output location, safe continuation, and return sync; keep technical verification with agents.
- Discovery complete: incorporate the Decision Packet, update durable state, close or archive the context.
- Lab proof/cap reached: stop lab polish; route production transfer, tests, and real-flow smoke.
- Maintenance proof reached: verify the original representative flow is materially smaller/faster and recurrence is covered, then return to the original task; containment alone is not closure.
- Optional extension surfaced: keep the task inside its DOD, return an Idea Candidate, and continue unless the human explicitly changes scope.
- Boundary consultation (`CONSULT`): from `Boundary/Evidence/Proposed move/Safe continuation`, choose `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, `DISCOVERY`, or `NEEDS_DECISION`; Peer Compass Review may support that route. Pause only the affected boundary.
- Material external delta: intersect it with active, queued, and paused tasks. Do not wake unaffected work. Send an affected active task only `what changed / applies to / preserved / action`; compatible work continues, while invalidated work pauses only the affected boundary for patch/re-brief.
- Task claims completion without `$accept-work`: send it to `$accept-work` in the same context.
- Rejected Candidate, `NEEDS_FIXES`, or human «do it differently»: record the `APPROACH_PIVOT` and `Keep/Rebuild/Drop/Unknown`, merge any reusable Memory Delta into its decision family, then build the successor from the Accepted Baseline plus refreshed Memory Brief, not the failed state.
- `BLOCKED`: record the missing decision/input and tell the human precisely.
- Accepted but smoke/merge pending: return the human to the task context.
- Cross-person handoff: keep delivery open until the recipient confirms the exact shared artifact/revision and performs the agreed receipt check; runnable work includes a representative scenario in their environment.
- Accepted enabler: report what it unlocks, what product behavior is still missing, and its next product slice; keep the parent open.
- Accepted and merged: deduplicate reusable Memory Delta into the current decision family, atomically rebuild affected memory bodies, then update DOD burn, parent closure, participant impact, and next-best-action.
- Repeated no-progress: distinguish implementation defect, weak acceptance oracle, and missing solution work. Rebuild from the Accepted Baseline with learned evidence, re-brief/split, or launch bounded Discovery; do not restart alignment, repeat status rituals, or climb reasoning levels mechanically.
Do not implement, debug, smoke, or merge from the orchestrator. Task detects execution boundaries; orchestrator decides project response.

## 6. Monitor
Use one monitor for one named gate only when direct context return and durable tracker events are unavailable. It may inspect or resume the existing task within approved scope. While unchanged it creates no context message, no-op trace, or model wake-up. It avoids new scope/merge/spend, notifies only on decision/drift/checkpoint/terminal state, and deletes itself when finished.

## 7. Health And Rotation

Run Health Review after milestones, several slices, repeated same-class corrections, stalled DOD burn, unexpected expansion, recurring architecture/data/tooling tax, owner dropout, repeated context compaction, stale scope/dashboards, or chat archaeology.

During Health Review, compare Idea Memory and Intent Trail with compass, DOD, active tasks, accepted work, operational sources, and repository state. Atomically rebuild stale current bodies, merge decision families and duplicates, refresh touch/recall keys, retire absorbed or superseded entries without deleting evidence, and test one representative Memory Intersection.

If rotation is needed:

1. Freeze new dispatch, but keep the previous orchestrator active and intact. Before creating the candidate, tell the human why rotation is needed, what will move, what will not change, how memory will be verified, and what confirmation activates the replacement.
2. Publish one Rotation Memory Packet from the previous context: compass/DOD, current decision families and material task-local pivots, active/queued/promised/deferred work, remembered requests, safe operational source pointers, checkpoints, constraints, monitors/returns, participants/ownership, and ambiguous, stale, or chat-only items.
3. Rebuild stale Idea Memory and Intent Trail bodies from their evidence, grouping related decisions instead of copying chronology. For every item record evidence, classification (`ALREADY_DURABLE`, `MISSING_DURABLE`, `AMBIGUOUS`, or `STALE/SUPERSEDED`), relations, and correct durable destination.
4. Re-resolve the `ORCHESTRATOR` profile and create a read-only candidate from current repo/framework. Do not register it active yet.
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
