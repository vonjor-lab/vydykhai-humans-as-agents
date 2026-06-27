# Фреймворк совместной вайб-разработки

Дата: 2026-06-10
Версия: 1.3.3
Статус: универсальный рабочий фреймворк для нескольких вайбкодеров и нескольких Codex-инстансов, работающих над одним продуктом
История изменений: `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`

## Источники

Фреймворк собран из:

- заметок и дистилляции team product daily / brainstorm, 2026-06-10;
- практической работы с Codex над общим продуктом, где параллельно жили несколько тредов, веток, продуктовых зон и автономных агентских запусков;
- повторяющихся уроков из удачных handoff, проваленных слишком больших задач, stale branches, лабораторных экспериментов, визуального дебага артефактов и дорогих перезапусков.

Источники объясняют происхождение подхода. Сам фреймворк универсальный и должен переноситься на другие проекты.

## Назначение

Фреймворк помогает нескольким людям и нескольким AI-агентам работать над одним продуктом и не разъезжаться.

Он нужен командам, где:

- люди работают part-time или асинхронно;
- Codex или похожие агенты могут автономно работать долго;
- задачи касаются продукта, дизайна, архитектуры, данных, UI, тестов, деплоя и памяти проекта;
- цена неверного направления высокая, потому что агент может быстро произвести много правдоподобной, но не туда направленной работы.

Цель - сделать автономную AI-разработку практичной: дать агентам достаточно контекста для самостоятельной работы, людям - достаточно контрольных точек для раннего управления, а проекту - устойчивую память, чтобы уроки не оставались только в чатах.

## Диагноз

Есть два типовых режима работы.

### Ручной режим

Человек сидит рядом с агентом и ведет его небольшими промптами.

Этот режим полезен для:

- быстрого дебага;
- небольших UI-правок;
- узкого исследования;
- тактического ремонта.

Как дефолтный режим он плох: производство останавливается, когда человек отходит.

### Эпик-режим

Человек дает агенту большую цель и оставляет его работать автономно.

Этот режим работает, когда задача хорошо задизайнена. Он проваливается, когда задача размыта, недоконтекстуализирована или не содержит ограничений. Тогда агент долго строит не туда, а команда потом платит rescue, rework или полным restart.

### Главный паттерн провала

Самые дорогие провалы возникают, когда команда стартует в эпик-режиме с недостаточным task design, а заканчивает ручным спасением результата.

Решение не в том, чтобы мыслить мельче. Решение в более качественном top-down design:

1. Определить project compass.
2. Разбить его на эпики.
3. Превратить эпики в самодостаточные задачи.
4. Дать агентам автономную работу.
5. Поставить контрольные точки до того, как отклонение станет дорогим.
6. Сохранить устойчивые уроки обратно в репозиторий.

## Роль Codex

Codex - не только исполнитель. Его нужно использовать на всех этапах планирования:

- Исследователь: изучает docs, код, issues, прошлые решения и похожие работы до финализации направления людьми.
- Соавтор brief: готовит epic briefs, task bodies, risks, dependencies и acceptance criteria.
- Ревьюер согласованности: сверяет новый эпик или задачу с compass, другими активными эпиками, shared contracts и известными lessons.
- Оркестратор: связывает brief, sequence, alignment journal, task threads, PRs и acceptance gates.
- Исполнитель: реализует scoped task после того, как brief и alignment checks стали ясными.

Человек остается ответственным за продуктовые решения. Codex расширяет контекст, подсвечивает конфликты и превращает решения в durable artifacts.

## Основные repo skills

Фреймворк реализуется через один orchestration skill и три человеческих work skills. Они лежат в `.agents/skills` внутри репозитория, поэтому каждый участник получает одинаковое поведение после pull репозитория и запуска новой Codex-сессии из него.

### `$framework-orchestrator`

Использовать в постоянном личном Codex thread, когда человек хочет продолжить product stream, стартовать следующую задачу, обработать daily или merge event, проверить sequence, запустить task thread или скоординировать acceptance.

Выход:

- текущий orchestrator state;
- ссылки на актуальный brief, task, PR и alignment;
- рекомендация следующего действия: continue, continue narrowly, wait, launch task, accept work или ask for decision;
- title и startup prompt для task thread, если нужно запускать новую задачу;
- обновления GitHub issue или PR после human approval;
- handoff в `$start-work`, `$daily-alignment` или `$accept-work`, когда нужен специализированный workflow.

### `$start-work`

Использовать, когда человек хочет запустить большую тему, развернуть идею в эпик, обработать инсайт со встречи или понять, что делать первым.

Выход:

- epic brief;
- затронутые entities и surfaces;
- cross-epic risks;
- implementation concept;
- task map;
- рекомендованная sequence;
- предложенное ownership;
- GitHub epic/task issues после human approval.

