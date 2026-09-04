# Accept Work Workflow

Goal: decide whether delivered work satisfies current intent and can safely move forward.

## 1. Reconstruct Baseline

Use source precedence:

1. latest explicit human decision;
2. approved compass, brief, DOD, patches, and deltas;
3. current issue, PR, accepted artifact, and verified repo state;
4. agent plan or handoff;
5. inference.

Identify the `Accepted Baseline`, current `Candidate`, contract-supplied Memory Brief and [Context Route](context-route.md), any [Executable Memory Brief](memory-brief-envelope.md) plus its application receipt, material task-local pivots, targeted orchestrator patches, and any `Rejected Candidate` used as evidence. Compare actual scope with the inherited constraints and affected consumers; local green tests do not prove an unexercised cross-boundary outcome. Do not reconstruct unrelated Project State, raw meeting history, or the full Project Memory Graph. Summarize:

- goal and DOD impact;
- scope/out of scope;
- scope freshness and baseline/candidate references;
- product loop or linked enabler;
- progress continuity and, for an enabler, `Unlocks / Still missing / next product slice`;
- reported parent DOD impact; the orchestrator decides parent closure and sequence;
- Execution Lease identity/state and DOD Control Line contribution;
- human checkpoint;
- Lab/Peer Review contract when used;
- current approach and why material pivots replaced earlier paths;
- each executable Memory Brief item and whether it was applied, missed, contradicted, or not exercised;
- every required atomic item/clause/row id and the exact validation result when an executable envelope was supplied;
- outcome owner, recipient/dependency boundary, and any required recipient proof;
- material burn limit;
- verification route.

## 2. Inspect Delivery

Review changed behavior, files/artifacts, docs, tests, smoke, unresolved comments, and participant impact. Ignore unrelated local changes unless they affect acceptance.

## 3. Verify Exact Current Code

Verify only the risks changed by the Candidate. For runtime, integration, or state work, record:

- repo/worktree, branch, commit, and dirty state;
- backend command, cwd, URL, or not needed;
- frontend command, cwd, URL, or not needed;
- browser/app target and scenario;
- smoke result and skipped steps.

Start or restart runtime from the exact code being accepted. Old servers, old tabs, or another branch are not evidence. Avoid a paid setup path when an equivalent controlled entry proves the changed risk and that path did not change.

For a zero-spend or no-mutation contract, disable the dangerous capability when practical and record relevant counters before and after. Any accidental call, spend, or mutation remains evidence, changes the classification, and cannot later be described as zero.

For authentication, data, storage, migration, deployment, or recovery work, verify the exact environment, least-privilege access, current safe runbook, backup/restore route, and a non-destructive preflight before mutation. Evidence may name only a complete protected pointer: owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition, never a credential, token, private payload, or recovery value. Missing fields, stale check, or unavailable access is `MEMORY_COVERAGE_GAP / BLOCKED` until repaired and rechecked.

For runnable data-backed handoffs, verify the exact schema/migration revision, a reproducible safe data source such as a fixture, seed, snapshot, or shared test environment, and the recipient's access before interpreting the recipient-side scenario. Missing or inaccessible required data makes the evidence inconclusive and the handoff `BLOCKED`, not a product failure. Never move production data, private payloads, or secret values through framework memory.

## 4. Compare

Check:

- goal, scope, and acceptance criteria;
- promised DOD movement;
- parent closure versus accepted sub-slice;
- preserved/replaced/added/remaining progress after any patch, split, or re-brief;
- visible product/operator loop or explicitly linked enabler;
- backing data/backend/permissions/recovery for UI work;
- Lab proof followed by production transfer and real-flow verification;
- Candidate ancestry and experiment decision; a Rejected Candidate is evidence, not the implicit correction base;
- continuation basis and material delta classification: `Inherited`, `Deliberately changed`, or `Unexpectedly changed`; unexplained unexpected change is not acceptable;
- applicable Memory Brief items and unresolved learning/approach evidence;
- each brief item's `Apply / Avoid / Verify` evidence and any new, corrected, missed, or contradicted reusable lesson;
- boundary consultations and whether an undeclared entity, shared mechanism, authority conflict, or ownership overlap was resolved before expansion;
- required Peer Compass Review and alignment;
- material burn and stop limits;
- Expansion Check route and, for maintenance, proof that the representative original flow became materially smaller/faster and recurrence is covered; backup, cleanup, migration, or a cap alone is containment;
- declared human checkpoint;
- whether its observable questions match the judgment that person owns rather than delegating technical verification;
- recipient-side exact-artifact/revision proof and agreed receipt check; for runnable data-backed work, exact environment, schema/migration revision, reproducible safe data source, recipient access, and a representative scenario;
- tests, exact-current-code smoke, docs, and durable handoff.

