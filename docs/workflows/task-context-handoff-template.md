# Task Context Handoff

Use the minimum contract. Add optional fields only when they alter execution safety.

```md
# Task Context Startup

Title:
Task / owner / backup:
Orchestrator / Project State:
Latest relevant delta:
Agent profile: <resolved model / reasoning mapping / checked date / fallback>
Return destination: <orchestrator context or stable shared-tracker event>
Return triggers: <human checkpoint | real blocker | terminal result>

## Goal And DOD

<one outcome and named DOD impact>

## Scope Boundary

Freshness: <UNCHANGED | PATCH_REQUIRED | REBRIEF_REQUIRED> | Checked: <date/evidence>
Accepted Baseline: <commit, artifact, or proven behavior>
Candidate: <one active candidate reference>

In scope:
- <work>

Out of scope:
- <work>

## Product Loop Or Enabler

<actor, entry/action, result/recovery, or linked capability/contract>

## Human Checkpoint

<none | product decision | visual review | paid/external approval | manual smoke and merge>

Trigger and exact requested evidence:
Safe continuation before checkpoint:

## Burn / Stop Limit

<not material or concrete cap and stop condition>

Expected touched surface / first human-verifiable evidence: <only when expansion risk is material>

## Verification And Completion

- <tests/checks>
- exact-current-code runtime smoke when user-facing or integration-affecting
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
DOD and parent result:
Human checkpoint result:
Burn result:
Expansion result / route: <when triggered>
Exact-current-code smoke / merge:
Participant impact / alignment needed:
Risks / follow-ups:
Recommended orchestrator next action:
```

A launch is incomplete when the child only writes a plan. It must start execution, name a blocker, or request re-brief. At every return trigger, publish this handoff automatically through native context messaging or the durable tracker; do not wait for a human to poll the task.
