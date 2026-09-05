# Task Context Contract

The orchestrator resolves project-wide meaning before dispatch. Give the task only what it needs to execute and prove one accepted increment. Do not copy Project State, meeting transcripts, the full Project Memory Graph, task map, or orchestration deliberation into the task.

## Startup

```md
# Task Context Startup

Role: EXECUTION
Agent profile: EXECUTION / <resolved efficient mapping and fallback if any>
Title: <work-id> [<track>] [<mode>] — <short outcome; owning Issue/stable task key, never PR; omit mode for normal execution>
Task / outcome owner / backup / recipient:
Return to: <orchestrator context or stable shared-tracker event>
Execution Lease: <PREPARED id / project / repo / worktree / branch / baseline / review-by / durable outbox + wakeup>

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

Authority / safety envelope: <allowed actions and named approval boundaries>
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

- Start implementation immediately; approved planning is not repeated in the task context.
- On launch and every material resume, make the first safe observable action in the same turn. Commentary, future-tense intention, or a plan without action is `PLAN_ONLY`, not `STARTED`. Name a real blocker or request re-brief when no safe action exists.
- Own local planning, implementation, debugging, corrective fixes, tests, exact-current-code smoke, and technical evidence.
- Resolve ordinary implementation failures autonomously inside the contract and burn limit. Do not send routine progress or a Return Sync for a locally resolved failure, and do not change reasoning profile mechanically.
- Do not run `$project-launch`, `$start-work`, `$daily-alignment`, or `$framework-orchestrator` here. Use implementation/domain skills as needed and run `$accept-work` before completion.
- Detect an undeclared boundary, stale upstream state, unresolved solution choice, or evidence that the acceptance contract is insufficient, but do not redesign project scope, sequence, ownership, shared contracts, or model routing. Send one compact `CONSULT`: `Boundary / Evidence / Proposed move / Safe continuation`, then pause only that boundary.
- If a human says an instruction was already decided or the supplied brief contradicts known direction, follow the clear current instruction inside scope and send compact miss evidence through `CONSULT`; do not search the full graph or run project-wide reflection here.
- When an Executable Memory Brief is present, preserve its bytes and order, apply every required id, and validate the bound application receipt before claiming use. Missing or invalid ids block only the affected obligation; advisory prose cannot substitute for them.
- When the pinned task requires `retained-progress-v1`, use the [Context Route reference caller](context-route.md#bounded-reference-caller): `resume` gates the explicit local command; `accept` executes the retained-plus-new verification plan. Legacy compile/receipt or orchestrator version cannot substitute. A local overlay applies only to its reviewed task and worker; return it for shared integration before dependent tasks.
- Apply a targeted orchestrator instruction at the next safe operation boundary. Continue unaffected work unless the instruction or safety envelope says otherwise.
- Keep corrective fixes, human smoke, and manual merge in this context because it owns the implementation evidence. A side answer or service exchange does not complete this contract: continue within scope or return the actual checkpoint/blocker through Return Sync.
- Before compaction, context handoff, risky external action, or after a human-accepted checkpoint, preserve the current Accepted Baseline/Candidate and next experiment as a commit or durable artifact. Accepted work may not exist only in chat or untracked files.
- Empty output, timeout, transport failure, or lost context after a possible paid, external, or shared-state action is `OUTCOME_UNKNOWN`. Freeze replay and ask the owning task to reconcile durable/provider/runtime receipts; never infer that no action occurred.

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

A launch or resume is incomplete when the task only writes a plan. It must perform an observable action, name a real blocker, or request re-brief. At every declared checkpoint, readiness, blocker, or terminal return trigger, first write the complete marked Return Sync above to the durable task/tracker outbox, then attempt the native wakeup with the same id. An Action Receipt never substitutes for this Return Sync. Native delivery, final text, and task/thread reads are not authority and may be empty; their loss must not lose the result. The orchestrator reconciles unconsumed outbox events at every cold path and Governor Check, writes the matching marked Return Route receipt after consumption, and Project Guard compares the two exact formats independently. A routed checkpoint retains its next action or concrete wait; it does not close the parent or an unfinished lead assignment. Do not wait for human polling. A cross-person handoff remains incomplete until recipient proof is returned.