### `$daily-alignment`

Использовать после встречи или перед продолжением работы во время execution.

Выход:

- Local Alignment Packet участника;
- обновленная Team Alignment Delta;
- guidance: continue, continue with cautions, wait или blocked;
- Brief Patch, если brief нужно немного и явно обновить;
- re-brief signal в `$start-work`, если materially меняются goal, scope, sequence, ownership или task map.

### `$accept-work`

Использовать, когда task, PR, milestone или epic готовы к приемке или закрытию.

Выход:

- acceptance report;
- сравнение с original brief;
- учет Brief Patches и Team Alignment Deltas;
- verification и residual risk summary;
- решение: accept, accept with follow-ups, needs fixes или blocked;
- GitHub/project-memory updates после human approval.

Эти skills сохраняют процесс человеческим: оркестрировать поток, стартовать работу, вести ее без расхождения, принять результат.

## Контур Встреча -> Codex

На человеческих встречах появляются контекст, суждения и компромиссы. Они должны напрямую попадать в агентскую работу, а не жить отдельно.

По возможности записывать встречи в Fathom или другой инструмент записи и транскрибации. После встречи просить Codex превратить transcript в компактный рабочий артефакт:

1. Принятые решения.
2. Изменившиеся assumptions.
3. Затронутые эпики или задачи.
4. Риски cross-agent alignment.
5. Открытые вопросы.
6. Docs, issues или briefs, которые нужно обновить.

Человек ревьюит эту дистилляцию до того, как она становится project memory. После подтверждения Codex обновляет нужные briefs, alignment packets, tasks или docs. Тогда Codex каждого участника команды читает одни и те же durable artifacts и продолжает из общего состояния.

Transcript встречи - это raw input. Дистилляция Codex плюс human approval - это мост в агентскую работу.

## Асинхронный alignment journal

Alignment команды не должен требовать, чтобы все были онлайн одновременно. Для каждой содержательной встречи или daily-цикла используем GitHub issue как общий alignment journal.

У issue две роли:

- comments - канонический append-only log;
- body - короткий dashboard, который пересобирается из comments.

Каждый участник может запустить свой Codex тогда, когда возвращается к работе. Codex читает transcript встречи, локальное состояние репозитория, контекст активной задачи и текущий alignment issue, после чего публикует Local Alignment Packet новым comment. Он не перезаписывает packet другого участника.

Локальная незакоммиченная работа невидима другим людям, пока Codex владельца не опубликует достаточно информации в packet. Поэтому packet должен кратко описывать текущее локальное состояние, branch или PR если есть, затронутые surfaces, изменившиеся assumptions, конфликты и можно ли владельцу продолжать.

Любой следующий Codex может прочитать все packets, пересобрать dashboard issue и опубликовать Team Alignment Delta:

- какие packets и встречи покрыты;
- кто еще не опубликовал packet;
- какие packet updates уже учтены;
- что изменилось в shared briefs, tasks, rules или assumptions;
- нужен ли Brief Patch или re-brief через `$start-work`;
- какой статус у работы: READY, READY_WITH_CAUTIONS, WAITING или BLOCKED.

Так цикл становится полностью асинхронным. Первый участник может продолжать, если текущая delta говорит, что его работа безопасна или изолирована. Missing packets остаются видимыми. Когда другой участник вернется позже, его Codex добавит новый packet и либо обновит team delta, либо оставит понятный waiting state. Последняя delta заменяет предыдущие по смыслу, но не удаляет их.

Journal должен оставаться коротким в операционной работе. Старые alignment issues закрываются или архивируются после того, как final delta перенесена в durable docs, tasks или briefs. Долгосрочный source of truth - не transcript и не история journal, а обновленная project memory.

### Event-triggered alignment

Daily или meeting alignment - не единственный способ синхронизации. Во время активной реализации нужно публиковать короткий packet только тогда, когда событие меняет следующий шаг, риск-модель или общее понимание другой стороны.

Публиковать или готовить packet нужно для таких событий:

- materially изменился implementation plan, boundary задачи, shared contract, affected entity или зависимость от другого owner;
- найден конфликт, overlap, blocker или missing decision;
- PR/task accepted, merged, blocked или отправлен на fixes;
- follow-up work вынесен из исходной задачи.

Не нужно публиковать routine commit-by-commit updates, создание branch или обычный факт открытия PR. Это должно жить в GitHub task и PR. Alignment issue - coordination journal, а не development log. Packet должен отвечать: что изменилось для других, какие surfaces или contracts затронуты, можно ли безопасно продолжать, какой review или decision нужен.

