# Project Guard Workflow

Goal: detect and repair control-loop failure even when the active orchestrator no longer invokes its own rules.

Project Guard is an operation, not a permanent agent or conversation. One project-owned runner lives outside the active orchestrator context and survives its repair or rotation.

## 1. Install The Runner

During `$project-launch`, detect the cheapest independent scheduler available in the current environment: native harness automation, operating-system scheduler plus agent CLI, CI scheduler, or equivalent. Register one primary runner for the project; an optional standby may claim work only after the shared lease expires.

The runner must be able to:

- read current Project State, Project Memory Graph, durable task outbox, actual active-context metadata, and observable orchestrator advisory activity/work origin when the harness exposes it;
- read the current `Human attention` state and carry any `Pending Human Action` through repair or rotation without interpreting the product decision for the person;
- run `node scripts/vydykhai.mjs guard-check --state <export> --graph <export> --outbox <export> --accepted-incident <last accepted semantic id when any> --json` without a model;
- wake the registered active orchestrator, start one fresh maximum-profile evaluator, and record one idempotent incident receipt;
- perform only control-plane messaging, repair, and confirmed rotation. It may not implement project work, merge, deploy, spend, access secrets, or repeat an uncertain external action.

Record the runner, event route, schedule, last installation proof, wakeup route, and current incident in the `Project Guard:` line. If no independent scheduler can be installed, report `LIMITED` and the exact missing capability; event-only self-checking is not background recovery.

Prepare adapter changes in an isolated Candidate, validate code and provider schemas, then use a guarded bundle switch with a known rollback. A live timer must never see a half-written repair. Verify the installed bundle and restore the schedule; a framework version or `doctor` pass alone does not certify adapter adoption.

## 2. Trigger One Check

Use the same runner for both routes:

- event route: activation, dispatch/material resume, Return Sync written, human correction/detour, lease review due, milestone/framework update, observable orchestrator advisory activity, or context-loss signal;
- schedule route: every 30 minutes while active by default, with an inexpensive no-op when no work or incident is due.

The schedule is a liveness fallback, not a second planning ritual. It targets the project pointer, never a hard-coded orchestrator context, so rotation does not orphan it. An unchanged healthy state or already delivered incident must not wake the orchestrator, start a model, append a visible message, or change the pending human request.

## 3. Decide Without Waking A Model

First compare durable state with actual context activity and run `guard-check`:

- `NOOP`: state, active-context identity, DOD, leases, returns, detours, memory probes, work origin, and hygiene agree. Write no message, issue comment, or model trace.
- `WAKE`: durable work is waiting for orchestration, such as a written Return Sync, due detour, returned lease, or pending memory event. Send one nonce-bound wakeup to the current orchestrator.
- `AUDIT_REQUIRED`: identity, DOD, state, memory, work origin, side-effect, repeated-failure, runner, or context health is mismatched; or the same `WAKE` incident remains unresolved at the next check.

Use the stable semantic incident id returned by `guard-check`. It is derived from the actionable condition set, not the snapshot hash: an ordinary Project State update cannot turn the same accepted limitation into a new incident, while any additional, removed, or changed condition creates a different identity and requires review. Snapshot and outbox hashes remain evidence. One incident may have one active owner; another machine or harness observes the receipt and does not duplicate the wakeup or evaluator. After a nonce-matched `HEALTHY` receipt for that exact condition, persist its semantic id in runner state and pass it as `--accepted-incident`; repeated scheduled checks are then `NOOP` with zero queue or model calls until the condition set changes. A recorded active incident is never deduplicated this way.

Before the first wakeup for a new incident, copy the exact current `Human attention` state into its receipt. `PENDING` means the request has already been shown and is waiting for the person, so a timer alone does not wake it. `RESURFACE_DUE` means a later system event displaced the request and produces one idempotent `WAKE`. Repeated checks of the same incident remain silent.

The adapter must discover newly written Return Sync receipts directly from the durable outbox or tracker and compare their stable ids with matching Return Route receipts, even when native delivery was never attempted or the native task or thread read is empty. Both use the marked v1 formats in the task and Project State templates. Import `validateDurableOutbox` from the installed `scripts/vydykhai.mjs`, or use its `guard-check --outbox` output; do not maintain a separate regex copy. The shared result includes `issues`, structured `returns`/`routes`, `pendingReturnIds`, and `routedReturnIds`; record validity is structural, not proof of sender authority or completed action. Ordinary prose creates no ids. Incomplete, duplicate, malformed, or mismatched pairs audit and cannot close a return. A newer routed return cannot hide an older pending one. A terminal Action Receipt without its required Return Sync is a return-contract mismatch, not proof that no result exists. An adapter that cannot perform this model-free discovery reports `LIMITED`.

