# AGENTS.md

## Purpose

This repository is the canonical source for the universal Vydykhai collaboration framework. Keep it concise, reusable, safe to publish, and independent of any product repository or private thread.

## Maintenance Rules

- Treat `vydykhai.json` as the machine-readable version and managed-path manifest.
- Keep `docs/FRAMEWORK.md` and `docs/FRAMEWORK_RU.md` aligned in meaning and version.
- Record conceptual changes in `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`.
- Keep the dated framework files as compatibility pointers only. Preserve detailed pre-1.5 material through Git tags instead of duplicating it in the active tree.
- Keep `.agents/skills` concise. Skills load `docs/FRAMEWORK.md` plus only the workflow needed for the current action.
- Keep `docs/AGENTS_CORE.md`, skill contracts, and workflows behaviorally aligned.
- Keep `BOOTSTRAP.md` as the agent-owned installation contract. Human-facing setup should remain one natural-language request, not a list of shell commands.
- Default to `latest available flagship / xhigh`. Resolve the actual model in Project State and make fallback visible; never hardcode a model version in universal runtime rules.
- Product-local copies are execution mirrors. Universal changes land here first, then product repos update through `scripts/vydykhai.mjs`.
- Product-specific rules stay outside framework-managed files in the target repo.
- Do not add product names, customer data, meeting transcripts, credentials, proprietary prompts, internal thread ids, or implementation details from another repository.
- Prefer deleting duplication over adding another rule or skill.
- The Framework Orchestrator is organization-only. Task threads own implementation, corrective fixes, `$accept-work`, exact-current-code smoke, and manual merge after human confirmation.
- Preserve source precedence, explicit human checkpoints, asynchronous participant visibility, dashboard freshness, monitor cleanup, and orchestrator rotation.
- Treat orchestrator rotation as a memory migration: previous packet, independent candidate coverage, visible delta, human-confirmed switch, and retained history thread.
- Run `node scripts/validate-framework.mjs` and `node --test tests/*.test.mjs` before committing.
- Run `git diff --check` before committing documentation changes.

## Repo Skills

- `.agents/skills/project-launch/SKILL.md`
- `.agents/skills/framework-orchestrator/SKILL.md`
- `.agents/skills/start-work/SKILL.md`
- `.agents/skills/daily-alignment/SKILL.md`
- `.agents/skills/accept-work/SKILL.md`
