# «Выдыхай»: командный автопилот для людей и AI

Версия: 1.23.1 | Статус: каноническое операционное ядро

«Выдыхай» - командный автопилот для людей, которые работают над одним проектом с AI. Он помогает и одному человеку с несколькими AI-сессиями, и распределенной команде с разными компьютерами, моделями и агентными средами превратить сырую цель в общий компас, разойтись по задачам без потери связности, сохранить возникающие идеи, принять результаты и снова собраться вокруг следующего шага. Люди остаются агентами смысла и решений, а их AI-оркестраторы поддерживают общую картину, последовательность, синки, приемку и next-best-action. Операционно Vydykhai поставляется как легкий фреймворк совместной работы, который после подключения исполняют сами агенты; людям не нужно изучать или вручную обслуживать его внутренние процедуры.

## Источники

Фреймворк вырос из продуктовых встреч и практической работы нескольких людей, репозиториев, веток и AI-агентов: долгих задач, лабораторных экспериментов, неудачных handoff, потерянного локального контекста и дорогих перезапусков. Эти уроки легли в правила ниже; детали конкретных проектов в универсальный репозиторий не входят.

## Назначение

Фреймворк подходит для совместной работы, если общую цель можно превратить в зафиксированные брифы, ограниченные задачи, проверяемые результаты и принятые следующие шаги. Совместный вайбкодинг остается его основным проверенным применением; более широкий vibe work использует тот же операционный цикл.

«Выдыхай» нужен, когда один человек работает через несколько AI-контекстов или несколько людей и AI-агентов асинхронно делают один продукт либо движутся к общему результату и иначе могут:

- по-разному понимать общую цель;
- дублировать или ломать работу друг друга;
- создавать правдоподобные технические слайсы без законченного пользовательского пути;
- терять решения в чатах, локальных worktree и незакоммиченном состоянии;
- слишком поздно замечать, что деньги и время тратятся не в том направлении.

Фреймворк должен уменьшать координационную работу людей. Люди обсуждают продукт и принимают решения; оркестратор поддерживает последовательность, общую память, handoff и контрольные точки. Человек может свободно высказывать полезные идеи, не раздувая текущую задачу и не отвечая за то, чтобы вспомнить их позже.

## Диагноз

Два режима плохо работают по отдельности:

- В ручном режиме человек постоянно стоит рядом с агентом, и работа останавливается без него.
- В эпик-режиме агент получает большую цель, но дорого ошибается, если бриф, ограничения или checkpoint недостаточны.

«Выдыхай» объединяет эти режимы: компас и контракт задачи проектируются сверху вниз, агент работает автономно, а человек подключается только в заранее названных точках.

## Операционная модель

- Продуктовый компас хранит цель, пользователей, желаемый результат, DOD, non-goals, ограничения и текущие решения. Он может меняться, но не незаметно.
- Тред сопровождения канонического фреймворка развивает только универсальные правила, релизы и инструменты; он не устанавливает фреймворк в продуктовые репозитории и не управляет их оркестраторами. Отдельно у каждого участника есть один активный Framework Orchestrator на product stream. Он организует конкретный проект и не пишет продуктовый код.
- Исследование, лаборатория, исполнение и обслуживание проекта идут в отдельных сфокусированных контекстах. Только в них выполняется проектная работа.
- Общий Git-репозиторий хранит framework и project files. GitHub Repo + Issues/Projects/PRs является рекомендуемым sync space; аналогичный tracker подходит, только если все участники и их оркестраторы видят одно связанное состояние. Локальные копии и история чата являются evidence, но не source of truth.
- Project Memory Graph связывает стабильные продуктовые anchors с текущими решениями, переиспользуемыми уроками, подтвержденными будущими идеями и безопасными операционными указателями в одном компактном общем представлении.
- Оркестратор решает, что, зачем, когда и кем делается, и поддерживает DOD Control Line, sequence, alignment, dispatch, запросы человеку, общую память, parent closure и next-best-action. Внешний Project Guard принадлежит проекту и переживает context оркестратора: события и schedule запускают deterministic check, а свежий maximum-profile Governor разбирает только anomaly и направляет ограниченный repair либо rotation. Проектную работу они не выполняют. Оркестратор на maximum-profile может использовать ограниченных внутренних advisory agents для улучшения control decision, но их анализ одноразовый и не может владеть проектным результатом, создавать принятое project evidence или заменять focused context.
- Task contexts решают, как доставить и доказать один принятый инкремент: локальный план, implementation, debugging, исправления, `$accept-work`, smoke на точном актуальном коде, ручной merge после подтверждения человека и автоматический return по объявленным triggers.
- Task обнаруживает границу исполнения, а оркестратор решает, как на нее реагировать на уровне проекта. Ни одна роль молча не забирает работу другой. Сфокусированная работа и задача обновления фреймворка возвращаются только проектному оркестратору, который сам принимает обновление. Возможный универсальный урок уходит наверх только отдельным явным обезличенным пакетом совместимости, а не как состояние проектной задачи или следующее действие проекта.
- У одного принятого инкремента есть один owning execution context, один Execution Lease и один канонический Candidate, если brief явно не разрешает parallel-safe работу. Следующие инкременты ставит в sequence оркестратор, не растягивая один task на весь продуктовый маршрут.

