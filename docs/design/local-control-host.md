# Local Control Host Candidate

Status: candidate implementation, not installed or a release qualification.
The contract covers the local controlled-command route only. It is not a claim
that ordinary native tools, hooks or other hosts are intercepted.

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
  Registration is periodic-only: no RunAtLoad or kickstart. The trusted setup
  `startControlSchedule` route executes one descriptor-selected bounded observer,
  verifies its exact durable result, then registers the schedule. It does not retry
  unknown observation and must have explicit execution scope/budget. Raw registration
  reports initialObservation=NOT_PERFORMED even when reused; it is not startup proof.
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
  tools only. It records dispatch, incomplete diagnostics, usage when available
  and result before consumption. Verdict citations must refer to actual reads in
  that run; changed sources invalidate the response. This establishes acquisition,
  not the truth or completeness of a model's interpretation or the registry.
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
- `control-child.mjs` bounds both ordinary execution and post-kill pipe waiting.
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
