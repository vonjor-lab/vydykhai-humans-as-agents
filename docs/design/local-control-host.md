# Local Control Host Candidate

## Bounded Review Cost

Host-bound review prompts carry the full current independent source index as
metadata, not acquired evidence. Original reads, drift checks, scoped expansion,
fresh contexts and verdict admission remain mandatory. `list_sources` remains
available but need not repeat an index already supplied by the host.

An explicit `review.native.preparationEffort` may select the effort for a trusted
`PHASED_V1` preparation review only. It is opt-in and requires comparable scoped
qualification. HEALTH and result POST retain `native.effort`; model identity,
deadlines, shared cumulative call budget and prior history do not change. Record
the selected effort in each run. This is not a universal model downgrade or a
claim that PRE qualification establishes POST/HEALTH reliability.

## Negative-Path Completion

Successful controlled local commands retain `context.command-environment.v1`
evidence from before execution: resolved workspace/cwd/executable, executable
permission, current context recheck and the exact command digest. The existing
host observation stores an in-process sealed proof and exposes it to POST.
Caller prose cannot supply that proof. It covers local process launch only, not
remote identity, business permissions or a filesystem lock. Historical records
without it remain unknown; updating the runtime does not backfill old success.

The durable owner journal records a native exit and its usage even when the
owner forgot a continuation checkpoint. `CHECKPOINT_MISSING` is fail-closed:
no active model is fabricated, no completion or automatic next turn is allowed.
The transport still reports the missing handoff for owned reconciliation.

The existing owner handler can use explicit `EXACT_CONTROL_DISPOSITION` policy.
Only a current positive independent verdict with no open findings and an exact
delegated next action or terminal decision is applied without a model. The same
owner acquisition, host freshness and notification readback APIs remain mandatory.
Ambiguity and repairs return to the existing owner; unknown application is retained
without retry. A new mode makes older implementations refuse instead of silently
falling back to native delivery. Existing native delegation remains compatible.

`waitControlEvent` is passive: it returns applied control, attention or observation
expiry, never a worker cancellation or a new tick. Size the caller's transport
wait separately from task execution. In-flight changes are not new model turns.

A complete launch packet exposes current installation, planned assignments,
dependency gates, checkpoints and the selected tracker through the same review
source registry as product evidence. Installation integrity outside that registry
does not prove operational readiness to a source-confined reviewer. A planned
assignment must not claim an active execution lease before dispatch.

`REPAIR` is an owned branch, not a terminal dead end and not permission to ignore
the finding. The existing owner retains the negative verdict, repairs its named
evidence, and uses `health.requestRepairReview`. A WAITING assignment first uses
the paused, exact-lease `health.resumeRepair`; this grants neither execution nor
independent approval. Only fresh independent findings and applied disposition
permit dependent work. Positive-only transport fixtures cannot qualify this path.

When selected sources identify a previous accepted artifact or terminal record,
new reviews receive its scoped `relatedAcceptances` from the authenticated host:
exact acceptance identity, independent result-use judgment, owner disposition,
enrollment and current source/retention observations. A terminal proposal or owner
narrative is not interchangeable with independent closure. This projection is
bound into the review key and grants no new execution. Older closed histories do
not gain new obligations retroactively; an owned repair adopts the new binding.
Readers that cannot interpret adopted related-control evidence cannot be selected
for rollback. Unselected history is not injected into the review context.

An action-only worker endpoint does not expose source discovery or filesystem
reads. Its trusted launcher supplies the already accepted preparation and exact
action/verification bindings inline; the host still rechecks admission at action
time. Do not assign source retrieval to a role without that capability. A failed
context handoff is not permission to replay: reconcile the completed process and
absence of registered calls/reservations first, retain its cost, and explicitly
dispatch a new corrected handoff. Unknown effects remain blocked.

Finite owner-handler capacity can be renewed on a quiescent paused host through
`changeControlProfile`: a separate `owner-delivery-*` journal, explicit allocation,
unchanged delegate identity and native profile, preserved old journals. This does
not reset spent calls, clear findings or resume the host. Review and owner capacity
must cover the whole remaining sequence, including repair verification.

