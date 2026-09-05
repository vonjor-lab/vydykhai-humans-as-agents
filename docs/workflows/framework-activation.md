# Framework Update Activation

An ordinary update request, or an already authorized update at its safe window,
owns **prepare → apply/prove → resume**. The person does not need to name a
capability or ask for activation separately. Existing merge, access, native trust
and memory/rotation cutover confirmations still apply.

## Prepare one transition

The active project orchestrator owns the transition in existing Project State:
accepted baseline, target plan id, one focused maintenance executor, safe named
checkpoint, Pending Human Action and productive next action. Reuse an existing
update task/branch; no competing updaters. Keep old workers on their accepted
contract until safe rebrief and actual readback. A new version alone does not
justify rotation, a full memory rebuild or another Guard.

`install` and `update` copy the kit and automatically expose the target adoption
plan stored in `.vydykhai-lock.json`. In the installed workspace consume:

```sh
node scripts/vydykhai.mjs adoption-plan --json
```

Retrieval is read-only, including the deterministic legacy fallback; it cannot
dirty the active accepted checkout. Only normal installation persists the plan.
The newly installed command is mandatory even when an older loaded updater only
printed “updated”. It supplies the missing handoff for legacy locks. An unknown
baseline conservatively includes all declared release requirements and available
release notes; establish the accepted baseline from Project State before pruning
work. Read skipped releases oldest first; missing release evidence remains a gap.

The plan binds version, canonical source and exact managed bundle. Repeated
update/restart returns the same plan for unchanged target content, including an
unknown baseline. Source revision reports current installed provenance even when
an identical bundle reuses its plan id. It never marks activation complete. When a target changes,
retain the prior plan reference and carry forward scoped progress from State.

## Apply and prove the applicable requirements

The executor applies the accepted kit update and returns exact-code evidence.
After authorized merge, the **active orchestrator itself** reads its own cwd,
accepted project HEAD, updated core, installed/source versions, title and Project
State, and runs its own live and offline doctor. Doctor checks kit integrity only;
a maintenance worktree cannot certify active use or another participant.
Preserve prior accepted operation if actual-context coherence is unavailable.
Rotate only for an evidenced need through the existing confirmed rotation route.

Reconcile shared meaning bidirectionally with each relevant participant through
the existing Shared Sync Contract and source coverage ledger. Each supplies a
source-backed delta, explicit no-change or scoped gap and checks their own
retrieval/readiness. One integration owner reconciles sources and advances the
shared semantic watermark only after actual integration. Never copy private
transcripts/secrets or let one machine certify another. An absent participant
leaves that dependent scope pending; unrelated safe work continues. On return,
consume the new delta and recheck affected scopes, not everyone's history again.

The global watermark records integration/readback provenance; it is not a reuse
key. Bind team-memory evidence to selected meaning/route (`sharedMeaningScope`),
participant, source range and Module Contract. An unrelated semantic edit may
advance the global watermark without invalidating this selected evidence.

Reuse existing graph, Module Contracts, source coverage and retrieval evidence
when sources and relevant boundaries still match. A version number is not a
memory gap. A real omission/conflict needs source-backed repair. To claim the
relevant new capability, require independent-source ordinary-language probes
`CURRENT / NEXT / CROSS_DOMAIN / PRIOR_MISS` and one actual path from source to
worker delivery, new-plus-retained behavior verification, Return and integrated
memory. Hashes, ids, flags and simulated checks do not establish semantic success.

For new tasks touching a durable module with prior obligations or acceptance
behavior, use [Context Preparation](context-preparation.md) and `context-run` by
default. The agent selects/reviews sources and handles transport; the worker
reads and acknowledges the actual context. Missing critical source access or
unsupported execution leaves the affected capability pending/LIMITED, never
fully active. Old workers enter only at safe rebrief/readback. The common path
needs no hooks; native interception needs separate applicable trust/host proof.

Keep the existing Guard liveness-only. Preserve unchanged tested adapters and
reuse evidence relevant to the service version/bundle, recipient and installed
timer. A changed recipient, adopted/repointed service or changed adapter requires
actual event and installed timer evidence plus a silent repeat under
[Project Guard](project-guard.md). Do not start a second Guard or a semantic timer.

## Reuse evidence, finish or give one checkpoint

Project State remains the authority for receipts, progress, acceptance and repair
attempts. Record requirement id, relevant source/boundary references, evidence,
limits and the next action in the existing update transition. Manifest `reuseBy`
names applicability dimensions; `adoptionEvidenceScope` only compares those
identities. Even a match means review existing evidence, never automatic success.
Unrelated State edits do not invalidate it; missing/changed relevant identity
requires scoped review. This planner does not parse receipts or enforce progress.

Reuse an accepted unchanged result and its limits. Preserve one bounded repair
attempt per unchanged semantic defect across plan ids, retries and restarts;
the defect identity is not the snapshot or plan hash. After one failed repair,
stop retries, retain prior accepted operation, and roll back only the changed
service bundle where safe. Never broadly roll back product code. Show one exact
needs-access/decision checkpoint and retain the pending question/next productive
action. Only materially changed evidence reopens the affected review.

The orchestrator records accepted target activation **with explicit limitations**
or the exact pending boundary. Failed critical capabilities cannot be called full
success; installing files alone cannot advance accepted activation. Resume the
next productive action, or preserve one actionable human checkpoint. External
availability and perfect recall are not promised.
