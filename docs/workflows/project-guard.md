# Project Guard Workflow

Goal: detect and repair control-loop failure even when the active orchestrator no longer invokes its own rules.

Project Guard is an operation, not a permanent agent or conversation. One project-owned runner lives outside the active orchestrator context and survives its repair or rotation.

## 1. Install The Runner

During `$project-launch`, detect the cheapest independent scheduler available in the current environment: native harness automation, operating-system scheduler plus agent CLI, CI scheduler, or equivalent. Register one primary runner for the project; an optional standby may claim work only after the shared lease expires.

The runner must be able to:

- read current Project State, Project Memory Graph, durable task outbox, and actual active-context metadata;
- run `node scripts/vydykhai.mjs guard-check --state <export> --graph <export> --json` without a model;
- wake the registered active orchestrator, start one fresh maximum-profile evaluator, and record one idempotent incident receipt;
- perform only control-plane messaging, repair, and confirmed rotation. It may not implement project work, merge, deploy, spend, access secrets, or repeat an uncertain external action.

Record the runner, event route, schedule, last installation proof, wakeup route, and current incident in the `Project Guard:` line. If no independent scheduler can be installed, report `LIMITED` and the exact missing capability; event-only self-checking is not background recovery.

## 2. Trigger One Check

Use the same runner for both routes:

- event route: activation, dispatch/material resume, Return Sync written, human correction/detour, lease review due, milestone/framework update, or context-loss signal;
- schedule route: every 30 minutes while active by default, with an inexpensive no-op when no work or incident is due.

The schedule is a liveness fallback, not a second planning ritual. It targets the project pointer, never a hard-coded orchestrator context, so rotation does not orphan it.

## 3. Decide Without Waking A Model

First compare durable state with actual context activity and run `guard-check`:

- `NOOP`: state, active-context identity, DOD, leases, returns, detours, memory probes, and hygiene agree. Write no message, issue comment, or model trace.
- `WAKE`: durable work is waiting for orchestration, such as a written Return Sync, due detour, returned lease, or pending memory event. Send one nonce-bound wakeup to the current orchestrator.
- `AUDIT_REQUIRED`: identity, DOD, state, memory, side-effect, repeated-failure, runner, or context health is mismatched; or the same `WAKE` incident remains unresolved at the next check.

Use the stable incident id returned by `guard-check`. One incident may have one active owner; another machine or harness observes the receipt and does not duplicate the wakeup or evaluator.

The adapter also checks actual harness evidence that durable files cannot prove: a newer human command with no observable action, a terminal task result missing from the inbox, duplicate or indistinguishable live control contexts, wrong reasoning profile, and completed contexts that remain active without an exit.

## 4. Evaluate Only The Anomaly

For `AUDIT_REQUIRED`, start a fresh ephemeral evaluator on the maximum available profile with the exact incident, current durable snapshot, and read-only access to relevant context metadata. It never inherits the orchestrator's explanation as truth and never performs project work.

Return exactly one result:

- `HEALTHY`: the anomaly is disproven; record the receipt for the exact snapshot and close the incident.
- `REPAIR`: send one bounded instruction, expected evidence, and review-by to the active orchestrator. Safe unaffected execution may continue.
- `ROTATE`: after a hard mismatch or one failed bounded repair, freeze new dispatch and follow the existing confirmed rotation path from durable evidence.

If the evaluator or wakeup itself produces no nonce-matched receipt, do not loop. Preserve the incident and escalate once to the configured fallback or human with one exact action.

## 5. Keep Naming And Cleanup Observable

Project-goal task titles remain `<work-id> [<track>] [<mode>] — <short outcome>`, with the work id first. Only service work that maintains the coordination system rather than achieving a project goal puts a concise unique service id first, for example `[FW 1.22.0] [SYSTEM] [MAINT] — Adopt`, `[ROT G4] [SYSTEM] [MAINT] — Replace orchestrator`, or `[GUARD <incident>] [SYSTEM] [MAINT] — Repair control loop`; do not reuse the Project State issue as its work id. Active and retired orchestrator titles keep their existing canonical format.

After a terminal receipt, verify artifact disposition, archive the completed focused context when supported, and retain only the durable reference. Do not mass-rename closed history.

## 6. Limits

This runner protects against a degraded context or missed control event. It cannot act while its whole host or agent platform is unavailable. A project that requires platform-level failover may register one standby runner in another environment using the same incident lease; that redundancy is optional, not a default framework layer.
