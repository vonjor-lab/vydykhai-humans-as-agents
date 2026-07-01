# Collaboration Framework Changelog

Этот файл фиксирует концептуальные изменения фреймворка совместной работы. Это не commit-by-commit log.

Правило версионирования:

- `MAJOR`: меняется базовая операционная модель.
- `MINOR`: появляется новый операционный элемент, например skill, orchestrator role, journal или task contract.
- `PATCH`: уточняются rules, wording, gates или templates без смены модели.

## 1.4.7 - 2026-07-01

Уточнен обязательный порядок активации фреймворка в новом или существующем проекте.

- README больше не описывает импорт как optional/recommended copy: framework kit нужно импортировать в целевой product repo.
- Repo-scoped skills считаются активными только после того, как `.agents/skills`, `docs/codex-workflows`, framework docs, changelog и core `AGENTS.md` rules лежат в target repo, закоммичены и подтянуты участниками.
- `$project-launch` теперь должен проверять activation preflight: target repo, local framework kit, target `AGENTS.md`, Codex session from target repo и personal Framework Orchestrator thread.
- Project launch docs прямо говорят, что standalone repo является canonical source, но не execution context для чужого проекта.
- Orchestrator thread описан как standing personal thread из target repo, не Git branch и не implementation task thread.

Зачем: убрать ложное ощущение, что достаточно ссылки на framework repo или чтения README. Для успешной работы фреймворк должен быть установлен в проект и запущен через личный orchestrator thread.

## 1.4.6 - 2026-06-29

Добавлен проактивный operating layer для orchestration: orchestrator сам замечает риск, выбирает подходящий инструмент и дает человеку конкретное действие.

- Human-as-agent rule: человек считается агентом системы рядом с task threads, GitHub, встречами и smoke; orchestrator должен давать ему адресата, ссылку/prompt, место результата, safe continuation status и return-sync instruction.
- No plan-only launch: task thread launch не считается прогрессом, если child thread только написал план или draft intention. Нужен `EXECUTION_STARTED`, `BLOCKED_BEFORE_START` или `NEEDS_REBRIEF`.
- Proactive Lab Mode: orchestrator предлагает lab, когда isolated learning снижает burn/risk, и отговаривает от lab для существующих product surfaces, real-data/content updates и DOD, который должен проверяться в реальном flow.
- Lab exit закреплен как обязательный переход: proof/cap -> stop lab polish -> production transfer -> tests -> real-flow smoke -> acceptance. Lab-only result не закрывает product capability.
- Peer Compass Review закреплен как легкий cross-owner review при пересечении задач, PRs, contracts или DOD rows; orchestrator готовит запрос человеку и требует обратный sync после packet.
- Health review и accept-work теперь проверяют stalled DOD burn, lab без exit и peer review packets до acceptance.

Зачем: сделать фреймворк более нативным для живых людей - человек не помнит все режимы, а orchestrator сам предлагает lab, peer review, stop/wait/rebrief или next-best-action при рисках и застреваниях.

## 1.4.5 - 2026-06-22

Уточнена формулировка canonical source, чтобы standalone framework не зависел от рабочих копий или внутренних рабочих контекстов команды.

- Standalone repo остается единственным canonical upstream для universal framework.
- Product-local copies остаются execution copies.
- Никакой конкретный project repo, рабочая копия или внутренний рабочий контекст не должен упоминаться как часть universal framework governance.

Зачем: сохранить standalone framework полностью универсальным и не привязывать его к рабочим контекстам или проектам конкретной команды.

## 1.4.4 - 2026-06-22

Закреплен governance source-of-truth для самого фреймворка.

- Standalone repo `https://github.com/vonjor-lab/vydykhai-humans-as-agents` объявлен canonical source.
- Product-local framework copies описаны как execution mirrors, а не canonical source.
- Universal framework changes должны сначала попадать в standalone repo, затем синхронизироваться в product repos.
- Перед изменением framework rules в product repo нужно сверяться со standalone upstream.
- Project-specific правила должны оставаться в product repo `AGENTS.md`, project docs или local runbooks и не продвигаться в universal framework молча.

Зачем: не расходить framework copies между проектами и не загрязнять универсальную модель локальными правилами одного продукта.

## 1.4.3 - 2026-06-22

Добавлен Runtime Coherence Check для smoke/acceptance в проектах с несколькими branches, worktrees и локальными runtime.