Когда работа принята или отклонена с material follow-ups, accepting agent должен оставить Acceptance Packet или обновить существующий packet/delta, чтобы остальные понимали, на что уже можно опираться и какие follow-ups остались.

### Product Compass Note Triage

В большом product stream люди часто добавляют комментарии, которые уточняют целевое видение уже во время реализации. Такие комментарии сначала считаются product compass notes, а не автоматическим расширением scope.

Каждый существенный продуктовый комментарий нужно классифицировать в одну из четырех групп:

- `scope change`: комментарий меняет текущую задачу только если человек явно подтвердил scope change, а orchestrator проверил, что это не ломает DOD задачи, owner split и acceptance boundary;
- `DOD gap`: комментарий показывает пропущенный шаг, нужный для named epic или milestone DOD. Orchestrator должен предложить named follow-up с parent issue, sequence, blocker status, owner и ожидаемым моментом выполнения до создания или запуска задачи;
- `vision guardrail`: комментарий уточняет целевую продуктовую модель, user mental model или архитектурное направление. Его нужно записать в brief, alignment issue или vision doc как guardrail без расширения active task;
- `future option`: комментарий описывает возможную будущую идею, не нужную для текущего DOD. Не превращать это в backlog noise. Сохранять в vision/parking note только если потерять идею будет дорого.

Перед созданием еще одного follow-up в той же области orchestrator должен показать closure discipline: сколько slices осталось до acceptance parent task или milestone, можно ли принять parent уже сейчас и почему новый slice нужен именно сейчас, а не может быть отложен.

### Product Capability Closed Loop

Задачи, которые обещают продуктовую возможность, должны описывать и затем доказывать замкнутый пользовательский или операторский loop. Product capability не считается принятой только потому, что появились backend state, APIs, projections, readiness cards или сохраненные records.

Перед dispatch каждой задачи или backlog item orchestrator классифицирует тип задачи:

- `product capability`: пользователь или оператор может сделать что-то ценное в продукте. Нужен closed loop.
- `technical enabler`: backend, data, API, contract, migration, infrastructure или projection work. Такая задача может быть принята без UI только если названа product capability или следующая задача, которая закрывает loop.
- `maintenance`: качество, debt, tooling, performance или guardrail. Нужен понятный payoff, timing, owner и stop condition.
- `research/spike`: снятие неопределенности. Нужен конкретный вопрос, output artifact и stop condition.
- `future option`: возможная будущая идея. Не превращать в backlog work без явного решения человека.

Closed loop для product capability должен отвечать:

1. Actor: кто владеет возможностью или пользуется ей.
2. Entry point: где actor находит ее в продукте.
3. Setup или configuration: где правила, лимиты, imports, доступы или defaults задаются и кем.
4. Input или action: что actor делает.
5. Processing или enforcement: что система делает до и после действия.
6. Feedback: что actor видит сразу.
7. State: где позже видны status, usage, readiness, errors, limits или exhausted states.
8. Recovery или next action: что actor делает при блокере, invalid state, conflict или исчерпанном лимите.
9. Audit и provenance: что записывается без раскрытия private data, secrets, prompts, provider internals или protected partner information.
10. Verification: как reviewer может smoke-нуть loop через UI, API или оба слоя.

Если loop отсутствует, orchestrator не должен ждать приемки, чтобы найти дыру. Он должен проактивно набросать вероятный loop, попросить человека подтвердить или урезать MVP, а затем обновить текущую задачу, отделить technical enabler от product-loop task, связать существующие задачи как parent/child или явно пометить, что задача не является product-complete до приемки linked loop.

Backend-only slices валидны, если они честно scoped как technical enablers. Их нельзя подавать как завершенные product capabilities, пока связанная closed-loop задача не принята или явно не вынесена out of scope human decision.

Проверка двусторонняя:

- Если задача начинается с backend, data, API, permissions, storage, AI или infrastructure, orchestrator должен определить product capability, actor, surface и scenario loop, которые эта техника включает. Если product loop отсутствует, orchestrator предлагает его и согласует с человеком до dispatch.
- Если задача начинается с UI, product surface, design, navigation или copy, orchestrator должен определить backing contracts: data source, backend/API, persistence, permissions, loading/empty/error states, recovery path, audit/provenance и реальные сценарии, которые UI должен поддержать. Если backing implementation отсутствует, orchestrator связывает или создает technical enabler до того, как UI считается product-complete.

Эта взаимная проверка защищает цельность продукта. Она должна помогать команде строить интуитивные end-to-end workflows, где frontend, backend, data, permissions и recovery states складываются в usable product, а не в набор правдоподобных, но разрозненных slices.

## Личный Framework Orchestrator

