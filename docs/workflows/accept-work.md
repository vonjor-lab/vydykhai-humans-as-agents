# Accept Work Workflow

Goal: decide whether delivered work satisfies current intent and can safely move forward.

## 1. Reconstruct Baseline

Use source precedence:

1. latest explicit human decision;
2. approved compass, brief, DOD, patches, and deltas;
3. current issue, PR, accepted artifact, and verified repo state;
4. agent plan or handoff;
5. inference.

Identify the `Accepted Baseline`, current `Candidate`, task Touch Set and Memory Brief, material task-local pivots, and any `Rejected Candidate` used as evidence. Summarize:

- goal and DOD impact;
- scope/out of scope;
- scope freshness and baseline/candidate references;
- product loop or linked enabler;
- progress continuity and, for an enabler, `Unlocks / Still missing / next product slice`;
- parent closure expectation;
- human checkpoint;
- Lab/Peer Review contract when used;
- current approach and why material pivots replaced earlier paths;
- memory decisions and rejected-path lessons applied, missed, or contradicted;
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

For authentication, data, storage, migration, deployment, or recovery work, verify the exact environment, least-privilege access, current safe runbook, backup/restore route, and a non-destructive preflight before mutation. Evidence may name a secret-manager reference and last safe check, never a credential, token, private payload, or recovery value. Missing operational memory or access is `BLOCKED`.

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
- applicable intent/working rules and unresolved Intent/Approach Delta;
- Touch Set coverage, Memory Brief use, and any new or corrected reusable lesson;
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

Keep fixes, smoke, and manual merge in the task context. After human confirmation:

- promote the accepted Candidate to the new Accepted Baseline;
- update task/PR status and acceptance summary;
- publish alignment only when another participant's safe action changes;
- report DOD impact, parent state, human checkpoint, burn, verification, merge, risks, and recommended orchestrator next action.
- for an enabler, report `Unlocks`, `Still missing`, and the next product slice/owner; do not close the parent from technical completion alone.
- classify each follow-up as a required DOD gap or optional Idea Candidate; optional ideas do not keep the accepted task or parent open by themselves.
- report Idea Memory entries absorbed by this work and confirmed candidates that the orchestrator should deduplicate and upsert.
- report Intent Trail decision families applied, confirmed, refined, superseded, or proposed; keep local-only lineage in the task.
- report boundary consultations and any deliberately changed or unexpected surfaces.
- publish terminal Return Sync with `Intent/Approach Delta` plus Memory Delta routing: `none`, `task-local only`, or a compact reusable candidate referencing the Learning/Intent/Operational evidence, touch keys, and safe source. The orchestrator deduplicates reusable deltas and atomically rebuilds the current decision map; it does not promote every task note.

For a rejected Candidate or human «do it differently», record Learning Delta plus `APPROACH_PIVOT`. Any successor starts from the Accepted Baseline plus applicable Memory Brief, preserves proven parts, and rebuilds failed parts using those lessons.

Do not close a parent from an accepted sub-slice unless its product loop and DOD are closed or explicitly moved out of scope.
