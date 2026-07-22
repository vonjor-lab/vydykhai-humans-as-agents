# Accept Work Workflow

Goal: decide whether delivered work satisfies current intent and can safely move forward.

## 1. Reconstruct Baseline

Use source precedence:

1. latest explicit human decision;
2. approved compass, brief, DOD, patches, and deltas;
3. current issue, PR, accepted artifact, and verified repo state;
4. agent plan or handoff;
5. inference.

Identify the `Accepted Baseline`, the current `Candidate`, and any `Rejected Candidate` used as evidence. Summarize:

- goal and DOD impact;
- scope/out of scope;
- scope freshness and baseline/candidate references;
- product loop or linked enabler;
- parent closure expectation;
- human checkpoint;
- Lab/Peer Review contract when used;
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

## 4. Compare

Check:

- goal, scope, and acceptance criteria;
- promised DOD movement;
- parent closure versus accepted sub-slice;
- visible product/operator loop or explicitly linked enabler;
- backing data/backend/permissions/recovery for UI work;
- Lab proof followed by production transfer and real-flow verification;
- Candidate ancestry and experiment decision; a Rejected Candidate is evidence, not the implicit correction base;
- required Peer Compass Review and alignment;
- material burn and stop limits;
- declared human checkpoint;
- tests, exact-current-code smoke, docs, and durable handoff.

## 5. Classify

- `ACCEPT`: promised scope and checkpoint are complete.
- `ACCEPT_WITH_FOLLOWUPS`: useful scope is accepted, named follow-ups remain, and parent stays open when needed.
- `NEEDS_FIXES`: task is close but the promised outcome, loop, checkpoint, or verification is incomplete.
- `BLOCKED`: a decision, packet, conflict, access, burn exception, or reliable verification is missing.

## 6. Finish In The Task Context

Keep fixes, smoke, and manual merge in the task context. After human confirmation:

- promote the accepted Candidate to the new Accepted Baseline;
- update task/PR status and acceptance summary;
- publish alignment only when another participant's safe action changes;
- report DOD impact, parent state, human checkpoint, burn, verification, merge, risks, and recommended orchestrator next action.
- classify each follow-up as a required DOD gap or optional Idea Candidate; optional ideas do not keep the accepted task or parent open by themselves.
- report Idea Memory entries absorbed by this work and confirmed candidates that the orchestrator should deduplicate and upsert.
- publish terminal Return Sync to the orchestrator through native context messaging or a durable tracker event without waiting for a human prompt.

For a rejected Candidate, record a Learning Delta with `Keep`, `Rebuild`, `Drop`, and `Unknown`. Any successor starts from the Accepted Baseline, preserves proven changes, and rebuilds failed parts using those lessons.

Do not close a parent from an accepted sub-slice unless its product loop and DOD are closed or explicitly moved out of scope.