Agent context - это логическая граница, а не функция конкретного продукта. Он может быть thread, chat, session, run, workspace или tracker-linked agent. Названия - это навигация, а не второй tracker: contexts, которые двигают цель проекта, и каждая понятная человеку ссылка на работу имеют вид `<work-id> [<track>] [<mode>] — <короткий результат>` на рабочем языке проекта, с номером в начале и фиксированными тегами. GitHub использует owning Issue, другой tracker - стабильный task key; PR или context id не заменяют идентичность работы. Обычный execution опускает mode; остальные режимы - `[DISCOVERY]`, `[LAB]`, `[MAINT]` и `[REVIEW]`. Только служебная работа по поддержанию системы координации, а не достижению цели проекта, выносит в начало короткий уникальный service id: версию framework, поколение rotation или incident Guard; Project State issue не используется как work id. Голые номера task, PR или context не используются; artifact называется `PR #456 → #123 [DOD1] — <короткий результат>`. Обезличенный пакет наверх не содержит названий проекта или людей, номеров и ссылок задач, очереди, закрытых материалов, текущего состояния проекта или его следующего действия.

Один активный оркестратор не означает один вечный context. Он именуется `[ORCHESTRATOR] <проект> — Vydykhai <версия>`, а замененный предшественник - `[RETIRED][ORCHESTRATOR] <проект> — Vydykhai <версия>`; `[FRAMEWORK] Vydykhai — maintenance` зарезервирован для универсального сопровождения. Меняющийся статус хранится в durable Project State, закреплен или выведен на первый план только один active orchestrator, а focused work архивируется после terminal Return Sync и artifact disposition. Project Guard независимо замечает потерю liveness, а Governor по evidence решает: продолжать, ремонтировать или входить в подтверждаемую rotation. Сама compaction является только сигналом.

## Активация

Комплект фреймворка один раз устанавливается в целевой репозиторий и через него попадает ко всем участникам. Обычный человеческий интерфейс - один запрос coding agent, подключенному к целевому проекту, даже если проект пока существует только как идея:

