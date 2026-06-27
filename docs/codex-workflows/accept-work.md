# Accept Work Workflow

Use this workflow when a human wants to accept, close, verify, or judge readiness of a task, PR, milestone, or epic.

Goal: decide whether the work satisfies the original intent and all later alignment changes without breaking neighboring work.

## Inputs To Read

1. Original epic brief and task issue.
2. Current PR, branch, local diff, or delivered artifact.
3. Relevant Local Alignment Packets, Team Alignment Deltas, and Brief Patches.
4. Local verification output, CI, tests, smoke checks, and review comments.
5. Related docs, rules, contracts, and active epics.

## Steps

### 1. Reconstruct The Acceptance Baseline

Summarize:

- original goal;
- task type: `product capability`, `technical enabler`, `maintenance`, or `research/spike`;
- whether this acceptance is supposed to close the parent issue/milestone row or accept a sub-slice only;
- Product Capability Loop baseline:
  - for product capabilities: actor, entry point, setup/configuration, input/action, processing/enforcement, feedback, state, recovery/next action, audit/provenance, and verification;
  - for technical enablers: the linked product capability or later task that closes the loop;
  - for UI/product-surface work: backing backend/API/data/persistence/permission contracts, loading/empty/error states, recovery path, audit/provenance, and realistic scenarios;
- task scope and out of scope;
- DOD impact promised by the task or parent milestone;
- Parent Closure expectation: parent closure, sub-slice acceptance, or parent remains open;
- Burn / Limits, if material;
- acceptance criteria;
- expected verification;
- decisions from meetings;
- Brief Patches, Local Alignment Packets, and Team Alignment Deltas that changed the baseline.

If alignment packets are missing or a newer delta is pending, state that acceptance may be incomplete.

For implementation tasks, check whether the final handoff is enough for other participants to understand material changes to shared surfaces, contracts, data shape, user-facing behavior, or cross-epic assumptions. A separate alignment packet is needed only when the accepted result changes another participant's next action or safe-to-build-on assumptions.

### 2. Inspect Delivered Work

Review:

- changed files or artifact scope;
- behavior actually implemented;
- docs or issue updates;
- tests and smoke checks;
- handoff notes;
- unresolved comments or known limitations.

Ignore unrelated local changes unless they affect acceptance.

### 3. Run Current-Branch Smoke

For user-facing or integration-affecting work, run or organize a smoke pass from the exact branch/worktree being accepted.

Required checks:

- confirm branch name and `HEAD` commit;
- state whether accepted work includes uncommitted local changes;
- start or restart the required backend and frontend from this same worktree;
- ensure the browser target points at these fresh processes, not old servers from another branch;
- smoke the relevant product path;
- record command, URL, result, and any skipped step with reason.

If Codex cannot prove the smoke ran against the current branch/worktree, classify acceptance as `BLOCKED` or `NEEDS_FIXES`.

### 4. Compare Against Baseline

Check:

- goal satisfied;
- product capability loop satisfied when the task promised product functionality, or explicitly linked/deferred when this is a technical enabler;
- product capability has a visible UI/operator entry/action, or a human-approved linked exception; routes, backend/API tests, projections, readiness cards, or passive records are not enough by themselves;
- UI/product-surface work has real or explicitly linked backing data/backend/permissions/error-state implementation instead of only static or fixture presentation;
- scope respected;
- out-of-scope work avoided or justified;
- promised DOD impact actually moved or closed the named epic/milestone row;
- parent closure is accurate: an accepted sub-slice or merged PR does not close the parent unless the named DOD row and promised product loop are closed or the human explicitly moved the remainder out of scope;
- burn stayed within the task's cap/stop condition, or is explicitly `not material`;
- acceptance criteria met;
- required verification run;
- docs and project memory updated;
- neighboring epics not contradicted;
- daily and event-triggered alignment decisions preserved.

### 5. Classify Result

Use one status:

- `ACCEPT`: ready to close.
- `ACCEPT_WITH_FOLLOWUPS`: core work or sub-slice is accepted, named follow-ups remain. Use this without closing the parent unless the parent DOD/product loop is actually closed.
- `NEEDS_FIXES`: work is close but must change before acceptance. Use this when a task promised a product capability but delivered only backend state, APIs, readiness cards, or passive accounting without the closed user/operator loop.
- `BLOCKED`: missing decision, missing packet, unresolved conflict, unknown verification, or exceeded material burn limit prevents acceptance.

### 6. Prepare GitHub Updates

After human confirmation:

- update task or PR status;
- add acceptance summary;
- post or prepare an `accepted` Local Alignment Packet only when acceptance changes what other participants or Codex instances need to know;
- create follow-up issues when needed;
- update the Framework Orchestrator state and task sequence when acceptance was requested by an orchestrator thread;
- close completed alignment issues only when their final delta is reflected in durable docs, tasks, briefs, or PRs;
- update project memory with durable lessons.

Do not close an epic until all blocking tasks are accepted or explicitly moved out of scope.

## Task Thread Use

When `$accept-work` runs inside an implementation task thread, it is the task's final self-check before completion.

For user-facing or integration-affecting work, the task thread must organize the current-branch smoke from the exact worktree being accepted. If merge is needed, the human performs manual smoke and then manual merge in this task thread after confirmation. Do not move smoke, merge, or corrective fixes into the Framework Orchestrator thread.

The task thread must include the result in its final report so the Framework Orchestrator can read it later:

- status: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`;
- PR, commit, or delivered artifact;
- DOD impact result;
- parent closure status: closed, remains open, or out-of-scope by human decision;
- burn check when material;
- verification and current-branch smoke result when required;
- smoke / merge status;
- follow-ups or blockers;
- recommended orchestrator next action.

## Acceptance Report Template

```md
## Acceptance Report

Status: <ACCEPT | ACCEPT_WITH_FOLLOWUPS | NEEDS_FIXES | BLOCKED>
Scope reviewed: <task, PR, milestone, or epic>
Baseline: <brief, task issue, deltas, patches>
Task type: <product capability | technical enabler | maintenance | research/spike>
Product loop: <closed | linked to issue/task | missing and needs decision>
DOD impact: <named row and result>
Parent closure: <closed | accepted sub-slice, parent remains open | out of scope by human decision>
Visible loop: <visible entry/action | linked exception | missing>
Burn check: <not material | within cap | exceeded and needs decision>
Smoke / merge: <not needed | smoke passed, merge pending | smoke passed, merged | blocked>

### What Matches

- <accepted behavior or artifact>

### Gaps Or Risks

- <gap, risk, or none>

### Verification

- <test, current-branch smoke, CI, review, or not run>

### Follow-Ups

- <issue, task, or none>

### Decision Needed

- <human decision or none>
```