У каждого участника должен быть один личный Framework Orchestrator thread на активный product stream или epic. Это не implementation worker. Это локальная control room для Codex-работы участника.

Orchestrator держит:

- текущий compass, brief и task sequence;
- ссылки на активные GitHub epic/task issues, PRs и общий alignment issue;
- последнюю Local Alignment Packet и Team Alignment Delta;
- активные task threads, их titles, branches, PRs, owners и status;
- pending decisions, missing inputs, merge events и acceptance gates;
- инструкцию запустить или продолжить следующий task thread.

Orchestrator почти не должен редактировать product code. Его обычная работа - читать durable artifacts, обновлять GitHub shared memory, решать, может ли участник безопасно продолжать, и создавать или готовить task threads для реализации.

### Task Thread Dispatch

Для каждой implementation task, которая может идти автономно, использовать отдельный task thread.

Правила dispatch:

- один task thread отвечает за один главный outcome задачи;
- title thread должен быть стабильным и сканируемым: `[#<issue>] <sequence> <short title>`; если у задачи есть sequence в epic или milestone, он обязателен в названии, например `[#42] 02.1 Data import access boundary`;
- task thread получает task issue, последнюю релевантную Team Alignment Delta, scope, out of scope, verification expectations, current-branch smoke rule и место handoff;
- orchestrator записывает ссылку/id task thread, pending worktree или manual-start prompt в task issue или orchestrator state, если это доступно;
- если Codex thread tools недоступны, orchestrator готовит точный title и startup prompt, чтобы человек создал thread вручную;
- когда task thread завершает implementation, он запускает `$accept-work` внутри task thread, включает результат в final report и возвращает этот report в orchestrator.

### Task Thread Auto-Launch And Resume

Автоматизация должна быть нативной, но не фоновой магией. Когда человек в orchestrator thread говорит "продолжай", "запусти следующую", "проверь поток" или похожую короткую команду, orchestrator сам восстанавливает durable state и выбирает действие:

- если следующая approved/ready задача не имеет task thread, создать его через Codex thread tools или подготовить точный manual-start prompt;
- если task thread уже есть, открыть или инспектить его по сохраненному id/link;
- если task thread завершил implementation без `$accept-work`, отправить туда короткую команду запустить `$accept-work` из текущего task context;
- если `$accept-work` уже дал `ACCEPT` или `ACCEPT_WITH_FOLLOWUPS`, обновить sequence, DOD impact и выбрать next best action.

Запуск task thread разрешен только для задачи с понятным scope, out of scope, acceptance criteria, verification, `Codex Task Contract`, `DOD Impact` и `Burn / Limits`. Orchestrator не должен подменять implementation worker собой.

### Уроки из параллельной работы

Последняя параллельная работа показала несколько универсальных уроков:

- shared consumer/producer contracts нужно записывать в task или alignment issue до того, как implementation threads разойдутся;
- stacked PRs требуют явного baton: что уже смержено, что продолжается дальше, что на паузе, какое review или smoke осталось;
- missing inputs вроде design reference или точной source link должны становиться pending inputs, а не оставаться только в чате;
- релевантные merge events - это alignment events, после них нужна короткая delta до продолжения зависимой работы;
- приемка сильнее, когда orchestrator проверяет scope, latest alignment, handoff и current-branch smoke до того, как задача считается done;
- DOD-burndown важнее количества закрытых slices: каждая новая task должна двигать named epic или milestone DoD row, иначе она остается backlog/follow-up;
- продуктовые комментарии во время реализации требуют triage до tasking: нужно отличать current scope changes, DOD gaps, vision guardrails и future options, чтобы product compass улучшался без неконтролируемого slice growth;
- burn нужно проверять только там, где есть реальный риск затрат: AI generation, paid APIs, долгие agent loops, тяжелые smoke/build циклы, внешнее demo или repeated retries.

## Операционный цикл

### 1. Project Compass

Перед крупной работой определить компас:

- какой продуктовый результат важен;
- кто пользователи или участники;
- какой full flow должен заработать;
- что уже существует и не должно дублироваться;
- какие ограничения не обсуждаются;
- какой первый полезный slice.

Компас должен быть коротким. Он задает направление и масштаб, а не все детали.

### 2. Epic Brief

У каждого осмысленного эпика должен быть brief до реализации.

Brief должен покрывать:

- назначение;
- текущее состояние;
- целевое поведение;
- scope;
- out of scope;
- зависимости;
- риски;
- owner или decision maker;
- acceptance criteria;
- ожидаемые tests или smoke checks;
- handoff expectations.

Если агент не может понять эпик без чтения длинного треда, brief недостаточно хорош.

### 3. Cross-Agent Alignment

Перед тем как эпик станет implementation work, нужно использовать Codex для проверки, как он касается других эпиков.

