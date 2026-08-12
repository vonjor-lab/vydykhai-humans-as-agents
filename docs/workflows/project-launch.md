# Project Launch Workflow

Goal: establish the minimum operating system before implementation starts.

## Preflight

1. Confirm the target product repo and agent working directory.
2. Run `node scripts/vydykhai.mjs doctor` when the kit is installed.
3. If missing and the user supplied the canonical link, execute `BOOTSTRAP.md` yourself before planning tasks. Ask only for missing access or target identity.
4. Confirm a shared Git-backed project repo and durable tracker exist; recommend GitHub with Issues and PRs, including for non-code work.
5. Confirm framework-managed files can be committed and pulled by the team.
6. Keep project rules outside managed files and the managed `AGENTS.md` block.
7. Resolve role-routed profiles on the latest available flagship: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, and efficient bounded for `EXECUTION`; record actual model, environment mappings, check date/source, and any fallback.
8. Resolve task return in this order: native cross-context message, shared-tracker event/hook, then one fallback monitor. Record the mapping and test it without asking people to poll.

## Project Operating Brief

Capture only:

- project and target repo;
- product goal and first useful outcome;
- users or actors;
- non-goals and constraints;
- shared Git-backed repo, durable tracker, source of truth, and privacy boundary;
- coordination inputs and access route: meetings, recordings, transcripts, chat, docs, or manual notes;
- safe operational sources: environments/services, owner, secret-manager references, runbooks, backup/restore routes, and last access check, never secret values;
- Shared Sync readiness and missing human/agent access;
- participants, decision owner, owner/backup convention, and availability;
- agent routing policy, resolved model and three role mappings, check date/source, and visible fallback rule;
- agent environment adapter and context mapping;
- task Return Sync mapping and scope-freshness interval;
- first milestone DOD and the tracker projection for `now / next / blocked / done`;
- open decisions and immediate risks.

Treat coordination inputs as raw until distilled and approved.

Use Fathom as the recommended meeting recorder when available. Read AI, tl;dv, another recorder, team chat, or manual notes are valid when every relevant orchestrator can read the source. Treat Obsidian or another local notebook as an input/view unless it is shared, versioned, and agent-accessible.

## Project State

Create or update one compact Project State using `project-state-template.md`.

Create one Project Memory Graph using `project-memory-graph-template.md` when the first reusable decision, idea, lesson, or safe operational pointer must survive its source context. Start stable anchors for outcomes, actors, product entities, surfaces, contracts, data, and operations as they become relevant; keep one meaning per memory node and link operational knowledge to protected runbooks or secret systems. For an upgraded graph, build a side-by-side read-only candidate, preserve ids and sources, compare current/upcoming/prior-miss plus one grounded historical retrieval scenario, show loss/conflict/delta, and switch only after human confirmation. Map existing Idea Memory and Intent Trail ids before marking them legacy/read-only.

Configure one lightweight tracker projection. The task issue body is the current contract; Project State holds the route; the board or equivalent shows `Todo`, `Next`, `In Progress`, `In Review`, `Blocked`, `Done`, and `Parked`. Record owner, priority, formal parent/dependencies where supported, milestone or delivery window, checkpoint, and PR/artifact. Keep views compact and use fixed sprints only when the team actually needs them.

Register each participant with:

- active orchestrator context link/title;
- installed framework version;
- resolved agent routing and last check;
- latest alignment packet;
- active task;
- current status;
- repo/tracker/input access status.

Do not store a permanent orchestrator context id in universal or project-wide framework rules. Project State owns the current pointer and can replace it during rotation.

Rotation does not replace that pointer automatically. Project State records the previous context, read-only candidate, Rotation Memory Packet, candidate Memory Coverage Check, explicit human confirmation, and visible cutover status. After the switch, the new context is foregrounded/pinned when supported; the old context is renamed, unpinned, and left with a final retirement notice and active link.

## Team Onboarding

Explain:

- ask the personal orchestrator to start, continue, process a meeting, or check work; ordinary continue uses a lightweight hot path rather than restarting alignment or planning;
- after a meaningful meeting, each relevant participant processes it asynchronously when they next resume; no fixed order is required;
- keep research, lab, and implementation in separate contexts; the orchestrator decides what/why/when/who, while a task decides how to implement and prove its accepted increment;
- finish tasks with `$accept-work` in the task context;
- perform manual smoke and merge in the task context after human confirmation;
- let the chosen shared tracker carry durable state between people and agents and expect its `now / next / blocked / done` view to match Project State;
- confirm that both the person and their orchestrator can reach the shared repo/tracker and relevant meeting inputs; otherwise expect `SYNC_LIMITED` rather than full alignment;
- let task contexts solve ordinary failures themselves and return only named human checkpoints, irreducible blockers, and terminal results automatically; people should not poll them;
- say useful ideas and corrections freely: the orchestrator protects the nearest DOD, investigates whether known meaning was absent, not retrieved, not applied, or not verified, and repairs the shared graph plus affected work;
- expect every task to start with short `Because / Apply / Avoid / Verify / Source` memory items and finish with their application result plus `NO_MEMORY_DELTA` or compact candidates; people do not tag or curate memory manually;
- expect setup, update, `doctor`, skill routing, adapter setup, and context launch to be agent-owned rather than manual command work.
- expect an orchestrator rotation to be announced before it starts and made visually obvious after confirmation; new coordination moves to the pinned replacement while the old context stays only as unpinned history.

## First Route

- Use `$start-work` for a raw or large goal.
- Use `$daily-alignment` when recent coordination inputs may already have changed direction.
- Use `$framework-orchestrator` when an approved task is ready.
- Return `NEEDS_DECISION` when source of truth, access, ownership, or DOD is unclear.

Do not implement in the launch context.

## Finish

Report Project State, compass/DOD, Shared Sync readiness, participants, active orchestrator context registration, framework/adapter status, first route, and one exact next action.
