# Framework Efficiency Transition

## Isolated Review Continuation 2026-10-22

Current authority: finish the scoped 2.1.7 release candidate, independent code
review, full tests and package/update/paused-rollback checks. No project activation
or publication. Earlier release/adoption records
below remain history, not permission to repeat their model calls.

The existing reviewer can opt into `native.reviewContinuation: true` with a
finite `reviewTotalTimeoutMs` (at most one hour), existing finite maxCalls and
profile expiry. One new assignment starts fresh; subsequent explicit
`review(offer, {resume:true})` calls resume only its saved native session.
Each dispatch consumes another call. Original deadline, raw attempts, UNKNOWN
usage and source-acquisition budget survive; unknown tokens never become zero.
This is not compatible with token-accounted episodes and does not change their
existing refusal. No automatic retry or extra model is scheduled.

When the normal host has recorded reviewFailure, use trusted
`host.resumeReview(id, originalOffer)` before continuing. It restores only the
same observed-stopped lease when the full original binding is unchanged and
the host is unpaused. It cannot replace a negative verdict, override pause,
resume unknown effects, extend budgets, or restore a changed source. Captured
confined-command HEALTH leases are deliberately unsupported by this narrow path.
The caller still performs normal host.review and owner disposition afterward.
Ordinary observer polling does not dispatch a turn. A timeout is still a finite
stop, but no longer necessarily destroys evidence acquired for this assignment.

Qualification: injected interruption/reopen, unchanged-source continuation,
source drift, concurrent allocation, read-budget retention and host lease
restoration tested locally. Real independent model was interrupted after reading
10 originals, then resumed the same thread and reused all 10 without rereading.
It returned 87 criteria and a genuine result-use REJECT in approximately 181s
after resume; CONTINUE/DONE were refused and owned REPAIR retained. Two model
turns spent, previous pilot attempts retained separately, token usage UNKNOWN.
A local runner initially omitted repair leases after the verdict; the recorded
verdict was reused to finish owner application without another inference.

Limits: abrupt parent-machine loss, every CLI/provider combination, automatic
scheduler continuation, broad-project health and net economy are not proved.
Parent-process loss without a trusted stopped observation remains fail-closed.
No new rules catalog, role, daemon, graph or alternative acceptance mechanism.
Release readiness: scoped independent code review completed; its P2 was corrected
and confirmed by the same reviewer (14 PASS, 0 FAIL, 3 opt-in SKIP). Full suite:
1548 PASS, 0 FAIL, 100 SKIP; skips are not evidence. Validator and diff check pass.
Archive round-trip, fresh install, actual 2.1.6 updater, complete runtime loading
and paused kit/runtime rollback passed. Local data, journals, spent counters and
pause remained byte-exact; the isolated paused observer used zero model calls.
The schedule-absence probe was scripted, not project automation proof.
Disposition: READY_FOR_RELEASE_APPROVAL for scoped 2.1.7; NO_PUBLICATION and
NO_PRODUCT_ACTIVATION. Project use still requires safe-boundary adoption with
preserved journals. Net economy and general autonomous recovery remain unproved.

Independent review identified one P2: a stop during an unfinished source-tool
call or truncated trace could spend a continuation that cannot pass validation.
The same trace validator now qualifies stopped prefixes, and trace hashes plus
prefix validity are rechecked before allocating a continuation. Such unsupported
interruptions remain retained and closed without another model call. Focused
tests cover incomplete tools, truncated JSON and post-stop trace tampering;
the genuine completed-source resume evidence is retained, not replayed.

## Release Package Checkpoint 2026-10-22

Current authority: finish the isolated 2.1.6 release candidate, scoped independent
code review, adoption requirements and archive/install/update/rollback checks.
Do not publish, change product repositories, execute product experiments or resume orchestrators.
All prior sections below are retained history, not instructions to replay them.

