# AGENTS.md

## Purpose

This repository contains the standalone Codex Collaboration Framework. Keep it generic, reusable, and safe to share later.

## Rules

- When changing the framework, update the version header in both language versions and add a conceptual entry to `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`.
- Keep the Russian and English framework documents aligned in meaning.
- Keep repo-scoped skills under `.agents/skills` aligned with the workflows under `docs/codex-workflows`.
- Do not add private product names, customer data, meeting transcripts, credentials, proprietary prompts, or implementation details from another repository.
- Prefer concise operational rules over long narrative history.
- If a workflow change affects how Codex should act, update both the workflow document and the matching skill contract.
- The Framework Orchestrator is organization-only: no product-code implementation, deploy, acceptance smoke, or merge from the orchestrator thread.
- Task threads own implementation, `$accept-work`, fresh current-branch smoke when required, and manual merge after human smoke.
- Treat Codex as the reference implementation. For other agent harnesses, document the adapter mapping before claiming the framework is active there.
- Run `git diff --check` before committing documentation changes.

## Repo Skills

- Use `.agents/skills/project-launch/SKILL.md` for starting a project or importing the framework into a target repo.
- Use `.agents/skills/framework-orchestrator/SKILL.md` for orchestration behavior.
- Use `.agents/skills/start-work/SKILL.md` for turning broad topics into epics and task maps.
- Use `.agents/skills/daily-alignment/SKILL.md` for meeting and event alignment.
- Use `.agents/skills/accept-work/SKILL.md` for acceptance checks.
