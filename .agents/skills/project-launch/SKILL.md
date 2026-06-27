---
name: project-launch
description: Use when starting a new project, connecting this framework to an existing repository, onboarding a team into the framework, defining project coordination sources, or creating the first operating brief before tasks exist.
---

# Project Launch

Launch a project into the collaboration framework before implementation work begins.

## Required References

Read these files before acting:

1. `AGENTS.md`
2. `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
3. `docs/codex-workflows/project-launch.md`

Load `docs/codex-workflows/start-work.md` only when the launch needs epic decomposition or task mapping.

## Operating Contract

- Treat meeting recordings, transcripts, team chat, docs, and manual notes as one coordination input layer.
- Create a compact Project Operating Brief: repo, source of truth, team, decision owner, owners/backups, coordination sources, privacy constraints, compass, DOD, and first next action.
- Treat Codex as the reference implementation. When the team uses another harness, document the adapter: separate task context, context id/link, shared memory, verification/smoke path, and handoff location.
- Explain onboarding plainly: personal orchestrator thread for organization, separate task threads for implementation, GitHub shared memory for durable state.
- Do not implement, fix, deploy, smoke test, or merge inside the launch/orchestrator thread.
- Ask for human approval before creating or updating GitHub issues, labels, milestones, docs, or shared-memory artifacts.
- Route large or vague work to `$start-work`; route recent meeting/chat changes to `$daily-alignment`; route ready execution to `$framework-orchestrator`.
- If the framework was imported into another repo, verify that repo-scoped `.agents/skills` and `docs/codex-workflows` are present and that the Codex session started from the target repo.

## User-Facing Outcome

End with one status:

- ready for start-work;
- ready for orchestrator;
- needs decision;
- blocked by access.

Include the operating brief location, coordination sources, source of truth, first DOD rows, and next action.