```text
Подключи Vydykhai к этому проекту и запусти оркестратор. Сам определи возможности своей агентской среды и выполни BOOTSTRAP.md; спрашивай меня только о недостающем доступе или решении: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

Обязательный порядок:

1. Bootstrap находит или готовит приватный дом проекта, сохраняет существующую работу, устанавливает или обновляет kit и до создания нового инвентаризирует текущие artifacts.
2. `doctor` проверяет только целостность фреймворка; `$project-launch` доказывает реальные права repo/tracker, готовность участников, inputs, operations первого DOD, курс и control loop.
3. `$project-launch` при необходимости помогает сформировать сырую цель, затем создает Operating Brief, атомарный Project State v2, Project Memory Graph v3, первый DOD Control Line, Shared Sync Contract, tracker route и безопасные operational pointers.
4. Каждый участник получает принятый setup через pull; его собственный orchestrator доказывает локальный `doctor` и необходимый доступ к repo/tracker/inputs, потому что одна машина не может сертифицировать другую. После обновления активация доказывается только из собственного рабочего дерева действующего оркестратора на принятой ревизии проекта, а не из update task или временного merged-source checkout. Его собственные live/offline `doctor`, перечитанный новый core, название и Project State должны совпасть; иначе Governor возвращает `REPAIR` либо подтверждаемый `ROTATE`.
5. Активный orchestrator, внешний runner Project Guard, Governor baseline, маршрут Execution Lease и Return Sync по схеме durable outbox плюс wakeup проверяются readback, после чего один Project Activation Receipt показывает evidence, безопасные ограничения, первый маршрут и next-best-action. Без независимого scheduler activation явно ограничена и не обещает background recovery.

Bootstrap-запрос разрешает setup branch/PR и общие operating artifacts, но не merge, destructive overwrite, платное действие, production change или раскрытие private data. Идею можно осмыслять, пока готовится приватный дом проекта, но shared execution и заявления о team alignment ждут прохождения нужных activation gates. Если не хватает tool или доступа, агент дает человеку одно точное действие.

### Контракт общей синхронизации и готовность проекта
Для распределенной работы Vydykhai нужны общий writable Git-backed repo и durable tracker. Рекомендуемый и лучше всего отлаженный вариант - GitHub Repo + Issues/Projects/PRs; аналог должен давать стабильные ссылки, историю, права, независимые обновления участников и read/write доступ агентам.
Project launch фиксирует `PASS / LIMITED / BLOCKED / NOT_REQUIRED` для home/kit, shared sync, людей, inputs, operations первого DOD, курса и control loop. Доступ к tracker доказывает первая настоящая запись Project State с readback; одноразовые проверочные artifacts запрещены.
Coordination input может быть напрямую доступен каждому нужному orchestrator или проходить через назначенного intake owner в подтвержденную traceable delta. Рекомендуется Fathom; подходят другой recorder, chat, docs, ручные заметки или общий agent-accessible notebook.
Operational readiness охватывает только текущий DOD: владельцев environments, текущий deployed baseline/revision, безопасные protected pointers, merge/deploy authority, non-destructive check, recovery route и stop conditions. Система не просит все credentials, не хранит secret values и не подразумевает production authority.
Только доказанный receipt возвращает `PROJECT_READY`; несущественные gaps дают `PROJECT_READY_WITH_LIMITS`, настоящее решение человека - `NEEDS_DECISION`, а доступ, блокирующий первый безопасный маршрут, - `BLOCKED_BY_ACCESS`. Отсутствующий участник блокирует только пересекающуюся работу.

## Профили по роли
Использовать последнюю доступную flagship-модель и расходовать reasoning там, где принимается решение:
- `ORCHESTRATOR`: максимальный доступный стабильный reasoning для compass, memory, routing, постановки задач, consultation, интеграции и next-best-action. Если среда использует это название, профиль соответствует `Ultra`.
- `DISCOVERY`: глубокий bounded reasoning для еще не определенного решения: ограниченного research, продуктового или архитектурного выбора, неясного UX/UI или визуального направления и проектирования эксперимента. Если доступно, профиль соответствует `XHigh`.
- `EXECUTION`: эффективный bounded reasoning для задачи, где решение и граница приемки уже определены. Если доступно, профиль соответствует `Low`.
Это environment mappings, а не требования к конкретному vendor. Профили выбираются по текущей доступности и авторитетному guidance; actual model, все три mapping и fallback записываются в Project State и перепроверяются при bootstrap, framework update, rotation, model rejection/deprecation и активном Health Review не реже раза в семь дней. Новому context явно передается его role profile, если tools это поддерживают; silent substitution запрещен. Текущая задача сохраняет принятый profile до настоящего re-brief.
Человек может изменить profile для названного scope. Максимальный reasoning не разрешает unbounded spend или внешнее действие, а любой profile не заменяет tests, smoke, acceptance и human checkpoints. Universal rules не фиксируют сегодняшний model id.

## Приоритет источников

Если источники противоречат друг другу, действует такой порядок:

1. Последнее явное решение человека для затронутого scope.
2. Согласованный compass, brief, DOD, Brief Patch или Team Alignment Delta.
3. Актуальные task issue, PR, принятый artifact и проверенное состояние репозитория.
4. Планы, summaries и handoff агентов.
5. Предположение по коду, истории чата или локальному состоянию.

План агента не может отменить более позднюю человеческую корректировку. Существенная поправка является memory event: нужно выяснить, отсутствовало ли знание, не нашлось, не применилось или не проверилось, и сохранить исправленный смысл до продолжения зависимой работы. Останавливается только затронутый scope.

## Проактивные правила

Правила фреймворка являются активными рекомендациями, а не скрытой проверкой. Оркестратор отвечает за продуктовые и координационные guardrails. Task применяет локальную безопасность и свой execution contract, а на более широкой границе консультируется вместо framework-wide review. Если человек или агент предлагает путь против правила, ответственный context должен вежливо назвать:

- нужное правило и конкретный риск;
- рекомендуемый путь и точное следующее действие;
- что можно сохранить, а что нужно собрать заново.

Человек может явно выбрать исключение. Нужно записать причину, границы и условие возврата. Команда, prompt, plan или попытка отправки не завершают переход: его owner считывает `Trigger / Retrieved rule / Expected / Observed / Evidence / PASS|MISMATCH|UNVERIFIED|OUTCOME_UNKNOWN`. Оркестратор владеет receipts launch/resume, Return Sync и memory-reflection/detour; действующий context - receipt защищенного доступа; task - receipts приемки/live action и внешнего эфекта. Только `PASS` закрывает переход. Governor receipt применим, только если его audited event точно совпадает с текущим событием atomic Project State. Mismatch останавливает только его, а неизвестный внешний результат запрещает повтор до сверки exact durable state.

## Операционный цикл

### 0. Запуск

Подключить и доказать repo, участников, inputs, operations текущего DOD, source of truth, privacy rules, компас, атомарные Project State/graph, DOD Control Line, внешний Project Guard и Governor baseline. До первого dispatch зарегистрировать active orchestrator и опубликовать Project Activation Receipt.

### 1. Осмысление

Использовать `$start-work`, чтобы превратить сырую цель, вывод встречи или большую тему в epic brief и task map. Начинать с продуктового результата, затем определять сущности, contracts, зависимости, риски, sequence, ownership и acceptance.

Если компас меняется, публиковать видимый patch или re-brief. Не менять активные задачи молча.

### Актуальность scope

Перед dispatch, re-brief или существенным возобновлением stale/paused работы оркестратор сопоставляет задачу с последними DOD и решениями, результатами upstream-задач, затронутыми сущностями и contracts, активной работой, применимыми узлами Project Memory Graph и текущим кодом. Обычное продолжение внутри актуального active contract является hot path: прочитать только новое значимое событие задачи и не перезапускать alignment, memory retrieval, scope freshness или dashboard rebuild.

- `UNCHANGED`: контракт остается актуальным.
- `PATCH_REQUIRED`: нужен ограниченный Brief Patch.
- `REBRIEF_REQUIRED`: нужно заново осмыслить goal, DOD, sequence, ownership или ключевые assumptions.

Возраст задачи требует перечитать ее, но сам по себе не меняет scope. По умолчанию сигналом являются семь дней без freshness check, если проект не выбрал другой интервал. Существенный patch или re-brief подтверждается человеком до продолжения implementation или burn. При re-brief или разделении прежний прогресс отмечается как `Сохранено`, `Заменено`, `Добавлено` и `Осталось`; доказанное продвижение нельзя молча обнулять.

### Проверка разрастания
Размер задачи является сигналом, а не приговором. Expansion Check проводится с паузой только затронутого роста, если первое проверяемое человеком evidence не уложилось в согласованный appetite, локальная цель потянула незапланированные слои или contracts, одна побочная platform problem повторяется в разных задачах, возникло второе исправление одного класса либо data/operating cost растет без движения DOD.
Нужно назвать `Ожидалось`, `Разрослось до`, `Вероятная причина` и один маршрут:
- `CONTINUE`: широкий scope действительно нужен; подтвердить новую границу и appetite.
- `REBRIEF`: смешано несколько результатов; вернуть один product outcome, остальное поставить в sequence.
- `LAB`: гипотезу дешевле доказать вне полного product path с заранее заданным выходом на бой.
- `MAINTENANCE`: повторяющийся architecture, data или tooling friction нужно устранить до продолжения затронутой работы.
Maintenance называет источник friction, сохраняет Accepted Baseline, меняет минимальную общую причину, доказывает, что исходный показательный flow стал существенно меньше или быстрее, проверяет отсутствие повторного роста и явно возвращается в исходную задачу. Backup, cleanup, migration или cap сдерживают последствия, но не закрывают долг, пока источник повторения не устранен либо осознанно не отложен. Appetite задается по задаче и repo; число файлов, строк или минут является предупреждением, а не универсальным вердиктом.

### Фокус на DOD и Project Memory Graph

Новые идеи не должны откладывать ближайший DOD, полезные идеи не должны теряться, а значимые намерения, решения, уроки и операционные знания должны переживать смену людей, задач и оркестраторов. Project State является атомарным control snapshot; его единственный DOD Control Line называет принятое proof, точный оставшийся gap и next-best-action. Project Memory Graph хранит переиспользуемый смысл, raw history остается evidence, а task получает только рабочую капсулу.

- Отсутствующее требование является DOD gap, а обязательная граница безопасности, качества или продукта - guardrail. Оба остаются в задаче или re-brief.
- Осознанное изменение обещанного результата требует видимого решения человека и обновления DOD, burn и sequence.
- Полезное расширение, которое не нужно для текущего DOD, остается вне задачи. После подтверждения человека оно сохраняется как узел `IDEA` с ценностью, anchors, source и trigger возврата.
- Просьба человека «запомнить и вернуться» является обязательством памяти, а не обычной историей. Сохраняются актуальный смысл, source, capability aliases и trigger, применимость/время со связью с планом или checkpoint, а также нерешенный вопрос человеку. Если момент не определен, вопрос возвращается при первом совпавшем планировании, а не разрешается агентом самостоятельно.
- Осознанное «отойти в сторону и потом вернуться» создает detour gate с owner, target DOD или lease, условием возврата и review-by. До закрытия detour маршрут восстанавливается либо явно заменяется.
- Outcomes, actors, entities, surfaces, contracts, data и operations получают стабильные anchors и aliases. Один узел хранит один переиспользуемый смысл: `INVARIANT`, текущий `DECISION`, урок неудачного пути `LESSON`, будущую `IDEA` или безопасный операционный `POINTER`, с типизированными relations, применимостью, исключениями и evidence. Защищенный `POINTER` исполним только тогда, когда текущая память называет owner, protected reference без самого значения, environment и scope, разрешенный non-destructive route, последнюю safe check с временем, результатом и source, а также expiry или условие повторного входа.
Длина сообщения не является trigger. Явные «запомни», «важно», «всегда», «никогда», «давай по-другому», повторное объяснение owner и принятые pivots запускают Memory Reflection. До извинения или patch оркестратор фиксирует `Before / Now / Why / scope`, извлекает связанные узлы и классифицирует `ABSENT`, `RETRIEVAL_MISS`, `APPLICATION_MISS` либо `VERIFICATION_MISS`; предполагаемый широкий смысл остается `PROVISIONAL`. Затем он интегрирует одно событие `ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT / NO_CHANGE`, повторяет retrieval и проверяет затронутые active и queued tasks. Task contexts возвращают candidates, но не переписывают общую память.

При каждом cold-path brief, re-brief, dispatch, решении consultation или sequence, parent acceptance, milestone и rotation оркестратор определяет точные anchors и aliases из Touch Set, до фильтрации dormant items пересекает совпавшие открытые обязательства памяти и checkpoints, добавляет semantic candidates, проходит один-два шага по релевантным типизированным relations и фильтрует по source precedence, status, scope, applicability и supersession. Он возвращает не более семи узлов и меньше, когда больше не нужно, как исполнимые пункты `Because / Apply / Avoid / Verify / Source`; одних id недостаточно. Если нужный смысл не доказан, ставится `MEMORY_COVERAGE_GAP`. Compaction или migration проходит только тогда, когда обычный вопрос о будущей работе возвращает конкретный смысл обязательства, source, условие возврата и human gate; полная карта id не доказывает semantic coverage. Неполный protected pointer блокирует только затронутое действие до повторного запроса секрета, исторической реконструкции или live mutation; указатель восстанавливается по связанному durable evidence, retrieval повторяется, а работа продолжается только после доказательства полного безопасного указателя и актуальной non-destructive check. Перед интеграцией перечитывается watermark, evidence сохраняется, а на hot-path continue retrieval не повторяется.

### 2. Выбор режима

Выбирать минимальный полезный контекст:

- Работа оркестратора: project-wide synthesis, prioritization, sequence и owner decision остаются в control context `ORCHESTRATOR`. Внутренние advisory agents допустимы, если долговечным результатом является только control artifact, а их заметки можно отбросить после синтеза. Каждый получает `Control decision / Available sources / Expected orchestration output / Route to focused context when` и в том же управляющем цикле возвращает `CONTROL_ONLY` либо `ROUTE_TO_FOCUSED_CONTEXT`.
- Research Context: ограниченный продуктовый или технический вопрос еще не готов для brief. Он работает как `DISCOVERY`, не меняет product code, возвращает короткий Decision Packet и после incorporation закрывается или архивируется.
- Lab Mode: изолированная реализация или эксперимент сокращают риск, стоимость или время обратной связи. До запуска определить решение, Accepted Baseline, одну главную переменную, проверяемый человеком proof, stop/burn limit и путь promote/reject/re-brief. Выход проходит через production transfer, tests и risk-based real-flow smoke.
- Task Context: результат и граница приемки достаточно ясны для `EXECUTION` в реальном продуктовом пути.
- Stale или Re-brief: карточка устарела, смешивает разные типы работы, слишком широка, противоречива или не имеет обязательных inputs. До task context ее нужно обновить или разделить.

Research уменьшает неопределенность. Lab уменьшает стоимость исполнения. Task доставляет принятый продуктовый или enabling результат.
Discovery Decision Packet называет выбранный подход, существенные отвергнутые варианты и уроки, затронутые entities или interfaces, acceptance или visual evidence, риски и нерешенные owner decisions. Оркестратор соединяет его с compass и memory до создания execution tasks. По умолчанию Discovery не создает production implementation; disposable lab artifact должен быть заявлен явно.
Граница проходит по владельцу результата, а не по теме или самому использованию субагентов. Advisory-анализ может читать существующий durable product context, включая проверенный repository, только настолько, насколько это нужно для управляющего решения. Отдельный focused context обязателен, если ответ устанавливает новую причину, продуктовое или техническое решение, факт о runtime/data, эксперимент, test, Candidate, acceptance proof, side effect, самостоятельно полезный artifact или работу, переживающую текущий control cycle. Advisory output не является принятым проектным evidence: существенное утверждение о проекте должно вести к human decision, durable source или focused-context receipt.
### Одна линия успеха

Строим от успеха, учимся на неудаче.

- `Accepted Baseline` - последнее доказанное рабочее состояние.
- `Candidate` - текущая предлагаемая дельта.
- `Rejected Candidate` - источник evidence, но не неявная база для следующего исправления.
- Следующий Candidate строится от Accepted Baseline и применимого Memory Brief: сохраняет доказанно работающие изменения и заново делает неудачные части с учетом полученных уроков.

Записывать короткое learning evidence: `Keep`, `Rebuild`, `Drop` и `Unknown`, затем возвращать переиспользуемый урок как candidate в граф. Повторное исправление одного класса ошибки сначала запускает проверку baseline, scope, прошлой памяти и подхода, а не еще одну слепую попытку.

### 3. Dispatch
Role `EXECUTION` запускается только для Low-ready работы: один конкретный результат и исполнимый первый шаг; нет нерешенного продуктового или архитектурного выбора; явно заданы scope, touch boundaries и non-goals; есть объективные DOD, tests/smoke/evidence и acceptance oracle; актуальны baseline, обязательные data, access и environment; заданы короткие существенные `CONSULT` triggers.
Если чего-то не хватает, оркестратор сам закрывает пробел, делает re-brief или split либо запускает `DISCOVERY`. Consultation страхует от новой обнаруженной границы, но не заменяет качественную постановку задачи.

Минимальный role-`EXECUTION` task contract содержит:

- Goal и DOD impact;
- Scope, out of scope, владелец результата и граница зависимости/получателя;
- Scope freshness, Accepted Baseline, принятый механизм и не более семи исполнимых пунктов Memory Brief;
- Product loop либо связанный enabling contract; enabler называет `Разблокировано`, `Еще не сделано` и следующий продуктовый slice;
- Authority/safety envelope и Human checkpoint;
- Burn / stop и expansion appetite, когда они существенны;
- Verification и completion route;
- Узкие Consult when / Return to, срабатывающие только на named human checkpoint, неустранимый blocker или terminal result.

Raw Project State, Touch Set, transcripts, полные memory views, task map и размышления оркестратора не передаются в task. Перед launch оркестратор записывает один `PREPARED` Execution Lease: work identity, owner/context, exact base, profile, вклад в DOD, review-by и return route; пока disposition неясен, duplicate launch запрещен. До `STARTED` он считывает title/link/profile/base и первое безопасное наблюдаемое действие. Ответ только с планом не является прогрессом; после одной прямой команды execute-or-block повтор дает `EXECUTION_STALLED` и ведет к replacement или re-brief от durable evidence.

### 4. Исполнение

Task context начинает с безопасного наблюдаемого действия, а не повторяет согласованное планирование. Он отвечает за implementation, debugging, tests, исправления и durable checkpoints, самостоятельно решает обычные ошибки внутри scope и burn и продолжает до named human checkpoint, неустранимого blocker или terminal result. Он не запускает project launch, shaping, alignment, orchestration или Governor workflows.

При незаявленном scope, authority, safety, общем механизме/contract, пересечении ownership, stale upstream state, нерешенном выборе решения, ставшем невозможным DOD или повторном отсутствии прогресса task отправляет один `CONSULT`: `Boundary`, `Evidence`, `Proposed move` и `Safe continuation`, затем останавливает только эту границу. Оркестратор подтягивает нужную durable truth и решает `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, `DISCOVERY` или `NEEDS_DECISION`; Peer Compass Review может поддержать этот маршрут. Вспомогательная, demo, review или transport-задача не получает продуктовый DOD и burn только потому, что ее файлы изолированы.
Нельзя механически повышать reasoning застрявшей задачи по лестнице effort. Сначала различить implementation defect, слабый acceptance oracle и недостающую проработку решения. Затем построить новую попытку от Accepted Baseline с учетом evidence, сделать re-brief либо запустить bounded Discovery. High-consequence execution может оставаться на эффективном profile только при явных invariants, deterministic guards и review evidence и project coherence максимальным profile оркестратора до human merge или action approval; task acceptance остается в task.

