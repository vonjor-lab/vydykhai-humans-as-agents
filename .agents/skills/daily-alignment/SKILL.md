---
name: daily-alignment
description: Process a daily or meaningful meeting, transcript, chat decision, merge, blocker, accepted result, owner change, or return-to-work event that may change another participant's safe next action.
---

# Daily Alignment

Reconcile asynchronous human and agent work without requiring simultaneous availability.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/codex-workflows/daily-alignment.md`

Load packet, delta, dashboard, and brief-patch templates only when writing them.

## Contract

- Treat meeting recordings, transcripts, chat, and notes as raw inputs.
- Identify the meeting/event scope, expected participants, affected tasks/contracts, active Alignment Window, and latest delta.
- Apply source precedence; a current human correction supersedes an old task-thread plan.
- Publish this participant's Local Alignment Packet only when meeting or local state materially changes shared work.
- Never overwrite or invent another participant's packet or uncommitted state.
- Reconcile the packets that matter and list missing participants explicitly.
- Let unrelated work continue. Use cautions or wait only for overlapping surfaces, contracts, decisions, or sequence.
- Publish a Team Alignment Delta when several packets need reconciliation or shared guidance changes.
- Rebuild the Alignment Window body in the same operation as the delta.
- Update the participant registry with orchestrator link, installed framework version, latest packet, active task, and status.
- Create a Brief Patch for a small approved change; route material goal, scope, sequence, ownership, or task-map changes to `$start-work`.
- Rotate and archive the Alignment Window after a milestone or when it is no longer quickly scannable.
- Update the Framework Orchestrator state and next-best-action.

## Finish

Return `CONTINUE`, `CONTINUE_WITH_CAUTIONS`, `WAIT`, or `BLOCKED`, with links to the active window, packet/delta, missing inputs, and exact next action.