Completed: scoped independent review found and closed one migration P2. Closed
legacy results no longer enroll a model review solely because resultUse is absent;
use remains blocked until an owned decision, and real drift/debt still triggers
review. The same reviewer confirmed the correction with five focused checks.
The final host/POST suite passed 100/100. Release-boundary checks passed 84 with
zero failures and one platform-specific skip. The source archive contains 379
exact files; fresh install, actual 2.1.5 updater, complete runtime loading and
paused forward/back switching passed. Local data, history, spent counters and
pauses were retained. Scheduler absence in the isolated switch check was scripted,
not live project automation proof. No new semantic-model trial was needed.

Disposition: READY_FOR_RELEASE_APPROVAL for this scoped 2.1.6 patch; NO_RELEASE,
NO_PRODUCT_ACTIVATION. Publication still requires authorization and exact remote
readback. A separately authorized project adoption must prove actual use through
the existing route; it is not implied by the isolated release package.

The actual-model negative result-use test passed: the retained REJECT prevents
CONTINUE/DONE even when individual findings are nonblocking. The existing suite
finished with 1538 PASS, 0 FAIL and 100 SKIP; skips are not proof. Reuse these
unchanged results. This turn checks only the remaining release boundaries and
addresses concrete reviewer findings, not another whole-project audit.

The release candidate carries the existing own-transition requirement for legacy
verdicts, durable return opt-in and a paused rollback that retains history and
does not authorize use under an older reader. Project adoption, ordinary positive
model reliability, whole-project memory coverage and net economy remain unproved
by this narrow negative fixture. Publishing is a later authorized action.

## Result-Use Gate Repair 2026-10-22

The first actual-model durable-submission trial returned a correct defect
diagnosis but nonblocking findings; unchanged CONTINUE was accepted. Preserve
that negative result. The next narrow candidate adds explicit independent
result-use judgment to the existing POST verdict, not another control role.
Legacy answers remain stored and readable but never gain permission by omission.
The connected runtime package must include the existing submission module.

Only the isolated fixture and candidate are authorized here. Do not update or
resume a product project, execute product experiments, publish or rerun historical HEALTH/PRE episodes.
Use one changed-contract real-model trial with the same original fixture evidence,
plus local boundary regressions. Keep the old ten spent attempts and record the
new actual call separately. A positive scoped result is not full project adoption.

Future adoption, when separately authorized: the existing maintenance owner at
a stopped runtime boundary installs the complete package, preserves journals and
findings, and verifies owner/preparer readback of result-use status. Existing
legacy work may not resume until its exact result has an explicit independent
judgment; do not regenerate its product work. Prefer existing current evidence;
review only the required use boundary. A rejected result stays owned for repair.

## Isolated Acceptance Repair 2026-10-22

The current request authorizes repairing the acceptance return mechanism, not
product work, publication or product restart. The candidate adds an opt-in durable
review submission to the existing source MCP and existing validators. It does not
add a reviewer role, catalog, scheduler or memory store. Original checkpoints below
remain historical evidence, not orders to replay completed work.

The real CLI with scripted local responses completed source acquisition, durable
POST submission, host admission, owner read/application, restart and quiet next
tick without a final model message. Incomplete output is rejected immediately;
source drift, unread citations and overwrite attempts stay refused. Scripted
responses establish transport behavior, not independent semantic acceptance.
Existing native final-message/windowed paths remain compatible. No old stopped
review is reclassified or admitted; usage absent after submission remains unknown.
Independent code review and exact evidence limits belong in the repair receipt.

## Current Checkpoint 2026-10-20

The user authorized narrow independent reader review and local packaging/update
qualification, not publication or project resume. One fresh reviewer found an
association-only entity constraint omission. A failing-before regression captured
it; the correction retains constraints, navigation routes, contracts and pending
coverage without expanding sibling bodies. The same reviewer confirmed scoped
PASS after the correction. Earlier findings remain retained, not overwritten.

Prepare the memory-only patch as version 2.1.5 on published 2.1.4, excluding the
separate unshipped confinement candidate. Its source and prior acceptance remain
preserved, but it is not silently part of this release. The local source archive
round-trips exactly; fresh install and the old installed updater pass. Historical
graph/source bytes, pauses and open obligations remain unchanged on the disposable
target; a managed-file conflict refuses before mutation. Installation remains
UNPROVEN_BY_INSTALLER, not project activation.