На объявленном return trigger task сначала пишет короткий Return Sync с уникальным receipt id и `NO_MEMORY_DELTA`, task-local evidence либо reusable candidates в durable task/tracker outbox, затем отправляет тот же id как native wakeup. Оркестратор на каждом cold path и Governor Check совмещает `WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED`, поэтому потерянное сообщение не теряет результат и не требует опроса человеком. До закрытия lease проверяются sender, evidence, DOD route и next action. Передача между людьми по-прежнему требует exact artifact/revision, environment, воспроизводимых безопасных data при необходимости, recipient access и согласованной проверки. Monitor остается только fallback при отсутствии обоих обычных routes.

### 5. Alignment

Использовать `$daily-alignment` только в оркестраторе после содержательной встречи или внешнего события, которое существенно меняет безопасное следующее действие другого участника. Task-local debugging, routine progress, срочность, локально исправленный blocker и обычное продолжение не являются alignment events.

Отсутствующий участник не блокирует независимую работу. Работа на его активной поверхности или contract продолжается только в явных cautions либо ждет его packet.

Каждая существенная delta сопоставляется с active, queued и paused tasks. Незатронутые задачи не будятся. Active task получает только `что изменилось / к чему относится / что сохраняется / действие`: совместимый patch позволяет продолжить, а invalidating change останавливает только затронутую границу для `PATCH_REQUIRED` или `REBRIEF_REQUIRED`. Task не читает raw meeting inputs.

