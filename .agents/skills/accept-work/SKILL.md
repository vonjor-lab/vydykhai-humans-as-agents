---
name: accept-work
description: Use when the user wants to accept, close, verify, review completion, or decide readiness of a task, PR, milestone, or epic against the original brief and alignment history.
---

# Accept Work

Check whether completed work can be accepted without losing original intent, daily alignment decisions, or cross-epic consistency.

## Required References

Read these files before acting:

1. `AGENTS.md`
2. `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
3. `docs/codex-workflows/accept-work.md`

Load related epic briefs, task issues, PRs, Team Alignment Deltas, Brief Patches, and local diff before judging readiness.

## Operating Contract

- Compare result against the original brief, task scope, acceptance criteria, and alignment history.
- Include relevant Brief Patches and Team Alignment Deltas.
- Distinguish accepted work from follow-up work.
- Check that the promised `DOD Impact` actually moved or closed the named epic/milestone row.
- Check parent closure status. An accepted sub-slice or merged PR does not close the parent issue unless the named DOD row and promised product loop are closed or the human explicitly moved the remainder out of scope.
- Check task type and Product Capability Loop. Product capabilities are not accepted as complete when they only deliver backend state, APIs, projections, readiness cards, or accounting without the closed user/operator loop; technical enablers must remain linked to the task that closes the loop; UI/product-surface work must have real or explicitly linked backing backend/API/data/permissions/error-state implementation.
- Require a visible UI/operator entry/action for product capability closure, or a human-approved linked exception. Route existence and backend/API tests are not enough by themselves.
- Check `Burn / Limits` when material; classify exceeded or unmeasured material burn as a decision/blocker instead of silently accepting.
- Check affected entities, neighboring epics, docs, tests, and handoff.
- For user-facing or integration-affecting work, require a fresh smoke pass from the exact current branch/worktree. Do not rely on old servers, old browser tabs, or processes from another branch.
- When running in a task thread, keep smoke, corrective fixes, and manual merge in that task thread after human confirmation; do not route merge work into the Framework Orchestrator.
- Do not close the loop if unprocessed alignment packets or unresolved conflicts can change the acceptance decision.
- When running inside an implementation task thread, act as the final task self-check before completion and include the acceptance status in the task thread's final report.
- When acceptance is run from a Framework Orchestrator thread, update the task sequence, handoff status, and shared GitHub memory after the human confirms the acceptance decision.
- Ask for human confirmation before closing GitHub issues or marking an epic accepted.

## User-Facing Outcome

End with one of:

- accept;
- accept with follow-ups;
- needs fixes;
- blocked by missing alignment or decision.