Build one complete source inventory, then refresh by stable source id and revision/update cursor, retaining unresolved returns and edits to old records. Advance the cursor only after a complete persisted delta; failed, truncated, or uncertain reads preserve prior state and report limited visibility, never an empty healthy outbox. Prove a bounded ordinary refresh rather than rereading all historical comments on each tick. If the source cannot expose reliable deltas, declare that limitation and use an explicitly budgeted reconciliation route.

Before a return wakeup, re-read the exact producer revision, matching route, and current recipient. An unrelated State or Memory edit does not invalidate a still-pending return. A routed or replaced producer cancels that delivery; recipient rotation preserves the pending work but invalidates the old target. Bind delivery deduplication to receipt revision and recipient, not a global snapshot hash. Queued or sent is not consumed: while delivery is in flight do not duplicate it; at the next check reconcile evidence and audit an unresolved wake rather than resend endlessly. Evaluator acceptance remains bound to its exact audited event and current material conditions; stale authority cannot close a newer incident or authorize live work.

Accept an adapter only after two real boundary tests, not a parser-only unit fixture: capture one Return Sync exactly as a task emits it and prove the event route wakes and routes it once; then run the installed schedule route against the same paired outbox and prove `NOOP`, no wakeup, no queued message, and no model call. Also prove malformed routing still audits, older pending work survives newer routed work, bounded refresh retains old edits, and pending delivery survives an unrelated change or recipient handoff. Keep the runner implementation and repair in a visible focused service task; the orchestrator owns briefing, coordination, Return Sync consumption, and acceptance, not adapter editing or smoke. Pending background proof blocks only the capability it has not established, not unrelated safe project work.

The adapter also checks actual harness evidence that durable files cannot prove: a newer human command with no observable action, a terminal task result missing from the inbox, duplicate or indistinguishable live control contexts, wrong reasoning profile, completed contexts that remain active without an exit, and internal orchestrator agents that lack the `Control decision / Available sources / Expected orchestration output / Route to focused context when` contract or originate project work without a visible owning context. A compliant advisory result is only `CONTROL_ONLY` or `ROUTE_TO_FOCUSED_CONTEXT`; it never advances DOD or supplies accepted project evidence. A project claim, diagnosis, Candidate, verification, or side effect without a human decision, durable source, or focused-context receipt is `UNOWNED_PROJECT_WORK`.

## 4. Evaluate Only The Anomaly

An empty native context view means observation is unavailable, not that execution stopped. Check durable receipts and available action metadata/journal pointers before classifying a stall; if neither proves activity, report the observation gap instead of inventing a failure or launching duplicate work.

For `AUDIT_REQUIRED`, start a fresh ephemeral evaluator on the maximum available profile with the exact incident, current durable snapshot, and read-only access to relevant context metadata. It never inherits the orchestrator's explanation as truth and never performs project work.

Return exactly one result:

- `HEALTHY`: the anomaly is disproven; record the receipt for the exact snapshot and close the incident.
- `REPAIR`: send one bounded instruction, expected evidence, and review-by to the active orchestrator. For `UNOWNED_PROJECT_WORK`, discard the unsupported result and restore a visible focused owner without interrupting unaffected execution.
- `ROTATE`: after a hard mismatch or one failed bounded repair, including repeated `UNOWNED_PROJECT_WORK`, freeze new dispatch and follow the existing confirmed rotation path from durable evidence.

If the evaluator or wakeup itself produces no nonce-matched receipt, do not loop. Preserve the incident and escalate once to the configured fallback or human with one exact action.

Guard delivery is control-plane input, not a second conversation with the person. The active orchestrator routes any repair to a focused maintenance context, releases its own turn after observable dispatch, and later presents one plain-language outcome. On completion it must restore or explicitly supersede the saved `Pending Human Action`; a replacement orchestrator inherits the same request before becoming active. The human speaks only to the orchestrator and never has to decode incident ids, evaluator receipts, scheduler state, or repair mechanics.

## 5. Keep Naming And Cleanup Observable

Project-goal task titles remain `<work-id> [<track>] [<mode>] — <short outcome>`, with the work id first. Only service work that maintains the coordination system rather than achieving a project goal puts a concise unique service id first, for example `[FW <version>] [SYSTEM] [MAINT] — Adopt`, `[ROT G4] [SYSTEM] [MAINT] — Replace orchestrator`, or `[GUARD <incident>] [SYSTEM] [MAINT] — Repair control loop`; do not reuse the Project State issue as its work id. Active and retired orchestrator titles keep their existing canonical format.

After a terminal receipt, verify artifact disposition, archive the completed focused context when supported, and retain only the durable reference. Do not mass-rename closed history.

## 6. Limits

This runner protects against a degraded context or missed control event. It cannot act while its whole host or agent platform is unavailable. If the harness does not expose enough context metadata to inspect advisory activity and work origin, report that check as `LIMITED`; do not claim independent protection from hidden takeover. A project that requires platform-level failover may register one standby runner in another environment using the same incident lease; that redundancy is optional, not a default framework layer.