Observation, review work and product work have different lifetimes. A passive
wait expiry is not failure and must not cancel or relaunch a task. The isolated
native worker helper is bounded (five minutes for non-review roles); it is not a
general multi-hour task host. Long product tasks retain their external task owner
and execution lease; the controller evaluates boundary events, not their entire
execution inside one review/tool call. This bounded helper does not establish
survival across CLI/host loss. Unknown external effects remain unreplayable until
reconciled. No short fixture qualifies multi-hour resilience or economic benefit.

Status: candidate implementation, not installed or a release qualification.
The contract covers the local controlled-command route only. It is not a claim
that ordinary native tools, hooks or other hosts are intercepted.

## Independent Result Use

POST_ACCEPT carries a separate `resultUse` judgment: `ALLOW`, `REJECT` or
`UNKNOWN`, with acquired source evidence. The host binds it to the exact product
acceptance, alongside the current review key. REJECT/UNKNOWN cite owned OPEN
findings; their `blocksResume` flags do not override this result-use decision.
ALLOW requires C20.02 PASS and cannot contradict an adverse C07.03 or C19.01
assessment of promised combined behavior or exact-candidate tests. Nonblocking
advisory debt can remain OPEN without rejecting an otherwise accepted result.

The C20.02 part supplies this judgment when partitioned; merge retains it and
global validation rechecks consistency. It is not a HEALTH judgment or a command
grant. The compact owner readback preserves it. The host refuses CONTINUE/DONE
without ALLOW; current assessment also guards command authorization, reservation,
historical grants and closure. REPAIR remains available. An independently
validated WAIT can retain obligations without permitting consumption or DONE.

Legacy verdicts without this field remain readable and unchanged, but confer no
new result-use permission. No automatic migration creates ALLOW or clears old
findings. Missing decisions require one source-bound review at the next needed
use boundary, not mass replay of prior tasks. At that boundary the trusted host's
existing `requestRepairReview(id, evidence, [])` accepts an empty finding selection
only for an owned REPAIR whose legacy verdict lacks `resultUse`. It preserves the
previous verdict in repair history and does not increment unrelated failed repairs
or bypass their retry requirements. Once the decision exists this exception is
unavailable. Activation is explicit and outside
this candidate test. Host enforcement cannot prove that a model's positive
semantic judgment is correct, or intercept actions outside the controlled route.

## Result-Use Update And Rollback

The existing transition owner and maintenance participant apply this change only
at a stopped, exclusive runtime boundary. Do not erase an unresolved review or
command to make the boundary appear safe: reconcile its actual outcome through
the existing recovery route, preserving the old lease and spent allocation.

1. Retain the accepted kit/runtime identity, activation/profile, journal revisions,
   findings, verdicts, grants, pending work and human pauses. Stage the complete
   pinned source package, including `control-review-submission.mjs`; a kit update
   alone does not switch the private runtime. Reuse the canonical update and
   explicit paused runtime-switch APIs; do not rewrite journal state.
2. Keep the current profile unless a separate same-host profile transition
   authorizes `native.reviewSubmission`. The opt-in return path preserves source
   acquisition and host validation. Missing final usage remains UNKNOWN, never
   zero; exact-token-accounted episodes cannot use it. A stopped HEALTH lease
   still needs its existing independent reconciliation, not an automatic retry.
3. Read legacy verdicts without changing them. Missing `resultUse` is UNKNOWN,
   not ALLOW. Only when that result is actually needed, the existing owner takes
   REPAIR and requests the missing decision through `requestRepairReview`; the
   legacy-only empty selection does not regenerate product work or erase failed
   repairs. Reuse current sources; no mass HEALTH/PRE/POST replay is required.
4. Verify the changed boundary with retained or scoped evidence: REJECT/UNKNOWN
   cannot authorize use or DONE; owned repair is possible; an explicit ALLOW can
   continue only while the normal source, grant, health and pause checks hold.
   Publish the rule through existing shared sync and read back actual
   owner/reviewer/consumer retrieval and application. Mark unavailable proof
   pending; copying files or an isolated test never closes project adoption.
