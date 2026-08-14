# Vydykhai: Team Autopilot for People and AI

«Выдыхай» - командный автопилот для людей, которые работают над одним проектом, каждый со своим AI. Участники могут использовать разные компьютеры, модели и агентные среды: Vydykhai связывает их личных оркестраторов общим брифом, памятью, задачами и приемкой. Работа, сделанная отдельно, сходится в один результат, а участники не ломают изменения друг друга. Люди задают цель и принимают смысловые решения; оркестраторы держат общий маршрут и следующий шаг.

Vydykhai is a team autopilot for people working on one project, each with their own AI. Participants may use different computers, models, and agent environments: Vydykhai connects their personal orchestrators through a shared brief, memory, tasks, and acceptance process. Work done separately converges into one result without participants breaking one another's changes. People set the goal and make judgment calls; orchestrators maintain the shared route and next step.

Created and originally published by [Alexander Rozhnov / Александр Рожнов](https://github.com/vonjor-lab).

Current version: `1.19.2`

License: [PolyForm Small Business 1.0.0](LICENSE.md); [separate commercial licensing](COMMERCIAL-LICENSING.md) is available.

## Что изменится для вас

- Вы можете сказать идею, уточнение или «давай по-другому» один раз. Оркестратор разберется, что именно изменилось, обновит общую память и проверит, какие текущие или будущие задачи это затрагивает.
- Каждая новая задача получает короткие применимые указания: что делать, чего не повторять и как проверить результат. Исполнитель не перечитывает историю проекта и не получает только непонятные ссылки на память.
- Принятые уроки одного участника становятся доступны оркестраторам остальных через общий репозиторий, а не остаются внутри личного чата.
- Три уровня контекстов не смешиваются: канонический репозиторий развивает только универсальную формулу, проектный оркестратор только организует один проект, а вся работа выполняется в отдельных task, discovery, lab или maintenance contexts.
- Команда или правильный план больше не считаются выполненным переходом сами по себе: оркестратор проверяет фактический запуск и возврат результата, а выполняющая task - свой защищенный доступ, приемку и live-действие. Следующий шаг не строится на неподтвержденном состоянии, и проверка не дублируется.
- GitHub показывает реальное `сейчас / дальше / заблокировано / готово`; встречи и локальная работа меняют эту картину только при существенном событии.
- Оркестратор время от времени проверяет рабочие хвосты: у каждой открытой задачи, PR, ветки или task context должна быть понятная роль и выход. Забытое не копится молча и не удаляется без проверки.
- Человек занимается целью, оценкой результата и необходимыми решениями. Поддержание памяти, связей задач и следующего действия берет на себя оркестратор.

## What Changes for You

- Say an idea, correction, or change of approach once. The orchestrator investigates what changed, updates shared memory, and checks which current or future tasks are affected.
- Each task receives short applicable instructions: what to do, what not to repeat, and how to verify the result. Execution does not reread project history or receive opaque memory references.
- One participant's accepted lessons become available to the other orchestrators through the shared repository instead of remaining trapped in a personal chat.
- Three context layers stay separate: the canonical repository evolves only the universal formula, a project orchestrator only organizes one project, and all work happens in separate task, discovery, lab, or maintenance contexts.
- A command or correct plan is no longer treated as a completed transition by itself: the orchestrator verifies actual launch and result return, while the executing task verifies its own protected access, acceptance, and live action. The next step never relies on unverified state, and verification is not duplicated.
- The tracker reflects the real `now / next / blocked / done` picture and changes only on material work events.
- The orchestrator periodically checks unfinished work: every open task, PR, branch, or task context needs a clear purpose and exit. Forgotten work neither accumulates silently nor gets deleted without proof.
- People own the goal, judgment, and approvals; the orchestrator owns memory, task coherence, and the next action.

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
- The orchestrator decides what/why/when/who and what changed; a focused task decides how to implement and prove one accepted increment.
- Reasoning follows the work: the orchestrator uses the strongest available profile, unresolved solution work uses a deep discovery profile, and a ready execution task uses the fast profile.
- A task continues the accepted product mechanism, resolves ordinary failures itself, and consults only at an undeclared boundary. Research or Lab is used only when uncertainty, cost, or risk justifies it.
- Meetings and asynchronous local work converge through shared Git-backed state. An absent participant blocks only overlapping work.
- Before work starts, the orchestrator resolves stable product anchors, follows their current decision and lesson links, and gives the task an executable Memory Brief: apply, avoid, verify, and source.
- A correction triggers a Memory Miss investigation instead of an apology-only patch. Each accepted result returns `NO_MEMORY_DELTA` or compact candidates; the orchestrator updates reusable meaning, affected work, the visible plan, and next-best-action.

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

During normal activity, each participant's orchestrator checks for a new Vydykhai version at most once every 24 hours. This is one small manifest request inside an already active session, not a background model run. When the version is current it stays silent. When a newer version exists, it reads every changelog entry after the installed version through the latest, oldest to newest. It reports `installed -> latest` and the number of releases, gives one concise product-impact line for every skipped release, then explains the combined effect here and puts the safest update window into next-best-action: now before the next dispatch or after a named task/checkpoint.

The orchestrator records the plan in Project State so the team prepares one update rather than duplicate work. At the chosen window it prepares or reuses one update branch, runs `update` and `doctor`, opens or refreshes its PR, and reports the short delta. It never overwrites locally modified managed files, changes rules silently in the middle of active work, or merges outside the project's normal policy. A major migration or an update that affects current safety is raised explicitly; ordinary compatible updates do not force orchestrator rotation. If upstream cannot be reached, the check remains visibly pending without blocking otherwise safe work.

## Agent Profiles

Vydykhai uses one current flagship model with reasoning routed by role:

- **Orchestrator:** maximum available reasoning, mapped to `Ultra` where that label exists.
- **Discovery:** deep bounded reasoning for research, product/architecture decisions, and unresolved UX or visual direction, mapped to `XHigh` where available.
- **Execution:** efficient bounded reasoning for a fully briefed task, mapped to `Low` where available.

The labels are environment mappings, not vendor requirements. Bootstrap records the actual model, three mappings, check date, and fallback in Project State and rechecks them at setup, framework update, orchestrator rotation, model rejection/deprecation, and at least weekly while active. A human may override a profile for a named scope. Reasoning depth never replaces tests, smoke, acceptance, or human approval.

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

The public repository contains only reusable framework mechanics. Do not add meeting transcripts, credential or secret values, customer data, proprietary prompts, private product details, or internal context links. Project memory may retain only safe references to protected secret systems and private operational runbooks.

Vydykhai is source-available under the [PolyForm Small Business License 1.0.0](LICENSE.md). Qualifying small businesses may use, change, and redistribute covered framework material under its terms, including the required attribution. For uses not covered by that grant, request a [separate written commercial license](COMMERCIAL-LICENSING.md).

The license follows framework-managed documentation, skills, workflows, scripts, and templates imported into a product repository. It does not claim ownership of that product's code, data, private instructions, meeting records, or outputs.

Preserve the required notice: [`NOTICE.md`](NOTICE.md) in the canonical source or `docs/VYDYKHAI_NOTICE.md` in an installed framework copy. The software license does not grant rights in the project names or identity described in [`TRADEMARKS.md`](TRADEMARKS.md). External contributions follow [`CONTRIBUTING.md`](CONTRIBUTING.md).
