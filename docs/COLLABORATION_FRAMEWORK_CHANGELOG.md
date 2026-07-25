# Collaboration Framework Changelog

Этот файл фиксирует концептуальные изменения фреймворка совместной работы. Это не commit-by-commit log.

Старые записи используют текущую environment-neutral терминологию там, где менялось только название механизма. Точный текст каждой версии сохраняется в Git tags.

Правило версионирования:

- `MAJOR`: базовая операционная модель меняется несовместимо, поэтому действующему проекту нужна миграция ролей, основных artifacts, skills или operating cycle, чтобы продолжить работу. Масштаб текста сам по себе не делает релиз major.
- `MINOR`: появляется совместимый операционный элемент; существующие Project State, tasks и contexts остаются пригодны и могут обновиться без смены модели.
- `PATCH`: уточняются rules, wording, gates или templates без нового операционного элемента.

## 1.11.0 - 2026-07-25

Ротация оркестратора получила явную и проверяемую пересменку, чтобы человек не гадал, какой context теперь главный.

- До запуска candidate оркестратор объясняет причину ротации, что переносится, что не меняется, как будет проверена память и какое подтверждение потребуется.
- После подтверждения новый orchestrator регистрируется active, поднимается на виду, закрепляется при поддержке среды и публикует понятный activation status с next-best-action.
- Return routes, tracker hooks и monitors переводятся со старого context до его закрывающего сообщения.
- Старый context переименовывается как retired/superseded, открепляется и последним крупным сообщением направляет всю новую работу в активный orchestrator.
- Старый context остается доступной незакрепленной историей и не архивируется или удаляется автоматически.
- Если среда не умеет pin/unpin/rename или terminal notice, оркестратор дает человеку одно точное действие и отмечает `ROTATION_CUTOVER_INCOMPLETE`, а не объявляет переход полностью завершенным.

Зачем: сделать смену управляющего context очевидной в интерфейсе, сохранив надежную миграцию памяти и исключив продолжение работы по ошибке в старом треде.

## 1.10.0 - 2026-07-25

Общая память и неожиданное разрастание задач стали явными проверяемыми контрактами.

- Shared Sync Contract требует общий Git-backed project repo, durable tracker, coordination-input route и проверенное покрытие доступа людей и их orchestrators.
- GitHub с Issues и PR является рекомендуемым и лучше всего отлаженным default, в том числе для non-code vibe work. Аналог подходит по функциональному контракту, а не по названию продукта.
- Fathom является рекомендуемым recorder при наличии; Read AI, tl;dv, другой transcript source, team chat или manual summary допустимы, если они доступны нужным orchestrators. Obsidian и другие локальные notebooks остаются input/view, пока не стали общими, версионируемыми и agent-accessible.
- Неполный доступ получает статус `SYNC_LIMITED`: система называет невидимую часть и не заявляет полный alignment для пересекающейся работы.
- Expansion Check срабатывает, когда локальная цель тянет незапланированные слои, первое evidence опаздывает, platform friction повторяется, одинаковое исправление снова не помогает или costs растут без DOD movement.
- Проверка выбирает один маршрут: обоснованно продолжить, провести re-brief, доказать гипотезу в Lab либо остановить затронутую работу ради bounded maintenance.
- Maintenance принимается, когда устранена минимальная общая причина, исходный representative flow стал существенно меньше или быстрее, проверено отсутствие повторного роста и работа явно вернулась к первоначальной задаче. Backup, cleanup, migration и caps считаются containment, а не автоматическим закрытием причины.
- Универсальные file/line/time thresholds не вводятся: appetite выбирается по задаче и repo, а количественные признаки только запускают review.
- Уточнена граница версий: этот релиз остается совместимым `MINOR`; `2.0.0` потребуется только при несовместимой смене базовой модели и обязательной миграции действующих проектов.