Выходом должен быть короткий alignment packet:

- какие assumptions есть у эпика;
- от каких других эпиков или surfaces он зависит;
- какие contracts или shared concepts он может поменять;
- что должен знать агент другой части команды;
- что нужно добавить в project memory до dispatch.

Этот packet - практический мост между Codex-инстансами под руководством разных людей. Им не нужно напрямую общаться, если они читают и обновляют одни и те же durable artifacts.

### 4. Task Design

Каждая автономная задача должна содержать достаточно контекста, чтобы ее мог выполнить свежий агент.

Минимальный формат задачи:

```md
## Short Description

## Goal

## Read First

## Current State

## Scope

## Out Of Scope

## Contracts And Rules

## Alignment Hooks

## Codex Task Contract

## DOD Impact

## Burn / Limits

## Acceptance Criteria

## Verification

## Completion Gate

## Handoff
```

Хорошая задача говорит не только что сделать, но и что нельзя сломать.

`Alignment Hooks` должен говорить, когда агент читает последнюю Team Alignment Delta и когда публикует или готовит Local Alignment Packet: material scope/contract changes, conflicts, blockers, accepted results или follow-up split.

`Codex Task Contract` должен называть orchestrator thread, task thread, alignment issue и финальное правило: до final completion task thread запускает `$accept-work` и сообщает один статус: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES` или `BLOCKED`.

`DOD Impact` должен коротко говорить, какую строку epic/milestone DoD задача двигает или закрывает. Если задача не двигает named DoD, orchestrator должен спросить, почему это не backlog или polish.

`Burn / Limits` должен быть коротким: `not material`, либо cap/stop condition для задач с AI generation, paid API, долгим agent loop, heavy verification или demo-risk. `$accept-work` проверяет burn только когда он material.

`Completion Gate` должен говорить, что task thread обязан запустить `$accept-work` внутри task thread до финального completion. Issue не считается accepted и не переводится в Done, пока этот результат не проверит original brief, latest alignment packets/deltas, verification, current-branch smoke когда требуется, и residual risks.

### 5. Dispatch

Назначать одну ясную задачу на одну пару человек-агент.

На человеческом уровне определить:

- owner;
- ожидаемый output;
- кто делает review;
- тип задачи: exploration, design-only, implementation, fix или rollout.

На уровне оркестрации Codex готовит технические детали: тело задачи, затронутые docs, alignment packet, предложенный branch/worktree, verification expectations и handoff requirements.

Не стоит давать нескольким агентам одновременно редактировать одну неясную продуктовую поверхность.

### 6. Agent Run

Агент должен:

- прочитать project instructions и task brief;
- прочитать последнюю релевантную Team Alignment Delta перед изменением shared surfaces;
- изучить существующий код и docs до предложения правок;
- назвать план, если задача нетривиальная;
- держать изменения scoped;
- сохранять unrelated user changes;
- публиковать или готовить alignment packet, когда trigger event меняет shared understanding;
- проверять результат до заявления о completion;
- запустить `$accept-work` внутри task thread до финального completion;
- оставить handoff.

Человеку не нужно микроменеджить каждую строку. Человек управляет на checkpoints.

### 7. Checkpoints

Checkpoints нужны, чтобы поймать отклонение рано.

Рекомендуемые checkpoints:

- после сбора контекста и плана;
- после изменений cross-agent alignment;
- перед изменением общей архитектуры или contracts;
- после первого working slice;
- перед PR;
- перед deploy;
- после smoke;
- когда агент нашел неожиданный конфликт или скрытую зависимость.

Checkpoint должен отвечать:

- что изменилось;
- что стало понятно;
- что рискованно;
- что заблокировано;
- какое human decision нужно;
- что будет дальше.

### 8. Review

Review должен смотреть в первую очередь на:

- поведенческую корректность;
- соответствие компасу;
- blast radius;
- скрытую связанность;
- недостающие tests;
- stale downstream state;
- rollout risk;
- нужно ли записать новые уроки.

Не стоит ревьюить только diff. Нужно ревьюить задачу относительно целевого flow.

Существенные задачи должны использовать `$accept-work` как acceptance gate. Implementation agent может описать свой результат, но acceptance лучше делать отдельным review step, если работа меняет shared contracts, user-facing behavior, data shape или cross-epic assumptions.

### 9. Handoff

Каждая завершенная задача должна оставлять короткий handoff:

```md
## Handoff

Branch:
Worktree:
PR:
Commit:

Changed files:

What changed:

Verification:

Known gaps:

Follow-up decisions:

