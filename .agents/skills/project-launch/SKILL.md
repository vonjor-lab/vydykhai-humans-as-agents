---
name: project-launch
description: Activate Vydykhai in a new or existing project, reconnect a project with stale operating memory, onboard participants, define coordination sources, create the first compass and DOD, or start a personal Framework Orchestrator.
---

# Project Launch

Create the minimum shared operating system before implementation starts.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/project-launch.md`

Load `docs/workflows/start-work.md` only when the initial goal needs decomposition.

## Contract

- Run `node scripts/vydykhai.mjs doctor` when available.
- If the framework is not installed and the user supplied the canonical link, follow its `BOOTSTRAP.md` autonomously. Ask only for missing target/access; do not delegate setup commands to the human.
- Confirm the session runs from the target product repo.
- Resolve role-routed profiles on the latest available flagship: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, and efficient bounded for `EXECUTION`. Map to `Ultra / XHigh / Low` when available. Record actual model, all mappings, check date/source, and visible fallback; do not pin a universal model id.
- Create or update a compact Project Operating Brief: Git-backed repo, durable tracker, source of truth, coordination inputs, privacy, access coverage, safe operational source pointers, participants, decision owner, owner/backup convention, agent routing, compass, DOD, and first next action.
- Create Project State with Shared Sync, participants, orchestrator links, framework/model state, tasks, active Alignment Window, one Project Memory Graph with stable anchors/atomic nodes/typed relations, and the tracker projection for `now / next / blocked / done`. Migrate an old graph only through a side-by-side read-only candidate, preserved ids/sources, practical retrieval comparison, visible delta, and human-confirmed cutover.
- Recommend GitHub with Issues and PRs as the default sync space. Accept an equivalent only when every participant and orchestrator can reach stable linked history and write their own updates.
- Test human and orchestrator access to the repo/tracker and relevant meeting inputs with least privilege. Record gaps as `SYNC_LIMITED`; never claim complete alignment for affected work.
- Detect and record the task Return Sync route: native cross-context message, shared-tracker event/hook, or one fallback monitor. Verify it on the first real dispatch by matching one receipt id through send, receive, consume, and routed next action, without a separate model run or human polling. Also record the scope-freshness interval; default to seven days.
- Treat meetings, recordings, transcripts, chat, and notes as raw coordination inputs until distilled and approved.
- Explain the working model plainly: the maximum-profile personal orchestrator decides what/why/when/who and what changed; deep-profile Discovery defines an unresolved solution; efficient-profile tasks execute a defined solution. Ordinary continue uses a lightweight hot path; tasks solve local failures and return only at declared triggers; acceptance and merge stay in the task. The orchestrator gives each task only executable `Because / Apply / Avoid / Verify / Source` memory items, investigates misses, integrates reusable candidates, and keeps tracker state current; people do not curate memory manually.
- Keep secret values out of Project State and shared memory. A protected pointer records owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition. Test only that route; incomplete pointers make the affected action `MEMORY_COVERAGE_GAP / BLOCKED` until repaired.
- Keep project-specific rules outside framework-managed files.
- A bootstrap request authorizes setup branch/PR and initial Project State. Otherwise ask before creating or changing shared-tracker artifacts.
- Route unclear goals to `$start-work`, recent meeting changes to `$daily-alignment`, and ready work to `$framework-orchestrator`.
- Do not implement, deploy, smoke, or merge from the launch/orchestrator context.

## Finish

Return one status: `READY_FOR_START_WORK`, `READY_FOR_ORCHESTRATOR`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`.

Include Project State, compass/DOD, Shared Sync readiness, participants, active orchestrator context registration, and exact next action.
