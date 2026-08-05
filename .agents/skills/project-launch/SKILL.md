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
- Resolve `latest available flagship / deepest bounded reasoning` from current environment availability or authoritative guidance. Record actual model, reasoning mapping, check date/source, and visible fallback; do not pin a universal model id.
- Create or update a compact Project Operating Brief: Git-backed repo, durable tracker, source of truth, coordination inputs, privacy, access coverage, safe operational source pointers, participants, decision owner, owner/backup convention, agent profile, compass, DOD, and first next action.
- Create Project State with Shared Sync, participants, orchestrator links, framework/model state, tasks, active Alignment Window, and pointers for Idea Memory and Intent Trail ready for their first confirmed idea or meaningful cross-context intent/pivot.
- Recommend GitHub with Issues and PRs as the default sync space. Accept an equivalent only when every participant and orchestrator can reach stable linked history and write their own updates.
- Test human and orchestrator access to the repo/tracker and relevant meeting inputs with least privilege. Record gaps as `SYNC_LIMITED`; never claim complete alignment for affected work.
- Detect and record the task Return Sync route: native cross-context message, shared-tracker event/hook, or one fallback monitor. Also record the scope-freshness interval; default to seven days.
- Treat meetings, recordings, transcripts, chat, and notes as raw coordination inputs until distilled and approved.
- Explain the working model plainly: personal orchestrator for organization; separate research/lab/task contexts; automatic task return; task-context acceptance and merge; DOD Focus; Idea Memory; and the Intent Trail decision map. The orchestrator recalls relevant decisions before work and learns reusable deltas afterward; people do not curate memory manually.
- Keep secret values out of Project State and shared memory. Record only least-privilege references to protected secret systems, private runbooks, environments, owners, backup/restore routes, and last safe access checks.
- Keep project-specific rules outside framework-managed files.
- A bootstrap request authorizes setup branch/PR and initial Project State. Otherwise ask before creating or changing shared-tracker artifacts.
- Route unclear goals to `$start-work`, recent meeting changes to `$daily-alignment`, and ready work to `$framework-orchestrator`.
- Do not implement, deploy, smoke, or merge from the launch/orchestrator context.

## Finish

Return one status: `READY_FOR_START_WORK`, `READY_FOR_ORCHESTRATOR`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`.

Include Project State, compass/DOD, Shared Sync readiness, participants, active orchestrator context registration, and exact next action.