5. If switching fails, use the existing paused rollback route. Restore only the
   selected code/kit, not old journal snapshots: new findings, spend and unknown
   effects must survive. Keep scheduling stopped and human pauses intact. An
   older reader may not enforce `resultUse`; successful reopening is data
   compatibility, NOT permission to resume or consume a rejected result.

## Interrupted Review Continuation

Opt-in native configuration uses `reviewSubmission: true`,
`reviewContinuation: true` and finite `reviewTotalTimeoutMs` (at most one
hour). Existing per-turn timeout, profile expiry and maxCalls still apply.
Every explicit continuation consumes a call; no automatic retry is introduced.
Fresh assignments start independent sessions. Only the unchanged assignment may
continue its retained session with `review.review(originalOffer, {resume:true})`.

After a normal host tick has recorded reviewFailure, the trusted owner first
calls `host.resumeReview(id, originalOffer)` (POST) or
`health.resumeReview(originalOffer)` (HEALTH). The API requires the exact
observed-stopped run, unchanged original binding and an unpaused host.
Then continue the reviewer and apply its verdict through the existing host and
owner APIs. A receipt is not owner application. These APIs are not model tools.
Polling alone never spends a call or resumes work.

Continuation preserves raw attempts, source receipts, source-window byte budget,
original deadline and unknown usage. Only complete supported trace prefixes are
resumable: a partially recorded tool call or truncated/corrupt trace is retained
but refused before another allocation. Missing process-stop proof, changed
sources/assignment, final negative verdict and exhausted limits remain closed.
This path does not repair a lost parent process or guarantee that every
interruption can resume. Token-accounted episodes and captured confined-command
HEALTH leases remain unsupported by this path.

At an update boundary, preserve journals and install the complete pinned runtime;
change the private profile only through the existing approved transition.
Do not reinterpret an old stopped run as a new continuable session.
Qualify only the affected route with retained evidence and an isolated
interruption/reopen check. Rollback keeps the host paused and retains all new
session/acquisition/expense records; an older reader cannot certify continuation
or authorize consumption of rejected results. No budget reset or product restart.

## Boundaries

- `control-store.mjs` owns append-only control revisions outside the worktree.
  Exclusive publication provides compare-and-swap across processes. Unpublished
  temporary files are not revisions. Missing or invalid history fails closed.
- `control-runtime.mjs` stages and verifies an explicit content-addressed runtime
  outside the project. It preserves license/provenance and rejects in-place damage;
  loading exposes the existing host/service/worker APIs, not a second control plane.
  STAGED_NOT_ACTIVATED does not initialize journals, install a timer, switch an
  active process or certify adoption. Same-schema reopen/rollback is tested;
  incompatible history is held rather than erased. See the
  [staging evidence](../evidence/framework-v2-runtime-staging-2026-10-06.md).
- `control-host.mjs` owns acceptance enrollment, independent review leases,
  disposition, exact command admission, effect observations and final readback.
  Its methods are trusted launcher capabilities, not worker-accessible tools.
- `control-loop.mjs` runs one budgeted tick. The actual scheduler and fresh
  reviewer transport are supplied by the launcher, not an orchestrator prompt.
- `control-service.mjs` drives a finite scheduled series of those ticks using
  a protected call budget. Reopening the service does not refill its budget.
  It does not register itself or hook an existing desktop chat.
- `control-activation.mjs` creates one private immutable service binding outside
  the workspace. Existing journals, pauses and consumed allocations are retained;
  missing installed journals are not recreated. Reviewer room/home are separate
  from the product. Existing operator auth is referenced, not copied; credential
  metadata must be private even when its home directory is traversable.
- `control-observer-run.mjs` runs exactly one tick under an exclusive dispatch
  lease and retains a bounded latest receipt. Unknown/crashed ownership is never
  stolen by pid or age. Reconciliation remains an explicit operator obligation.