### 6. Приемка

Перед завершением owning task context запускает `$accept-work`. Приемка сравнивает Candidate с execution contract, Accepted Baseline, прямыми корректировками человека, адресными patches оркестратора, product loop, burn, тестами, smoke evidence и каждым исполнимым пунктом Memory Brief как applied, missed, contradicted либо not exercised; несвязанная память проекта не восстанавливается. Существенные изменения получают статус `Inherited`, `Deliberately changed` или `Unexpectedly changed`; необъясненное неожиданное изменение означает `NEEDS_FIXES`.

Проверяются риски, которые изменил Candidate. Для runtime, integration или state changes smoke проводится на точных branch, worktree, commit, frontend, backend и browser target, которые принимаются; старый сервер или другая ветка не подходят. Не нужно проходить платный подготовительный путь, если тот же риск доказывается контролируемой точкой входа, а сам путь не менялся. Для zero-spend или no-mutation работы опасная возможность по возможности отключается технически, а counters проверяются до и после; нарушение остается раскрытым и не может называться нулевым. Backend state, UI shell, lab proof или enabler без названного продуктового продолжения сами по себе не закрывают capability.

После приемки и обязательного human checkpoint Candidate становится новым Accepted Baseline. Rejected Candidate остается только evidence. Человек делает manual merge через task context, который сначала пишет terminal Return Sync в durable outbox. Перед merge, deploy, spend или shared-state mutation записывается Action Receipt и считываются owning acceptance и свежие точные actor, environment, revision, permitted mutation и stop conditions. Оркестратор интегрирует переиспользуемый смысл, превращает miss в retrieval regression, обновляет DOD Control Line и затронутую работу, а lease закрывает только после routed return.