Docs or issues updated:
```

Простая проверка: другой агент должен смочь продолжить без восстановления всего треда.

### 10. Memory Update

Когда появляется повторяющаяся ошибка, архитектурное решение или продуктовое правило, это нужно записать в устойчивую память проекта:

- основные инструкции для агентов;
- project compass;
- epic brief;
- rules document;
- lessons document;
- issue body;
- decision log.

Meeting notes и chat history полезны как вход, но недостаточны как память проекта.

## Формат человеческих встреч

### Ежедневный продуктовый разговор, 15-30 минут

Цель: чтобы люди нормально обсудили смысл, решения, сомнения и компромиссы.

Повестка:

- Что стало понятнее?
- Что изменилось в продукте, пользователях, ограничениях или приоритетах?
- Какие решения мы приняли?
- В чем мы сомневаемся?
- Что должно двигаться дальше?
- Кто принимает или ревьюит человеческое решение?

Выход:

- запись или transcript встречи;
- человеческие решения;
- открытые вопросы;
- примерные направления следующей работы.

Людям не нужно обсуждать branches, worktrees, test plans и подробные агентские чеклисты, если эти детали не влияют на продуктовое решение.

### Post-Meeting Codex Alignment, async

После каждой содержательной встречи каждый участник запускает один и тот же Codex alignment workflow, когда возвращается к работе. Команда для человека может быть короткой: "сделай daily alignment после последней встречи".

Codex должен:

- дистиллировать решения, changed assumptions, open questions и affected epics;
- проверить локальную работу участника и контекст активной задачи;
- опубликовать или supersede Local Alignment Packet участника в общем GitHub alignment issue;
- прочитать packets других участников, которые уже есть в issue;
- пересобрать dashboard issue из всех packets;
- опубликовать или обновить Team Alignment Delta, если контекста достаточно;
- превратить примерные направления работы в ready или almost-ready tasks;
- подсветить конфликты, дублирование, missing context и рискованные assumptions.

Workflow асинхронный. Если другие участники еще не опубликовали packets, Codex оставляет issue в WAITING или READY_WITH_CAUTIONS и говорит человеку, можно ли продолжать, продолжать узко или нужно ждать. Когда missing participant вернется позже, его Codex повторит тот же workflow и согласует новый packet с уже существующим journal.

### Agent Dispatch

После alignment каждый участник запускает или продолжает свой Codex от обновленных артефактов. Для implementation work личный Framework Orchestrator должен запустить или подготовить отдельный task thread, а не смешивать долгую реализацию с orchestration thread.

Минимальная инструкция:

```text
Read the latest project instructions, meeting distillation, relevant brief, and alignment packet. Continue only within the task scope. If you find a conflict with another active epic or assumption, stop and report it before implementation.
```

Codex сам обрабатывает технический чеклист: branch/worktree, files, tests, smoke checks и handoff.

### Легкий async update

Когда нужно, люди пишут только:

- какое decision нужно;
- что заблокировано;
- что готово к review;
- какой artifact прочитать.

Технические детали остаются в agent handoffs, если не влияют на человеческое решение.

### Личный Framework Orchestrator Thread

У каждого участника должен быть один постоянный личный Codex thread на активный product stream или epic. Этот thread живет framework, brief, GitHub shared memory, task sequence, daily/merge alignment и acceptance gates. Он не должен становиться местом большой implementation work.

Обычная команда человека может быть короткой:

```text
Используй $framework-orchestrator и продолжи этот поток.
Запусти большую тему по итогам встречи.
Сделай daily alignment после последней встречи. Используй repo workflow.
Прими эту задачу с учетом brief и alignment history.
Запусти следующий task thread, если следующая задача готова.
```

Codex после этого должен использовать подходящий repo-scoped skill, следовать соответствующему workflow из `docs/codex-workflows` и держать GitHub issues, briefs, deltas, task threads и project memory согласованными.

Во время implementation task thread может публиковать или готовить event-triggered alignment packets, но orchestrator должен решить, как packet влияет на поток. Используйте lightweight packet только когда есть реальная coordination value, и избегайте шумных updates про обычный локальный прогресс.

Минимальный orchestrator state:

```md
## Framework Orchestrator State

Owner:
Product stream / epic:
Compass / brief:
Alignment issue:
Latest meeting or event processed:
Latest Team Alignment Delta:

Active tasks:
- <issue> | <sequence/title> | <owner> | <task thread/pending> | <branch/PR> | <DOD impact> | <status> | <next>

Pending decisions or inputs:

