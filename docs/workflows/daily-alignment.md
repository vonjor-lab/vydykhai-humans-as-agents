# Daily Alignment Workflow

Goal: reconcile material meeting, event, and local-work changes asynchronously.

## Durable State

- Project State holds current compass, DOD, participant registry, tasks, and active Alignment Window.
- Alignment Window comments hold append-only packets and deltas for one meeting, milestone, or compact period.
- Alignment Window body is a current dashboard rebuilt with every Team Alignment Delta.

Comments remain evidence; a stale body must be rebuilt before use.

## 1. Identify Scope

Determine:

- meeting or event key and source link;
- expected participants and affected tasks/contracts;
- current participant and active task;
- active Alignment Window and latest delta;
- whether catch-up must cover several missed events.

## 2. Inspect Local State

Capture only what changes shared work:

- task/PR and material local delta;
- shared surfaces or contracts touched;
- changed assumption or decision;
- confirmed future idea and its likely recall trigger;
- overlap, blocker, or human checkpoint;
- safe continuation boundary.

Do not paste large diffs or routine commit updates.

## 3. Publish Local Packet

Append a packet using `local-alignment-packet.md`. Include participant, orchestrator, installed framework version, resolved agent profile/check date, scope, local delta, conflicts/needs, and safe continuation.

Supersede this participant's older packet; never overwrite another participant's packet or invent their local state.

Update the participant registry row.

## 4. Reconcile

Classify expected participants as posted, missing, not applicable, or stale. Read only packets relevant to the affected work.

Use:

- `READY`: relevant participants covered and no conflict;
- `READY_WITH_CAUTIONS`: named work can continue within boundaries;
- `WAITING`: missing packet/decision may change overlapping work;
- `BLOCKED`: known conflict or decision stops affected work.

Missing participants do not block unrelated work.

## 5. Publish Delta And Dashboard Together

When shared guidance changes:

1. Append Team Alignment Delta with covered and pending packet ids.
2. Create a Brief Patch or re-brief signal when needed.
3. Rebuild the Alignment Window body from all current packets/deltas.
4. Update Project State: latest delta, participant rows, task/sequence impact, and next action.

When an input contains a useful extension that is not required for the current DOD, preserve it as an Idea Candidate rather than expanding a task. The orchestrator checks duplicates and upserts confirmed ideas into Idea Memory.

Do not leave a new delta behind an old dashboard.

## 6. Rotate

After a milestone or when the window is no longer quickly scannable:

1. Ensure final delta is reflected in Project State, briefs, tasks, or PRs.
2. Close/archive the window.
3. Create the next compact window only when a new event requires it.

## 7. Tell The Human

Return continue, continue with cautions, wait, or blocked. Include durable links, missing inputs, safe boundary, and one exact next action.
