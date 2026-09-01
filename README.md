# Vydykhai: Team Autopilot for People and AI

«Выдыхай» - командный автопилот для людей, которые работают над одним проектом, каждый со своим AI. Он связывает разные компьютеры, модели и агентные среды в один общий курс: цель, память, задачи и приемку. Работа, сделанная отдельно, сходится в один результат, а участники не ломают изменения друг друга.

Vydykhai полезен и одному человеку, который ведет проект через несколько AI-сессий, и особенно команде, где у каждого свои инструменты. После подключения каждый участник общается со своим оркестратором обычным языком; оркестраторы сами поддерживают общий маршрут, организуют сфокусированную работу, собирают результаты и возвращают проект к ближайшему проверяемому результату (DOD), если работа остановилась или разошлась.

Vydykhai is a team autopilot for people working on one project, each with their own AI. It connects different computers, models, and agent environments through one shared course: goal, memory, tasks, and acceptance. Work done separately converges into one result without participants breaking one another's changes.

Vydykhai helps a solo builder working across several AI sessions and becomes especially valuable when each team member uses different tools. After setup, every participant speaks naturally to their own orchestrator; the orchestrators maintain the shared route, organize focused work, collect results, and return the project to its nearest verifiable outcome (DOD) when work stalls or diverges.

