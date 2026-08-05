# Task Context Handoff

Use the minimum contract. Add optional fields only when they alter execution safety.

```md
# Task Context Startup

Title:
Task / outcome owner / backup / recipient:
Orchestrator / Project State:
Latest relevant delta:
Touch Set: <outcomes | entities | actors/surfaces | contracts/authorities | data/operational realms>
Memory Brief: <1-3 current decisions/invariants | rejected-path lessons | relevant ideas without scope growth | safe operational sources | conflicts/gaps or none>
Continue from / applicable invariants: <accepted mechanism/reference plus Memory Brief>
Agent profile: <resolved model / reasoning mapping / checked date / fallback>
Consult when / Return to: <semantic boundary signals / orchestrator context or stable shared-tracker event>
Return triggers: <human checkpoint | real blocker | terminal result>

## Goal And DOD

<one outcome and named DOD impact>

## Scope Boundary

Freshness: <UNCHANGED | PATCH_REQUIRED | REBRIEF_REQUIRED> | Checked: <date/evidence>
Accepted Baseline: <commit, artifact, or proven behavior>
Candidate: <one active candidate reference>
Progress continuity: <UNCHANGED | Preserved / Replaced / Added / Remaining>

In scope:
- <work>

Out of scope:
- <work>

## Product Loop Or Enabler

<actor, entry/action, result/recovery, or linked capability/contract>
For an enabler: Unlocks / Still missing / next product slice and owner:

## Human Checkpoint

<none | product decision | visual review | paid/external approval | manual smoke and merge>
Judgment owner / why this person:

Trigger and exact requested evidence:
Safe continuation before checkpoint:

## Burn / Stop Limit

<not material or concrete cap and stop condition>

Expected touched surface / first human-verifiable evidence: <only when expansion risk is material>

## Verification And Completion

- <tests/checks>
- for auth/data/storage/migration/deploy work: verify exact environment, least-privilege access, safe runbook, backup/recovery route, and a non-destructive preflight; never copy secret values into evidence
- exact-current-code runtime smoke when user-facing or integration-affecting
- for zero-spend/no-mutation work: capability guard plus before/after counters
- run `$accept-work` in this task context before completion
- keep corrective fixes, human smoke, and manual merge in this task context

## Optional Safety Modes

Research / Lab / Peer Compass Review: <only when relevant>
Experiment decision / one variable / proof / exit: <only for Lab Mode>

## Handoff Back

Status: <EXECUTION_STARTED | BLOCKED_BEFORE_START | NEEDS_REBRIEF | ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED>
PR / commit / artifact:
Accepted Baseline / Candidate result:
Learning Delta: <Keep | Rebuild | Drop | Unknown, when a candidate is rejected>
Intent / Approach Delta: <none | INTENT / WORKING_RULE / APPROACH_PIVOT; Before / Now / Why / Keep / Drop / applies to / source>
Memory Delta: <none | task-local only | reusable: confirmed / refined / superseded / new decision family; referenced Learning / Intent / Operational evidence; touch keys; safe source link>
Boundary consultation result: <none | resolved existing route; evidence/link>
DOD and parent result:
Human checkpoint result:
Burn result:
Expansion result / route: <when triggered>
Exact-current-code smoke / merge:
Participant impact / alignment needed:
Recipient proof: <not applicable | exact shared artifact or revision / agreed check / recipient environment and representative scenario when runnable>
Risks / follow-ups:
Recommended orchestrator next action:
```

A launch is incomplete when the child only writes a plan. It must start execution, name a blocker, or request re-brief. At every return trigger, publish this handoff automatically through native context messaging or the durable tracker; do not wait for a human to poll the task. A cross-person handoff remains incomplete until recipient proof is returned.
