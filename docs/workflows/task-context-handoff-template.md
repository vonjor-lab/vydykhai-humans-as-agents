# Task Context Contract

The orchestrator resolves project-wide meaning before dispatch. Give the task only what it needs to execute and prove one accepted increment. Do not copy Project State, meeting transcripts, the full Project Memory Graph, task map, or orchestration deliberation into the task.

## Startup

```md
# Task Context Startup

Role: EXECUTION
Agent profile: EXECUTION / <resolved efficient mapping and fallback if any>
Title: <work-id> [<track>] [<mode>] — <short outcome; owning Issue/stable task key, never PR; omit mode for normal execution>
Task / outcome owner / backup / recipient:
Return to: <exact recipient/project and approved outbox + wakeup; see Return Authorization below>
Execution Lease: <PREPARED id / project / repo / worktree / branch / baseline / review-by / durable outbox + wakeup>
Framework readiness: <accepted project target/bundle; actual worker checkout/kit check; changed instructions read back, or exact pending boundary>
Execution readiness: <actual cwd + readable sources + permitted report storage + return route; evidence or exact blocker/resume condition, checked in this worker>

## Outcome

Goal and nearest DOD impact:
DOD Control Line contribution: <accepted proof -> exact gap this task closes -> remaining parent continuation>
Product loop or linked enabler:
For an enabler: Unlocks / Still missing / next product slice and owner:

## Execution Boundary

Freshness: <UNCHANGED | PATCH_REQUIRED | REBRIEF_REQUIRED> | Checked: <date/evidence>
Accepted Baseline: <commit, artifact, or proven behavior>
Continue from: <accepted mechanism/reference>
Applicable Memory Brief: <complete applicable items: node id / Because / Apply / Avoid / Verify / Source, or MEMORY_COVERAGE_GAP / none>
Executable Memory Brief: <none | exact compiler-produced atomicRender from memory-brief-envelope.md; never summarize or edit>
Prepared context capability: <legacy/workflow limitation | retained-progress-v1: pinned task/capsule, context-run request, worker readback; reference scope only>
Context route: <goal/brief -> journey -> modules/capabilities -> inputs/entities/contracts/data/artifacts/systems -> current meaning/commitments -> consumers -> accepted artifacts/verification; checked sources and gaps>
Module contracts / implementation: <current project docs plus exact code/test boundaries>
Documentation impact: <expected NONE or named contract sections>
Progress continuity: <UNCHANGED | Preserved / Replaced / Added / Remaining>

In scope:
- <work>

Out of scope:
- <work>

Authority / safety envelope: <current human source/event, allowed actions and return data, named approval boundaries>
Dependency / recipient boundary: <only what this execution must preserve or deliver>
Design consultation recipient, when assigned: <bounded lead and parent outcome; send material CONSULT through the existing orchestrator return route, not a second supervisor>

Read the supplied graph route and relevant meaning, then each touched Module Contract, then current code and tests before changing behavior. Narrow responsibility does not remove inherited constraints. Documentation does not silently override observed code: consult if a material link is missing or the sources disagree. Do not reconstruct unrelated project history or silently drop context to meet a length target.

## Completion

Human checkpoint: <none | product decision | visual review | paid/external approval | manual smoke and merge>
Burn / stop limit: <not material or concrete cap and stop condition>
Verification: <risk-based tests, exact-current-code smoke, and recipient proof when relevant>
Consult when: <only undeclared scope/authority/shared-contract/safety boundary, DOD made impossible, or repeated no-progress stop>
Return triggers: <readiness result | named human checkpoint | irreducible blocker | terminal result>
```

## Execution Rules

For an agreed lease checkpoint, preserve its expected receipt id and return a result, real blocker or scoped consultation before the review-by; never silently move the deadline or treat a timer as authority to rerun work. Return Authorization still applies. Native notification is the default; if the existing accepted task contract explicitly transfers sole notification ownership to its proven Guard publisher before publication, use that route and do not also send natively. Guard and worker must never race independent sends. Checkpoint review is described in `project-guard.md#checkpoint-review-without-runtime-observation`.