Зачем: дать нескольким людям и агентам действительно общую рабочую память, а небольшим продуктовым задачам не позволять незаметно превращаться в дорогое обслуживание всей платформы.

## 1.9.0 - 2026-07-22

Исполнение стало замкнутым событийным циклом, а эксперименты получили одну проверяемую линию успеха.

- Task context после запуска сам продолжает работу до human checkpoint, реального blocker или terminal result и автоматически отправляет Return Sync оркестратору. Native cross-context message является первым выбором, shared-tracker event - вторым, monitor - только fallback.
- Перед dispatch или resume проводится Scope Freshness Check: `UNCHANGED`, `PATCH_REQUIRED` или `REBRIEF_REQUIRED`. Семь дней являются настраиваемым сигналом перечитать задачу, но не причиной автоматически менять scope.
- Введена One Success Line: `Accepted Baseline` хранит последнее доказанное рабочее состояние, `Candidate` - текущую попытку, а `Rejected Candidate` остается evidence, но не базой для следующего исправления.
- Новый Candidate строится от Accepted Baseline, сохраняет доказанные части и заново делает неудачные с учетом Learning Delta: `Keep`, `Rebuild`, `Drop`, `Unknown`.
- Для эксперимента фиксируются решение, baseline, одна основная переменная, проверяемый человеком proof, burn/stop и маршрут promote/reject/re-brief. Приемка проверяет только измененные риски и не требует платного пути, если равнозначное бесплатное доказательство достаточно.
- Proactive Guardrails теперь требуют вежливо замечать отклонение от любого правила, объяснять конкретный риск и рекомендуемый следующий шаг. Человек может явно выбрать ограниченное исключение с условием возврата.
- В одной продуктовой фазе поддерживаются один active implementation context и один канонический Candidate; повторное исправление одного класса ошибки сначала запускает проверку baseline, scope и подхода.
- Рабочие README, framework docs, skills и workflows показывают только текущую версию. Исторические номера остаются в changelog, provenance и специальных compatibility pointers.
- Позиционирование расширено от совместного вайбкодинга к более широкому vibe work, когда общую цель можно превратить в брифы, ограниченные задачи, проверяемые результаты и принятые следующие шаги. Операционная модель при этом не меняется.

Зачем: человеку не нужно опрашивать задачи и помнить технические страховки, а команда не накапливает исправления поверх неудачных экспериментов или устаревших brief.

## 1.8.0 - 2026-07-14

Добавлены фокус на ближайшем DOD и долговременная память полезных идей.

- Человек может свободно высказывать новые идеи: orchestrator отделяет обязательный DOD gap или guardrail от optional scope, который задержит текущий результат.
- Полезное расширение не добавляется в активную задачу молча. После подтверждения человека оно сохраняется в общей Idea Memory с источником, затрагиваемыми поверхностями и trigger, при котором его нужно вспомнить.
- При каждом brief, re-brief, sequence decision и milestone plan orchestrator сопоставляет Idea Memory с DOD, активными задачами, сущностями, поверхностями и contracts.
- Совпавшая идея либо учитывается как guard, либо отдельно формируется через research/task, либо остается в памяти, либо закрывается как поглощенная, дублирующая или устаревшая.
- Task, research, lab, daily alignment и acceptance contexts могут вернуть Idea Candidate, но orchestrator дедуплицирует записи и поддерживает одно компактное текущее представление.
- Health Review очищает дубли и устаревшие записи; optional ideas сами по себе не удерживают принятую задачу или parent открытыми.
- В Project State добавлена ссылка на Idea Memory, а новый легкий template не превращает идеи в backlog или отдельную задачу на каждую мысль.

Зачем: быстрее доводить работу до DOD, не заставляя человека выбирать между сохранением хорошей идеи и раздуванием текущего scope, а также не полагаться на человеческую память или археологию по чатам.

## 1.7.0 - 2026-07-10

Runtime фреймворка отвязан от одной агентской среды.

