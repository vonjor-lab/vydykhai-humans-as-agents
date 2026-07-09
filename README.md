# Vydykhai: Collaborative Vibe Coding with Humans as Agents

«Выдыхай» - это фреймворк для совместного вайбкодинга, где люди определяют смысл и направление, а AI-оркестратор превращает сырую цель в компас, брифы, согласованные задачи, приемку и следующий лучший шаг.

Vydykhai is a framework for collaborative vibe coding with humans as agents: people carry meaning and judgment, while an AI orchestrator maintains the compass, task flow, alignment, acceptance, and next-best-action.

Current version: `1.5.0`

## Start Here

- Russian operating core: [`docs/FRAMEWORK_RU.md`](docs/FRAMEWORK_RU.md)
- English operating core: [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md)
- Changelog: [`docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`](docs/COLLABORATION_FRAMEWORK_CHANGELOG.md)
- Workflow index: [`docs/codex-workflows/README.md`](docs/codex-workflows/README.md)
- Repo-scoped skills: [`.agents/skills`](.agents/skills)

The detailed 1.4.8 documents remain available through the `v1.4.8` Git tag. Current skills do not load them.

## What It Does

- Helps brainstorm an unclear idea into a product compass and brief.
- Turns large topics into epics and autonomous task contracts.
- Keeps implementation in focused task threads and orchestration in one clean control thread.
- Reconciles meetings and asynchronous local work through durable shared state.
- Calls humans only at explicit product, visual, paid-action, smoke, or merge checkpoints.
- Checks product-loop closure, DOD burn, exact-current-code smoke, and next-best-action.
- Rotates stale orchestrators, journals, monitors, and task contexts before they become hidden project memory.

## Install Into A Project

A link to this repository does not activate repo-scoped skills. Install the framework kit into the product repository:

```bash
git clone https://github.com/vonjor-lab/vydykhai-humans-as-agents.git
node vydykhai-humans-as-agents/scripts/vydykhai.mjs install /path/to/product-repo
```

The installer writes only framework-managed files and one marked block in the target `AGENTS.md`. Project-specific rules stay outside that block.

Then:

1. Review and commit the installed files.
2. Let every participant pull them.
3. Start a new Codex thread from the product repo.
4. Say: `Start this project with Vydykhai.`

The orchestrator applies `$project-launch`, registers the project and participants, creates the first compass and DOD, and chooses the next route. People do not need to select skills manually afterward.

## Update And Diagnose

From an installed product repository:

```bash
node scripts/vydykhai.mjs doctor
node scripts/vydykhai.mjs update
```

`doctor` checks the installed version, managed-file integrity, `AGENTS.md` block, and upstream version when network access is available. `update` pulls the current canonical kit, preserves project-specific files, and stops before overwriting locally modified managed files unless explicitly forced.

## Human Interface

The normal interface is one personal orchestrator and natural language:

```text
Start this project.
Continue this stream.
Process the latest meeting.
Check the work and continue.
```

The orchestrator chooses `$start-work`, `$daily-alignment`, `$accept-work`, Research Thread, Lab Mode, Peer Compass Review, task dispatch, health review, or rotation as needed.

## Canonical Source

This repository is the canonical source for universal Vydykhai rules, workflows, skills, and tooling. Product repositories contain execution mirrors. Universal changes land here first; product-specific rules belong in the product repo outside framework-managed files.

## Other Agent Harnesses

The reference implementation is Codex-first. Another harness can use the operating model when it provides equivalents for:

- project instructions;
- separate resumable task contexts;
- stable context links or ids;
- shared durable memory;
- verification and exact-current-code smoke;
- handoff and acceptance results.

When resumable threads are unavailable, use issue or PR links as task handles and preserve the orchestrator/implementation split as a team convention.

## Privacy And License

The public repository contains only reusable framework mechanics. Do not add meeting transcripts, credentials, customer data, proprietary prompts, private product details, or internal thread links.

No reuse license has been selected yet. The source is publicly visible, but redistribution and reuse terms remain ungranted until a license is added.