## 5. Classify

- `ACCEPT`: promised scope and checkpoint are complete.
- `ACCEPT_WITH_FOLLOWUPS`: useful scope is accepted, named follow-ups remain, and parent stays open when needed.
- `NEEDS_FIXES`: task is close but the promised outcome, loop, checkpoint, verification, or inheritance proof is incomplete.
- `BLOCKED`: a decision, packet, conflict, access, burn exception, or reliable verification is missing.

## 6. Finish In The Task Context

Keep fixes, smoke, and manual merge in the owning task context. After human confirmation:

- promote the accepted Candidate to the new Accepted Baseline;
- update task/PR status and acceptance summary;
- request alignment only when another participant's safe action changes; the orchestrator runs that workflow.
- report DOD impact, human checkpoint, burn, verification, merge, risks, and recommended orchestrator action; the orchestrator decides parent state and next-best-action.
- for an enabler, report `Unlocks`, `Still missing`, and the next product slice/owner; do not close the parent from technical completion alone.
- classify each follow-up as a required DOD gap or optional `IDEA` candidate; optional ideas do not keep the accepted task or parent open by themselves.
- report graph nodes applied, confirmed, refined, superseded, or contradicted; keep local-only lineage in the task.
- report `Memory Brief result` item by item as `applied / missed / contradicted / not exercised`; a miss is evidence for orchestrator-owned Memory Reflection and a representative regression scenario.
- validate any `memory.application-receipt.v1` against the unchanged envelope; missing ids or mismatched authority/prompt/digest cannot be accepted as applied.
- report boundary consultations and any deliberately changed or unexpected surfaces.
- publish terminal Return Sync with learning/approach evidence plus `Memory candidates: NO_MEMORY_DELTA`, `task-local only`, or compact `ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT` candidates containing type, current value, touch keys, relations, and safe source. The orchestrator integrates reusable candidates into the graph; the task never edits shared memory and not every task note is promoted.
- write that complete marked Return Sync to the durable task/tracker outbox first, then attempt the same receipt id as the native wakeup. An Action Receipt never substitutes for Return Sync, including a readiness or human-checkpoint result. Report only through `SENT`; the orchestrator owns `RECEIVED -> CONSUMED -> ROUTED`, the paired marked Return Route receipt, and lease closure. Native final text and task/thread reads are non-authoritative and may be empty; native loss does not justify human polling or recreating an already durable result.
- include `Artifact disposition` for the context, PR, branch, worktree, runtime, and monitor. Close or clean only what is proven safe to remove, with unique work incorporated or preserved. Preserve ambiguous evidence; mark useful stale work `SALVAGE` for transfer onto the current Accepted Baseline rather than reviving it wholesale, and give `WAITING` or `RETIRE` an owner plus re-entry or cleanup condition. The orchestrator consumes this result and routes any separate maintenance without performing it.

Before merge, deploy, spend, or shared-state mutation, read back owning acceptance plus fresh exact actor, environment, revision, permitted mutation, and stop conditions as the Action Receipt. Acceptance, merge, and deploy are separate authorities; an absent, stale, or cross-environment receipt is `BLOCKED` for that action.

If a timeout, empty response, transport loss, or context failure follows a possible paid/external/shared-state action, return `OUTCOME_UNKNOWN`, freeze replay, and reconcile exact provider/runtime/durable receipts. Do not infer failure or retry from missing chat output.

For a rejected Candidate, human «do it differently», or statement that the direction was already known, record learning/approach and miss evidence and return a `DECISION` or `LESSON` candidate when reusable. Apply a clear task-local correction, but leave full graph retrieval, miss classification, and impact analysis to the orchestrator. Any successor starts from the Accepted Baseline plus refreshed Memory Brief, preserves proven parts, and rebuilds failed parts using those lessons.

Do not close a parent from an accepted sub-slice unless its product loop and DOD are closed or explicitly moved out of scope.