- `control-schedule.mjs` registers that command with macOS launchd, not a new
  conversational manager. Disposable SESSION and LOGIN registrations have run;
  logout/reboot is not qualified. Removal
  verifies exact registration identity and holds the dispatch lease through
  unregister; missing observation inputs do not make owned cleanup impossible.
  Registration and wakeup are not successful diagnosis, owner action or readiness.
  Default registration is periodic-only: no RunAtLoad or kickstart. The trusted setup
  `startScheduledControl` route registers the natural interval without a separate
  initial dispatch; `waitControlObservation` follows terminal receipt hashes without
  aborting work. Legacy synchronous startup is not this route. Raw registration
  reports initialObservation=NOT_PERFORMED even when reused; it is not startup proof.
  Opt-in event-driven startup and host acceptance request a non-terminating wake
  through `requestScheduledObservation` after the obligation is persisted. The
  exact installed service/profile is checked; no `-k`, second manager or replay.
  A missed/coalesced wake retains the obligation for the same timer to reconcile.
  Initial and interval receipts are distinct evidence. Later LOGIN loading starts
  the interval, not an immediate login tick; logout/reboot remains unqualified. A
  preexisting RunAtLoad plist requires owned unregister/re-register at a quiescent
  boundary; registration never silently rewrites a conflicting plist.
  Removal accepts only the exact current plist or its exact previous RunAtLoad=true
  variant. With the exclusive observer lease held through verified bootout, an idle
  post-tick PID is not a blocker: it may be terminated after the durable receipt.
  An active or unknown retained lease still blocks removal; no lease is stolen.
  A successful bootout is not immediate absence. Exactly one bootout is followed
  by read-only exact-identity observations within a shared 10-second deadline
  (child shutdown observation can add its bounded 250ms grace). Unknown/foreign
  readback stops immediately. Until absence is confirmed, the plist is preserved;
  uncertainty after dispatch also retains the lease for explicit reconciliation.
  This is not permission to repeat bootout or age-clear a lease. Reconciliation
  must establish registration/process state as well as stopped lease ownership.
- `control-recovery.mjs` reconciles a stopped observer with exact journal/lease
  bindings and trusted supervisor evidence. Unknown effects cannot be cleared.
- `control-notification.mjs` retains bounded pending/delivered/applied evidence;
  `control-notification-owner.mjs` requires exact-token readback and separately
  observes actual dispositions. Supersession preserves history, not false closure.
- `control-owner-delivery.mjs` optionally invokes the explicitly delegated native
  control-disposition capability from that observer. Persisted finite allocations
  bind attempts to exact obligations, not replaceable notice ids. It cannot submit
  repair completion: both native allowlisting and endpoint capability enforce this.
  Observed disposition is neither executed repair nor observed continuation. This
  does not wake an existing desktop chat or replace the project orchestrator.
- `control-cadence.mjs` evaluates trusted observed resets without guessing a
  repeating window or replenishing budgets. Health retains due reset obligations
  through pause, newer observations and blocking repairs.
- `control-allowance.mjs` reads the explicit Codex bucket/window through bounded
  read-only app-server RPC without inference. Optional service polling defers
  during pause/review and cannot replenish budgets. The adapter requires a private
  auth-only home; inherited-config homes are refused, not silently executed.
  Missing, ambiguous or inaccessible metadata remains UNKNOWN with owned followup.
- `control-migration.mjs` appends explicit paused host-schema migration under a
  trusted writer-exclusion capability. It is not an active service switch.
- `control-health.mjs` enrolls initial health without inventing accepted work,
  then uses the same REVIEW/disposition/finding history for due/trigger checks.
  `control-repo-observation.mjs` reads actual refs/worktrees/status, hashes bounded
  dirty bytes and staged blob identity, and sends no code contents to the model.
  Missing/unbounded observations are LIMITED, not zero or healthy. Branch counts
  trigger examination, never deletion. Source changes invalidate in-flight proof.
- `local-control-sandbox.mjs` provides a macOS process boundary for controlled
  commands: workspace writes only, no network and no control-store access.
  Other platforms are explicitly unsupported by this adapter.