Regression: the isolated memory-only candidate ran 1619 tests: 1520 PASS, two
release-list oracle FAIL and 97 existing SKIP. The two exact expected version lists
were advanced to include the candidate patch; their files plus the maintainer-plan
checks then passed 44/44. No runtime change followed that full run. Preserve the
original failure log and the scoped correction, not an invented all-green rerun.
The final archive and update receipt pin the qualified bytes; validator and diff
checks pass. Disposition: READY_FOR_PUBLICATION_APPROVAL for this memory-only patch,
NO_PUBLICATION and NO_PROJECT_RESUME. This is not readiness of the separate
confinement candidate or proof of the whole platform's health.

Whole-project memory completeness, autonomous adoption and economic improvement
are not established. No additional historical audit or product restart is needed
to close the narrow release checks; publication and actual project adoption remain
separate decisions. Do not read the preserved checkpoints below as current orders.

## Retained Initial Repair Checkpoint 2026-10-20

The user authorized a bounded historical-memory repair and integration into the
existing v4/recall route, not another memory mechanism or project resume. The
reader candidate separates association navigation from explicit obligation closure;
unresolved association remains a visible applicability gap. Graph format, physical
storage, independent control roles and execution admission remain unchanged.
Retain the previous checkpoint below and all its evidence limits.

Source-side verification covers old/new recall, provisional historical meaning,
registered multipart preparation and direct original-source access for independent
control. No new semantic model run, project publication, deployment or activation
is authorized by these mechanical checks. Prepared-work adoption remains owned at
the actual project's safe boundary, outside this maintenance context.

Verification: 88 focused tests passed. The full existing suite returned 1527 PASS,
one stale maintainer-plan heading assertion FAIL and 97 SKIP. That assertion now
checks the approved simplified plan and retained historical sections; all seven
tests in its file pass. No production code changed after the full run. Validator
and diff checks pass; do not relabel the original full run as wholly green.

Before release: obtain scoped review of the changed reader semantics, settle the
exact release diff/version and verify the
archive/update path. Publication needs its explicit authority and live readback.
Do not repeat accepted whole-cycle experiments or require a whole-project rebuild
to finish this narrow change. Whole-project recall, autonomous adoption and net
economy remain unproved; a structural compatibility PASS cannot close them.

## Retained Checkpoint 2026-10-13

Owner: framework maintainer. Current disposition: 2026-10-13.
This is the maintainer's existing transition plan, not installed project policy.
Current action: the approved plan correction and one separately authorized narrow
isolated candidate acceptance are complete. Previous history remains preserved.
Runtime changes, release and product adoption were not authorized or performed.
Explicit pauses remain binding.

## Outcome

Increase retained useful outcomes by reducing rework, lost decisions, duplicated
modules and recovery. Account for preparation, delivery, review, coordination and
recovery together. Useful control may cost more; net savings require comparable
accepted outcomes, not fewer words, more passing tests or a version increment.

## Accepted Baseline And Limits

- The repository records the opt-in 2.0.0 release and compatible 2.0.1 through
  2.1.4 corrections. Manifest version is 2.1.4. Changelog entries and versioned
  sources retain their distinct scopes; this plan does not recheck live remote
  publication or attest any project's installed version.
- The finite two-task, retained-reuse and owned health-repair route was observed
  and independently accepted at its supported scope. Later unhinted recall,
  scoped migration and assisted canary evidence retain their original limits.
  Do not replay completed phases to reconstruct missing narration.
- Matched quality was equal at higher candidate effort; economy is NOT_PROVEN.
  Missing maintainer/reviewer overhead remains UNKNOWN, never zero.
- The current single-confinement source is an unreleased candidate. Preserve
  its source, tests and review evidence. It does not establish project adoption,
  arbitrary-host support, hostile-writer safety or autonomous project completion.
- Project application and outcome are NOT_ESTABLISHED by this source-side review.
  A product's authorized context owns actual safe-boundary adoption and evidence.
