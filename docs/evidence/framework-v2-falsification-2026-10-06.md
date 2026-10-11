# Framework 2.0 Falsification Check

Status: COUNTEREXAMPLES_REPAIRED, INDEPENDENT_REVIEW_INCOMPLETE, NO_RELEASE.
This challenges the earlier small pilot; it does not promote the candidate.
No product inspection, mutation, new model retry or release occurred.

## Independent Attempt

One newly authorized fresh Sol 6.1 High review received frozen prototype sources,
tests, design and the first-pilot report. It was asked to disprove claims rather
than repeat the author's rubric. Read-only configuration reused the previously
verified sandbox recipe. No new sandbox qualification was claimed.

The process was terminated at the 180-second cap (180.022 seconds observed).
There was no completed turn or structured final report. Its partial message named
four counterexamples: unrecorded deadline changes, erased failed attempts, changed
boundary evidence with an unchanged key, and supplied debt omitted from the final
recovery disposition. The trace shows a failed Node invocation; the reviewer said
it used an in-memory substitute afterward. We do not count that assertion as
native execution proof. All actionable cases were reproduced separately in Node.

The review is NOT a completed independent acceptance of either the old or repaired
candidate. Token usage and subscription consumption are UNKNOWN: no completed-turn
usage receipt was available. This does not mean zero consumption. No paid retry.
Frozen inputs remained byte-identical. Stream SHA256:
`8d3bbfa888644a1fbd5d25bb97700aa2ae10140cf38fdc594ed24fcee92a116b`.

## Reproduced Defects And Repairs

Each row has a failing pre-repair test, then a passing regression test. Tests use
the real modules and hashing, not the reviewer's substitute. They establish only
the declared-input contract, not authenticity or truth of external observations.

| Case | Earlier behavior | Correction |
| --- | --- | --- |
| Changed recovery owner/boundary | Old review remained usable | Include owner, reached boundary and prior findings in recovery binding. |
| Failed attempt erased | Removing `lastResult` bypassed failed-repair handling | Keep failure until a later recorded result or independently evidenced closure. |
| Malformed history | Missing historical fields weakened comparisons | Validate both current and prior finding records. |
| Silent postponement | Moving an overdue finding's date enabled continuation | Require retained old/new dates and a rescheduling decision, even without a trend window. |
| Contradictory debt views | Known supplied open debt could yield COMPLETE with empty recovery debt | Reconcile identities, criteria, owners, attempts, dates and closure state across supplied views. |
| Different next task | Prior readback/progress/report could certify another task | Bind continuation to recovery, task, worker and authority; bind report to that continuation. |
| Missing debt observation | Null/absent input threw an exception | Return explicit RECONCILE_EVIDENCE. |

The four independent partial-review observations overlap the maintainer's findings;
do not count them as four additional independent successful reviews. The final code
changes were verified by deterministic maintainer tests, not a second model review.

## Checking The Tests

Isolated mechanical mutation trials removed protections and added an always-block
variant. Initially one of eight mutants survived: the malformed-history test was
accidentally rejected by the deadline check, concealing loss of schema validation.
The test now removes one historical field at a time while preserving the others.
After that correction, all eight selected mutants fail and the intact 35-test
recovery/debt suite passes. This is selected-mutation coverage, not exhaustive
mutation coverage or independent semantic qualification. Original failure logs and
both mutation attempts are retained outside the universal repository.

Repository verification after repairs: 440/440 tests passed, framework validator
passed at unchanged version 1.34.1, and `git diff --check` passed. These counts do
not change the independent-review or host-qualification status above.

## What Remains Unproved

The small original pilot used coherent, easily enumerated sources and tested
planning/review rather than actual task execution. Its scorer was the rubric
author. It has no matched baseline or policy-ablation control, no unseen complex
history, no repeated interruption/recovery cycle and no demonstrated economy.
It cannot attribute behavior to the framework rather than the capable model.

These pure assessors still trust supplied records. A caller can omit an entire
history, invent a receipt, change both views consistently or recompute keys. Hashes
detect accidental/stale mismatches, not fraud or actor identity. Authentic source
collection, durable obligation enrollment, independent permissions, timed health
review and actual worker application remain host obligations, not solved defects.

Next gate: one isolated host-backed continuation/retention cycle with independently
observed facts, a real interrupt, an old receipt replay and one legitimate unchanged
continuation. Missing evidence must block only dependent action; real current proof
must permit productive continuation. Reconcile retained obligations after restart.
Only then test unhinted retrieval/application on an independently checked project
snapshot. A later matched baseline and policy-ablation comparison must test benefit,
false blocks and whole-chain costs. No new paid run is authorized by this report.

Harness lesson: preflight the actual read-only execution runtime, not only file
isolation; allocate a narrower review target and leave time for final reporting.
A timeout/partial message remains INCOMPLETE even if it contains useful findings.

Evolution gate: Benefit = concrete false-positive paths removed and a weak test
exposed. Evidence = red/green native regressions and selected mutation checks.
Complexity = bounded prototype binding/validation changes, no new actor or timer.
Verdict = continue isolated qualification; NO_RELEASE, no reliability or savings claim.
