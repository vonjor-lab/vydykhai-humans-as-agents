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

- Do not treat a link to the standalone framework repo as activation. The framework is active only after the framework kit is imported into the target repo, committed, pulled by the team, and this Codex session starts from that target repo.
- If the target repo is missing `.agents/skills`, `docs/codex-workflows`, framework docs, changelog, or AGENTS core rules, stop and give the human the exact bootstrap steps before planning implementation.
- Treat meeting recordings, transcripts, team chat, docs, and manual notes as one coordination input layer.
- Create a compact Project Operating Brief: repo, source of truth, team, decision owner, owners/backups, coordination sources, privacy constraints, compass, DOD, and first next action.
- Record the framework upstream when importing into a product repo. The standalone framework repo is the canonical source; product-local copies are execution mirrors.
- Keep product-specific rules in the target repo's `AGENTS.md`, project docs, or local runbooks instead of silently changing universal framework rules.
- Treat Codex as the reference implementation. When the team uses another harness, document the adapter: separate task context, context id/link, shared memory, verification/smoke path, and handoff location.
- Explain onboarding plainly: personal orchestrator thread for organization, separate task threads for implementation, GitHub shared memory for durable state.
- Do not implement, fix, deploy, smoke test, or merge inside the launch/orchestrator thread.
- Ask for human approval before creating or updating GitHub issues, labels, milestones, docs, or shared-memory artifacts.
- Route large or vague work to `$start-work`; route recent meeting/chat changes to `$daily-alignment`; route ready execution to `$framework-orchestrator`.
- Verify that the new standing thread is the personal Framework Orchestrator thread for the project or product stream. It is not a Git branch and not an implementation task thread.

## User-Facing Outcome

End with one status:

- ready for start-work;
- ready for orchestrator;
- needs decision;
- blocked by access.

Include the operating brief location, coordination sources, source of truth, first DOD rows, and next action.