- Канонической единицей стал `agent context`: в конкретной среде это может быть thread, chat, session, run, workspace или tracker-linked agent.
- Skills остаются едиными `.agents/skills/*/SKILL.md`; vendor-specific metadata, включая `agents/openai.yaml`, является только optional interface adapter.
- `docs/codex-workflows` переименован в нейтральный `docs/workflows`, а Task/Research Thread заменены в active runtime на Task/Research Context.
- Bootstrap теперь сам определяет, как среда читает project instructions и skills, создает contexts, использует shared state и запускает verification. При отсутствии native support он создает один тонкий adapter со ссылками на canonical files без копирования логики.
- GitHub остается возможным shared tracker, но operating contracts работают с любым общим tracker и repository host.
- Model policy стала `latest available flagship / deepest bounded reasoning`; Extra High / `xhigh` является environment mapping, а не universal vendor label. Compatibility field сохранено, чтобы updater версии 1.6 мог прочитать новый manifest.
- Validation проверяет согласованность версии и запрещает vendor-only wording в active runtime.

Зачем: один и тот же легкий framework kit должен запускаться агентом в любой подходящей среде, не требуя от человека переписывать skills или вручную переводить понятие треда.

## 1.6.0 - 2026-07-10

Добавлен проверяемый ownership и licensing layer без изменения операционной модели фреймворка.

- Alexander Rozhnov закреплен как creator, originating designer и original publisher Vydykhai в README, NOTICE, manifest и citation metadata.
- Новые версии распространяются по PolyForm Small Business License 1.0.0; использование вне ее grant требует отдельной письменной commercial license.
- Namespaced license/attribution notice стал framework-managed file: он приезжает при импорте, а creator, license и Required Notice записываются в lock metadata и проверяются через `doctor`, не затрагивая product license.
- Граница лицензии зафиксирована явно: framework kit остается covered material, но product code, данные, private instructions, meeting records и outputs проекта не переходят под права фреймворка.
- Добавлены public provenance timeline, `CITATION.cff` и правила использования project names без неподтвержденных заявлений о registered trademark или worldwide priority.
- Substantive external contributions не принимаются до отдельного contributor agreement, сохраняющего возможность relicense и commercial licensing.

Зачем: оставить проверяемый след происхождения, сохранить авторство в forks и product mirrors и не потерять право выпускать будущие версии на иных коммерческих условиях.

## 1.5.2 - 2026-07-10

Ротация orchestrator стала контролируемой миграцией памяти вместо автоматической замены треда.

- Previous orchestrator перед ротацией публикует Rotation Memory Packet: compass/DOD, decisions, очередь, promises, deferred work, просьбы человека запомнить, working rules, monitors, checkpoints, ownership и ambiguous/stale items.
- Каждый item сверяется с durable sources и получает статус `ALREADY_DURABLE`, `MISSING_DURABLE`, `AMBIGUOUS` или `STALE/SUPERSEDED`.
- Новый orchestrator сначала является read-only candidate и независимо проводит Memory Coverage Check по Project State, issues/PR, project docs/instructions, repo state и доступной истории.
- Active pointer меняется только после human-visible coverage delta и явного подтверждения человека.
- Missing items не превращаются молча в новые задачи: человек видит их и подтверждает правильный durable destination.
- Previous thread сохраняется pinned historical/reference link и никогда не архивируется или удаляется автоматически.
- При недоступном previous thread recovery помечается incomplete, а candidate не заявляет полную память и не меняет shared direction без человека.

Зачем: не терять накопленные просьбы, очередь и правила работы при очистке перегруженного контекста и не удивлять человека появлением нового «главного» orchestrator.

## 1.5.1 - 2026-07-10

Установка сведена к одному запросу агенту, а выбор модели стал динамической политикой вместо project-specific номера.

