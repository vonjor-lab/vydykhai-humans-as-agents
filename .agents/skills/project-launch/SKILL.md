---
name: project-launch
description: Activate Vydykhai in a new or existing project, reconnect a project with stale operating memory, onboard participants, define coordination sources, create the first compass and DOD, or start a personal Framework Orchestrator.
---

# Project Launch

Create the minimum shared operating system before implementation starts.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/codex-workflows/project-launch.md`

Load `docs/codex-workflows/start-work.md` only when the initial goal needs decomposition.

## Contract

- Run `node scripts/vydykhai.mjs doctor` when available.
- If the framework is not installed, stop task planning and give the exact install command.
- Confirm the session runs from the target product repo.
- Create or update a compact Project Operating Brief: repo, source of truth, coordination inputs, privacy, participants, decision owner, owner/backup convention, model profile, compass, DOD, and first next action.
- Create Project State with participant registry, active orchestrator links, installed framework versions, current tasks, and active Alignment Window.
- Treat meetings, recordings, transcripts, chat, and notes as raw coordination inputs until distilled and approved.
- Explain the working model plainly: personal orchestrator for organization; separate research, lab, and task threads; task-thread acceptance and merge; durable shared state.
- Keep project-specific rules outside framework-managed files.
- Ask for human approval before creating or changing shared GitHub artifacts.
- Route unclear goals to `$start-work`, recent meeting changes to `$daily-alignment`, and ready work to `$framework-orchestrator`.
- Do not implement, deploy, smoke, or merge from the launch/orchestrator context.

## Finish

Return one status: `READY_FOR_START_WORK`, `READY_FOR_ORCHESTRATOR`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`.

Include Project State, compass/DOD, participants, active orchestrator registration, and exact next action.
