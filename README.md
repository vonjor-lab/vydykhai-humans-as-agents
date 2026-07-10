# Vydykhai: Collaborative Vibe Coding with Humans as Agents

«Выдыхай» - это фреймворк для совместного вайбкодинга, где люди определяют смысл и направление, а AI-оркестратор превращает сырую цель в компас, брифы, согласованные задачи, приемку и следующий лучший шаг.

Vydykhai is a framework for collaborative vibe coding with humans as agents: people carry meaning and judgment, while an AI orchestrator maintains the compass, task flow, alignment, acceptance, and next-best-action.

Current version: `1.5.2`

## Give This To Your Agent

Open a Codex task in the project you want to build and send one message:

```text
Подключи Vydykhai к этому проекту и запусти оркестратор. Все технические шаги сделай сам по BOOTSTRAP.md; спрашивай меня только о недостающем доступе или решении: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

That is the normal installation path. The agent identifies the target repo, installs and validates the framework, prepares the setup change, creates Project State, and starts the dedicated orchestrator. A bare URL is not enough to express intent; the one sentence above is.

The human may still need to grant repository/network access or approve merge. They should not need to clone repositories, run installer commands, choose skills, or copy prompts.

## Start Here

- Russian operating core: [`docs/FRAMEWORK_RU.md`](docs/FRAMEWORK_RU.md)
- English operating core: [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md)
- Changelog: [`docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`](docs/COLLABORATION_FRAMEWORK_CHANGELOG.md)
- Workflow index: [`docs/codex-workflows/README.md`](docs/codex-workflows/README.md)
- Repo-scoped skills: [`.agents/skills`](.agents/skills)
- Agent bootstrap contract: [`BOOTSTRAP.md`](BOOTSTRAP.md)

The detailed 1.4.8 documents remain available through the `v1.4.8` Git tag. Current skills do not load them.

## What It Does

- Helps brainstorm an unclear idea into a product compass and brief.
- Turns large topics into epics and autonomous task contracts.
- Keeps implementation in focused task threads and orchestration in one clean control thread.
- Reconciles meetings and asynchronous local work through durable shared state.
- Calls humans only at explicit product, visual, paid-action, smoke, or merge checkpoints.
- Checks product-loop closure, DOD burn, exact-current-code smoke, and next-best-action.
- Rotates stale orchestrators, journals, monitors, and task contexts before they become hidden project memory.
- Preserves queued work, remembered nuances, promises, and working rules through a human-confirmed Memory Coverage Check before orchestrator rotation.

## Install Into A Project

Give the agent the request above from a task attached to the target project. [`BOOTSTRAP.md`](BOOTSTRAP.md) contains the deterministic setup contract and the installer remains an internal implementation detail.

The installer writes only framework-managed files and one marked block in the target `AGENTS.md`. Project-specific rules stay outside that block. The agent reviews and validates the diff, prepares the setup branch or PR, and leaves merge under the project's normal policy.

The orchestrator applies `$project-launch`, registers the project and participants, creates the first compass and DOD, and chooses the next route. People do not need to select skills manually afterward.

## Update And Diagnose

Tell the orchestrator: `Update Vydykhai and verify this project.` It runs `doctor` and `update` itself. `doctor` checks installed version, managed-file integrity, the `AGENTS.md` block, upstream version, and the default agent policy. `update` preserves project-specific files and stops before overwriting locally modified managed files unless explicitly approved.

## Agent Profile

Vydykhai defaults to `latest available flagship / xhigh`: the strongest broadly capable coding and agentic model available to that participant, using Extra High reasoning. It records the resolved model and check date in Project State and rechecks at setup, framework update, orchestrator rotation, model rejection/deprecation, and at least weekly while the project is active.

The framework does not pin today's model id, so a future flagship can replace it. If discovery or the preferred model is unavailable, the orchestrator uses the best verified fallback only after making that fallback visible. A human can explicitly choose a cheaper or faster profile for a named scope.

On Codex, bootstrap also prefers a project default of `xhigh` while leaving the model unpinned. This lets the recommended model advance without editing the framework, while Project State still records which model was actually used.

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
