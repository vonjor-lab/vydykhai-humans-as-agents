# Фреймворк совместной вайб-разработки «Выдыхай»

Версия: 1.6.0
Статус: каноническое операционное ядро

«Выдыхай» - это фреймворк для совместного вайбкодинга, где люди работают как агенты смысла и продуктового направления. AI-оркестратор помогает превратить сырую цель в компас, брифы, согласованные task threads, alignment, приемку и понятный next-best-action.

## Источники

Фреймворк вырос из продуктовых встреч и практической работы нескольких людей, репозиториев, веток и AI-агентов: долгих задач, лабораторных экспериментов, неудачных handoff, потерянного локального контекста и дорогих перезапусков. Эти уроки легли в правила ниже; детали конкретных проектов в универсальный репозиторий не входят.

## Назначение

«Выдыхай» нужен, когда несколько людей и AI-агентов асинхронно делают один продукт и иначе могут:

- по-разному понимать общую цель;
- дублировать или ломать работу друг друга;
- создавать правдоподобные технические слайсы без законченного пользовательского пути;
- терять решения в чатах, локальных worktree и незакоммиченном состоянии;
- слишком поздно замечать, что деньги и время тратятся не в том направлении.

Фреймворк должен уменьшать координационную работу людей. Люди обсуждают продукт и принимают решения; оркестратор поддерживает последовательность, общую память, handoff и контрольные точки.

## Диагноз

Два режима плохо работают по отдельности:

- В ручном режиме человек постоянно стоит рядом с агентом, и работа останавливается без него.
- В эпик-режиме агент получает большую цель, но дорого ошибается, если бриф, ограничения или checkpoint недостаточны.

«Выдыхай» объединяет эти режимы: компас и контракт задачи проектируются сверху вниз, агент работает автономно, а человек подключается только в заранее названных точках.

## Операционная модель

- Продуктовый компас хранит цель, пользователей, желаемый результат, DOD, non-goals, ограничения и текущие решения. Он может меняться, но не незаметно.
- У каждого участника есть один активный Framework Orchestrator на product stream. Он организует работу и не пишет продуктовый код.
- Research, lab и implementation идут в отдельных сфокусированных контекстах.
- GitHub issues и PR либо аналогичный общий tracker хранят durable state. История чата является свидетельством, но не source of truth.
- Task threads отвечают за implementation, исправления, `$accept-work`, smoke на точном актуальном коде и ручной merge после подтверждения человека.
- Оркестратор отвечает за sequence, alignment, dispatch, запросы человеку, health checks и next-best-action.

Один активный оркестратор не означает один вечный тред. Его нужно менять, когда контекст перестает быть компактным и надежным.

## Активация

Фреймворк работает только после установки комплекта в целевой product repo и запуска агентской сессии из этого репозитория. Обычный человеческий интерфейс - один запрос в задаче агента, подключенной к целевому repo:

