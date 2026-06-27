# Task Thread Startup Template

Use this template when a Framework Orchestrator launches or prepares a separate task thread.

```md
# Task Thread Startup

Thread title:
Task issue:
Owner:
Orchestrator thread:
Alignment issue:
Latest Team Alignment Delta:
Codex Task Contract: use the contract in the task issue as the completion source of truth.
DOD impact:
Task type:
Product Capability Loop:
Burn / Limits:

## Read First

- `AGENTS.md`
- `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
- task issue or approved task brief
- latest relevant Team Alignment Delta
- related brief, design doc, contract, or API doc

## Goal

<one primary outcome>

## Scope

- <included work>

## Out Of Scope

- <excluded work>

## Contracts And Alignment

- <shared contracts or affected surfaces>
- <assumptions this task must preserve>
- <closed product loop if this is a product capability, or linked product-loop task if this is a technical enabler>
- <backing backend/API/data/persistence/permission contracts and realistic states if this is UI/product-surface work>
- <when to stop and return to orchestrator>

## Verification

- <tests or checks>
- current-branch smoke is required when this is user-facing or integration-affecting
- burn check is required when `Burn / Limits` is not `not material`

## Completion Gate

- before final completion, run `$accept-work` in this task thread;
- `$accept-work` must inspect this task issue, PR or diff, latest relevant alignment, DOD impact, task type, Product Capability Loop, verification, burn check when material, and current-branch smoke when required;
- finish only with one acceptance status: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`;
- do not say the task is done before the `$accept-work` result is included.

## Handoff Back To Orchestrator

Branch / worktree:
PR / commit:
Accept Work status:
DOD impact result:
Task type / product loop result:
Burn check:
Changed surfaces:
Verification:
Not verified:
Risks:
Follow-ups:
Event-triggered alignment packet needed:
Recommended orchestrator next action:
```
