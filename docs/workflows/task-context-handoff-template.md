# Task Context Contract

The orchestrator resolves project-wide meaning before dispatch. Give the task only what it needs to execute and prove one accepted increment. Do not copy Project State, meeting transcripts, the full Project Memory Graph, task map, or orchestration deliberation into the task.

## Startup

```md
# Task Context Startup

Role: EXECUTION
Agent profile: EXECUTION / <resolved efficient mapping and fallback if any>
Title:
Task / outcome owner / backup / recipient:
Return to: <orchestrator context or stable shared-tracker event>

## Outcome

Goal and nearest DOD impact:
Product loop or linked enabler:
For an enabler: Unlocks / Still missing / next product slice and owner:

## Execution Boundary

Freshness: <UNCHANGED | PATCH_REQUIRED | REBRIEF_REQUIRED> | Checked: <date/evidence>
Accepted Baseline: <commit, artifact, or proven behavior>
Continue from: <accepted mechanism/reference>
Applicable Memory Brief: <up to 7 executable items: node id / Because / Apply / Avoid / Verify / Source, or MEMORY_COVERAGE_GAP / none>
Progress continuity: <UNCHANGED | Preserved / Replaced / Added / Remaining>

In scope:
- <work>

Out of scope:
- <work>

Authority / safety envelope: <allowed actions and named approval boundaries>
Dependency / recipient boundary: <only what this execution must preserve or deliver>

## Completion

Human checkpoint: <none | product decision | visual review | paid/external approval | manual smoke and merge>
Burn / stop limit: <not material or concrete cap and stop condition>
Verification: <risk-based tests, exact-current-code smoke, and recipient proof when relevant>
Consult when: <only undeclared scope/authority/shared-contract/safety boundary, DOD made impossible, or repeated no-progress stop>
Return triggers: <named human checkpoint | irreducible blocker | terminal result>
```

## Execution Rules

- Start implementation immediately; approved planning is not repeated in the task context.
- Own local planning, implementation, debugging, corrective fixes, tests, exact-current-code smoke, and technical evidence.
- Resolve ordinary implementation failures autonomously inside the contract and burn limit. Do not send routine progress or a Return Sync for a locally resolved failure, and do not change reasoning profile mechanically.
- Do not run `$project-launch`, `$start-work`, `$daily-alignment`, or `$framework-orchestrator` here. Use implementation/domain skills as needed and run `$accept-work` before completion.
- Detect an undeclared boundary, stale upstream state, unresolved solution choice, or evidence that the acceptance contract is insufficient, but do not redesign project scope, sequence, ownership, shared contracts, or model routing. Send one compact `CONSULT`: `Boundary / Evidence / Proposed move / Safe continuation`, then pause only that boundary.
- If a human says an instruction was already decided or the supplied brief contradicts known direction, follow the clear current instruction inside scope and send compact miss evidence through `CONSULT`; do not search the full graph or run project-wide reflection here.
- Apply a targeted orchestrator instruction at the next safe operation boundary. Continue unaffected work unless the instruction or safety envelope says otherwise.
- Keep corrective fixes, human smoke, and manual merge in this context because it owns the implementation evidence.

## Return Sync

```md
Status: <BLOCKED_BEFORE_START | NEEDS_REBRIEF | ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED>
Return receipt id: <unique event id>
Task / context / PR / commit / artifact:
Agent profile used / fallback:
Accepted Baseline -> Candidate result:
DOD impact / enabler continuation:
Verification / exact-current-code smoke / merge:
Human checkpoint result:
Burn result:
Boundary consultation: <none | Boundary / Evidence / Proposed move / Safe continuation>
Learning / approach evidence: <none | Before / Now / Why / Keep / Rebuild / Drop / Unknown / source>
Memory Brief result: <each item applied | missed | contradicted | not exercised, with evidence>
Memory candidates: <NO_MEMORY_DELTA | task-local only | one or more ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT candidates with type, Apply/Avoid, anchors, scope, relations, and safe source>
Recipient proof: <not applicable | exact artifact/revision, environment, schema/migration revision, access, agreed check, and reproducible safe data when required>
Artifact disposition: <context / PR / branch / worktree / runtime / monitor -> ACTIVE | WAITING | FINISH (cleaned/pending) | SALVAGE | RETIRE (cleaned/pending) | not applicable, with proof or re-entry>
Risks / required follow-ups / optional future candidates:
Recommended orchestrator next action:
```

A launch is incomplete when the task only writes a plan. It must start execution, name a real blocker, or request re-brief. Publish Return Sync automatically only at a declared trigger through native context messaging or the durable tracker; the orchestrator must read back the same receipt id, sender, recipient, evidence, consumption, and routed next action. Do not wait for human polling. A cross-person handoff remains incomplete until recipient proof is returned.