Can continue:
Next action:
```

## Формат еженедельной работы

### Weekly Product Alignment, 45-60 минут

Цель: держать людей aligned по направлению, а не по механике инструментов.

Повестка:

- Что мы узнали о пользователях, продукте, рынке, качестве или ограничениях?
- Что изменилось в compass?
- Какие decisions все еще не закрыты?
- Какие 1-3 outcomes главные на следующую неделю?
- Что нужно остановить, продолжить или упростить?

Выход:

- обновленный compass, если нужно;
- priorities и non-goals;
- decisions для Codex, которые нужно превратить в artifacts;
- open questions для research или design.

### Weekly Codex Orchestration Review, 20-30 минут

Цель: Codex аудирует механику проекта, чтобы людям не обсуждать ее вручную.

Codex должен проверить:

- active branches;
- dirty worktrees;
- stale local servers;
- untracked files;
- PRs waiting for review;
- stale tasks или briefs;
- decisions со встреч, которые не превращены в work artifacts;
- experiments, которые нужно merge, split, isolate или archive.

Выход:

- короткое human summary;
- cleanup recommendations;
- risks, где нужно human decision;
- task/doc updates, которые Codex может выполнить после approval.

### Weekly Lessons Review, 20 минут

Цель: превратить боль в процесс.

По каждому дорогому моменту записать:

- что произошло;
- почему это было дорого;
- какой ранний сигнал мы пропустили;
- новое правило или пункт checklist;
- где теперь живет это правило.

Если урок не записан, считать, что он повторится.

## Месячные или поэпиковые ритуалы

### Epic Kickoff

Перед большим эпиком:

- написать epic brief;
- определить shared contracts;
- определить первый slice;
- определить out-of-scope;
- попросить Codex подготовить alignment packet и task breakdown;
- отревьюить предложенные risks и open questions.

### Epic Closeout

После эпика:

- сравнить outcome с compass;
- перечислить shipped artifacts;
- перечислить missed assumptions;
- записать follow-up tasks;
- архивировать stale experiments;
- обновить rules или lessons.

## Rules

### Context Rules

- Нет большой задачи без compass.
- Нет автономной реализации без epic brief или task brief.
- Не считать chat history единственным source of truth.
- Хранить project memory в репозитории.
- Когда context меняется, обновить задачу или brief до продолжения.
- Считать продуктовые комментарии внутри active epic compass notes, пока они не классифицированы как confirmed scope change, DOD gap, vision guardrail или future option.

### Task Rules

- У одной задачи должен быть один главный outcome.
- Out-of-scope должен быть явным.
- Нужно указать, какое существующее поведение должно остаться валидным.
- Expected verification нужно указать до старта агента.
- Задачу нужно split, если она без ясных границ смешивает product design, architecture, implementation и rollout.

### Agent Rules

- Сначала читать instructions и task docs.
- Сначала изучать существующую систему, потом редактировать.
- Использовать Codex для brief drafting и consistency review перед большой implementation work.
- Использовать личный Framework Orchestrator thread, чтобы связывать brief, sequence, alignment state, task threads и acceptance gates.
- Не делать большую implementation work внутри orchestrator thread; отправлять ее в task thread с ясным title и startup prompt.
- Называть task threads стабильно: `[#<issue>] <sequence> <short title>`, если issue id или sequence доступны.
- Предпочитать существующие patterns новым abstractions.
- Держать edits scoped.
- Сохранять unrelated dirty work.
- Останавливаться на checkpoint при изменении shared contracts или assumptions.
- Проверять результат до заявления о completion.

### Orchestration Rules

- Orchestrator должен читать latest durable state перед рекомендацией следующего действия: framework, brief, relevant GitHub issues/PRs, latest Team Alignment Delta и active task handoffs.
- Orchestrator может создать или подготовить новый task thread только когда задача approved или достаточно ready: есть scope, out of scope, acceptance criteria, verification expectation, `DOD Impact` и `Burn / Limits`.
- Task thread name должен включать issue id и sequence, если они есть, чтобы люди и Codex могли сопоставить sidebar с brief/GitHub без открытия issue.
- Orchestrator должен записывать ссылки/ids активных task threads, pending worktree или manual-start prompt в GitHub shared memory, когда это доступно.
- При короткой команде продолжения orchestrator сам запускает или возобновляет next ready task thread; если task thread завершился без `$accept-work`, orchestrator отправляет туда команду на `$accept-work`.
- Когда человек добавляет product vision или future-state commentary во время implementation, orchestrator должен провести Product Compass Note Triage до расширения scope, создания follow-ups или изменения task order.
- После daily, содержательной встречи, merge, blocked event, accepted result или follow-up split orchestrator должен запустить или направить в `$daily-alignment` до продолжения зависимой работы.
- После сообщения task thread о completion orchestrator должен проверить, запускал ли task thread `$accept-work`. Если нет, он отправляет эту команду обратно в task thread. Если да, использует результат, чтобы выбрать next best action.
- Каждая substantial task должна иметь `DOD Impact`; новый slice разрешен только если он двигает named epic/milestone DoD или явно принят как exception.
- `Burn / Limits` обязателен для задач с material cost/retry/generation risk и может быть `not material` для обычных задач.
- Если shared packets отсутствуют, orchestrator должен вернуть `continue with cautions`, `wait` или `blocked`, а не придумывать локальное состояние другого участника.

### Git And Environment Rules

- Codex должен управлять branch/worktree и local runtime деталями как частью technical orchestration.
- Люди обсуждают эти детали только когда они влияют на product risk, rollout risk или работу другого человека.
- Experiments должны быть isolated, пока человек не подтвердил их продуктовое направление.
- Перед PR Codex должен объяснить changed files, blast radius и verification человеческим языком.

### Review Rules

- Ревьюить относительно product flow, а не только diff.
- Проверять, согласована ли работа с другими активными эпиками.
- Проверять hidden downstream effects.
- Проверять, может ли state стать stale.
- Проверять, сможет ли следующий агент понять handoff.
- Если проблема появилась дважды, превратить ее в rule.

### Verification Rules

- Tests доказывают только то, что покрывают.
- Browser или product smoke нужен для user-facing behavior, когда это feasible.
- По завершении задачи Codex должен организовать свежий smoke на точной текущей ветке/worktree, которую принимают. Нельзя опираться на старые локальные серверы, старые browser tabs или frontend/backend процессы, запущенные из другой ветки.
- Перед smoke Codex должен подтвердить branch/worktree identity, поднять или перезапустить нужные backend и frontend из этого же worktree и записать, какой commit или local state был проверен.
- Если verification step пропущен, явно сказать почему.
- Не заявлять completion без свежей verification.
- Не доверять generated artifacts без проверки, что они meaningful, current и traceable.

### Memory Rules

- Каждое устойчивое продуктовое решение должно жить вне чата.
- Transcripts встреч - это raw inputs, а не project memory, пока Codex не дистиллировал их и человек не подтвердил результат.
- Каждое cross-epic assumption должно быть записано там, где его увидят другие агенты.
- Каждая повторяющаяся ловушка должна стать rule, checklist item или documented lesson.
- Каждый эпик должен оставить достаточно памяти, чтобы новый агент мог продолжить.
- Handoff - часть работы, а не необязательное приложение.

## Минимальные шаблоны

### Meeting-To-Codex Prompt

```md
# Meeting-To-Codex Orchestration

Use this framework to process the meeting transcript.

Input:
- meeting recording/transcript:
- current compass or brief:
- active epics/tasks:

Produce:
1. decisions made;
2. changed assumptions;
3. affected epics/tasks;
4. cross-agent alignment risks;
5. open questions;
6. docs/issues/briefs to update;
7. ready or almost-ready tasks;
8. what each team member's Codex should read next;
9. what needs human approval before dispatch.
```

### Daily Human Note

```md
# Daily Human Note

Date:
Main decision or shift:

Open questions:

Next work areas:

Needs Codex distillation:
```

### Weekly Human Note

```md
# Weekly Human Note

Week:

What we learned:

Compass changes:

Decisions made:

Next outcomes:

Open questions:

Needs Codex orchestration:
```

### Agent Task Handoff

```md
# Agent Task Handoff

Task:
Owner:
Branch / worktree:
PR / commit:

Changed:

Verified:

Not verified:

Risks:

Next:

Docs updated:
```

### Task Thread Startup Prompt

```md
# Task Thread Startup

Thread title:
Task issue:
Owner:
Orchestrator thread:
Alignment issue:
Latest Team Alignment Delta:
DOD impact:
Burn / Limits:

Read first:
- AGENTS.md
- collaboration framework
- task issue
- latest relevant Team Alignment Delta
- related brief or design doc

Scope:

Out of scope:

Acceptance criteria:

Verification:
- include current-branch smoke when user-facing or integration-affecting

Completion gate:
- before final completion, run $accept-work inside this task thread
- include the acceptance status in the final report

Handoff back to orchestrator:
- branch/worktree
- PR/commit
- accept-work status
- DOD impact result
- burn check
- changed surfaces
- verification
- open risks
- whether an event-triggered alignment packet is needed
- recommended orchestrator next action
```

### Alignment Packet

```md
# Alignment Packet

Epic / task:
Owner:

Assumptions:

Depends on:

May affect:

Shared contracts or concepts:

Other agents must know:

Docs/issues to update before dispatch:
```

### Meeting Distillation

```md
# Meeting Distillation

Meeting:
Date:
Transcript / recording:

Decisions:

Changed assumptions:

Affected epics / tasks:

Alignment risks:

Open questions:

Docs / issues / briefs to update:

Approved by:
```