- Добавлен `BOOTSTRAP.md`: пользователь открывает задачу в своем проекте, дает coding agent ссылку и просит подключить Vydykhai; clone, install, `doctor`, setup branch/PR, Project State и запуск orchestrator выполняет агент.
- Bootstrap-запрос сразу разрешает безопасные setup artifacts, но не merge, destructive overwrite, paid actions или production changes.
- Основной README больше не требует от человека git-команд; команды установки остаются внутренней механикой агента.
- Default agent policy теперь `latest available flagship / xhigh`: выбирается сильнейшая доступная универсальная coding/agentic модель, а не максимальный номер версии.
- Project State хранит resolved model, reasoning, дату/источник проверки и fallback для каждого участника.
- Orchestrator повторно проверяет актуальность модели при setup, framework update, rotation, rejection/deprecation и не реже раза в семь дней в активном проекте.
- Silent downgrade запрещен; более дешевый или быстрый profile возможен только как явное человеческое решение для названного scope.

Зачем: дать вайбкодеру понятный вход «отправь ссылку агенту» и автоматически переходить на будущие flagship-модели без переписывания universal framework.

## 1.5.0 - 2026-07-10

Фреймворк сокращен до компактного операционного ядра и получил воспроизводимый installation/runtime layer.

- Каноническими стали стабильные `docs/FRAMEWORK.md` и `docs/FRAMEWORK_RU.md`; подробная версия 1.4.8 сохранена Git-тегом и больше не загружается skills.
- Добавлен порядок авторитетности источников: последнее явное решение человека имеет приоритет над brief, issue и планом агента.
- В минимальный task contract добавлен один обязательный `Human checkpoint`, чтобы orchestrator заранее знал момент участия человека.
- Один active orchestrator больше не считается вечным: добавлена checkpoint-and-rotate процедура при milestone, context pollution и repeated compaction.
- Project State отделен от коротких Alignment Windows; participant registry показывает orchestrator, framework version, latest packet и active task.
- Team Alignment Delta и перестройка issue dashboard стали одной операцией; stale alignment windows должны ротироваться.
- Закреплен контракт монитора: один gate, тишина без изменений, отсутствие нового scope/merge/spend и удаление в terminal state.
- Model/reasoning вынесены из universal rules в project configuration, чтобы фреймворк не устаревал при смене моделей.
- Добавлены machine-readable manifest, managed `AGENTS.md` block, installer/updater/doctor и автоматическая validation.
- Человеческий интерфейс сведен к естественным командам в orchestrator; пять repo skills остаются внутренней реализацией.

Зачем: сохранить сильные safety gates, но убрать контекстный вес, ручной sync и скрытую координационную работу человека.

## 1.4.8 - 2026-07-04

Расширен Research Thread как единственный режим для проработки непонятной идеи до brief/task, без введения второго термина.

- Research Thread теперь используется не только для source of truth/foundation, но и для узкой идеи, product model, option set, design question или affected contracts, когда тема еще не готова для task brief.
- Добавлен проактивный вход: orchestrator предлагает research thread, если размышление начинает засорять основной orchestrator или преждевременно тянет тему в implementation.
- Добавлен проактивный выход: research thread возвращает короткий Research Packet с findings, recommended/rejected options, assumptions, risks, impact on compass/brief/task map и next route.
- После incorporation Research Packet в durable memory research thread должен быть archived/inactive, чтобы не становиться вторым orchestrator.
- Health Review расширен до context hygiene: проверять связность research/lab/task outputs, stale threads/worktrees/monitors/branches, trapped chat decisions, stalled DOD burn и technical slicing без product progress.

Зачем: сохранить чистый orchestrator context и при этом дать команде безопасный способ осмыслять частные неопределенные темы до планирования и реализации.

## 1.4.7 - 2026-07-01

Уточнен обязательный порядок активации фреймворка в новом или существующем проекте.

