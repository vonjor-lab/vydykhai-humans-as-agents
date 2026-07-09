# Project Launch Workflow

Goal: establish the minimum operating system before implementation starts.

## Preflight

1. Confirm the target product repo and session cwd.
2. Run `node scripts/vydykhai.mjs doctor` when the kit is installed.
3. If missing, install from the canonical repo before planning tasks.
4. Confirm framework-managed files can be committed and pulled by the team.
5. Keep project rules outside managed files and the managed `AGENTS.md` block.

## Project Operating Brief

Capture only:

- project and target repo;
- product goal and first useful outcome;
- users or actors;
- non-goals and constraints;
- source of truth and privacy boundary;
- coordination inputs: meetings, recordings, chat, docs, or manual notes;
- participants, decision owner, owner/backup convention, and availability;
- project model/reasoning profile and visible fallback rule;
- first milestone DOD;
- open decisions and immediate risks.

Treat coordination inputs as raw until distilled and approved.

## Project State

Create or update one compact Project State using `project-state-template.md`.

Register each participant with:

- active orchestrator link/title;
- installed framework version;
- latest alignment packet;
- active task;
- current status.

Do not store a permanent orchestrator thread id in universal or project-wide framework rules. Project State owns the current pointer and can replace it during rotation.

## Team Onboarding

Explain:

- ask the personal orchestrator to start, continue, process a meeting, or check work;
- keep research, lab, and implementation in separate contexts;
- finish tasks with `$accept-work` in the task thread;
- perform manual smoke and merge in the task thread after human confirmation;
- let GitHub or the chosen tracker carry durable state between people and agents.

## First Route

- Use `$start-work` for a raw or large goal.
- Use `$daily-alignment` when recent coordination inputs may already have changed direction.
- Use `$framework-orchestrator` when an approved task is ready.
- Return `NEEDS_DECISION` when source of truth, access, ownership, or DOD is unclear.

Do not implement in the launch context.

## Finish

Report Project State, compass/DOD, participants, active orchestrator registration, framework status, first route, and one exact next action.