### 7. Health Review

Project Guard - это operation, а не постоянный context. Один project-owned runner вне оркестратора вызывает deterministic `guard-check` при activation, dispatch/material resume, записи Return Sync, человеческой коррекции/detour, наступлении lease review, milestone/update, context-loss signal и по независимому timer. Здоровая проверка проходит без модели и сообщений; ожидающая durable работа получает один idempotent wakeup, а anomaly или неустраненный повторный incident запускает свежий maximum-profile Governor. Он независимо читает durable state и фактические context metadata и возвращает `HEALTHY`, ограниченный `REPAIR` либо подтверждаемый `ROTATE`, не выполняя project work. Более широкий Health Review остается для нескольких slices, stalled DOD burn, повторного expansion/tax, выпадения owner, качества памяти и work hygiene.

Проверяются продвижение к compass и DOD; blockers, повторные затраты и technical slicing без продуктового прогресса; неожиданное разрастание или повторяющийся architecture/data/tooling tax; stale scope, конкурирующие Candidates, исправления на rejected work, research или lab outputs вне real path, потерянные решения, правдивость tracker, качество и retrieval графа, необходимость сменить active orchestrator. После подключения к действующему проекту или доказанного memory miss отдельная read-only task проводит ограниченный memory backfill от принятого brief либо самого раннего надежного baseline: сравнивает с текущей памятью высокосигнальные человеческие коррекции, решения встреч, pivots, открытые обязательства памяти, checkpoints и принятые уроки; поздний evidence заменяет ранний смысл; глубоко разбираются только отсутствующие, неоднозначные или конфликтующие кластеры; до подтвержденной человеком интеграции они проверяются обычными вопросами о будущей работе. Внутри проводится `Work Hygiene Check` всех существующих live task, PR, branch, context, worktree, runtime и monitor: у каждого должны быть owner, связь с текущими goal/DOD, состояние и условие выхода либо возврата, после чего он получает класс `ACTIVE`, `WAITING`, `FINISH`, `SALVAGE` или `RETIRE`. Shared artifacts читаются из общей metadata, local-only artifacts проверяет их owner в отдельной focused maintenance task, поэтому одна машина не может объявить чистой всю команду. Возраст запускает review, но не удаление и не фиксированный лимит веток. Оркестратор только классифицирует, направляет и хранит в Project State дату проверки с нерешенными исключениями; owning или focused tasks проверяют и очищают. Evidence и уникальная работа сохраняются, полезная stale-работа переносится на текущий Accepted Baseline вместо полного оживления старого context, а inventory artifacts не попадает в semantic graph, кроме переиспользуемых решений и уроков.

## Люди как агенты