- `control-endpoint.mjs` and `control-mcp.mjs` expose only registered request IDs
  to a worker. They never expose approval, acceptance, disposition or store writes.
  Private configuration chooses the exact request; the worker cannot override it.
- `control-worker-run.mjs` launches a fresh isolated native CLI with a private
  home, strict explicit config, read-only native workspace and a required MCP.
  Direct shell, other plugins/apps, agent creation and network tools are disabled.
  `control-codex-profile.mjs` owns that supported CLI profile. No existing desktop
  chat, global configuration or credentials are changed/copied.
- `control-review-sources.mjs` and its MCP expose a host-owned public evidence
  registry, independently of the preparer's packet. Registered reads have hashes,
  explicit missing status and bounded size; unregistered paths are unavailable.
- `control-model-review.mjs` starts fresh native REVIEW contexts with source-read
  tools and, when explicitly selected, a verdict-submission capability only. It records dispatch, incomplete diagnostics, usage when available
  and result before consumption. Verdict citations must refer to actual reads in
  that run; changed sources invalidate the response. This establishes acquisition,
  not the truth or completeness of a model's interpretation or the registry.
- Candidate opt-in `native.reviewSubmission:true` uses `submit_review` rather than
  a final conversational message. The existing wire/coverage/acquisition validators
  check the assigned complete answer before an immutable private receipt is written.
  Its acknowledgment ends the read-only child; the parent still requires observed
  termination, matching receipt and transport, unchanged source/host binding and
  finding validation before returning a verdict. The receipt itself grants nothing.
  A rejected submission stops without automatic retry. Existing final-message
  profiles may opt into `native.reviewUsageDrainMs` (0..30000, default0): after a
  successful durable receipt, allow normal CLI completion to emit final usage.
  The original work deadline still applies; rejection stops immediately. No new
  assignment or retry is launched. Drain expiry retains the submitted verdict
  subject to normal admission and marks missing usage UNKNOWN. Additional native
  response work inside that same turn is part of the measured expense. Existing
  profiles are unchanged. If no turn-completed usage was delivered, spend remains
  UNKNOWN, not zero. This mode is refused before dispatch for token-bounded episodes,
  which require completed usage; their old unknown-usage guard is not weakened.
  This route does not make a model finish reasoning, replace missing judgments,
  revive an expired budget, clear historical holds or prove production readiness.
- `control-owner.mjs` and its MCP expose the retained inbox, exact verdict readback,
  owned response and observed retention-repair submission. They expose no command
  grant, independent verdict creation or finding closure. Native per-tool approval
  is explicit only for these limited mutations and registered worker requests;
  internal current-source admission and one-use reservations remain mandatory.
  Typed decisions and unique owner/work repair groups avoid guessed protocol
  fields. The owner view retains all findings and all criterion statuses without
  repeating each source citation; the complete original verdict remains stored.
  Only the hash of a verdict actually acquired in that tool session can be bound
  to a response. Missing readback, explicit wrong hashes and replay still fail.
  Post-accept disposition validates pause, leases, blocking findings and fresh
  sources for continuation. A restricted CONTROL_DISPOSITION_ONLY endpoint exposes
  only inbox/verdict/notice readback and disposition, never repair submission.
- `control-review-wire.mjs` expands source handles, explicit criterion groups and
  finding-resolution deltas. The host owns hashes, criteria and immutable history;
  omitted findings remain unchanged. This reduces transcription, not review scope.
- `control-review-process.mjs` supervises a fixed offline reviewer command in a
  separate read-only process. Its private append-only journal retains dispatch
  before execution, bounded output and observed termination/result. Reopening an
  uncertain journal never grants replay. Identity comes from the trusted launch,
  not a name emitted by the child. This is not yet a semantic model transport.
- `control-child.mjs` bounds actual execution separately from post-kill pipe waiting. Explicit review work may use up to 900000ms; service budget includes native work plus 1000ms. Defaults and other worker caps are unchanged. Passive observation expiry never aborts that work or replenishes its allocation.
  Unobserved close remains UNKNOWN. Offline review forbids child creation; its
  trusted inline policy must treat workspace sources as data, not load them as
  executable reviewer code. Native CLI exit does not certify all command effects.

