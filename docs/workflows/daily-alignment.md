# Daily Alignment Workflow

Goal: reconcile material meeting, event, and local-work changes asynchronously.

Run only from an orchestrator context when the input may change another participant's safe next action. Task-local debugging, routine progress, urgency, a locally resolved blocker, and ordinary continue are not alignment events.

## Durable State

- Project State holds the Shared Sync Contract, current compass, DOD, participant registry, tasks, and active Alignment Window.
- Alignment Window comments hold append-only packets and deltas for one meeting, milestone, or compact period.
- Alignment Window body is a current dashboard rebuilt with every Team Alignment Delta.

Comments remain evidence; a stale body must be rebuilt before use.

## 1. Identify Scope

Determine:

- meeting or event key and source link;
- Shared Sync readiness and source access for expected participants/orchestrators;
- expected participants and affected tasks/contracts;
- current participant and active task;
- active Alignment Window and latest delta;
- whether catch-up must cover several missed events.

## 2. Inspect Local State

Capture only what changes shared work:

- task/PR and material local delta;
- shared surfaces or contracts touched;
- changed assumption or decision;
  - meaningful intent, invariant, or approach pivot, including task-local «do it differently» changes that redefine the method without changing DOD;
  - confirmed future idea and its likely recall trigger as a graph candidate;
- overlap, blocker, or human checkpoint;
- safe continuation boundary.

Do not paste large diffs or routine commit updates.

## 3. Publish Local Packet

Append a packet using `local-alignment-packet.md`. Include participant/orchestrator, framework/model state, scope, local delta, `Memory candidates: NO_MEMORY_DELTA` or compact reusable proposals with source, conflicts/needs, and safe continuation.

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

Source or tracker gaps are `SYNC_LIMITED`, not implicit coverage. Do not publish `READY` for overlapping work until the required source and packet coverage exist; state what remains safe meanwhile.

## 5. Publish Delta And Dashboard Together

When shared guidance changes:

1. Append Team Alignment Delta with covered and pending packet ids.
2. Create a Brief Patch or re-brief signal when needed.
3. Rebuild the Alignment Window body from all current packets/deltas.
4. Update Project State: latest delta, participant rows, task/sequence impact, and next action.
5. Intersect the delta with active, queued, and paused tasks.
6. Leave unaffected tasks asleep. For an affected active task, send only `what changed / applies to / preserved / action`: a compatible patch continues execution; an invalidating change pauses only the affected boundary for `PATCH_REQUIRED` or `REBRIEF_REQUIRED`.
7. Mark affected queued or paused tasks `PATCH_REQUIRED` or `REBRIEF_REQUIRED`; age alone is only a re-read signal.

Preserve an optional extension as an `IDEA` candidate. Keep task-local pivots in their task and return reusable `INVARIANT`, `DECISION`, `LESSON`, or safe `POINTER` candidates. A meeting correction or repeated owner explanation triggers orchestrator-owned Memory Reflection: retrieve related nodes, classify `ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS`, integrate the smallest atomic event, rerun the affected executable Brief, and intersect it with active/queued work. Re-read the graph watermark and unseen events, never overwrite another participant or copy secret values, keep inferred wider applicability `PROVISIONAL`, and link sources instead of messages.

Do not leave a new delta behind an old dashboard.

Task contexts never read the raw transcript, participant packets, or Alignment Window as part of normal execution. The orchestrator distills only the delta needed by that task.

## 6. Rotate

After a milestone or when the window is no longer quickly scannable:

1. Ensure final delta is reflected in Project State, briefs, tasks, or PRs.
2. Close/archive the window.
3. Create the next compact window only when a new event requires it.

## 7. Tell The Human

Return continue, continue with cautions, wait, or blocked. Include sync readiness, durable links, missing inputs, safe boundary, and one exact next action.