- Current-branch smoke теперь требует доказательство, что frontend, backend и browser target относятся к той же ветке/worktree/commit, которые принимаются.
- Task handoff и acceptance report получили отдельное поле `Runtime Coherence Check`.
- `$accept-work` должен классифицировать acceptance как `NEEDS_FIXES` или `BLOCKED`, если smoke нельзя связать с exact current branch/worktree.
- Orchestrator должен отправлять task thread обратно на проверку, если ACCEPT есть, но runtime coherence не доказан.
- Формулировки оставлены универсальными: без project-specific команд, но с обязательными полями repo root, branch, HEAD, dirty state, backend/frontend command+URL+cwd, browser target и smoke result.

Зачем: не принимать результат, проверенный на старом backend/frontend, соседнем worktree или browser tab от другой ветки.

## 1.4.2 - 2026-06-22

Закреплены уроки оркестраторского треда без добавления нового skill.

- Добавлен Compass Calibration Check для product/design/IA/UI shell/entity-model/AI workflow задач, где легко перепутать объект работы или source of truth.
- Research thread стал явным режимом для вопросов "что является source of truth/foundation?" до implementation.
- Thread Launch Contract уточнен: orchestrator после creation/readback сам проверяет title и переименовывает thread; startup title в дочернем thread только подсказка.
- Новые task/research threads должны запускаться на `gpt-5.5` или newest available model и `xhigh` reasoning; fallback должен быть видимым.
- Acceptance уточнен: merged PR или accepted sub-slice не закрывает parent issue, пока named DOD/product loop не закрыт.
- Visible loop rule: route/backend/tests не считаются product capability, если пользовательское действие не видно в UI/surface или нет human-approved exception.

Зачем: ловить неверный product compass и ложное "done" до дорогого implementation/rework.

## 1.4.1 - 2026-06-20

Уточнена переносимость фреймворка на другие agent harnesses.

- Codex закреплен как reference implementation: repo-scoped skills, threads, thread titles, orchestrator/task-thread handoff, GitHub shared memory и local verification.
- Добавлен adapter capability check для Claude Code, Cursor, Windsurf/Devin Desktop, GitHub Copilot cloud agent, Gemini CLI или других инструментов.
- Если harness не умеет создавать resumable task threads, task thread мапится на отдельный chat/run/branch/PR/issue, а GitHub issue становится главным coordination handle.
- README теперь явно говорит, что link-only или наличие этого repo не активирует skills/workflows в чужом harness.

Зачем: сохранить универсальность фреймворка без ложного обещания, что Codex-specific automation автоматически работает в других инструментах.

## 1.4.0 - 2026-06-20

Добавлен универсальный запуск проекта и усилена дисциплина orchestrator/task thread.

- Появился `$project-launch`: project operating brief, coordination sources, team onboarding, compass, DOD, owners/backups и первый route в `$start-work` или `$framework-orchestrator`.
- Введен единый блок Project Coordination Sources: встречи, записи, transcripts, командный чат, docs и ручные summaries считаются одним слоем raw inputs для синков.
- Orchestrator thread закреплен как organization-only: в нем нельзя кодить, чинить, деплоить, запускать приемочный smoke или merge.
- Task thread закреплен как место implementation, `$accept-work`, fresh current-branch smoke и manual merge после human smoke.
- Добавлен Thread Launch Contract: task thread должен иметь стабильное title, проверенный rename и запись title/id/link или manual-start prompt в GitHub shared memory.
- Добавлены owner/backup и failover rule для задач, которые блокируют других участников.
- Добавлен Orchestrator Health Review после milestone/large merge, 3-5 accepted slices, repeated follow-ups, stalled tasks, scope growth или owner dropout.
- README теперь объясняет, как импортировать framework kit в чужой repo и почему link-only не активирует repo-scoped skills.

Зачем: сделать фреймворк пригодным для старта любого нового проекта с несколькими людьми и Codex-инстансами, сохранив простую модель: orchestrator организует, task threads делают и принимают.

## 1.3.3 - 2026-06-19

Уточнена двусторонняя связь продукта и техники в Product Capability Closed Loop.

- Если задача начинается с backend/API/data/permissions/storage/AI/infrastructure, оркестратор должен проверить, какой пользовательский или операторский loop эта техника включает.
- Если задача начинается с UI/product surface/design/navigation/copy, оркестратор должен проверить backend/API/data/persistence/permissions, состояния загрузки/пустоты/ошибки, recovery path, audit/provenance и реальные сценарии под этим UI.
- Если одна сторона отсутствует, оркестратор должен проактивно предложить недостающую сторону, согласовать ее с человеком и обновить task map или acceptance boundary до запуска/приемки.

Зачем: защищать цельность и интуитивность продукта, чтобы фронт, бэк, данные, права и сценарии складывались в usable workflow, а не в разрозненные slices.

## 1.3.2 - 2026-06-19