The model transport remains outside the command sandbox. Do not pass model API
credentials or control capabilities to command processes. The explicit native
worker launcher makes the required MCP its action route; the ordinary CLI and
desktop remain unchanged. Calling the library optionally does not enforce this
boundary. Actor strings in the host API are not authentication: keep those
capabilities outside worker tools and the writable workspace.

## State And Recovery

Product acceptance and pending review enrollment publish together. Accepted
product bytes are preserved; the independent review follows actual memory, map,
tracker and custody readback. References are version-scoped evidence, not an
instruction to freeze a shared project's evolving current files forever.

A review claim is retained before dispatch. Related evidence and per-acceptance
state bind the verdict; unrelated work must not invalidate it. A lease cannot be
hidden by restoring old bytes or closing the acceptance. Due owned nonblocking
debt can reenter review without repeating product work. Findings retain their
original criteria and independently checked repair history.

Original artifact, producer Return, technical proof and goal bytes are reobserved,
not just memory/map/tracker/custody. Their loss or alteration invalidates prior
review and enrolls fresh review before or after closure. A repaired semantic write
uses an append-only retention revision: same required paths, actual byte readback,
the owner's existing repair disposition and a fresh independent check. The original
acceptance and findings cannot be rewritten by that operation.

Configured `evidenceRegistry` also binds fresh registered source observations into
admission. Changes outside the retention paths invalidate reuse and enroll review.
The service requires the same registry for reviewer acquisition. Legacy profiles
without this binding explicitly report RETENTION_ONLY_QUALIFICATION, not complete
source coverage. Registry contents must be versioned with their review allocation;
editing an existing allocation's registry is not an authorized budget reset.
The model transport verifies current registry identity and workspace before any
dispatch, matches the host's exact offered source snapshot when present, and
checks again after acquisition. A replaced registry requires an explicitly
versioned allocation, not silent reuse by a long-lived reviewer process.
An allocation may additionally bind `scope.requiredSourceIds`. Every listed source
must actually be acquired before verdict publication; unavailable content must
remain a finding/unknown, not invented evidence. Selection happens before dispatch.
Read coverage proves acquisition only, not correctness of the model's interpretation.

A timeout does not establish that a reviewer stopped. Uncertain reviews remain
owned and are not automatically retried. The trusted `observeReviewRun` transport
must confirm termination. Reconciliation reuses a valid retained verdict when
available. Otherwise an explicit independent retry decision is recorded alongside
the original run before another attempt becomes eligible. The observer callback
must read actual process/transport evidence, not relay an actor's assertion.

Commands reserve an exact admission before their effect. A second command for
the same task cannot bypass an unresolved attempt by changing its arguments.
An observation records the result without re-execution. It certifies continuation
only for the owner disposition that authorized that attempt. A changed disposition
requires reconciliation, not attachment of an old result to the new decision.
The runner records COMPLETED only after final source and behavior readback. A
successful child exit followed by a failed readback leaves the reservation unknown.

Optional `continuation: {mode: "REGISTERED_PREAPPROVED_ONLY", maxActions: 1}` in
the private service profile enables deterministic dispatch after disposition.
Only a trusted admission grant carrying its exact `executionRequest` opts in.
An ordinary grant is not an instruction to execute automatically. The observer
uses the same source-bound admission, sandbox, reservation and final readback;
it neither chooses work nor approves/renews grants nor accepts product results.
Expired/ambiguous routes wait for their owner. Unknown effects remain held. This
removes a model call for already decided mechanical work, not independent review.

Human pause is authoritative. Unavailable control never falls back to unguarded
execution. The control store has an explicit 8 MiB per-revision capacity and no
silent truncation. This is operational journal capacity, not a memory-graph limit.

Health-enabled journals use `control.host.v2` and bind the complete configuration.
A legacy reader cannot drop the health field and resume them. There is no implicit
v1-to-v2 migration. Initial health, interval/source/custody triggers and overdue
findings are retained outside manager context. Pending health holds the configured
controlled route, except explicitly listed maintenance tasks, which still need
ordinary command permission and honor pauses/unknown effects. This is not a
general authority to hold or mutate unrelated projects. The owner must acquire
the exact verdict and record owned leases; a second pending repair cannot replace
the first. Failed attempts need an independent recorded decision before retry.