Люди являются событийными участниками системы, а не ее скрытыми диспетчерами. Когда нужен человек, оркестратор сообщает, кто действует, какое суждение принадлежит этому человеку, что проверить или решить, точную ссылку/task/prompt, куда попадет результат, что можно продолжать и какой Return Sync возобновит поток. Техническую проверку проводят агенты; человеку задаются понятные продуктовые, визуальные, расходные, внешние, smoke или merge-вопросы по его роли.

У каждой задачи есть один `Human checkpoint`: `none`, `product decision`, `visual review`, `paid or external action approval` либо `manual smoke and merge`.

Оркестратор не должен говорить, что участие человека не требуется, если впереди есть названный checkpoint.

## Асинхронная совместная работа

Нужен один авторитетный снимок текущего dashboard; связанные artifacts создаются только при появлении их trigger:

- Project State: обязательные compass, DOD, registry участников, active orchestrator contexts, текущие задачи и последнее состояние alignment.
- Alignment Window: используется, когда нужно согласовать packets встречи, milestone или локальной работы.
- Project Memory Graph: один компактный текущий граф стабильных anchors, атомарных invariants, решений, уроков, будущих идей, безопасных pointers, типизированных relations и retrieval scenarios. Существующие graphs, Idea Memory и Intent Trail являются migration inputs, а не параллельной active truth.

Registry участников содержит: participant и role/decision scope, backup или absence route, orchestrator context link, framework и проверку `doctor`, resolved profile, доступ к repo/tracker/input, собственный readiness receipt, latest packet, active task, availability и status. Одна машина не сертифицирует другую.

Перед dispatch или существенным resume на общей поверхности orchestrator каждого участника проверяет свою строку и публикует packet только при материальном изменении локального состояния или результатов встречи. Обычное execution внутри актуального contract не создает packet. Нельзя придумывать незакоммиченное состояние другого участника.

Body задачи является ее единственным текущим execution contract; comments являются evidence. Общий tracker - это понятная человеку проекция Project State и текущих issues, а не второй planner. Используются `Todo -> Next -> In Progress -> In Review -> Done`, а также `Blocked` и `Parked`, с owner, priority, формальными parent/dependencies, когда они поддерживаются, milestone или delivery window, checkpoint и PR/artifact. Достаточно компактных views для current work, roadmap, parked work, recent completion и control; фиксированные спринты нужны только команде, которая действительно так работает.
При dispatch, существенном re-brief, blocker, acceptance и close task contract, Project State и tracker projection обновляются вместе до объявления нового состояния. Routine progress не переписывает dashboards или Alignment. При публикации Team Alignment Delta или изменении графа затронутый current view перестраивается в той же операции. История остается по ссылкам, а Alignment Window ротируется, когда перестает быстро читаться.

## Встречи
Meetings, записи, transcripts, командные чаты и заметки являются одним слоем coordination inputs. Они остаются raw, пока orchestrators с прямым доступом или назначенный intake owner не дистиллируют их в traceable shared delta, а человек не подтвердит изменения compass, scope, sequence, ownership или DOD.

После встречи достаточно короткой команды `сделай daily alignment`. Оркестратор читает доступный источник, обновляет durable state, просит недостающие packets только там, где они важны, и возвращает continue, continue with cautions, wait или blocked.

## Peer Compass Review

Peer Compass Review предлагается, когда задачи, PR, продуктовые поверхности, contracts или DOD rows пересекаются между owners. Оркестратор готовит review request и говорит человеку, к кому обратиться, что проверить, куда вернуть packet и что можно продолжать тем временем.

## Контракт монитора

- Один monitor следит за одним named gate или active stream.
- При неизменном состоянии и работе внутри scope он не создает context message, no-op trace или model wake-up.
- Уведомляет только о blocker, decision, drift, human checkpoint или terminal result.
- Не создает новый scope, не делает merge, не тратит деньги и не переосмысливает compass.
- При изменении gate обновляется существующий monitor, а не создается дубль.
- В terminal state либо при потере полезности monitor удаляется.

## Ротация оркестратора

Для одного участника и stream авторитетен один активный orchestrator. Ротация является двухфазным handoff с явной пересменкой, а не автоматической заменой:

1. До начала оркестратор объясняет человеку, почему нужна ротация, что перейдет в новый context, что не изменится, как будет проверена память и что одно явное подтверждение активирует замену.
2. Предыдущий orchestrator context остается активным, целым и доступным по ссылке. Он публикует Rotation Memory Packet: compass/DOD, семейства решений и существенные task-local pivots, queued/promised/deferred work, просьбы запомнить, безопасные операционные pointers, monitors/follow-ups, checkpoints, participants, ambiguous и stale items.
3. Stale memory bodies перестраиваются из evidence, связанные решения группируются, а packet сверяется с Project State, issues/PR, project instructions/docs, repo state и доступной историей context. Каждый item получает статус already durable, missing durable state, ambiguous или stale/superseded.
4. Candidate orchestrator создается из актуальных repo/framework в read-only режиме. Он независимо проверяет Project State v2, DOD Control Line, unresolved leases, Pending Return Inbox, detour gates, high-signal human sources и graph v3, затем восстанавливает исполнимые briefs для current, next и prior-miss Touch Sets. Совпадение ids или согласованность Packet с dashboard сами по себе не являются memory coverage.
5. Актуальные missing items попадают в правильный durable source только после того, как человек увидел coverage delta; нельзя массово создавать задачи или молча возвращать старые идеи.
6. Человек явно подтверждает active switch. До подтверждения candidate не dispatch новые задачи, а active pointer не меняется.
7. После подтверждения candidate регистрируется active, все unresolved leases и durable/native return routes перенаправляются, Pending Return Inbox совмещается, monitors переводятся, а новый context поднимается на виду и публикует ясное сообщение об активации.
8. Previous context переименовывается как retired/superseded, открепляется и последним сообщением крупно сообщает на языке человека, что новую работу сюда больше не направляют, со ссылкой на активный orchestrator. Он остается доступной, но незакрепленной историей; автоматически удалять или архивировать его нельзя.
9. Ротация считается завершенной только когда Project State, ссылки, pin state, названия, return routes и последнее сообщение старого context согласованы. Если среда не умеет управлять этими поверхностями, оркестратор дает человеку одно точное действие и отмечает неполную видимость пересменки, а не скрывает ограничение.

