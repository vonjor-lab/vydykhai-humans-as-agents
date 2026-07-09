# Task Thread Handoff

Use the minimum contract. Add optional fields only when they alter execution safety.

```md
# Task Thread Startup

Title:
Task / owner / backup:
Orchestrator / Project State:
Latest relevant delta:
Model profile / fallback: <project policy or not material>

## Goal And DOD

<one outcome and named DOD impact>

## Scope Boundary

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

## Verification And Completion

- <tests/checks>
- exact-current-code runtime smoke when user-facing or integration-affecting
- run `$accept-work` in this task thread before completion
- keep corrective fixes, human smoke, and manual merge in this task thread

## Optional Safety Modes

Research / Lab / Peer Compass Review: <only when relevant>

## Handoff Back

Status: <EXECUTION_STARTED | BLOCKED_BEFORE_START | NEEDS_REBRIEF | ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED>
PR / commit / artifact:
DOD and parent result:
Human checkpoint result:
Burn result:
Exact-current-code smoke / merge:
Participant impact / alignment needed:
Risks / follow-ups:
Recommended orchestrator next action:
```

A launch is incomplete when the child only writes a plan. It must start execution, name a blocker, or request re-brief.