Добавлен Product Capability Closed Loop без нового skill.

- Перед dispatch или task-map update оркестратор должен классифицировать задачу как `product capability`, `technical enabler`, `maintenance`, `research/spike` или `future option`.
- Product capability требует описанного пользовательского или операторского loop: actor, entry point, setup/configuration, action, processing/enforcement, feedback, state, recovery, audit/provenance and verification.
- Technical enabler может быть принят без UI только если явно связан с capability/task, который закрывает пользовательский loop.
- Если loop отсутствует, оркестратор должен проактивно предложить черновик loop, согласовать его с человеком и обновить task map или acceptance boundary до запуска работы.
- `$accept-work` должен отличать завершенный technical slice от закрытой продуктовой возможности.

Зачем: ловить backend-only или readiness-only задачи до реализации, чтобы продуктовые возможности не принимались без понятного пользовательского цикла.

## 1.3.1 - 2026-06-18

Добавлен Product Compass Note Triage без нового skill.

- Продуктовые комментарии во время реализации теперь сначала классифицируются как `scope change`, `DOD gap`, `vision guardrail` или `future option`.
- Scope меняется только после явного подтверждения человека и проверки DOD/границ задачи.
- DOD gaps превращаются в named follow-up только с parent issue, последовательностью, owner, blocker status и ожидаемым моментом выполнения.
- Vision guardrails фиксируются в brief/alignment/docs без автоматического расширения текущей задачи.
- Future options не должны становиться backlog-мусором.
- Перед новым follow-up в той же области оркестратор обязан показать parent closure view: что закрыто, сколько слайсов осталось, можно ли принять parent сейчас и почему новый слайс нужен.

Зачем: сохранять цельность сложного эпика, не терять продуктовый компас и одновременно не плодить бессвязные слайсы.

## 1.3.0 - 2026-06-18

Закреплена более автономная работа Framework Orchestrator без добавления нового skill.

- Task thread titles стали детерминированными: `[#<issue>] <sequence> <short title>`, если issue id или sequence доступны.
- Orchestrator по короткой команде продолжения сам запускает или возобновляет next ready task thread, записывает thread/pending state в GitHub shared memory и проверяет `$accept-work`.
- В task contract добавлен `DOD Impact`, чтобы новые slices двигали named epic/milestone DoD, а не плодили работу без closure progress.
- Добавлен lightweight `Burn / Limits` check для задач с material generation/API/retry/verification cost risk.

Зачем: сделать совместную работу проще для людей и продуктивнее для нескольких Codex-инстансов, не заставляя команду вручную помнить названия тредов, запуск acceptance и контроль DOD/burn.

## 1.2.1 - 2026-06-15

Уточнен контракт task thread acceptance.

- GitHub task issues содержат компактный `Codex Task Contract`.
- Task threads запускают `$accept-work` до final completion.
- Framework Orchestrator читает acceptance result и выбирает next best action: fix, wait, merge, align или launch next task.

Зачем: убрать ручной шаг, где человек должен помнить, что после завершения task thread нужно отдельно попросить acceptance.

## 1.2.0 - 2026-06-14

Добавлена модель личного Framework Orchestrator thread.

- У каждого участника есть постоянный orchestrator thread на активный product stream или epic.
- Implementation уходит в отдельные task threads.
- Orchestrator держит sequence, GitHub shared memory, task threads, merge events, alignment и acceptance gates.

Зачем: координировать нескольких людей и несколько Codex-инстансов без ручного восстановления контекста.

## 1.1.1 - 2026-06-11

Добавлено правило current-branch smoke.

- Перед приемкой user-facing или integration-affecting work Codex должен запустить или организовать smoke на точной текущей branch/worktree.
- Codex должен поднять или перезапустить нужные backend и frontend процессы из этого же worktree.
- Stale servers, stale browser tabs или процессы из других branches не считаются приемочным доказательством.

Зачем: предотвратить ложную приемку на старом local runtime state.

## 1.1.0 - 2026-06-11

Добавлен asynchronous alignment через GitHub.

- Local Alignment Packets.
- Team Alignment Delta.
- Event-triggered alignment.
- Brief Patch и re-brief path через `$start-work`.

Зачем: сделать alignment полностью асинхронным, когда участники и их Codex threads возвращаются к работе в разное время.

## 1.0.0 - 2026-06-10

Создана первая универсальная версия фреймворка.

- Sources, purpose и diagnosis.
- Operating cycle.
- `$start-work`, `$daily-alignment`, and `$accept-work`.
- Human meeting loop и rules.

Зачем: превратить практические уроки совместной вайб-разработки в reusable operating framework.