```text
Подключи Vydykhai к этому проекту и запусти оркестратор. Все технические шаги сделай сам по BOOTSTRAP.md; спрашивай меня только о недостающем доступе или решении: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

Обязательный порядок:

1. Bootstrap-агент определяет target repo, сохраняет существующую работу, устанавливает или обновляет kit и запускает `doctor`.
2. Он проверяет diff, готовит setup commit или PR и оставляет project rules вне managed files.
3. Он создает Project State и запускает личный Framework Orchestrator из target repo.
4. `$project-launch` создает Project Operating Brief, компас, первый DOD, registry участников, общую память и первый маршрут.
5. После принятия setup change каждый участник делает обычный pull и подтверждает активацию через своего orchestrator.

Bootstrap-запрос разрешает setup branch/PR и общие operating artifacts. Он не разрешает merge, destructive overwrite, платные действия, production changes или раскрытие private data. Если не хватает tool или доступа, агент просит только эту возможность и не перекладывает команды установки на человека.

## Профиль агента

Политика по умолчанию - `latest available flagship / xhigh`: самая сильная доступная участнику универсальная модель для coding и agentic work с reasoning Extra High.

- Выбирать по текущей доступности в harness и актуальному авторитетному model guidance, а не только по номеру версии.
- Записывать policy, resolved model id, reasoning effort, дату/источник проверки и fallback в Project State.
- Повторять проверку при bootstrap, framework update, создании или ротации orchestrator, model rejection/deprecation и активном Health Review не реже одного раза в семь дней.
- Явно передавать resolved profile новым и возобновляемым контекстам, если tools это поддерживают.
- Если discovery недоступен, использовать рекомендованный harness flagship и отмечать verification pending.
- Если flagship не поддерживает `xhigh`, использовать его максимальный поддерживаемый reasoning и записывать fallback; не выбирать автоматически Max или Ultra.
- Не делать silent downgrade. Человек может явно выбрать более дешевый или быстрый profile для названного scope.

Universal rules не фиксируют сегодняшний model id, поэтому будущий flagship можно принять без нового релиза фреймворка.

## Приоритет источников

Если источники противоречат друг другу, действует такой порядок:

1. Последнее явное решение человека для затронутого scope.
2. Согласованный compass, brief, DOD, Brief Patch или Team Alignment Delta.
3. Актуальные task issue, PR, принятый artifact и проверенное состояние репозитория.
4. Планы, summaries и handoff агентов.
5. Предположение по коду, истории чата или локальному состоянию.

План агента не может отменить более позднюю человеческую корректировку. Перед продолжением зависимой работы решение нужно записать в durable state. Останавливается только затронутый scope; независимая работа может продолжаться в явно названных границах.

## Операционный цикл

### 0. Запуск

Подключить repo, участников, coordination inputs, source of truth, privacy rules, компас и первый DOD. Зарегистрировать активные оркестраторы в Project State.

### 1. Осмысление

Использовать `$start-work`, чтобы превратить сырую цель, вывод встречи или большую тему в epic brief и task map. Начинать с продуктового результата, затем определять сущности, contracts, зависимости, риски, sequence, ownership и acceptance.

Если компас меняется, публиковать видимый patch или re-brief. Не менять активные задачи молча.

### 2. Выбор режима

Выбирать минимальный полезный контекст:

- Research Thread: ограниченный продуктовый или технический вопрос еще не готов для brief. Product code не меняется. На выходе короткий Research Packet; после incorporation тред архивируется.
- Lab Mode: изолированная реализация или эксперимент сокращают риск, стоимость или время обратной связи. До запуска определить proof, stop condition, burn cap и production-transfer plan.
- Task Thread: результат и граница приемки достаточно ясны, чтобы реализовывать их в реальном продуктовом пути.

Research уменьшает неопределенность. Lab уменьшает стоимость исполнения. Task доставляет принятый продуктовый или enabling результат.

### 3. Dispatch

Минимальный task contract содержит:

- Goal и DOD impact;
- Scope и out of scope;
- Product loop либо связанный enabling contract;
- Human checkpoint;
- Burn / limits, когда расходы существенны;
- Verification и completion route.

Lab Mode, Peer Compass Review, model profile и подробные contracts добавляются только когда нужны. Оркестратор создает или готовит task thread, проверяет его реальное название, записывает ссылку и убеждается, что работа началась. Ответ child thread только с планом не считается прогрессом.

### 4. Исполнение

Task thread автономно реализует задачу внутри контракта. Он останавливается и возвращается за re-brief, если меняются цель, source of truth, общий contract, burn cap или human checkpoint.

### 5. Alignment

Использовать `$daily-alignment` после содержательной встречи или события, которое меняет безопасное следующее действие другого участника. Опубликовать local packet, согласовать нужные packets, перестроить текущий dashboard и явно сказать, что может продолжаться.

Отсутствующий участник не блокирует независимую работу. Работа на его активной поверхности или contract продолжается только в явных cautions либо ждет его packet.

### 6. Приемка

Перед завершением task thread запускает `$accept-work`. Приемка сравнивает результат с последним решением человека, brief, DOD, deltas, product loop, burn, тестами и smoke evidence.

Для runtime-работы smoke проводится на точных branch, worktree, commit, frontend, backend и browser target, которые принимаются. Старый сервер или другая ветка не подходят. Backend state, UI shell или lab proof сами по себе не закрывают product capability.

После ручного smoke человек делает manual merge из task thread. Затем оркестратор обновляет DOD burn, alignment, parent closure и next-best-action.

### 7. Health Review

Короткий Health Review проводится после milestone, нескольких принятых слайсов, повторяющихся follow-ups, остановки DOD burn, выпадения owner, повторных context compaction или когда работа начинает зависеть от археологии по чатам.

Проверяется:

- продвижение к compass и DOD;
- blockers, повторные затраты и technical slicing без продуктового прогресса;
- research и lab outputs, которые не попали в реальный продуктовый путь;
- stale tasks, PR, branches, worktrees, monitors и alignment windows;
- решения, оставшиеся вне durable state;
- необходимость сменить активный orchestrator.

## Люди как агенты

Люди являются событийными участниками системы, а не ее скрытыми диспетчерами. Когда нужен человек, оркестратор должен сообщить:

- кто должен действовать;
- что проверить или решить;
- точную ссылку, задачу или prompt;
- куда попадет результат;
- что тем временем можно безопасно продолжать;
- какой return sync возобновит поток.

У каждой задачи есть один `Human checkpoint`:

- `none`;
- `product decision`;
- `visual review`;
- `paid or external action approval`;
- `manual smoke and merge`.

Оркестратор не должен говорить, что участие человека не требуется, если впереди есть названный checkpoint.

## Асинхронная совместная работа

Достаточно двух компактных durable artifacts:

- Project State: compass, DOD, registry участников, активные orchestrators, текущие задачи и последнее alignment window.
- Alignment Window: append-only packets и deltas одной встречи, milestone или компактного рабочего периода.

Registry участников содержит: participant, orchestrator link, установленную версию фреймворка, resolved agent profile и дату проверки, latest packet, active task и status.

Перед стартом или продолжением работы на общей поверхности orchestrator каждого участника проверяет свою строку и публикует новый packet, если локальное состояние или результаты встречи существенно изменились. Нельзя придумывать незакоммиченное состояние другого участника.

При публикации Team Alignment Delta issue body перестраивается в той же операции. Alignment Window ротируется после milestone или когда перестает быстро читаться; архивное окно связывается из Project State.

## Встречи

Meetings, записи, transcripts, командные чаты и заметки являются одним слоем coordination inputs. Они остаются raw input, пока orchestrator не дистиллирует их, а человек не подтвердит изменения compass, scope, sequence, ownership или DOD.

После встречи достаточно короткой команды `сделай daily alignment`. Оркестратор читает доступный источник, обновляет durable state, просит недостающие packets только там, где они важны, и возвращает continue, continue with cautions, wait или blocked.

## Peer Compass Review

Peer Compass Review предлагается, когда задачи, PR, продуктовые поверхности, contracts или DOD rows пересекаются между owners. Оркестратор готовит review request и говорит человеку, к кому обратиться, что проверить, куда вернуть packet и что можно продолжать тем временем.

## Контракт монитора

- Один monitor следит за одним named gate или active stream.
- При неизменном состоянии и работе внутри scope он молчит.
- Уведомляет только о blocker, decision, drift, human checkpoint или terminal result.
- Не создает новый scope, не делает merge, не тратит деньги и не переосмысливает compass.
- При изменении gate обновляется существующий monitor, а не создается дубль.
- В terminal state либо при потере полезности monitor удаляется.

## Ротация оркестратора

Для одного участника и stream авторитетен один активный orchestrator. Ротация является двухфазным handoff, а не автоматической заменой:

1. Предыдущий orchestrator остается активным, целым и доступным по ссылке. Он публикует Rotation Memory Packet: compass/DOD, решения, queued/promised/deferred work, просьбы человека запомнить, working rules, monitors/follow-ups, checkpoints, participants, ambiguous и stale items.
2. Packet сверяется с Project State, issues/PR, project instructions/docs, текущим repo state и доступной историей thread. Каждый item получает статус already durable, missing durable state, ambiguous или stale/superseded.
3. Candidate orchestrator создается из актуальных repo/framework в read-only режиме. Он независимо проводит Memory Coverage Check и показывает omissions, conflicts и proposed durable destinations.
4. Актуальные missing items попадают в правильный durable source только после того, как человек увидел coverage delta; нельзя массово создавать задачи или молча возвращать старые идеи.
5. Человек явно подтверждает active switch. До подтверждения candidate не dispatch новые задачи, а active pointer не меняется.
6. После подтверждения candidate регистрируется active, а previous thread остается pinned historical/reference link. Его нельзя удалять или архивировать автоматически.

Если previous orchestrator недоступен, recovery отмечается incomplete, сохраняются safe boundaries, а полное memory coverage и смена направления требуют решения человека.

## Правила

- Orchestrator занимается только организацией.
- Universal rules хранятся в canonical framework, project rules - в product repo.
- Человеческое общение остается продуктовым; branch и worktree mechanics показываются только когда влияют на решение или риск.
- Implementation не начинается без goal, boundary, DOD impact, human checkpoint и verification route.
- Принятый sub-slice не закрывает parent, пока обещанные product loop и DOD не закрыты или явно не вынесены out of scope.
- Lab Mode не принимается как продуктовый результат без production transfer и real-flow verification.
- Secrets, transcripts, private product data, proprietary prompts и customer information не попадают в public framework artifacts.
- В установленных или распространяемых копиях фреймворка сохраняются license, creator metadata и required notice; они не распространяют права на project-specific работу.
- Используется `latest available flagship / xhigh`; resolved profile и дата проверки хранятся в Project State, fallback показывается явно. Universal rules не содержат hardcoded model version.
- Append-only evidence сохраняется, но текущие dashboards остаются короткими и актуальными.
- Next-best-action важнее status-only ответа.
- Active orchestrator нельзя переключать без Rotation Memory Packet, candidate Memory Coverage Check и явного подтверждения человека.

## Skills и человеческий интерфейс

Внутренние repo-scoped skills:

- `$project-launch`: активировать проект и создать operating brief.
- `$framework-orchestrator`: восстановить state, координировать, dispatch, supervise и выбрать next-best-action.
- `$start-work`: превратить большую тему в epic и task map.
- `$daily-alignment`: асинхронно согласовать изменения встреч и событий.
- `$accept-work`: принять task, milestone или epic по актуальному intent и evidence.

Человеку не нужно вручную выбирать skill. В orchestrator достаточно естественных команд:

- `Запусти этот проект.`
- `Продолжи этот поток.`
- `Обработай последнюю встречу.`
- `Проверь работу и продолжи.`

Оркестратор сам выбирает и применяет нужный skill.
