# Daily Alignment Workflow

Use this repo-local workflow when the user asks for daily alignment, post-meeting alignment, "продолжи по daily", "сделай апдейт после встречи", event-triggered alignment, task alignment, blocked-work alignment, completion alignment, or a similar short command.

Goal: let every participant's Codex process meeting outcomes, task events, and local work asynchronously, without requiring everyone to be online at the same time.

## Source Of Truth

Use a GitHub issue as the shared alignment journal.

- Issue comments are canonical. Append new comments for packets and deltas.
- Issue body is a derived dashboard. Rebuild it from comments when you have enough context.
- Never overwrite or delete another participant's Local Alignment Packet.
- A newer Local Alignment Packet or Team Alignment Delta supersedes older ones by id, but older comments remain auditable.

## Inputs To Read

1. Latest relevant meeting recording, transcript, or Fathom summary.
2. Current alignment issue for that meeting, day, task, or product stream.
3. Latest project instructions, including `AGENTS.md` and the collaboration framework.
4. Relevant epic brief, task, PR, branch, or local work state.
5. Previous Team Alignment Delta and any packets not yet covered by it.

If there is no alignment issue, create one using `alignment-issue-template.md`.

When the trigger is a task event rather than a meeting, use the task or PR as the scope key. A meeting transcript is optional in that case.

## Event-Triggered Alignment

Daily alignment is the periodic catch-up path. Event-triggered alignment is the lightweight path used between daily cycles.

Post or prepare a Local Alignment Packet only when one of these events changes what others need to know:

- `scope_changed`: implementation direction, task boundary, shared contract, or affected entity changed materially;
- `blocked`: work discovered a conflict, overlap, missing decision, or unavailable dependency;
- `accepted`: PR/task was accepted, merged, or explicitly accepted with follow-ups;
- `follow_up_split`: new follow-up work was separated from the original task.

Do not post packets for routine commits, branch creation, ordinary PR-open status, local refactors that do not affect shared contracts, or progress notes that do not change another participant's next action.

## Pivot And Brief Changes

Daily alignment is allowed to update direction, but it must do it visibly.

Use `brief-patch-template.md` when the meeting changes wording, assumptions, acceptance criteria, task boundaries, or a small dependency without changing the epic's core goal.

Route to `$start-work` in re-brief mode when the meeting changes:

- epic goal;
- scope or out of scope materially;
- task map;
- sequence of work;
- ownership;
- shared contract or affected entity model;
- whether the work is still the same epic.

Do not silently mutate tasks. If a Brief Patch or re-brief is needed, say so in the Team Alignment Delta and list which issues or docs must be updated after human approval.

## Steps

### 1. Identify The Alignment Scope

Determine:

- meeting key: date, title, and recording or transcript link;
- event key when this is task-triggered: issue, PR, event type, and timestamp;
- expected participants when known;
- current participant and active work stream;
- prior alignment issue or the issue that should be created;
- packets and deltas already present.

If several meetings were missed, process them as a catch-up batch and list all covered meeting keys.

### 2. Inspect Local State

Summarize only what other Codex instances need for alignment:

- active branch, PR, or issue;
- local uncommitted work that affects shared behavior;
- files or product surfaces touched;
- assumptions introduced or changed;
- overlaps with other active work;
- whether the owner can continue safely before everyone else posts.

Do not paste large diffs into the issue. Link to commits, PRs, or issues when available; otherwise summarize the local delta.

### 3. Post Local Alignment Packet

Append a new issue comment using `local-alignment-packet.md`.

Use a stable `packet_id`. If this participant already posted for the same scope and the new packet changes it, set `supersedes` to the previous packet id.

The packet must state:

- owner;
- meetings covered;
- event type and event key when not meeting-triggered;
- local state observed;
- decisions or assumptions from the meeting affecting this owner;
- local delta since the previous packet;
- conflicts, overlaps, or missing context;
- safe-to-continue recommendation;
- needs from other participants.

### 4. Rebuild Shared Status

Read all current packets and deltas in the issue. Classify each expected participant:

- `posted`: latest packet exists for this scope;
- `missing`: expected participant has no packet yet;
- `not_applicable`: participant or Codex explicitly marked no relevant local work;
- `stale`: packet exists but was superseded by newer local work, newer meeting scope, or a newer participant note.

Then identify which packets are already covered by the latest Team Alignment Delta.

### 5. Publish Or Update Team Alignment Delta

If there is enough information, append a Team Alignment Delta comment using `team-alignment-delta.md`.

Use one of these statuses:

- `READY`: all expected packets are covered and no open conflict blocks work.
- `READY_WITH_CAUTIONS`: some packets are missing or uncertainty remains, but listed work can continue safely within limits.
- `WAITING`: alignment cannot be completed until specific packets or decisions arrive, but no known contradiction exists.
- `BLOCKED`: packets conflict or a decision is required before affected work continues.

The delta must list covered packet ids and pending packet ids or participants. This is how later Codex instances know what has and has not been incorporated.

If a Brief Patch or re-brief is needed, include it in the delta. Do not update GitHub tasks, briefs, or docs until the human approves the change.

For task events, a Team Alignment Delta is optional when the Local Alignment Packet is enough for coordination. Publish a delta when several packets must be reconciled, when safe-to-continue guidance changes, or when the event changes shared contracts, sequence, ownership, or task scope.

### 6. Rebuild Issue Dashboard

Update the issue body from `alignment-issue-template.md` so a human can scan:

- current status;
- meeting scope;
- expected participants;
- latest packet per participant;
- latest Team Alignment Delta;
- pending participants or packets;
- safe-to-continue guidance;
- next required action.

The dashboard is a cache. If comments and body disagree, comments win.

### 7. Tell The Human What To Do

End with one of these outcomes:

- continue: work is aligned enough;
- continue with cautions: work can continue only within listed boundaries;
- wait: another packet, decision, or conflict resolution is required.

When this workflow runs inside a Framework Orchestrator thread, update the orchestrator state with the latest delta, pending participants or packets, task sequence impact, and next recommended action.

Keep the human summary short and link to the issue, packet, and latest delta when possible.

## Archiving

Keep the operational journal short. Once the final delta has been incorporated into durable docs, tasks, briefs, or PRs, close or archive the issue. Do not rely on old meeting transcripts as project memory.
