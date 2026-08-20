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

- Run `node scripts/vydykhai.mjs doctor` when available. Treat it only as installed-kit integrity; never infer live project readiness from it.
- If the framework is not installed and the user supplied the canonical link, follow its `BOOTSTRAP.md` autonomously. Ask only for missing target/access; do not delegate setup commands to the human.
- Confirm the session runs from the exact target product repo by observed local path, remote, host, owner, and visibility. If none exists, ask only unresolved host/owner/visibility and prepare a private Git-backed repo when tools allow.
- Inventory existing brief, tracker, board, Project State, memory, branches, PRs, environments, deployment instructions, and accepted rules before creating new artifacts. Use the first real Project State create/update plus readback as the tracker write test; never create disposable probes.
- Resolve role-routed profiles on the latest available flagship: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, and efficient bounded for `EXECUTION`. Map to `Ultra / XHigh / Low` when available. Record actual model, all mappings, check date/source, and visible fallback; do not pin a universal model id.
- Create or update a compact Project Operating Brief: Git-backed repo, durable tracker, source of truth, coordination inputs, privacy, access coverage, safe first-DOD operational pointers, participants and role/decision scopes, owner/backup convention, agent routing, compass, DOD, initial plan, and first next action.
- For an existing project with meaningful history, route an early bounded read-only memory backfill from the accepted brief or earliest reliable baseline. Inventory high-signal human corrections, meeting decisions, pivots, open recall commitments, checkpoints, and accepted lessons; cluster by anchors, let later evidence supersede earlier meaning, deeply inspect only missing/ambiguous/conflicting clusters, and compare a side-by-side candidate. Require ordinary future-work queries to recover concrete meaning, source, return condition, and human gate before confirmed integration; never copy the full transcript or model narration into memory.
- Create Project State with the Project Activation Receipt, Shared Sync, participant readiness receipts, orchestrator links, framework/model state, tasks, active Alignment Window, one Project Memory Graph with stable anchors/atomic nodes/typed relations, and the tracker projection for `now / next / blocked / done`. Migrate an old graph only through a side-by-side read-only candidate, preserved ids/sources, practical retrieval comparison, visible delta, and human-confirmed cutover.
- Reuse the registered active orchestrator when healthy; create one only when absent and replace it only through confirmed rotation. Name it `[ORCHESTRATOR] <project> — Vydykhai <version>`, verify the actual title/profile, and pin or foreground exactly that one context. Project State owns the pointer; never leave two active contexts.
- Recommend GitHub Repo + Issues/Projects/PRs as the default sync space. Accept an equivalent only when it provides the same durable linked history, permissions, and participant/orchestrator writes.
- Commit the framework once into the project. Each participant's own orchestrator must prove its `doctor`, repo/tracker/input access, role, availability, and backup route through a readiness receipt; one machine cannot certify another.
- Prefer direct least-privilege coordination-input access for every relevant orchestrator. Otherwise name one intake owner and a traceable route from accessible meeting/chat/notes to an approved shared delta. Record gaps as `SYNC_LIMITED`; never claim complete alignment for affected work.
- Map only operations needed by the first DOD: environment/service owner, current deployed baseline/revision, complete protected pointer, merge/deploy authority, non-destructive check, backup/rollback, and stop conditions. Future-only access is `NOT_REQUIRED`; never request all credentials, store secret values, or treat merge as deploy.
- Detect and record the task Return Sync route: native cross-context message, shared-tracker event/hook, or one fallback monitor. Verify it on the first real dispatch by matching one receipt id through send, receive, consume, and routed next action, without a separate model run or human polling. Also record the scope-freshness interval; default to seven days.
- Treat meetings, recordings, transcripts, chat, and notes as raw coordination inputs until distilled and approved.
- Explain the working model plainly: the maximum-profile personal orchestrator decides what/why/when/who and what changed; deep-profile Discovery defines an unresolved solution; efficient-profile tasks execute a defined solution. Ordinary continue uses a lightweight hot path; tasks solve local failures and return only at declared triggers; acceptance and merge stay in the task. The orchestrator gives each task only executable `Because / Apply / Avoid / Verify / Source` memory items, investigates misses, integrates reusable candidates, and keeps tracker state current; people do not curate memory manually.
- Keep secret values out of Project State and shared memory. A protected pointer records owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition. Test only that route; incomplete pointers make the affected action `MEMORY_COVERAGE_GAP / BLOCKED` until repaired.
- Keep project-specific rules outside framework-managed files.
- A bootstrap request authorizes setup branch/PR and initial Project State. Otherwise ask before creating or changing shared-tracker artifacts.
- Route unclear goals through `$start-work` inside launch until the goal, first DOD, and initial route are accepted; recent meeting changes go to `$daily-alignment`, and ready work to `$framework-orchestrator`.
- Do not implement, deploy, smoke, or merge from the launch/orchestrator context.

## Finish

Publish and read back one Project Activation Receipt. Return `PROJECT_READY` only when every gate required by the first DOD passes; use `PROJECT_READY_WITH_LIMITS` for non-critical named gaps, `NEEDS_DECISION` for a real human choice, or `BLOCKED_BY_ACCESS` when access prevents the first safe route.

Include gate evidence, Project State, compass/DOD, Shared Sync, participants, operational readiness for the first DOD, active orchestrator registration, safe limits, first route, and exact next action. Never finish at a setup summary without next-best-action.