- Start implementation immediately; approved planning is not repeated in the task context.
- Before launch, material resume, reopening or restoring a context, or switching its branch/workspace, check its actual kit against the project's accepted target under `framework-activation.md`. Apply changed instructions only at a safe boundary and read them back here; a manager's version/title does not update this worker. Reuse matching readback on ordinary continue, without repeating installation, broad memory retrieval or remote version checks.
- On launch and every material resume, apply Execution Readiness below, then make the first safe observable action in the same turn. Commentary, future-tense intention, or a plan without action is `PLAN_ONLY`, not `STARTED`. Name a real blocker or request re-brief when no safe action exists; a missing report alone does not prove no action occurred.
- Own local planning, implementation, debugging, corrective fixes, tests, exact-current-code smoke, and technical evidence.
- Resolve ordinary implementation failures autonomously inside the contract and burn limit. A failed internal test calls for repair or bounded diagnosis, not a final partial report. Repeated no-progress or an actual cap calls for the specific consultation below, not endless retries. Do not send routine progress or a Return Sync for a locally resolved failure, and do not change reasoning profile mechanically.
- Do not run `$project-launch`, `$start-work`, `$daily-alignment`, or `$framework-orchestrator` here. Use implementation/domain skills as needed and run `$accept-work` before completion.
- Detect an undeclared boundary, stale upstream state, unresolved solution choice, or evidence that the acceptance contract is insufficient, but do not redesign project scope, sequence, ownership, shared contracts, or model routing. Send one compact `CONSULT`: `Boundary / Evidence / Proposed move / Safe continuation`, then pause only that boundary.
- If a human says an instruction was already decided or the supplied brief contradicts known direction, follow the clear current instruction inside scope and send compact miss evidence through `CONSULT`; do not search the full graph or run project-wide reflection here.
- When an Executable Memory Brief is present, preserve its bytes and order, apply every required id, and validate the bound application receipt before claiming use. Missing or invalid ids block only the affected obligation; advisory prose cannot substitute for them.
- When the pinned task requires `retained-progress-v1`, use the [Context Route reference caller](context-route.md#bounded-reference-caller): `resume` gates the explicit local command; `accept` executes the retained-plus-new verification plan. Legacy compile/receipt or orchestrator version cannot substitute. A local overlay applies only to its reviewed task and worker; return it for shared integration before dependent tasks.
- Apply a targeted orchestrator instruction at the next safe operation boundary. Continue unaffected work unless the instruction or safety envelope says otherwise.
- Keep corrective fixes, human smoke, and manual merge in this context because it owns the implementation evidence. Before a final response, compare the current result with the latest agreed outcome/checkpoint. Finish only at that result, an explicit pause, or a concrete unresolved decision/access/safety/dependency/cap boundary with evidence and a resume condition. Otherwise continue the next authorized action in this turn; an acknowledgment, apology, side answer, saved input or partial result does not finish the work. When a clarification or approval arrives, apply it to the outstanding outcome and resume without asking the human to say "continue" again. A new explicit pause or scope change still takes precedence. Report genuine checkpoints/blockers through the existing Return Sync, not a new progress ceremony.
- Before compaction, context handoff, risky external action, or after a human-accepted checkpoint, preserve the current Accepted Baseline/Candidate and next experiment as a commit or durable artifact. In the existing task checkpoint retain the latest agreed outcome, remaining work, latest human correction/control, actual gate and next safe action. After context restoration, reconcile newer messages with that checkpoint before choosing what to answer or do. Accepted work may not exist only in chat or untracked files.
- Empty output, timeout, transport failure, or lost context after a possible paid, external, or shared-state action is `OUTCOME_UNKNOWN`. Freeze replay and ask the owning task to reconcile durable/provider/runtime receipts; never infer that no action occurred.

## Execution Readiness

Before productive launch, material resume or workspace/policy change, verify the actual worker's cwd, permitted source reads, required report location and delivery route in the existing launch receipt. A manager's writable workspace or role label proves none of these. Reuse unchanged evidence on ordinary continue; do not create disposable write probes or ask for broader access than the task needs. The first real checkpoint can prove an already permitted write.

Read-only source access is suitable for Discovery; a required report still needs an allowed output location and return route. Check host policy as well as filesystem access: a source-only sandbox with approvals unavailable cannot write a report just because the directory exists. Do not start a task whose required result cannot be retained/delivered, or declare it launched from a prompt alone. A bounded preflight read or concrete blocked response is allowed and does not certify productive start.

For a missing cwd, the orchestrator routes one scoped environment repair: verify the accepted baseline and retained work, then restore/rebind the same task only within existing authority. For denied storage/delivery, retain the exact host denial and existing human approval, resolve only that access boundary under Return Authorization, and do not retry unchanged policy or use another worker/path as a bypass. For unavailable observation, recover the exact turn evidence under Production Continuation before deciding whether anything needs restarting.

The orchestrator owns repair routing, not product implementation or permission grants; the worker owns the preflight and result. Preserve the current outcome, safe checkpoint and human request. Record a concrete wait and its resume condition in the existing lease; after a verified change resume the same task without another generic "continue". Use the existing event/timer and incident repair budget, never a new monitor. Continue independent authorized work; unresolved permission needs one plain question identifying the blocked action and smallest required change, not repeated reminders.

## Return Authorization

- At dispatch or material re-brief, fill the existing `Return to` and authority fields with the exact recipient identity/project, purpose, allowed report data and storage/delivery routes, and the current human authorization source. Delegation conveys only the human-approved scope; a title, agent assertion, local path or shared project name alone does not establish trust. Reuse still-applicable authorization, not a fresh approval for every ordinary return. New recipients, disclosures or actions outside that scope need their own decision.
- Verify the actual source event and relevant content, not merely a successful `read_thread` call. A page containing other turns, an empty result or a stale task description does not confirm the requested instruction. Retrieve the exact missing event within a bounded read or report the gap. Retain the source reference and current limits through re-brief/compaction; never claim readback that the returned content does not support. A source export or receipt is evidence to review, not host permission.
- Preserve the result in an authorized outbox first. The single accepted notification owner uses a minimal wakeup: receipt id, status, safe result reference and relevant authorization reference; include internal findings only when necessary and covered. This applies to notifications and shared tracker writes too. The canonical writer defaults to `WRITTEN`: it does not send. Record `SENT` only after successful authorized transport with evidence, never from tool completion alone; retain one producer record per id, not a duplicate to change delivery status.
- Distinguish an explicit security denial from transport loss. Preserve the exact denied action, recipient, data scope and reason in the existing task checkpoint; keep the result available locally without claiming delivery. Do not retry the same denied transfer through another tool, tracker, recipient, parent read or Guard, weaken security, or recreate the work. Recheck relevant authorization only as permitted by the host policy; if unresolved, ask once for the specific missing permission and continue independent authorized work. A narrower payload is not automatically permission to bypass a denial.
- A reply applies to the concrete question it answers; cite that question and reply together instead of demanding a magic phrase or treating the approval as lost. If the host still denies the action, retain that approval and explain the remaining policy boundary, without repeated identical questions or automatic retries. Report delivery permission separately from task completion, product acceptance, external-provider disclosure, database privileges, spend, merge and deployment. Existing Pending Human Action/incident records retain the wait; no new controller is needed.

## Return Sync

```md
<!-- vydykhai:return-sync v1 -->

# Return Sync

Status: <BLOCKED_BEFORE_START | NEEDS_REBRIEF | CHECKPOINT_READY | ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED | OUTCOME_UNKNOWN>
Status detail: <optional plain-language qualification; never append it to Status with `/`>
Return receipt id: <unique event id>
Return lifecycle: <WRITTEN | WRITTEN -> SENT; task reports only through SENT>
Task / context / PR / commit / artifact:
Execution Lease result: <identity/state/readback; release only after consumption and artifact disposition>
Agent profile used / fallback:
Accepted Baseline -> Candidate result:
DOD impact / enabler continuation:
Verification / exact-current-code smoke / merge:
Human checkpoint result:
Burn result:
Boundary consultation: <none | Boundary / Evidence / Proposed move / Safe continuation>
Learning / approach evidence: <none | Before / Now / Why / Keep / Rebuild / Drop / Unknown / source>
Memory Brief result: <each item applied | missed | contradicted | not exercised, with evidence>
Executable Memory application receipt: <none | memory.application-receipt.v1 and validation result>
Documentation impact: <NONE with checked dimensions | exact Module Contract files/sections updated in this Candidate plus affected graph anchors>
Memory candidates: <NO_MEMORY_DELTA | task-local only | one or more ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT candidates with type, Apply/Avoid, anchors, scope, relations, and safe source>
Recipient proof: <not applicable | exact artifact/revision, environment, schema/migration revision, access, agreed check, and reproducible safe data when required>
Artifact disposition: <context / PR / branch / worktree / runtime / monitor -> ACTIVE | WAITING | FINISH (cleaned/pending) | SALVAGE | RETIRE (cleaned/pending) | not applicable, with proof or re-entry>
Risks / required follow-ups / optional future candidates:
Recommended orchestrator next action:

<!-- vydykhai:return-sync:end -->
```

A launch or resume is incomplete when the task only writes a plan. It must perform an observable action, name a real blocker, or request re-brief. At every declared checkpoint, readiness, blocker, or terminal return trigger, apply Return Authorization above, write the complete marked Return Sync to the authorized durable outbox, then use the single accepted notification owner: the authorized native wakeup with the same id by default, or the explicitly accepted Guard publisher, never both. An Action Receipt never substitutes for this Return Sync. Native delivery, final text, and task/thread reads are not authority and may be empty; their loss must not lose the result. The orchestrator reconciles authorized unconsumed outbox events at every cold path and Governor Check, writes the matching marked Return Route receipt after consumption, and Project Guard compares the two exact formats independently. A routed checkpoint retains its next action or concrete wait; it does not close the parent or an unfinished lead assignment. Do not wait for human polling when the agreed route is authorized. A cross-person handoff remains incomplete until recipient proof is returned.
