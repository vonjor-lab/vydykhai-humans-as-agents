# Vydykhai: Collaborative Vibe Coding with Humans as Agents

«Выдыхай» - это фреймворк совместной работы людей и AI-агентов. Он вырос из совместного вайбкодинга, но подходит и для более широкого vibe work: помогает группе превратить сырую цель в общий компас, разойтись по задачам без потери связности, сохранить возникающие идеи, принять результаты и снова собраться вокруг следующего шага. Люди остаются агентами смысла и решений, а AI-оркестратор поддерживает общую картину, последовательность, синки, приемку и next-best-action.

Vydykhai is a framework for collaborative work between people and AI agents. It grew out of collaborative vibe coding, but extends to broader vibe work: helping a group turn an unclear goal into a shared compass, split work without losing coherence, preserve emerging ideas, accept results, and reconverge around the next step. People remain agents of meaning and judgment, while the AI orchestrator maintains the shared picture, sequence, alignment, acceptance, and next-best-action.

Created and originally published by [Alexander Rozhnov / Александр Рожнов](https://github.com/vonjor-lab).

Current version: `1.12.0`

License: [PolyForm Small Business 1.0.0](LICENSE.md); [separate commercial licensing](COMMERCIAL-LICENSING.md) is available.

## Give This To Your Agent

Open your coding agent in the project you want to build and send one message:

```text
Подключи Vydykhai к этому проекту и запусти оркестратор. Сам определи возможности своей агентской среды и выполни BOOTSTRAP.md; спрашивай меня только о недостающем доступе или решении: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

That is the normal installation path. The agent identifies the target repo, installs and validates the framework, prepares the setup change, creates Project State, and starts the dedicated orchestrator. A bare URL is not enough to express intent; the one sentence above is.

If the project is still only an idea and has no repository, send the same request. The agent asks only for unresolved host, owner, or visibility and prepares a private Git-backed operating repo when its tools allow.

The human may still need to grant repository/network access or approve merge. They should not need to clone repositories, run installer commands, choose skills, or copy prompts.

## Start Here

- Russian operating core: [`docs/FRAMEWORK_RU.md`](docs/FRAMEWORK_RU.md)
- English operating core: [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md)
- Changelog: [`docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`](docs/COLLABORATION_FRAMEWORK_CHANGELOG.md)
- Origin and provenance: [`docs/PROVENANCE.md`](docs/PROVENANCE.md)
- Ownership notice: [`NOTICE.md`](NOTICE.md)
- Citation metadata: [`CITATION.cff`](CITATION.cff)
- Workflow index: [`docs/workflows/README.md`](docs/workflows/README.md)
- Repo-scoped skills: [`.agents/skills`](.agents/skills)
- Agent bootstrap contract: [`BOOTSTRAP.md`](BOOTSTRAP.md)

Historical snapshots remain available through Git releases and tags. Current skills load only the current operating core.

## How It Works

- Start with a rough goal. The orchestrator helps brainstorm it into a shared compass, brief, and nearest DOD.
- The orchestrator turns approved direction into focused tasks while keeping implementation out of the coordination context.
- A task continues the accepted product mechanism. It consults the orchestrator only at an undeclared boundary; Research or Lab is used only when uncertainty, cost, or risk justifies it.
- Meetings and asynchronous local work converge through shared Git-backed state. An absent participant blocks only overlapping work.
- Each result is verified and accepted against the current artifact or exact code, then returned to the orchestrator.
- The orchestrator updates DOD progress and next-best-action, preserves useful future ideas and meaningful human intent, and runs health review or rotation only when needed.

People normally speak only to their orchestrator in natural language. Vydykhai uses native context creation, messaging, and UI controls when the harness supports them; otherwise it uses the shared tracker and gives one exact human action. It never treats a missing harness capability as completed automation.

## Install Into A Project

Give the agent the request above from a task attached to the target project. [`BOOTSTRAP.md`](BOOTSTRAP.md) contains the deterministic setup contract and the installer remains an internal implementation detail.

The installer writes only framework-managed files and one marked block in the target `AGENTS.md`. Project-specific rules stay outside that block. The agent reviews and validates the diff, prepares the setup branch or PR, and leaves merge under the project's normal policy.

The orchestrator applies `$project-launch`, registers the project and participants, creates the first compass and DOD, and chooses the next route. People do not need to select skills manually afterward.

## Shared Sync

Distributed Vydykhai needs one shared Git-backed project repo and durable tracker, even when the work is research, writing, design, or another non-code form of vibe work. GitHub with Issues and PRs is the recommended and best-supported default. Another host or tracker is valid if it gives stable links, history, access control, participant-owned updates, and read/write access to each participant's orchestrator.

At launch, the agent records and tests this sync space plus the meeting-input route. Fathom is the recommended recorder when available; Read AI, tl;dv, another transcript service, team chat, or an approved manual summary can provide the same input. A local notebook such as Obsidian remains an input or view unless it is shared, versioned, and agent-accessible.

After a meaningful meeting, each relevant participant can say `Process the latest meeting.` whenever they next resume. Their orchestrator reads the configured source, publishes only the material local delta, reconciles available packets in the tracker, and states what can continue; no fixed order or simultaneous attendance is required.

Give every person and agent only the access they need; never share credentials or use public-by-link access for private meeting material. If someone cannot reach the repo, tracker, or relevant meeting source, the orchestrator marks `SYNC_LIMITED`, names the missing visibility, and does not claim complete alignment for overlapping work.

## Update And Diagnose

Tell the orchestrator: `Update Vydykhai and verify this project.` It runs `doctor` and `update` itself. `doctor` checks installed version, managed-file integrity, the `AGENTS.md` block, upstream version, and the default agent policy. `update` preserves project-specific files and stops before overwriting locally modified managed files unless explicitly approved.

## Agent Profile

Vydykhai defaults to `latest available flagship / deepest bounded reasoning`: the strongest broadly capable coding and agentic model available to that participant, using the environment's deepest stable reasoning mode that does not imply an unbounded cost tier. It records the resolved model and check date in Project State and rechecks at setup, framework update, orchestrator rotation, model rejection/deprecation, and at least weekly while the project is active.

The framework does not pin today's model id, so a future flagship can replace it. If discovery or the preferred model is unavailable, the orchestrator uses the best verified fallback only after making that fallback visible. A human can explicitly choose a cheaper or faster profile for a named scope.

When an environment exposes Extra High / `xhigh`, use it as the default mapping. A materially more expensive Max, Ultra, or unbounded tier still requires an explicit human scope decision.

## Human Interface

The normal interface is one personal orchestrator context and natural language:

```text
Start this project.
Continue this stream.
Process the latest meeting.
Check the work and continue.
What else could we do here?
```

The orchestrator chooses `$start-work`, `$daily-alignment`, `$accept-work`, Research Context, Lab Mode, Peer Compass Review, task dispatch, health review, or rotation as needed.

## Canonical Source

This repository is the canonical source for universal Vydykhai rules, workflows, skills, and tooling. Product repositories contain execution mirrors. Universal changes land here first; product-specific rules belong in the product repo outside framework-managed files.

## Agent Environments

Vydykhai is not tied to one agent product. Its canonical behavior lives in `AGENTS.md`, `.agents/skills/*/SKILL.md`, and `docs/workflows`. Bootstrap maps the current environment to:

- project instructions;
- native skill/rule invocation or a thin adapter;
- separate resumable agent contexts;
- stable context links or ids;
- shared durable memory;
- verification and exact-current-code smoke;
- handoff and acceptance results.

A context may be implemented as a thread, chat, session, run, workspace, or tracker-linked agent. If native skill discovery or context creation is unavailable, bootstrap creates the smallest native adapter that points to the canonical files and records the mapping in Project State. It must not duplicate the framework logic.

Files such as `agents/openai.yaml` are optional interface adapters. They do not own skill behavior and may be ignored by other environments.

## Privacy And Ownership

The public repository contains only reusable framework mechanics. Do not add meeting transcripts, credentials, customer data, proprietary prompts, private product details, or internal thread links.

Vydykhai is source-available under the [PolyForm Small Business License 1.0.0](LICENSE.md). Qualifying small businesses may use, change, and redistribute covered framework material under its terms, including the required attribution. For uses not covered by that grant, request a [separate written commercial license](COMMERCIAL-LICENSING.md).

The license follows framework-managed documentation, skills, workflows, scripts, and templates imported into a product repository. It does not claim ownership of that product's code, data, private instructions, meeting records, or outputs.

Preserve the required notice: [`NOTICE.md`](NOTICE.md) in the canonical source or `docs/VYDYKHAI_NOTICE.md` in an installed framework copy. The software license does not grant rights in the project names or identity described in [`TRADEMARKS.md`](TRADEMARKS.md). External contributions follow [`CONTRIBUTING.md`](CONTRIBUTING.md).