The HEALTH offer also carries a read-only lifecycle projection: initial/followup
diagnosis or requested repair verification, prior review identity, recorded owner
disposition/assignments, and requested finding IDs. It deliberately excludes the
transient enrollment and review lease changed by claim, so the offer remains
stable during its own review. Admission binds the projection through the existing
offer hash and state revision. These records prove coordination, not completed
execution or semantic repair. Initial diagnosis must not demand that its own
future repair has already passed; verification still needs fresh result evidence.
Phase alone never grants PASS, nonapplicability, closure or continuation.

The same offer exposes protected execution metadata: approved command identities,
task IDs, dependency IDs, expiry and reservation status. It excludes executable
arguments and does not claim coverage of external project leases. Empty records
before assignment are distinct from an orphaned running task. Changes bind both
review admission and owner application; a stale verdict cannot authorize a newly
changed execution picture. Source-universe limits and each criterion's causal and
timing predicates must be examined, not converted into unrelated fault claims.

Overdue findings are scheduling events, not permanent requests to rerun an
unchanged audit. A review lease captures the then-overdue `(id, reviewAt)` pairs;
only successful host admission acknowledges those pairs. The finding remains
OPEN and overdue with its original deadline and owner. A deadline crossing during
inference, a changed deadline, source/custody changes and periodic review remain
separate triggers. Failure, unknown outcome or pause cannot acknowledge an event.
Existing journals without this optional acknowledgement receive one due review,
not an invented prior check. A newly discovered already-overdue finding can also
require one follow-up. No attempt counter, deadline or budget is reset.

An explicitly configured partitioned native reviewer reserves all native slots
upfront and covers whole catalog groups against one frozen offer/source identity.
Only the complete raw union, decoded and globally checked, may enter the host.
Host-bound parts use the authentic current POST acceptance scope or HEALTH input;
each part and the final union recheck the exact host lease, state and source basis.
Read-only HEALTH `reviewInput()` supplies no dispatch or disposition authority.
Cancellation during final publication withdraws any unaccepted verdict; incomplete
parts retain cost/history and cannot authorize continuation. Review capacity and
native-call capacity remain separate units. This opt-in route has no automatic
refill, retry or partial-result admission. Maintainer diagnostic reconstruction is
outside the runtime and supplies no host authority.

This adapter still has operational limits: a latest receipt and owner inbox are
not a delivered human alert. Optional explicitly delegated native owner delivery
wakes a bounded disposition handler, not an existing desktop orchestrator. Actual
desktop-owner wakeup/human alert remains unqualified. Stopped-observer recovery
does not infer unknown process/effect outcomes or renew a budget. An optional
account-metadata RPC adapter is wired but requires a private configuration-free
authenticated home; real authenticated automatic observation remains unqualified.
Missing cadence metadata remains an owned follow-up and does not
block unrelated healthy work or suppress failure triggers. Fixed interval mode
remains explicitly different from observed-reset mode. These limits cannot justify
recreating budgets, deleting unknown leases or claiming whole-project health.

## Current Preparation Status

Immutable acceptance-time memory is historical evidence, not a live lifecycle
status. Native `preparation` requires both the public-source endpoint and an
explicit `CONTROL_READ_ONLY` owner profile scoped to named acceptance ids. That
profile exposes only `read_status`: no grants, owner mutations or new execution
authority. Unknown ids and missing profiles are refused, not silently downgraded.

The projection separates historical acceptance from current enrollment, retention
readback, pending/reconciling review and unresolved findings. CLOSED does not mean
that all platform debt is repaired. Its scoped digest changes with relevant state
and source observations, not unrelated journal traffic. The launcher requires an
actual successful acquisition and validates current freshness after the native
turn; missing/stale acquisition returns `PREPARATION_UNVERIFIED`. Verified readback
does not certify semantic application or public-source acquisition: callers still
check those separately. Independent qualification must inspect the resulting
context, not just a successful read or machine-readable answer shape.