- README больше не описывает импорт как optional/recommended copy: framework kit нужно импортировать в целевой product repo.
- Repo-scoped skills считаются активными только после того, как `.agents/skills`, `docs/workflows`, framework docs, changelog и core `AGENTS.md` rules лежат в target repo, закоммичены и подтянуты участниками.
- `$project-launch` теперь должен проверять activation preflight: target repo, local framework kit, target `AGENTS.md`, agent context from target repo и personal Framework Orchestrator context.
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
- Новые task/research contexts должны запускаться на newest available flagship и глубоком reasoning; fallback должен быть видимым.
- Acceptance уточнен: merged PR или accepted sub-slice не закрывает parent issue, пока named DOD/product loop не закрыт.
- Visible loop rule: route/backend/tests не считаются product capability, если пользовательское действие не видно в UI/surface или нет human-approved exception.

Зачем: ловить неверный product compass и ложное "done" до дорогого implementation/rework.

## 1.4.1 - 2026-06-20

Уточнена переносимость фреймворка на другие agent environments.

- Закреплен reference capability set: repo-scoped skills, resumable contexts, stable handles, orchestrator/task handoff, shared memory и local verification.
- Добавлен adapter capability check для любой agent environment.
- Если среда не умеет создавать resumable task contexts, task context мапится на отдельный chat/run/workspace или tracker handle.
- README теперь явно говорит, что link-only или наличие этого repo не активирует skills/workflows без bootstrap текущей agent environment.

Зачем: сохранить универсальность фреймворка без ложного обещания, что environment-specific automation автоматически работает в любом инструменте.

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

Зачем: сделать фреймворк пригодным для старта любого нового проекта с несколькими людьми и agent contexts, сохранив простую модель: orchestrator организует, task contexts делают и принимают.

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

Зачем: сделать совместную работу проще для людей и продуктивнее для нескольких agent contexts, не заставляя команду вручную помнить названия contexts, запуск acceptance и контроль DOD/burn.

## 1.2.1 - 2026-06-15

Уточнен контракт task thread acceptance.

- Shared-tracker tasks содержат компактный `Agent Task Contract`.
- Task threads запускают `$accept-work` до final completion.
- Framework Orchestrator читает acceptance result и выбирает next best action: fix, wait, merge, align или launch next task.

Зачем: убрать ручной шаг, где человек должен помнить, что после завершения task thread нужно отдельно попросить acceptance.

## 1.2.0 - 2026-06-14

Добавлена модель личного Framework Orchestrator thread.

- У каждого участника есть постоянный orchestrator thread на активный product stream или epic.
- Implementation уходит в отдельные task threads.
- Orchestrator держит sequence, GitHub shared memory, task threads, merge events, alignment и acceptance gates.

Зачем: координировать нескольких людей и несколько agent contexts без ручного восстановления контекста.

## 1.1.1 - 2026-06-11

Добавлено правило current-branch smoke.

- Перед приемкой user-facing или integration-affecting work агент должен запустить или организовать smoke на точной текущей branch/worktree.
- Агент должен поднять или перезапустить нужные backend и frontend процессы из этого же worktree.
- Stale servers, stale browser tabs или процессы из других branches не считаются приемочным доказательством.

Зачем: предотвратить ложную приемку на старом local runtime state.

## 1.1.0 - 2026-06-11

Добавлен asynchronous alignment через GitHub.

- Local Alignment Packets.
- Team Alignment Delta.
- Event-triggered alignment.
- Brief Patch и re-brief path через `$start-work`.

Зачем: сделать alignment полностью асинхронным, когда участники и их agent contexts возвращаются к работе в разное время.

## 1.0.0 - 2026-06-10

Создана первая универсальная версия фреймворка.

- Sources, purpose и diagnosis.
- Operating cycle.
- `$start-work`, `$daily-alignment`, and `$accept-work`.
- Human meeting loop и rules.

Зачем: превратить практические уроки совместной вайб-разработки в reusable operating framework.