- The 2026-10-13 isolated acceptance exercised the unchanged candidate at
  `7ea4d86ebc25d291571ea7a2115f29c4dd2987ed`: one scoped consumer command,
  two actual outputs, retained knowledge and independent POST. One missing
  routing-evidence item was repaired and independently confirmed without command
  replay or a new audit. Owner application was reread as CLOSED /
  CONTROL_DONE_CONFIRMED with no open finding in this acceptance. This is a
  synthetic, source-assisted route, not autonomous operation or project adoption.

## Preserve

Keep one outcome owner, one logical decision graph, the shared module/code map,
versioned public module consumption, retained success and rejected alternatives,
independent preparation/acceptance control and owned bounded health repair.
Preserve explicit pauses, rights, baseline/data, unique work, pending knowledge,
open findings, spent attempts and uncertain effects. Reconcile unknown outcomes
without replay. Essential safety or acceptance constraints are not optional.

## Next Decision And Exit

The accepted review records NO_CHANGE to runtime, core, skills, controller roles
and schemas; no release is needed for this maintainer-plan cleanup. The old plan
is preserved verbatim in existing history. Check the replacement against the
accepted evidence and open obligations. A documentation check proves clarity
and preservation only, not improved agent behavior.

The next missing fact is actual authorized project adoption, not another replay
of the now accepted isolated route. It remains paused outside this maintainer
context. Any future candidate release requires separate authority and the actual
release gates; do not infer it from this local acceptance. Identify the next
missing acceptance fact and its existing owner before spending on repair.
For a repeated failure, compare continued repair, boundary adaptation and a
reversible workaround by remaining cost/risk. Keep necessary guarantees; a changed
promise needs a human decision. Record the discriminating hypothesis and stop
condition in the existing checkpoint, not a new task/report system. Without new
evidence, do not repeat the failed route. Pause only the affected authorized path.

Exit is the next actual accepted result plus retained evidence and its observed
application, with unresolved limits explicit. A local test, delivered message,
installed file or subtask PASS cannot close the parent outcome. An unchanged
ordinary continuation reuses its accepted contract without another preparation.

## Remaining Obligations

- Any eventual candidate release needs its actual current technical/release gates;
  old published versions are not pending publication merely because history says so.
- Actual adoption needs the existing adoptionRequirements, current participant
  application, real consumer/owner closure and preserved state. Source does not
  inspect private project records or install/steer product orchestrators.
- Broader recall, unresolved debt, future scheduled operation and unsupported
  environments retain their original evidence limits and owners. A local success
  does not certify them or create a new global audit requirement.
- Economic improvement requires a comparable accepted outcome and whole-chain
  accounting. Transition expenditure is separate; missing values remain UNKNOWN.

Project work acquires no new prerequisite from this maintenance review. Existing
project authorities decide their own continuation; this plan grants no access,
dispatch, paid experiment, cleanup or permission to resume paused work.

## Evidence Navigation

- [Changelog](COLLABORATION_FRAMEWORK_CHANGELOG.md): versioned changes and candidate.
- [Qualification evidence](design/framework-v2-current-checkpoint.md): exact dated
  routes, retained failures and limits; historical commands do not renew authority.
- [Useful pair and repair](evidence/framework-v2-option-a-2026-10-09.md): bounded
  observed success and the preceding unsuccessful route.
- [Continuity evidence](evidence/task-continuity-review-2026-10-01.md): deterministic
  identity checks versus unproved native observation/adoption.
- [History](FRAMEWORK_TRANSITION_HISTORY.md): prior plans and complete archived
  snapshot, never an alternative current plan.

Evolution Gate: retain the simplified plan and record the bounded accepted result;
no new installed rule, runtime, role, scheduler or schema. One authorized isolated
acceptance used three agents/five role turns including documentary confirmation,
not a new qualification suite. Actual models/efforts were recovered from host
metadata; whole-chain cost and reduced rework remain unproved.
Verdict: bounded acceptance complete / no release / project pause preserved.
