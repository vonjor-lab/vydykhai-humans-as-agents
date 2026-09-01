---
name: project-launch
description: Turn one Vydykhai installation or reconnect request into an evidence-backed ready project with shared sync, participant onboarding, first-DOD access, compass, and an active personal Framework Orchestrator.
---

# Project Launch

Create the minimum shared operating system before implementation starts.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/project-launch.md`

Load `docs/workflows/start-work.md` only when the initial goal needs decomposition.

## Contract

- Run `node scripts/vydykhai.mjs doctor` when available. Treat it only as installed-kit integrity; never infer live project readiness from it. Detect old Project State/graph schemas and migrate them side by side rather than appending incompatible current state.
- If the framework is not installed and the user supplied the canonical link, follow its `BOOTSTRAP.md` autonomously. Ask only for missing target/access; do not delegate setup commands to the human.
- Confirm the session runs from the exact target product repo by observed local path, remote, host, owner, and visibility. If none exists, ask only unresolved host/owner/visibility and prepare a private Git-backed repo when tools allow.
- Inventory existing brief, tracker, board, Project State, memory, branches, PRs, environments, deployment instructions, and accepted rules before creating new artifacts. Use the first real Project State create/update plus readback as the tracker write test; never create disposable probes.
- Resolve role-routed profiles on the latest available flagship: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, and efficient bounded for `EXECUTION`. Map to `Ultra / XHigh / Low` when available. Record actual model, all mappings, check date/source, and visible fallback; do not pin a universal model id.
- Create or update a compact Project Operating Brief: Git-backed repo, durable tracker, source of truth, coordination inputs, privacy, access coverage, safe first-DOD operational pointers, participants and role/decision scopes, owner/backup convention, agent routing, compass, DOD, initial plan, and first next action.
- For an existing project with meaningful history, route an early bounded read-only memory backfill from the accepted brief or earliest reliable baseline. Inventory high-signal human corrections, meeting decisions, pivots, open recall commitments, checkpoints, and accepted lessons; cluster by anchors, let later evidence supersede earlier meaning, deeply inspect only missing/ambiguous/conflicting clusters, and compare a side-by-side candidate. Require ordinary future-work queries to recover concrete meaning, source, return condition, and human gate before confirmed integration; never copy the full transcript or model narration into memory.
- Create atomic Project State v2 with activation, external Project Guard registration, `Human attention: NONE`, DOD Control Line, Governor receipt, Execution Leases, Pending Return Inbox, detour/recall gates, Shared Sync, participants, orchestrator, and tracker projection. Use Project Memory Graph v3 with stable anchors, atomic nodes, pending events, and `CURRENT / NEXT / PRIOR_MISS` probes. Migrate side by side with preserved ids/sources, visible delta, practical retrieval, human-confirmed cutover, and passing `control-check`.
- Reuse the registered active orchestrator when healthy; create one only when absent and replace it only through confirmed rotation. Name it `[ORCHESTRATOR] <project> — Vydykhai <version>`, verify the actual title/profile, and pin or foreground exactly that one context. Project State owns the pointer; never leave two active contexts.
- Install one Project Guard outside that context with the cheapest available independent scheduler. It runs deterministic `guard-check` on events and schedule, targets the current Project State pointer, keeps healthy and unchanged delivered incidents silent, wakes the active orchestrator once for durable waiting work, and starts a fresh maximum evaluator only for anomaly. Prove runner, schedule, actual-context and Human attention read, wakeup, and idempotent incident handling; without them report `PROJECT_READY_WITH_LIMITS`, never background recovery.
- Recommend GitHub Repo + Issues/Projects/PRs as the default sync space. Accept an equivalent only when it provides the same durable linked history, permissions, and participant/orchestrator writes.
- Commit the framework once into the project. Each participant's own orchestrator must prove its `doctor`, repo/tracker/input access, role, availability, and backup route through a readiness receipt; one machine cannot certify another.
- Prefer direct least-privilege coordination-input access for every relevant orchestrator. Otherwise name one intake owner and a traceable route from accessible meeting/chat/notes to an approved shared delta. Record gaps as `SYNC_LIMITED`; never claim complete alignment for affected work.
- Map only operations needed by the first DOD: environment/service owner, current deployed baseline/revision, complete protected pointer, merge/deploy authority, non-destructive check, backup/rollback, and stop conditions. Future-only access is `NOT_REQUIRED`; never request all credentials, store secret values, or treat merge as deploy.
- Configure task Return Sync as durable tracker outbox first and native cross-context wakeup second, with one fallback monitor only when neither is available. Verify one receipt id through `WRITTEN / SENT / RECEIVED / CONSUMED / ROUTED` on the first real dispatch without human polling. Give Project Guard the durable route and actual-context adapter; record the scope-freshness interval, default seven days.
- Treat meetings, recordings, transcripts, chat, and notes as raw coordination inputs until distilled and approved.
- Explain the working model plainly: the maximum-profile personal orchestrator decides what/why/when/who and what changed; deep-profile Discovery defines an unresolved solution; efficient-profile tasks execute a defined solution. Ordinary continue uses a lightweight hot path; tasks solve local failures and return only at declared triggers; acceptance and merge stay in the task. The orchestrator gives each task only executable `Because / Apply / Avoid / Verify / Source` memory items, investigates misses, integrates reusable candidates, and keeps tracker state current; people do not curate memory manually.
- Keep secret values out of Project State and shared memory. A protected pointer records owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition. Test only that route; incomplete pointers make the affected action `MEMORY_COVERAGE_GAP / BLOCKED` until repaired.
- Keep project-specific rules outside framework-managed files.
- A bootstrap request authorizes setup branch/PR and initial Project State. Otherwise ask before creating or changing shared-tracker artifacts.
- Route unclear goals through `$start-work` inside launch until the goal, first DOD, and initial route are accepted; recent meeting changes go to `$daily-alignment`, and ready work to `$framework-orchestrator`.
- Do not implement, deploy, smoke, or merge from the launch/orchestrator context.

## Finish

Publish and read back one Project Activation Receipt plus Project Guard proof and an independent Governor baseline. Return `PROJECT_READY` only when required gates and `control-check` pass; use `PROJECT_READY_WITH_LIMITS` for non-critical gaps, `NEEDS_DECISION` for a real human choice, or `BLOCKED_BY_ACCESS` when access prevents the first safe route.

Include gate evidence, Project State, compass/DOD, Shared Sync, participants, operational readiness for the first DOD, active orchestrator registration, safe limits, first route, and exact next action. Never finish at a setup summary without next-best-action.
