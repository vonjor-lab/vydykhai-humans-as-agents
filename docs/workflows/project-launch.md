# Project Launch Workflow

Goal: establish the minimum operating system before implementation starts.

## Preflight

1. Confirm the target product repo and agent working directory.
2. Run `node scripts/vydykhai.mjs doctor` when the kit is installed.
3. If missing and the user supplied the canonical link, execute `BOOTSTRAP.md` yourself before planning tasks. Ask only for missing access or target identity.
4. Confirm framework-managed files can be committed and pulled by the team.
5. Keep project rules outside managed files and the managed `AGENTS.md` block.
6. Resolve `latest available flagship / deepest bounded reasoning`; record actual model, environment mapping, check date/source, and any fallback.
7. Resolve task return in this order: native cross-context message, shared-tracker event/hook, then one fallback monitor. Record the mapping and test it without asking people to poll.

## Project Operating Brief

Capture only:

- project and target repo;
- product goal and first useful outcome;
- users or actors;
- non-goals and constraints;
- source of truth and privacy boundary;
- coordination inputs: meetings, recordings, chat, docs, or manual notes;
- participants, decision owner, owner/backup convention, and availability;
- agent profile policy, resolved model, check date/source, and visible fallback rule;
- agent environment adapter and context mapping;
- task Return Sync mapping and scope-freshness interval;
- first milestone DOD;
- open decisions and immediate risks.

Treat coordination inputs as raw until distilled and approved.

## Project State

Create or update one compact Project State using `project-state-template.md`.

Keep an Idea Memory pointer in Project State. Create the shared Idea Memory only when the first confirmed idea must be preserved; it may be a compact Project State section or one linked current-state artifact.

Register each participant with:

- active orchestrator context link/title;
- installed framework version;
- resolved agent profile and last check;
- latest alignment packet;
- active task;
- current status.

Do not store a permanent orchestrator context id in universal or project-wide framework rules. Project State owns the current pointer and can replace it during rotation.

Rotation does not replace that pointer automatically. Project State records the previous context, read-only candidate, Rotation Memory Packet, candidate Memory Coverage Check, and explicit human confirmation before the switch.

## Team Onboarding

Explain:

- ask the personal orchestrator to start, continue, process a meeting, or check work;
- keep research, lab, and implementation in separate contexts;
- finish tasks with `$accept-work` in the task context;
- perform manual smoke and merge in the task context after human confirmation;
- let the chosen shared tracker carry durable state between people and agents;
- let task contexts return checkpoints, blockers, and terminal results automatically; people should not poll them;
- say useful ideas freely: the orchestrator protects the nearest DOD, stores confirmed future ideas, and recalls them at relevant planning;
- expect setup, update, `doctor`, skill routing, adapter setup, and context launch to be agent-owned rather than manual command work.

## First Route

- Use `$start-work` for a raw or large goal.
- Use `$daily-alignment` when recent coordination inputs may already have changed direction.
- Use `$framework-orchestrator` when an approved task is ready.
- Return `NEEDS_DECISION` when source of truth, access, ownership, or DOD is unclear.

Do not implement in the launch context.

## Finish

Report Project State, compass/DOD, participants, active orchestrator context registration, framework/adapter status, first route, and one exact next action.
