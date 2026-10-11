# Framework 2.0 Assembly Check

Date: 2026-10-06. Status: PARTIAL_ASSEMBLY_VERIFIED / NO_RELEASE.
Owner: framework maintainer. Tracked in
[issue 71](https://github.com/vonjor-lab/vydykhai-humans-as-agents/issues/71).
User authorized implementation, checking and publication after successful
qualification. Publication is not waiting for another approval; it is waiting for
working mandatory host control, combined qualification and safe adoption proof.
No product installation, runtime change, merge, tag or release was performed.

## Independent Architecture Findings

A fresh Sol 6.1 High static review read the frozen design and existing mechanisms.
It returned four release-blocking findings, not acceptance:

1. The reference cycle closed after owner consumption without post-accept control.
2. Finding history could weaken original evidence/boundaries or leave nominal
   repair owners without a current continuing assignment.
3. The current exact-command hook is not mandatory interception of every affected
   action; editable actor labels, caller observations and files are not isolation.
4. Whole-project readiness was used to block even a proven independent increment;
   installation, pending-record migration and rollback remain unqualified.

The report completed before its process hit the 180-second wall cap. Treat this
as a completed static report with capped process termination, not a clean host run.

## Implemented Candidate Mechanisms

- `control-catalog.mjs`: 28 responsibility groups expanded into 87 operational
  criteria, each linked to existing authority. Every row needs a disposition and
  evidence; exclusions need reasons; gaps require linked findings. This is not a
  count of every prose rule or proof that a nonempty evidence string is true.
- `post-accept.mjs`: product acceptance and canonical review enrollment share one
  immutable-by-convention atomic file. Idempotent readback validates the existing
  Return framing and acceptance identity. Missing routing remains pending, not
  falsely delivered. Actual memory/map/tracker/custody file hashes are observed.
  The classifier requires a fresh source-bound verdict, preserved findings, live
  repair leases, manager disposition and continuation evidence. An accepted
  artifact survives a failed control check. This API is not yet installed as a
  mandatory manager/host route; file mode and hashes are not access separation.
- `finding-history.mjs`: preserve criterion, original evidence/boundary, first
  observation, failed attempts and closure proof. Owner/work transfers, changing
  holds and rescheduling require retained decisions. Existing leases must account
  for open repairs. Retry decisions and revision revalidations are append-only.
- `increment-readiness.mjs`: separate a current independently reviewed public
  dependency route from whole-project readiness. The whole inventory is still
  considered; required public boundaries and the existing route acceptance must
  pass. Other findings retain owners and dates; the whole project stays not ready.
- `project-recovery.mjs` now applies those history/lease/scoped-resume checks.
  The reference cycle now stops at ACCEPTED_CONTROL_DUE after manager acceptance
  and uses post-accept assessment before CLOSED. Trusted fixture labels still
  do not prove host identity, source meaning or real-world continuation.

## Independent Counterexamples And Repairs

A second fresh Sol 6.1 High static review inspected the implementation and tests.
It found two concrete state-transition bugs:

- A closed finding could not survive a later inventory revision: keeping the old
  closure failed freshness; rewriting its revision failed history preservation.
  Repair: retain the original closure and append independent revision revalidation.
- Increasing an attempt counter after FAILED bypassed the required retry decision.
  Repair: bind the independent retry decision to the previous failed attempt and
  the next attempt; retain that decision history without rewriting earlier entries.

Both were fixed. Three targeted regressions were executed against the frozen
pre-repair sources: 0 passed / 3 failed. The same tests on repaired sources:
3 passed / 0 failed. These are counterexample regressions, not a second independent
approval of the repaired implementation.

## Verification

- Focused post-accept, recovery and reference-cycle tests: **73 passed**.
- Full candidate suite: **471 passed / 0 failed / 0 skipped**, about 18.9 seconds
  on the final code readback.
- Framework validator: passed against the still-current **1.34.1** manifest.
  This does not mean a 2.0 installer or migration was tested.
- Stored-file lifecycle: acceptance/enrollment, failed memory retention, original
  finding reload, actual repaired bytes, independent-verdict projection and owner
  continuation are exercised without rerunning product work.
- Negative cases include stale/self-authored review, omitted catalog rows, fake
  green memory retention, absent/dead repair leases, erased findings, silent hold
  changes, rewritten failure history, unjustified retries, uncertain effects and
  human pause. The semantic judge and owner in these tests are fixture projections.

No claim of full Q5, native authenticated enforcement, full-platform health,
economic improvement, zero future errors or successful project adoption follows.

## Actual Host Constraint And Next Gate

The existing hook must remain explicitly LIMITED. Official documentation states
that a PreToolUse callback error, timeout or malformed response can fail without
blocking the tool, and unavailable MCP hooks do not block operations.
[OpenAI hook documentation, checked 2026-10-06](https://learn.chatgpt.com/docs/hooks).
This supports rejecting hooks alone as the mandatory control boundary, not a
claim that no supported integration can be built.

Next implementation is one explicitly scoped execution adapter with external
control state and actual permission separation. It must independently acquire
prior findings, observe role identity and enrollment, deliver the verdict, and
deny the affected action when admission is absent or unavailable. If an ordinary
UI tool can bypass that adapter, that UI route is outside the enforced capability;
it must not inherit a universal guarantee. Do not conceal this with another prompt
or install a recursive model-backed monitor.

Before publication:

1. Connect the candidate acceptance API to that adapter's actual completion route,
   independent event/timer admission and existing Return/lease consumption.
2. Prove unavailable controller, stale/forged verdict, bypass attempts, process
   interruption and unchanged healthy use on the real supported adapter. Preserve
   explicit pause, pending external outcome and accepted product artifacts.
3. Exercise fresh semantic post-accept review and observed repair/continuation,
   including retained knowledge retrieval and actual shared tracker state.
4. Qualify installer, current-manager/unfinished-worker transition and rollback
   while preserving pending findings/results; then a separately owned bounded
   project canary and matched whole-chain effectiveness measurement.

Do not repeat the earlier product audit or the entire semantic test matrix while
mandatory host dispatch is missing. First remove this specific implementation gap.

## Bounded Review Cost

| Review | Wall time | Input | Cached input, subset | Output | Completion |
| --- | ---: | ---: | ---: | ---: | --- |
| Architecture | 180.010 s | 410,609 | 341,888 | 5,132 | Final report; process wall cap |
| Implementation counterexamples | 116.252 s | 176,553 | 123,008 | 2,959 | Exit 0, final report |

These two runs total 587,162 input tokens (464,896 cached, included in input),
8,091 output tokens and 296.262 seconds. Maintainer work is not included. No exact
subscription attribution or savings claim. No Astra or paid repeat review was used.
Raw receipts/frozen sources remain in private maintainer evidence; this public
report contains no product data. Stream digests respectively:
`9f0c0b71b1e353e41784a00fbb76a936c584a06ee002153d0aed9c2e45664f9a`
and `7cf9b00d09801b9859bcff352a6ff51fa5f73b3ae21ccc4e1f6f3248cd8a0e14`.