Created and originally published by [Alexander Rozhnov / Александр Рожнов](https://github.com/vonjor-lab).

Current version: `1.24.1`

License: [PolyForm Small Business 1.0.0](LICENSE.md); [separate commercial licensing](COMMERCIAL-LICENSING.md) is available.

## Что Vydykhai берет на себя

- **Организует путь к результату.** Превращает сырую цель в общий бриф, ближайший DOD, ограниченные задачи и одно понятное следующее действие.
- **Сводит людей и разные AI в одну работу.** Участники могут действовать асинхронно на своих компьютерах и в своих агентных средах; общий репозиторий связывает их планы, результаты и приемку.
- **Включает людей как агентов смысла.** Оркестратор обращается к конкретному человеку только за его решением или проверкой, объясняет, что требуется и куда вернется результат; независимая работа тем временем продолжается.
- **Помнит и применяет накопленный опыт.** Идеи, встречи, решения, «давай по-другому», ошибки и обещания вернуться сохраняются в общей памяти и поднимаются тогда, когда действительно влияют на работу.
- **Восстанавливает движение.** Если работа остановилась, результат не вернулся или оркестратор потерял фокус, Vydykhai сверяется с общим состоянием, безопасно возобновляет поток или предлагает замену оркестратора. Если агентная среда не позволяет независимую проверку, это ограничение показывается явно.

## What Vydykhai Owns

- **Organizes the route to an outcome.** It turns a rough goal into a shared brief, the nearest DOD, bounded tasks, and one clear next action.
- **Converges people and different AI tools.** Participants may work asynchronously across their own computers and agent environments while one shared repository connects plans, results, and acceptance.
- **Includes people as agents of judgment.** The orchestrator asks a specific person only for the decision or review they own, explains what is needed and where the result returns, and keeps independent work moving.
- **Remembers and applies accumulated experience.** Ideas, meetings, decisions, changes of approach, failures, and promises to return enter shared memory and resurface when they materially affect the work.
- **Restores forward motion.** If work stalls, a result does not return, or the orchestrator loses focus, Vydykhai reconciles shared state, safely resumes the flow, or proposes orchestrator replacement. When an agent environment cannot support an independent check, the limitation stays explicit.

## Give This To Your Agent

Open your coding agent in the project you want to build and send either version as one message:

```text
Подключи Vydykhai к этому проекту и запусти оркестратор. Сам определи возможности своей агентской среды и выполни BOOTSTRAP.md; спрашивай меня только о недостающем доступе или решении: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

```text
Connect Vydykhai to this project and start the orchestrator. Determine the capabilities of your agent environment, follow BOOTSTRAP.md end to end, and ask me only for missing access or a decision: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

That is the normal installation path. The agent identifies the target repo, installs and validates the framework, connects the shared operating space, prepares Project State, and starts the dedicated orchestrator. A bare URL is not enough to express intent; either sentence above is.

If the project is still only an idea and has no repository, send the same request. The agent asks only for unresolved host, owner, or visibility and prepares a private Git-backed operating repo when its tools allow.

The human may still need to grant repository/network access or approve merge. They should not need to clone repositories, run installer commands, choose skills, or copy prompts.

## How It Works

- Start with a rough goal. Your orchestrator helps shape it into a shared compass, brief, nearest DOD, and visible plan.
- Each participant keeps one personal project orchestrator. The orchestrators coordinate what, why, when, and who through shared Git-backed state; focused task, discovery, lab, and maintenance contexts own the actual work.
- Every focused context receives only the applicable goal, boundary, memory, verification, human checkpoint, and return route. It continues autonomously inside that contract and consults the orchestrator only at a real boundary.
- Reasoning follows the role: the orchestrator uses the strongest available profile, unresolved solution work uses deep bounded discovery, and a ready execution task uses an efficient profile.
- Accepted corrections and lessons update shared project memory and the affected plan. A participant's durable learning can therefore guide the other orchestrators instead of remaining inside one chat.
- Results are written to durable shared state before the orchestrator is notified. After dispatch the orchestrator remains available instead of polling the task, and lost cross-context messages do not erase completed work or make a person poll for it.
- Where an independent trigger is available, Project Guard checks meaningful events and a schedule without using a model while healthy. Unchanged checks stay silent; a real mismatch starts a fresh intelligent repair or confirmed rotation, and any question already awaiting the person returns to the foreground afterward.

People normally speak only to their orchestrator in natural language. Vydykhai uses native context creation, messaging, and UI controls when the harness supports them; otherwise it uses the shared tracker and gives one exact human action. It never treats a missing harness capability as completed automation.

## Когда проект запущен / When The Project Is Ready

Установка файлов еще не означает, что проект запущен. `doctor` проверяет целостность комплекта, а `$project-launch` доказывает, что общий рабочий контур действительно готов. Результатом становится видимый статус запуска и одно следующее действие.

The project is ready only after its activation receipt proves:

- the target repository and current framework kit;
- one shared writable Git-backed repository and durable tracker;
- each current participant's role, personal orchestrator, required access, and input route;
- only the environments, safe protected references, authority, and recovery path needed by the first DOD;
- the accepted goal, current DOD, visible plan, active orchestrator, result-return route, available recovery boundary, and exact next action.

GitHub Repo + Issues/Projects/PRs and Fathom are the recommended, best-supported setup, not a vendor lock-in. Equivalent tools are valid when they provide the same durable linked state, permissions, history, and agent access. The framework kit is committed once into the project; every participant receives it through the shared repo, while their own orchestrator proves local readiness. One machine never certifies another.

Missing non-critical coverage produces `PROJECT_READY_WITH_LIMITS` with the exact safe boundary. Missing access that blocks the first route produces `BLOCKED_BY_ACCESS`; Vydykhai never claims team memory, alignment, or background recovery that it cannot observe.

The exact activation contract lives in [`docs/workflows/project-launch.md`](docs/workflows/project-launch.md).

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

## Install Into A Project

Give the agent the request above from a task attached to the target project. [`BOOTSTRAP.md`](BOOTSTRAP.md) contains the deterministic setup contract and the installer remains an internal implementation detail.

The installer writes only framework-managed files and one marked block in the target `AGENTS.md`. Project-specific rules stay outside that block. The agent reviews and validates the diff, prepares the setup branch or PR, and leaves merge under the project's normal policy.

The orchestrator applies `$project-launch`, registers the project and participants, proves the activation gates, creates the first compass and DOD, and chooses the next route. People do not need to select skills manually afterward.

## Shared Sync

Distributed Vydykhai needs one shared Git-backed project repo and durable tracker, even when the work is research, writing, design, or another non-code form of vibe work. GitHub Repo + Issues/Projects/PRs is the recommended and best-supported default. Another host or tracker is valid if it gives stable links, history, access control, participant-owned updates, and read/write access to each participant's orchestrator.

At launch, the agent records and tests this sync space plus the meeting-input route. Fathom is the recommended recorder when available; Read AI, tl;dv, another transcript service, team chat, or an approved manual summary can provide the same input. Prefer direct access for each relevant orchestrator; otherwise name one intake owner who publishes an approved traceable delta. A local notebook such as Obsidian remains an input or view unless it is shared, versioned, and agent-accessible.

After a meaningful meeting, each relevant participant can say `Process the latest meeting.` whenever they next resume. Their orchestrator reads the configured source, publishes only the material local delta, reconciles available packets in the tracker, and states what can continue; no fixed order or simultaneous attendance is required.

Give every person and agent only the access they need; never share credentials or use public-by-link access for private meeting material. If the repo/tracker or both direct and intake-owner source routes leave required work invisible, the orchestrator marks `SYNC_LIMITED`, names the missing visibility, and does not claim complete alignment for overlapping work.

## Update And Diagnose

During normal activity, each participant's orchestrator checks for a new Vydykhai version at most once every 24 hours. This is one small manifest request inside an already active session, not a background model run. When the version is current it stays silent. When a newer version exists, it reads every changelog entry after the installed version through the latest, oldest to newest. It reports `installed -> latest` and the number of releases, gives one concise product-impact line for every skipped release, then explains the combined effect here and puts the safest update window into next-best-action: now before the next dispatch or after a named task/checkpoint.

The orchestrator records the plan in Project State so the team prepares one update rather than duplicate work. At the chosen window it prepares or reuses one update branch, runs `update` and `doctor`, opens or refreshes its PR, and reports the short delta. After merge, activation requires a clean exact readback from the active orchestrator's own working directory: accepted project revision, installed version and source revision, current schemas, integrity, and reread updated core. A temporary update or merged-source worktree cannot certify the active context. If the active context cannot move cleanly, Governor records `REPAIR` or enters confirmed rotation instead of changing the title or Project State early. The orchestrator never overwrites locally modified managed files, changes rules silently in the middle of active work, or merges outside the project's normal policy. A major migration or an update that affects current safety is raised explicitly; ordinary compatible updates do not force orchestrator rotation. If upstream cannot be reached, the check remains visibly pending without blocking otherwise safe work.

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
