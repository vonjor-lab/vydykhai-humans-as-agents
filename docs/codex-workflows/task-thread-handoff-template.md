# Task Thread Startup Template

Use this template when a Framework Orchestrator launches or prepares a separate task thread.

For a research thread, keep the same header fields but set scope to investigation only. The thread must not change product code unless the orchestrator and human explicitly promote it to implementation.

```md
# Task Thread Startup

Thread title:
Task issue:
Owner:
Backup owner / failover:
Orchestrator thread:
Alignment issue:
Task thread launch state:
Latest Team Alignment Delta:
Model / Reasoning:
Compass Calibration:
Codex Task Contract: use the contract in the task issue as the completion source of truth.
DOD impact:
Accepted as sub-slice:
Parent closure status:
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
- <visible UI/operator entry/action, or human-approved linked exception if the loop is intentionally deferred>
- <when to stop and return to orchestrator>

## Verification

- <tests or checks>
- current-branch smoke is required when this is user-facing or integration-affecting
- burn check is required when `Burn / Limits` is not `not material`

## Completion Gate

- before final completion, run `$accept-work` in this task thread;
- `$accept-work` must inspect this task issue, PR or diff, latest relevant alignment, DOD impact, parent closure status, task type, Product Capability Loop, verification, burn check when material, and current-branch smoke when required;
- accepted sub-slice or merged PR does not close the parent issue unless the named DOD row and promised product loop are closed or the human explicitly moved the remainder out of scope;
- for user-facing or integration-affecting work, organize fresh current-branch smoke from this exact worktree before claiming acceptance;
- if merge is needed, perform manual merge from this task thread after manual smoke and human confirmation;
- finish only with one acceptance status: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`;
- do not say the task is done before the `$accept-work` result is included.

## Handoff Back To Orchestrator

Branch / worktree:
PR / commit:
Accept Work status:
Smoke / merge status:
DOD impact result:
Accepted as sub-slice:
Parent closure status:
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