## Remaining Integration Gates

Candidate cutover is a trusted operator API in `control-cutover.mjs`, not a hot
swap. It requires paused/quiescent journals, an unregistered scheduler, the same
profile/schema and an explicit exclusion of external scheduler writers. Supported
registration/removal shares the observer lease. Both old and target runtimes read
back the same host, notification and model-budget state; capacity may expire but
cannot increase. Optional continuation requires the selected implementation's
capability. A durable intent holds interrupted switches for explicit recovery.
Failed selection restores the previous runtime without deleting new journal state;
if preservation cannot be proved, it holds for reconciliation instead. Switch or
rollback never restarts scheduling, unpauses work or certifies project adoption.
Content hashes identify a reviewed package; they do not authenticate an arbitrary
package or sandbox the trusted imports. Runtime verification binds the selected
inventory, not the newest inventory, so intact older packages remain inspectable.

1. Qualify the final supported combined route. The revised six-call
   [combined cycle](../evidence/framework-v2-combined-cycle-2026-10-07.md) closed
   through explicit preapproved deterministic continuation, with four owned open
   findings. The earlier failed seven-call run and its recovery remain separate.
   Subsequent recall exposed stale lifecycle context; the later current-status
   and inherited repair/NO_CHANGE episodes have scoped acceptance recorded in the
   current plan. Do not repeat them or relabel their original failed attempts.
2. Preserve the now-qualified supported startup route: one nonce-bound installed
   observation before periodic SESSION/LOGIN registration, actual timer wakeup,
   owner application or durable pending-attention, and continuation once. Installed
   followthrough has four native-provider tests and independent scoped acceptance;
   abort alone is not proof of exit. Desktop/human alert delivery, real reboot/login
   and long-duration service behavior remain outside that evidence. Do not claim
   those optional modes from a durable receipt or restart already accepted tests.
3. Held-out semantic tests: unprompted recall, complete applicable coverage,
   resisting unsupported closure and preserving accepted/rejected decisions.
   Synthetic PASS rows establish none of those properties.
4. Existing-project installation, preservation of old state, explicitly supported
   compatibility mode and observed rollback. No silent fallback to legacy tools.
5. A bounded whole-chain canary and honest time/token accounting. Account-wide
   subscription usage cannot be attributed to this host from token counts alone.

These gates precede publication. Existing 1.34.1 validation does not qualify the
new operating contract, and the manifest is deliberately unchanged.

## Durable Owner Waiting

Optional `ownerDelivery.waits` uses the existing delivery journal, not another
manager. A trusted launcher claims `waiting.begin()`, then starts or resumes the
exact recorded native session. The owner parks an allowlisted event and checkpoint
and ends its turn. Only a trusted native-exit receipt changes PARKED to WAITING;
an event before exit cannot start a concurrent owner. The existing observer records
READY mechanically. With `waits.eventDriven:true`, native exit also calls this
same observer, and trusted role completion calls it after saving the actual Return.
Neither path launches a model or advances task stages; OBSERVATION waits still
require a new periodic receipt. The launcher consumes READY once and resumes the same session;
it makes no task-stage decisions. Workers must outlive the owner's MCP connection.
A long pending MCP call alone does not prove zero model inference while waiting.

A completed observation is quiet only with a successful outcome, no unresolved
review/owner/action, no pending obligations or notifications, and no model or
command activity. Unknown/failed or attention-required observations return an
attention event with the original evidence, never quiet success. The trusted
timer adapter establishes the interval; a changed receipt hash alone does not.

Pause, expiry, unknown native exit and a changed session prevent resumption.
Observation deadlines report attention, never cancel work or grant retries.
Negative events wake the owner but confer no permission. Results still require
ordinary acceptance and independent control. Account for each active turn; native
resume usage can be session-cumulative, so calculate deltas rather than summing
cumulative totals. Retain prior expenses. Profile replacement cannot discard this
session allocation; cutover rejects an active/unknown owner or an incapable reader.
