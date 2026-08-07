# Task Context Contract

The orchestrator resolves project-wide meaning before dispatch. Give the task only what it needs to execute and prove one accepted increment. Do not copy Project State, meeting transcripts, Idea Memory, Intent Trail, the full task map, or orchestration deliberation into the task.

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
Applicable Memory Brief: <1-3 distilled decisions/invariants, rejected-path lessons, or safe operational references; conflicts/gaps or none>
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
- Apply a targeted orchestrator instruction at the next safe operation boundary. Continue unaffected work unless the instruction or safety envelope says otherwise.
- Keep corrective fixes, human smoke, and manual merge in this context because it owns the implementation evidence.

## Return Sync

```md
Status: <BLOCKED_BEFORE_START | NEEDS_REBRIEF | ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED>
Task / context / PR / commit / artifact:
Agent profile used / fallback:
Accepted Baseline -> Candidate result:
DOD impact / enabler continuation:
Verification / exact-current-code smoke / merge:
Human checkpoint result:
Burn result:
Boundary consultation: <none | Boundary / Evidence / Proposed move / Safe continuation>
Learning Delta: <none | Keep / Rebuild / Drop / Unknown>
Intent / Approach Delta: <none | Before / Now / Why / Keep / Drop / applies to / source>
Memory Delta: <none | task-local only | reusable candidate with touch keys and safe source>
Recipient proof: <not applicable | exact artifact/revision, environment, schema/migration revision, access, agreed check, and reproducible safe data when required>
Risks / required follow-ups / optional Idea Candidates:
Recommended orchestrator next action:
```

A launch is incomplete when the task only writes a plan. It must start execution, name a real blocker, or request re-brief. Publish Return Sync automatically only at a declared trigger through native context messaging or the durable tracker; do not wait for human polling. A cross-person handoff remains incomplete until recipient proof is returned.