Если previous orchestrator недоступен, recovery отмечается incomplete, сохраняются safe boundaries, а полное memory coverage и смена направления требуют решения человека.

## Правила

- При первом активном обращении к orchestrator после того, как проверка этого участника стала старше 24 часов, установленная версия сравнивается с canonical upstream. Если версия актуальна, система молчит; если вышла новая, читает все релизы `installed < release <= latest` от старого к новому, сообщает диапазон и короткую дельту каждой версии, затем записывает суммарное влияние, один общий update plan и безопасное окно в next-best-action. В это окно готовится или переиспользуется обычный update change; нельзя пропускать промежуточную версию, дублировать update, перезаписывать конфликты, незаметно делать merge или менять правила активной задачи посреди исполнения. Недоступная проверка остается pending и не блокирует остальную безопасную работу.
- Orchestrator занимается только организацией: `ORCHESTRATOR_WORK` может использовать ограниченных advisory agents для управляющих решений, но каждое существенное проектное утверждение требует допустимого work origin. `UNOWNED_PROJECT_WORK` получает один bounded repair; повтор после repair является сигналом rotation.
- Universal rules хранятся в canonical framework, project rules - в product repo.
- Человеческое общение остается продуктовым; branch и worktree mechanics показываются только когда влияют на решение или риск.
- Implementation не начинается без goal, boundary, DOD impact, human checkpoint и verification route.
- Нельзя заявлять team alignment, пока доступ к shared repo/tracker или важному input имеет статус `SYNC_LIMITED`.
- Scope freshness проверяется перед dispatch, re-brief или существенным resume stale/paused работы; обычное продолжение внутри актуального active contract ее не запускает.
- Неожиданное разрастание задачи является diagnostic trigger; повторяющийся architecture tax нельзя считать нормой, а containment - устранением причины.
- Ближайший DOD защищается от optional scope growth, а переиспользуемые решения, будущие идеи, pivots, уроки и безопасные операционные pointers сохраняются в одном Project Memory Graph, а не только в памяти человека или истории чата.
- Сохраняется одна линия успеха: новые Candidates строятся от Accepted Baseline и применимого Memory Brief с учетом уроков Rejected Candidates.
- Принятый sub-slice не закрывает parent, пока обещанные product loop и DOD не закрыты или явно не вынесены out of scope.
- Lab Mode не принимается как продуктовый результат без production transfer и real-flow verification.
- Значения secrets, transcripts, private product data, proprietary prompts и customer information не попадают в public framework artifacts или общую память. Защищенный pointer хранит только owner, protected reference, environment/scope, разрешенный non-destructive route, последнюю safe check с source и expiry/re-entry condition; если обязательного поля нет, затронутое действие получает `MEMORY_COVERAGE_GAP / BLOCKED` до исправления и повторной проверки.
- В установленных или распространяемых копиях фреймворка сохраняются license, creator metadata и required notice; они не распространяют права на project-specific работу.
- Последняя доступная flagship-модель маршрутизируется по роли: максимальный reasoning для оркестратора, глубокий bounded для Discovery и эффективный bounded для Execution. Все resolved mappings и дата проверки хранятся в Project State; model version не фиксируется, а profile не заменяется незаметно.
- Append-only evidence сохраняется, но текущие dashboards атомарно перестраиваются и не содержат дублирующих или противоречащих текущих секций.
- Поддерживаются один DOD Control Line, один unresolved Execution Lease на инкремент, Return Sync сначала в durable outbox, явные detour return gates и один внешний Project Guard. Здоровая проверка молчит; anomaly направляет repair либо подтверждаемую rotation даже когда orchestrator перестал вызывать собственные правила. Людям не нужно опрашивать tasks или помнить отложенное за систему.
- Next-best-action важнее status-only ответа.
- Active orchestrator нельзя переключать без Rotation Memory Packet, candidate Memory Coverage Check и явного подтверждения человека.
## Skills и человеческий интерфейс

Канонические repo-scoped skills:

- `$project-launch`: активировать проект и создать operating brief.
- `$framework-orchestrator`: через hot или cold path координировать, dispatch, supervise, интегрировать результат и выбрать next-best-action.
- `$start-work`: превратить большую тему в epic и task map.
- `$daily-alignment`: асинхронно согласовать изменения встреч и событий.
- `$accept-work`: принять task, PR, lab/maintenance result или продуктовый инкремент в owning execution context.

Поведение задают `SKILL.md` contracts. Среда может показывать их как `$skills`, commands, rules или automatic routes; optional interface metadata не меняет их смысл.

Человеку не нужно вручную выбирать skill. В orchestrator context достаточно естественных команд:

- `Запусти этот проект.`
- `Продолжи этот поток.`
- `Обработай последнюю встречу.`
- `Проверь работу и продолжи.`
- `Что еще можно сделать по этой теме?`

Оркестратор сам выбирает и применяет нужный skill.
