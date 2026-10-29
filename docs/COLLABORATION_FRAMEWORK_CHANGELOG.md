# Collaboration Framework Changelog

## 2.1.9 - 2026-10-29

При подготовке задачи сохраняется ранее записанный безопасный маршрут доступа:
кто отвечает за него, где находится защищённая ссылка, что разрешено проверить
и когда требуется повторная проверка. Эти сведения больше не теряются при
поиске по памяти; секретные значения не запрашиваются и не открываются поиском.

Подготовка различает уже принятое решение о доступе и состояние текущей сессии.
Перед повторным вопросом пользователю нужно восстановить сохранённую историю.
Если запись не попала в память, она возвращается в существующий процесс
восстановления, без создания второго хранилища и без расширения прав.
Обновление не подтверждает доступ автоматически и не разрешает удаление данных.

## 2.1.8 - 2026-10-23

Незавершённое действие или обращение к владельцу не выдаётся за спокойное
завершение цикла, даже если модель в этот момент не вызывалась. Сохраняются
исходное доказательство и необходимость решения, без прерывания работы.

Независимая проверка получает полный указатель доступных источников сразу,
не тратя отдельный обмен на его запрос. Сами источники по-прежнему нужно прочитать.
Для проверки подготовки можно отдельно выбрать подтверждённый испытаниями режим
модели, не меняя режим проверки результата и здоровья системы.

Проверка результата получает доказательство проверки локальной среды перед
выполнением команды. Прежние результаты без такого доказательства не объявляются
проверенными задним числом. При завершении владельца без точки продолжения
сохраняются фактическая остановка и расход, без самовольного повторного запуска.

Проверка назначения различает планируемого исполнителя и подтверждённое
действующее назначение. Для завершённой подготовки без запуска исполнения
не требуется придумывать активное назначение; при последующем запуске его
проверка остаётся обязательной. Отсутствие нужного доказательства не считается
успешной проверкой.

Независимая проверка отдельно оценивает исключения из правил и допуск защищённых
действий. Обычное разрешение не подменяет согласованное исключение, а приёмка
подготовки не подтверждает разрешение на будущее действие. Недостающие
доказательства сохраняются как неопределённость, а не успешная проверка.

Согласованный событийный режим позволяет продолжать работу после готовности
результата, не ожидая очередного интервала проверки. Независимые проверки
подготовки и результата могут оценивать обязанности своего этапа, сохраняя
общий контроль здоровья, память и все прежние замечания. Этот режим включается
явно; измерение экономии и ограничения применимости сохраняются отдельно.

При длительном ожидании можно сохранить точку продолжения и остановить модель
владельца, не останавливая исполнителей. После события продолжает та же сессия,
без повторного выполнения задачи. Пауза и неопределённый исход защищены от
самовольного перезапуска; история и расход сохраняются. Это снижает лишнюю
работу в ожидании, но само по себе не доказывает экономию всего процесса.

Ожидание проверки больше не требует постоянных запросов модели о неизменном
состоянии. Явно разрешённое однозначное применение независимого решения может
выполняться кодом, без отдельного модельного обработчика. Отрицательные решения,
неясности и ремонт остаются у ответственного владельца; независимая приёмка
и проверка актуальности доказательств сохраняются.

Следующая задача может проверить, что необходимый предыдущий результат действительно
прошёл независимую приёмку и был закрыт. Ей не нужно верить пересказу оркестратора
или повторять уже выполненную работу: связанные доказательства приходят из журнала
контроля, без загрузки всей истории проекта.

После согласованного продолжения можно безопасно выделить новый конечный бюджет
обработчику результатов. Прежний расход и решения сохраняются, права обработчика
не расширяются, а незавершённая работа не объявляется выполненной.

В событийном режиме подготовленный пакет получает обязательную независимую
проверку до исполнения, а принятый результат — отдельную проверку после приёмки.
Короткое ожидание ответа не обрывает длительную работу. Обычная периодическая
сверка не расходует модельные вызовы при неизменном исправном состоянии;
пропущенные проверки остаются видимыми обязательствами.

Перед первой независимой приёмкой можно дополнить доказательства, не выполняя
готовую работу заново. Прежние решения и история сохраняются; добавление
источников не заменяет независимую проверку и не разрешает использовать результат.

Обновление и откат проверяют, сможет ли выбранная версия прочитать сохранённые
доказательства. Несовместимая версия не подменяет рабочий механизм приёмки.

Проверяющий получает все обязательные условия допуска результата заранее.
Это уменьшает риск противоречивой приёмки без ослабления требований к качеству
и без объявления старых нерешённых проблем закрытыми.

Чтение большого набора доказательств больше не создаёт в журнале повторные
копии всех ранее прочитанных текстов. Это сокращает задержки и объём хранения;
восстановление проверки сохраняет историю, лимит чтения и проверку целостности.

Независимая проверка получает источники напрямую, без промежуточного вывода,
который мог обрезать текст и вынуждать читать его повторно. Предел размера
источников и запрет использовать непрочитанные доказательства сохраняются.

## 2.1.7 - 2026-10-22

Прерванная независимая проверка может продолжить чтение и оценку с сохранённой
точки, вместо повторного сбора тех же источников. История, расходы и ограничения
сохраняются. Изменение исходных данных запрещает использовать прежнее основание;
неполная или отрицательная приёмка по-прежнему не разрешает использовать результат.

Evolution Gate: the actual-model interruption/resumption test reused ten sources
and enforced a negative verdict, with two accounted turns and unknown token
usage retained. Local source-drift, concurrency, budget and host-lease checks
cover the changed boundary. Cost: opt-in continuation in existing reviewer,
source receipt and host APIs, no new control actor or scheduler. Verdict:
qualified isolated candidate, not a release or project-adoption claim.

## 2.1.6 - 2026-10-22

Готовое решение независимого проверяющего можно сохранить и передать
владельцу, не ожидая заключительного сообщения в чате. Неполное решение не
принимается; история замечаний, проверка источников и запреты на выполнение
сохраняются. Старый способ возврата совместим, новый включается явно.

Отрицательная независимая приёмка теперь запрещает использовать результат и
закрывать его как готовый, даже если отдельные замечания не отмечены блокирующими.
Ремонт остаётся доступен. Старые решения сохраняются, но отсутствие явного допуска
не превращается в разрешение. Обычный неблокирующий долг сам по себе не запрещает
использовать результат, который действительно прошёл приёмку.

Evolution Gate: benefit is fewer lost completed decisions and repeated reviews;
evidence includes a real Sol6.1High source-based rejection in219505ms, delivered
and enforced with all10 finding holds false, plus local legacy/positive/negative,
restart, packaging and closure checks. The earlier failed semantic trial remains
recorded. This is one scoped synthetic challenge, not project acceptance or
measured savings. Cost: one receipt capability on the existing MCP,
no new service, role, audit or scheduler. Unknown model usage stays unknown.
Verdict: release candidate; publication and actual project activation remain
separate. The existing own-transition adoption requirement owns retained history,
legacy decisions and paused rollback, without automatically repeating old work.

## 2.1.5 - 2026-10-20

The existing v4 locator distinguishes association from obligation expansion.
Shared `About` links keep navigation, source coverage and contracts without copying
every sibling record into the packet. Unselected associated records remain explicit
applicability gaps; `requires`/`constrains`, pending evidence and overflow refusal
stay enforced, including constraints on association-only anchors and visible
applicability gaps for their outgoing dependency routes. Contract anchors can be recall roots. Historical reconstruction
uses canonical v4 fields and provisional scope, not a second installed format.

Evolution Gate: **Benefit** - recover prior decisions without whole-graph expansion
or silently dropping related uncertainty. **Evidence and limits** - focused old/new
format and source-boundary checks; no claim of whole-project completeness, autonomous
adoption or measured savings. **Complexity tradeoff** - one retrieval-set distinction
inside the existing reader, no new role, service, format or timer. **Verdict** -
scoped independent code review passed after repairing one omitted-constraint
finding; local archive/update preservation passed. Final packaging readiness is
recorded in the maintainer plan, not inferred as live adoption. Existing prepared-work
adoption owns safe source integration and recipient retrieval/application; pauses
are not resumed by this change.

Этот файл фиксирует концептуальные изменения фреймворка совместной работы. Это не commit-by-commit log.

Старые записи используют текущую environment-neutral терминологию там, где менялось только название механизма. Точный текст каждой версии сохраняется в Git tags.

Правило версионирования:

- `MAJOR`: базовая операционная модель меняется несовместимо, поэтому действующему проекту нужна миграция ролей, основных artifacts, skills или operating cycle, чтобы продолжить работу. Масштаб текста сам по себе не делает релиз major.
- `MINOR`: появляется совместимый операционный элемент; существующие Project State, tasks и contexts остаются пригодны и могут обновиться без смены модели.
- `PATCH`: уточняются rules, wording, gates или templates без нового операционного элемента.

## 2.1.4 - 2026-10-13

Reduce duplicated initial context in existing host-bound fixed review parts.
Assigned findings remain complete; outside blockers and failed findings remain
complete, and other outside dependencies retain evidence, ownership, scope and
history without repeating unassigned criterion prose. Source pointers bind the
original snapshot; complete original metadata and acquisition remain available.
The host admits only the complete criterion union against the unchanged offer.
Unbound and single-review profiles retain their existing rendering and behavior.
An optional trusted finite aggregate source snapshot allowance preserves the
default and all per-source, native acquisition and timeout limits. It permits
retaining original history alongside justified current sources, not expanding
graph or model context. These changes establish neither semantic completeness
nor native timeout repair, autonomy or net savings; adoption must prove the real
result boundary on the retained incident without resetting previous expenditure.

## 2.1.3 - 2026-10-13

Repair unbounded original-source acquisition without adding a role, timer or
shorter catalog. An optional trusted native review policy limits acquired text
bytes and Unicode-safe windows; every window binds the actual original hash,
range and slice hash. The host verifies observed readbacks and complete required
source coverage, not the model's assertion that it read a document. All registered
originals remain available. Exhaustion is explicit NEEDS_DISCOVERY, never MISSING,
PASS, closure, or permission to omit obligations. Whole-source claims require
complete coverage; slice citations retain their original locator. Existing
profiles, budgets, deadlines, paused duties and unknown expenditure stay intact.
Adoption must compare the actual acquisition/result boundary on the retained
case before claiming reduced rework or an autonomous cycle.

## 2.1.2 - 2026-10-12

Separate the admitted action's finite execution budget from model and service
deadlines. Task actions may declare up to ten minutes; only a trusted controlled
resume with exact command-bound authorization and reservation can execute above
the ordinary sixty-second ceiling. Verification and unprotected execution retain
their old ceiling. Module/model limits, grant expiry, output bounds, final
readback and uncertain-outcome reconciliation are unchanged. Existing adoption
owns resource bindings and the whole deadline chain: observe initial startup
without a long action when necessary, then prove its natural scheduled execution
and owner application. No new role, timer, audit or asynchronous protocol.

## 2.1.1 - 2026-10-12

Repair the missing trusted transition from an expired initial private service
profile to a separately authorised operational profile. A stopped, paused same
host selects an immutable versioned profile atomically while preserving old
profiles, journals, findings, authority and spending. Explicit fresh allocations
use separate journals; no in-place budget renewal or replacement of an existing
owner-handler allocation. A crash retains exclusive ownership until exact
stopped-operator recovery. Existing same-profile runtime cutover remains intact;
runtime lacking versioned-profile support refuses selection. Setup still owns
actual initial/recurring delivery and application proof before retiring personal
monitoring. No new audit, controller, role, timer or checklist is introduced.

## 2.1.0 - 2026-10-12

Compatible opt-in HEALTH continuation reuses the existing POST checkpoint
mechanism: one frozen whole-group part per tick, retained native evidence and
finite cumulative allocation. Only the complete 28-group/87-criterion union can
become an owner verdict; partial progress grants no execution or repair scope.
Source, execution, plan drift or pause invalidates reuse even after restoration.
Unknown termination or usage retains the hold; known failure requires independent
changed-attempt reconciliation, without replaying completed parts or refunding
spent calls. Captured confined-command domains retain their existing single-review
protocol and refuse episodes. Existing single/fixed-part profiles and schemas are
unchanged. Adoption owns safe runtime switching, preserved evidence and allocations,
fresh complete review and actual same-projection owner application. Local tests
and scripted CLI transport are not semantic project acceptance or measured savings.
Stable main/Latest remains unchanged; no new controller, timer or checklist is added.

## 2.0.1 - 2026-10-11

Compatible memory-section reader repair on `release/2.x`. Validation and recall
stop Pending Memory Events at an actual peer or ancestor Markdown heading,
instead of treating a following public-contract table as pending-event rows.
Nested, prose, fenced and HTML-comment heading text cannot truncate genuine pending meaning;
strict event shape, state and anchor validation remain unchanged. Existing graph
versions and schemas are unchanged: no memory reordering, rebuilding or waiver
is needed. Current operating-core labels now reflect the opt-in released channel;
historical candidate evidence remains historical. Safe adoption uses the existing
team-memory owner/readback route and new trusted runtime pins, retaining all
accepted artifacts, pending deltas, private state and spent allocations. Installation
is not proof of controlled project readiness or economic improvement.

## 2.0.0 - 2026-10-11

Opt-in major release on `release/2.x`; stable `1.x/main` remains unchanged.
The controlled operating contract
adds independently evidenced admission, retained acceptance and observed recovery
or continuation. Existing projects require owned migration and rollback proof;
file installation alone cannot activate or certify this model. The major version
identifies the incompatible operating model. Independent final acceptance closes
the supported-route technical qualification gates: ordinary unhinted recall,
public module composition, two retained tasks and owned health repair, scoped
safe KIT migration, and the assisted adoption canary. Current regression:
1554 PASS, 0 FAIL, 0 CANCELLED, 8 SKIP with bounded concurrency4.
Matched output quality is equal at higher candidate effort: measured savings
remain NOT_PROVEN. This is not whole-project health, universal reliability,
unassisted canary-driver success or automatic product activation.
Historical qualification notes below preserve the versions, failures and
unreleased status actually observed at those earlier checkpoints.

2026-10-10 creation compatibility correction: compiler and runner use the same
validated target intent and example eligibility. Only genuine creation may have
no retained cases, with nonempty source-bound new oracle cases; change and legacy
keep regression baselines, and supplied retained cases are never dropped. Planning
checks coverage before confirmation writes. This corrects the isolated pilot's
compiler/runtime mismatch without fabricated history, a new lifecycle protocol
or a blanket waiver. The changed runtime needs current adoption and independent
acceptance; the stopped pilot and spent calls are retained. No release is implied.

Final finding-scope clarification, 2026-10-10: independent REVIEW's previous
findings are only the current offer's authoritative previousFindings. Another
task's findings are source evidence, not inherited current IDs. Applicable issues
need complete new current records; another task's history cannot be closed or
rewritten. Existing assertions preserve rejection of incomplete foreign IDs;
host, decoder and authority are unchanged. The original invalid native answer
and spent calls remain retained. Its later independent reconciliation and actual
owner DONE are separate evidence, not a rewritten unassisted pass. Matched six
outputs have equal independently blinded quality at higher candidate effort;
economic improvement is not claimed. The candidate remains unreleased.

2026-10-10 assembly correction: single-part model REVIEW validates the complete
finding history before exposing a reusable verdict, like the existing partitioned
route. A completed invalid answer retains candidate, trace, usage and spent budget;
it is not an UNKNOWN process or a permission. Cached invalid HEALTH findings can
reach the existing explicit independent retry gate without looping on the rejected
verdict; source/identity failures still block. Compact grouped nonpass rows link
only their complete unique same-source declared new findings; ambiguity, retained
OPEN competitors and missing proof are refused. No judgment or debt is rewritten.
Required public plans/manifests must be readable by independent PRE, not only
referenced. Maintainer fixture assembly now supplies that closure before preparation
and requires actual owner endpoint application rather than prose-only success.
The frozen native cycle completed17 phases unassisted: two actual accepted tasks,
full87 POST each, owned actual map repair, fresh full HEALTH closure and applied
owner continuation. Quiet observation added zero calls; unresolved retrieval debt
remains owned. Supported regression1543 PASS/0 FAIL/9 SKIP. This proves the bounded
working route, not universal adoption or economy. No new controller, recovery
service or scheduled role was added; the candidate remains unreleased.

Ordinary recall entry, 2026-10-09: `memory-recall` locates declared names/aliases
in the existing Graph v4, retaining parent obligations, public consumer routes and
current commitments without producer-source retrieval. A shared Markdown parser
keeps the CLI locator and existing graph validation aligned. Read-only inspection
can expose applicable pending integration without mistaking it for ready memory;
ordinary readiness validation is unchanged. Candidate/gap outputs grant no
admission and do not attest exhaustive semantic recall, native execution or indexed
large-graph retrieval. Existing adoption includes source-backed route repair and
actual next-task application. This is the first option-A increment, not release
qualification or activation of the abandoned timeout experiment.

Registered factual access uses the same locator through optional `recall_memory`
on the existing read-only source MCP adapter. Only an explicitly enabled factual
profile exposes it; default independent reviewers retain original-source tools.
Inline-source transport limits remain, with no new store, role or authority.
The existing multipart manifest is also supported only with separately registered
whole parts and verified physical/logical identities. Acquisition stays within
128 KiB per source/2 MiB total; returned candidates and invalid-graph diagnostics
stay within 64 KiB. Independent falsification exposed and verified correction of
an oversized refusal dump. Short packets are not indexed retrieval or semantic
completeness; existing adoption must prove current part bindings and next-task use.
The maintainer two-task qualification distinguishes actual native outcomes from
scripted wiring and trusted fixture acceptance; it is not platform adoption.
Its native follow-through exposed undisclosed grader spellings and a stale PENDING
acceptance publication after completed POST. Source meaning stays under independent
judgment; actual completed phase facts must be published before the next task, not
reconstructed by that task. Accepted results and charged calls survive a bounded
explicitly pinned continuation; no semantic backfill or automatic repeat is added.

The actual two-consumer witness now passed both readiness and post-accept judgments
with independent final evidence acceptance. It retains failed history, eight charged
calls and the older frozen runtime identity; no production adoption or economic
claim follows. A contract-specific lossless wire compiler is maintainer evidence,
not a universal permission to reinterpret incomplete contracts.
Registered marker selections now share the existing 2 MiB artifact envelope while
returned sections stay capped at 128 KiB; markerless files retain their old limit.
Exact-delta review accepted the genuine short-section regression correction. This
does not fix full-history storage growth or establish indexed large-graph recall.

Accepted-cycle terminal correction, 2026-10-09: explicit WAIT/DONE use a durable
source-bound owner record, independent complete-catalog judgment and host readback,
not a synthetic next command. WAIT retains owner/trigger/return/checkpoint; DONE
binds accepted scope/DOD and producer Return. Existing reviewer wire, owner MCP,
notification and delivery paths carry the typed verdict. These statuses grant no
execution and cannot clear pause, blocking findings, pending review or UNKNOWN.
Exact independent repair review accepts strict raw JSON refusal, historical/current
separation, durable snapshot compatibility and visible later-drift owner attention.
Actual native current adoption remains due; no atomic external-writer fence follows.
Existing adoption requires recipient application and later-drift/expiry readback,
not merely installed files or a historical completion notice.

HEALTH evidence identity now hashes complete stored grants/reservations without
exposing their contents. Genuine receipt/result-only drift counterexamples are
corrected and independently accepted. This does not authorize arbitrary repository
churn: trusted effect/dependency evidence is still missing for that liveness gate.
The existing macOS launch adapter now has an optional single-existing-file data-write
mode, independently accepted through real local process tests. It denies other
writes, parent/Git mutation and process-fork, with prelaunch identity/alias checks;
legacy modes remain unchanged. It is only a confinement primitive, not an effects
observer, approved domain, external-writer lock or HEALTH exception. No existing
service automatically selects it; changed mode adoption needs owned current proof.
Scripted storage-envelope qualification retains prior bytes and pending ownership
at capacity and proves short recall from a large packed graph, not indexed I/O or
unbounded storage.

Reconciled-failure migration, 2026-10-09: migration and cutover recognize a genuine
`FAILED_RECONCILED` reservation only with bound grant/failure/process/effects and
its exact append-only host transition. Preserve failed/spent history and pause;
this is quiescence, not success or replay authority. Actual protected exit-7 to
reconciliation/migration and synthetic cutover/rollback checks pass, independently
reviewed at that scope. Generic effect collection and physical custody guarantees
remain outside this correction; it does not qualify native adoption or release.

Host-bound composition correction, 2026-10-09: fixed independent parts retain one
authentic POST scope or HEALTH input and recheck the current lease before each
dispatch and final complete union. HEALTH exposes read-only current review input,
not new authority. Preflight can precede dispatch without reinitializing child
journals; reopening validates their configuration. Finite aggregate allocation,
expiry, unknown-outcome holds and final host admission remain mandatory. Scripted
CLI proof is not semantic qualification; the candidate remains unreleased.
The comparison budget now delegates child-identity calculation to the selected
runtime's pure builder instead of duplicating its internals. Historical packages
without that API retain only the original legacy formula; incompatible
transitional packages refuse, never accept both keys or erase previous spend.
An active REVIEW_IN_FLIGHT enrollment is required for model dispatch. Rebasing
fresh inputs around a held reconciliation lease does not create authority;
read-only observation and reuse of a verified stopped verdict remain available.

Command-failure recovery correction, 2026-10-08: preserve protected termination
metadata and output hashes without exposing raw command output. The trusted host
can reconcile an exact failed reservation only through independent termination
and separate effect observations with journal CAS. The service receives that observer
only through a trusted SDK argument, not serialized profile claims. Failure stays failure; old grants
remain consumed, correction needs fresh admission, and pauses remain. No generic
effect collector, automatic retry, success credit or migration/cutover qualification
is implied. Focused exit7, side-effect and forgery checks are not whole-cycle proof.
Writable-command deadline correction: after timeout/output-limit kill, stream
draining has a250ms teardown grace. Unobserved close settles as OUTCOME_UNKNOWN,
without a fabricated closed-failure receipt or replay authority. Destroying local
pipes is not proof that descendants stopped. Model qualification timers do not change.
Admission diagnostics expose only bounded phase/kind/elapsedMs. Private deadline
identity prevents callback error text from impersonating timer expiry; no raw errors
or command contents are exposed. Contended qualification can safely refuse before
invocation; serial functional testing is not concurrent-capacity certification.

Native REVIEW evidence-integrity correction, 2026-10-08: acquired source evidence
must precede the unique judgment within one completed turn, with consistent tool
identity, arguments and completed lifecycle. Post-judgment reads, crossed calls and
failed or incomplete tools refuse promotion. The observed pre-turn CLI feature
warning is distinguished narrowly from tool errors; original traces and consumed
attempts remain retained. Transport validity is not semantic qualification or
continuation authority; frozen historical runs are unchanged.
Compatibility follow-up: only the observed coherent empty built-in resource
discovery response is admitted as non-evidence transport. Exact response shape,
pre-judgment chronology and the same call ledger remain mandatory; discovery
cannot replace registered-source acquisition or justify citations. Unknown or
nonempty discovery still refuses. Freeze05 remains historical; changed source
requires independent review, a new full-suite qualification and Freeze06 before
native POST_ACCEPT dispatch.

Scoped health correction, 2026-10-08: initial independent diagnosis and owner
application remain mandatory. Later due observation stays visible without becoming
a global execution hold. HEALTH findings can retain immutable source-backed
affectedTasks; missing scope remains global/unknown. Actual owned repair leases
admit their exact repair identifier without static aliasing. Pauses and independent
failed-repair retry gates remain. This changes candidate runtime bytes; older
Freeze02 qualification does not certify the corrected runtime. Focused regression
and independent review, then a new source freeze, are required before new dispatch.

Evidence granularity correction, 2026-10-08: protected per-acceptance source scope
isolates unrelated registry growth; original acceptance remains immutable while
owned additive revisions permit newly discovered dependencies after stopped-review
reconciliation. Existing exact artifact selectors now also bound review-source
bytes, avoiding whole-file invalidation for unrelated memory/map additions. Relevant
drift and unacquired evidence still refuse. Single-part service supplies its own host
binding; old unbound journals require explicit safe binding with preserved budget and
history. No scoped multipart support, semantic-completeness or economic claim is
implied. Independent counterexamples and the current full suite remain qualification
requirements; no new manager, index, role or automatic product migration is added.

Readiness coverage repair, 2026-10-08: existing C05.02 now explicitly judges the
already-required independent disposition for the exact current packet, permitted
command and source revisions BEFORE an adopted controlled action. A mechanical
grant, worker readback or later successful review cannot substitute for it or
backdate it. Reuse needs an unchanged authorized binding. Missing pertinent proof
remains owned UNKNOWN; evidenced omission is FINDING, not NOT_APPLICABLE. This
clarifies one existing criterion without adding roles, checks or a runtime schema.
Prior all87 verdicts used the old predicate and do not prove this added coverage;
preserve their original results and qualify a new compliant increment instead.

Qualification transport repair, 2026-10-08: preserve completed preparation instead
of regenerating it after a serializer failure. Only an exactly equal redundant
frozen command may be projected out of the declared compact format, with original
output and a checked receipt retained. Subsequent reuse requires an unchanged file
map, acquired sources and a fresh owner decision; it grants no execution authority
and permits no appended semantic changes. Publish the full compiler context at
that interface. This changes the qualifier, not the installed operating roles;
successful scoped recovery is not a clean-run, economic or adoption claim.

Post-accept partition repair, 2026-10-08: a complete real three-part verdict failed
at persistence because its parent copied an omitted POST_ACCEPT phase. The merger
now uses the same phase default as the single-review path. Regression covers both
phases, all87 rows, retained findings and no repeated dispatch. Original native
answers can be recovered only with authenticated journals/source bindings; failed
runs and actual findings remain visible. This is not release or product closure.

Post-accept evidence boundary, 2026-10-08: expose only the accepted task's protected
historical grants/reservations and bind them into review freshness. Do not expose
raw commands/paths, infer outside-host authority or renew consumed grants. New
continuation depending on the acceptance is excluded even for the same task ID,
so it cannot invalidate its own prerequisite review; unknown effects remain held.
Targeted counterexamples and the full runtime suite pass. This is an evidence
projection repair, not another role or a claim that adoption is complete.

Module identity clarified, 2026-10-07: the existing delivery workflow and contract
now distinguish canonical development, immutable release distribution, environment
bindings and versioned composites. Connections must not create algorithm forks;
composites pin children and preserve public obligations. Independent connection
and algorithm-quality verdicts remain separate. No new service/role/runtime schema;
structural coverage is not behavioral qualification or project adoption proof.
The shared map now explicitly routes goal/capability through canonical module,
contract, selected release and consumers. Latest available and actually selected
versions stay distinct; diagrams are views, not another registry. Existing roles
share this navigation and update/review it through the normal acceptance/sync path.

Economic objective clarified, 2026-10-07: eliminate repeated and wasted work through
better organization, rather than minimize preparation/control in isolation. The
managed control route and qualification criteria now require whole-sequence
retained outcomes, actual rework/recall/duplication losses and all operating costs.
Higher control expense can be justified by lower observed total effort; hypothetical
prevented failures are not measured savings. No measured economic claim is added.

Controlled policy assembly, 2026-10-07: the private host cycle was implemented and
described in maintainer design, but ordinary managed owner/worker event routes did
not explicitly require its post-accept enrollment. A model comparison driven only
by harness instructions could therefore overstate adoption. One managed
`independent-control.md` procedure now binds mode selection, original-source
readiness, actual retention, fresh REVIEW, applied disposition and observed
continuation. Core and existing start/accept/activation/orchestrator routes point
to it; no new manager, runtime schema or unconditional full-context prompt. Host
limitations, explicit pauses and budgets remain. This is unreleased policy wiring,
not semantic or live-adoption proof; qualify the newly frozen policy before release.

Separated startup, 2026-10-07: actual concurrent-registration and interrupted-before-
kick counterexamples showed that successful registration could lose the immediate
wake. Instead of adding wake retries or another coordinator, registration is now
periodic-only. The automatic trusted setup route runs the selected observer once,
checks its durable result and then registers the timer. Unknown initial outcomes
stop before registration; activation itself remains NOT_RUN/NOT_CHANGED. Initial
observation, real interval execution and project readiness are separate proofs.
This supersedes the earlier post-registration kick approach below; historical
failures remain evidence, not silently regraded outcomes.

Major channel protection, 2026-10-07: the new installer selects updates from the
installed target's major, using main for 1.x and opt-in release/2.x for 2.x. Major
changes and downgrades require an exact approved version pair before any target
write; --force does not bypass transition approval. Malformed/conflicting installed
identity, regressed metadata and missing/wrong-major channels fail closed, without
fallback. Historical updaters cannot gain these guards retroactively: main and
remote default HEAD must remain compatible 1.x, and explicit cross-major --from
must use the reviewed new installer. CLI approval is not authenticated human
consent, adoption acceptance or journal rollback. No channel was published here.

Registration wakeup, 2026-10-07: a disposable native launchd probe reproduces a
lost first wake when RunAtLoad starts under the registration lease and kickstart
encounters the still-exiting rejected child. New registrations disable RunAtLoad
and explicitly wake after release, without killing, retrying or stealing observer
ownership. Future LOGIN loading follows the interval, not immediate startup;
logout/reboot remains unqualified. Existing conflicting plists require owned
quiescent unregister/re-register. This explains a demonstrated possible failure
path; the earlier failed broad test did not retain enough diagnostics to identify
its exact cause retrospectively.

Owned removal, 2026-10-07: two failing-before native cases exposed a false hold on
an idle post-tick PID and an inability to remove the exact earlier RunAtLoad plist.
Removal now accepts that exact legacy variant without allowing silent registration
reuse, and may stop an idle process while exclusively holding the observer lease
through verified bootout. Retained active/unknown leases still block removal. This
does not establish why an earlier broad run's post-tick process exit was delayed.
The later full-suite removal failure exposed another boundary: bootout can return
success while a registered process is still SIGTERMed. A native delayed-exit probe
reproduced this. Removal now observes exact absence within a finite deadline without
repeating bootout; unknown post-dispatch state preserves both lease and plist for
explicit reconciliation. Fault-injected print failures distinguish pre-dispatch
safe release from post-dispatch retained ownership.

Execution visibility and scoped evidence, 2026-10-07: a fresh all-criterion run
completed but stopped before repair. Independent review distinguished a missing
bounded source-universe declaration, a premature execution-lease requirement and
an unsupported capacity-loss attribution. HEALTH now observes protected grant and
reservation metadata without command contents; changes invalidate review and owner
application. These facts cover only this host, not external project assignments.
Review guidance requires the actual criterion's causal/timing conditions and keeps
unknown scope distinct from a demonstrated fault. No automatic N/A, closure, retry
or broadened repair authority; the failed run remains failed. A synthetic closed
source-universe declaration cannot certify a real project's history.

Overdue-review deduplication, 2026-10-07: a reproduced scheduler defect repeatedly
reenrolled unchanged nonblocking overdue findings immediately after completed
review and owner disposition. The lease now captures due checkpoint identities;
only accepted review acknowledges them. Findings/deadlines remain open and intact;
new deadlines, source changes and periodic control still trigger. Legacy journals
have no implied acknowledgement. This repairs a demonstrated waste path, not a
measured claim about any live project's allowance consumption.

Health lifecycle visibility, 2026-10-07: initial diagnosis and repair verification
now receive the host's actual coordination projection, including recorded repair
assignments and requested finding IDs. These previously stored facts were absent
from the reviewer input. The projection is offer-bound, stable across claim and
explicitly not successful-repair proof. Independent closure and all criterion
coverage remain required; phase does not automatically waive a check. Existing
projects apply this only through a quiescent runtime update, then verify their
own current lifecycle/evidence route; old incomplete reviews remain unresolved.

Bounded review parts, 2026-10-07: diagnostic judgments completed on small assigned
sets using the real native path; full-review timeout cause remains unproved.
The candidate can explicitly split the catalog into fixed whole-group parts with
one immutable offer, full source acquisition, reserved aggregate capacity and
global all-or-nothing admission. No part alone is a healthy-project verdict or
continuation authority. Independent lifecycle checks repaired budget-unit, source
identity and cancellation-publication defects. Two actual parts completed, but
the second was rejected for missing duplicated rationale. An absence-only decoder
normalization reuses the exact linked current finding evidence; it does not invent
proof or change the failed result. Maintainer-only diagnostic reconciliation can
preserve those results without repeating their model calls. The qualifier now
stops before a paid repair-review when other blocking work is outside its fixed
repair scope. Assembled semantic qualification remains open; this is not released.

Inherited-project qualification, 2026-10-07: actual historical install/update and
installed control activation are exercised in a synthetic pricing project. An
independent counterexample repaired the qualifier's pre-install preservation gap.
The first native diagnosis acquired all sources but timed out; its failed state,
unknown usage and unspent later stages remain visible, not a completed adoption.
Review catalog serialization is smaller without dropping any of the 87 criteria;
bounded transport timing now makes future phase delays observable. No timeout
increase, allocation reset, inferred review, automatic retry or savings claim.
The separately allocated diagnosis also timed out after completed source reads;
cause remains unproved. Independent review found missing baseline behavioral
proof in the fixture: it now verifies public behavior before installation and
registers an artifact-bound synthetic receipt. Original failed runs remain failed.
Child output now uses streaming UTF8 decoding after a split-character corruption
reproduction; this transport fix is not presented as the diagnosis-timeout cause.

Current-state preparation, 2026-10-07: immutable historical acceptance is now
separate from a scoped read-only host projection. Native preparation must acquire
that projection and pass post-call freshness, while public-source acquisition and
semantic application remain separate obligations. Independent probes caught stale
positive reporting during pending/reconciling review and a qualifier parser
mismatch before another inference was dispatched. Preserve the original failed
recall and all open findings; no runtime activation or release is claimed here.

Combined-cycle checkpoint, 2026-10-07: actual model preparation, independent
readiness, public-module consumption, product acceptance/retention, fresh control
and owner disposition ran on one frozen version. The final native worker made no
execution call; this was retained as FAILED, then independently checked and
recovered through the same protected route with zero new model calls. Six open
owned findings remain. Runtime completion now follows final readback, not child
exit; required-source acquisition and exact action-result gates reject false
success. Optional preapproved deterministic continuation removes an unnecessary
model dispatch without creating new approval authority. See combined-cycle
evidence; this is not production adoption or proven allowance savings. NO_RELEASE.

Scoped delivery checkpoint, 2026-10-07: installed observation can invoke an
explicitly delegated, budgeted native disposition handler, not another project
orchestrator. Independent counterexamples repaired invalid application evidence
and excessive repair-submission authority. Native continuation and local lost
external-response reconciliation execute without replay. Automatic allowance RPC
is wired but refuses unsafe/config-bearing auth homes; live reset observation and
desktop-owner wakeup are not certified. This does not complete semantic/adoption/
economics gates. See owner-delivery evidence; manifest 1.34.1, NO_RELEASE.

Service recovery checkpoint, 2026-10-07: stopped-observer reconciliation preserves
pause/journals/allocation and refuses unknown effects. Reset-aware scheduling now
retains due epochs across newer observations and blocking repairs; independent
review exposed and regression-tested both loss cases. Durable notifications
distinguish attempted delivery, exact readback, host-observed disposition and
supersession without false closure. Native owner transport and disposable LOGIN
wakeup passed. Explicit paused journal migration retains old data and rejects
unsafe rollback. These are supported-host prerequisites, not a completed combined
cycle or installation. See service-recovery evidence. Manifest remains 1.34.1.

Latest checkpoint, 2026-10-07: independent initial health, private activation and
actual disposable launchd observation work without an accepted task or active
manager. Five found boundary defects were repaired and independently accepted.
A real owner failed on the old untyped tool; typed/compact delivery then consumed
the same verdict without repeating review. Independent repair closed six of seven
findings; one nonblocking inventory gap stays owned with its failed attempt.
Added bounded dirty-path metadata, not producer source context. This is not complete
recovery, adoption/rollback or measured framework savings. See health-activation
evidence. Manifest remains 1.34.1; NO_RELEASE and no live product changes.

Prior boundary checkpoint, 2026-10-06: 540/540 tests pass, native enabled, no
skips. Independent review reproduced legacy failed-repair closure and stale
registry acquisition; both fixes received separate scoped acceptance. Candidate
runtime staging verifies a separate content-addressed package without changing
the project. Actual native execution from it and same-schema reopen/rollback
retain pauses and unknown effects; unsupported history is held, not reset.
This does not install a service, enroll project health or complete adoption.
See runtime-staging evidence. Manifest remains 1.34.1; NO_RELEASE.

Semantic-cycle checkpoint, 2026-10-06 (supersedes earlier test counts below):
fresh native review rejected contradictory retained meaning, verified its repair,
then detected stale tracker state after the protected consumer ran once. Final
closure retained original acceptance and failure history without product replay.
Compact source handles keep hashes and immutable finding metadata host-owned.
Two independent host defects were reproduced and repaired; 534 native/repository
tests pass. This developmental synthetic cycle used a trusted fixture owner and
retention-only admission, not a live orchestrator or complete adoption. Timeout
usage is UNKNOWN and comparative savings are unproven. See the semantic-cycle
evidence; installation/rollback and final independent acceptance remain gates.
NO_RELEASE, no production activation or manifest change.

Native-boundary follow-through, 2026-10-06 (candidate only): an isolated supported
CLI worker now uses a required registered-command MCP, with direct native writes
and shell disabled. Actual local-provider/OS tests reject missing approval,
forged authority, replay and missing control service. A separate offline reviewer
process retains results across restart; bounded shutdown preserves UNKNOWN rather
than false completion. Independent scoped review accepted the shutdown repair;
513 native/repository tests pass. Semantic model delivery, scheduler, combined
cycle and existing-project adoption/rollback are still release gates. No installed
manifest or product change, no universal reliability/economy claim, NO_RELEASE.

Controlled-dispatch candidate, 2026-10-06: the existing context runner now supports
a host-owned command admission boundary. A separate candidate entry requires
authorization, exact reservation and observation; controller failure cannot fall
back to execution on that entry. Eight real-command regression cases pass, full
suite 479/479. Protected host identity/storage, post-accept delivery and installation
remain unimplemented gates; ordinary reference CLI behavior is unchanged. No release.

Assembly update, 2026-10-06 (not installed): 28 control groups now have 87 explicit
operational criteria. Candidate modules bind atomic product acceptance/review
enrollment, actual retention readback, independent post-accept disposition and
continuation. Retained findings use live repair leases, append-only retry decisions
and revision revalidation. A proven independent increment no longer implies that
whole-project preparation is complete. Independent counterexamples were reproduced
and repaired; 471 tests pass. Mandatory supported-host enforcement, combined
semantic qualification and adoption/rollback remain release gates. See the
assembly evidence; this is not a 2.0 release or a universal reliability claim.

2.0 design clarification: independent cycle control follows the orchestrator's
accept-work and actual knowledge/artifact retention. It examines the completed
manager cycle across applicable C01-C28 responsibilities, not just the worker's
output. Existing pre-accept technical review remains. Fresh REVIEW publishes a
verdict; the host ensures delivery and an observed orchestrator response without
a persuasion loop. Knowledge integration stays the orchestrator's accountability.
The required post-accept host test is specified but not yet executed or installed.

Qualification update, 2026-10-06 (not installed behavior): a disposable protocol
host now tests real interruption, unknown-effect holds, exact result recovery and
retained next-task preparation. Independent counterexamples tightened debt
scope/time accounting, sparse-input validation and admitted/dispatched command
binding. A private-source regression demonstrated why action-changing decisions
need a short correction/provenance chain, and why independent grading must not
confuse unavailable evidence or equivalent wording with a failure. These are
bounded qualification results, not complete 2.0, project adoption or savings;
see the lifecycle qualification evidence. No new production role/timer or release.

The independent Health Review candidate now separates consideration from repair:
an accepted deadline and source survive outside the product next action; a long
milestone cannot silently postpone the architecture plan. Current dispositions
accompany original findings, and accepted repaired-source revisions retain all
unresolved owners/deadlines. Existing checkpoint-review adoption carries this
proof; no new role, timer or runtime protocol is introduced. Isolated adapter
checks and one separately owned host episode support the bounded follow-through,
not universal semantic completeness, atomic host admission or allowance savings.
The broader candidate remains unreleased pending its explicit acceptance gates.

Exact-producer handoff review exposed a narrow reader gap: a standalone or fenced
JSON object explicitly claiming the Return protocol was treated as an empty
outbox without diagnostics. Such a claim now reports invalid framing; it is not
accepted as a new wire format and creates no receipt id. Diagnostics preserve
claimed identity so a different malformed receipt cannot hide behind an old
accepted incident. Ordinary JSON/prose remains quiet. Tests cover canonical
framing repair, one-time discovery/routing, quiet repeats and bounded failed
repair. Adoption stays in guard-continuity: actual producer bytes, expected valid
id, writer/storage availability, owner-scoped repair or NO_CHANGE, and recipient
readback. Coordinator-created replacements do not prove producer delivery.

The isolated stress episode accepted saved code and documentation, but its JSON
Return was not natively discoverable; later coordinator-generated records proved
only the coordinator path. Keep that evidence correction explicit. This reader
fix has reproducible local benefit without a new role or timer. Production
adoption and automatic semantic course control are separate, unproven boundaries;
publication remains pending, not implied by passing tests.

Поддерживаемые новые значения входа не означают изменение модуля или его контракта. Отказ адаптера сначала рассматривается как дефект совместимости; транспортная проверка не должна создавать вторую бизнес-схему. Перед дорогим этапом проверяется фактическая установленная стыковка, включая сохранение и повторное чтение, проекции входа и доступность объявленных ресурсов. Неизменность дочерних модулей и старый пример не заменяют эту проверку. Не требуется повторный аудит платформы для каждого нового значения.

Sanitized compatibility review: a released capability supports a family of requests, but a consumer validator rejects a different supported request. This is a connection defect, not evidence that the user changed the module. Existing public-boundary rules already prohibit producer rewrites; this clarification makes input classification and installed-route proof explicit without another role, schema or runtime gate.

| Review scenario | Required disposition |
| --- | --- |
| Different supported values; old consumer validator rejects them | Consume the same module; repair the evidenced consumer boundary, not a second business contract. |
| Current persisted input differs from reopened or consumer-facing input | Connection not ready; retain evidence and route the named mismatch to its owner before the dependent costly stage. |
| Old example passes but an actual declared resource location does not resolve | Old proof stays scoped; installed-route readiness is not established. |
| Input is outside declared applicability, or unchanged route evidence is sufficient | Explicit applicability decision for the former; reuse evidence and continue authorized consumption for the latter. |

Adoption uses the existing `module-boundaries` requirement: at the affected task's next safe connection/rebrief checkpoint, review its declared input family and projections, repair a demonstrated mismatch or record evidence-backed NO_CHANGE, and obtain actual installed-route readback. Preserve existing owners, authority and unaffected work; publish changed contract/map meaning and verify affected recipient application through existing sync. No whole-project refactor or automatic paid replay. These scenarios and instruction tests are review evidence, not observed model behavior or live adoption. Version remains 1.34.1 until publication is separately completed.

Независимый контроль курса использует существующий REVIEW в свежем контексте, а не нового постоянного руководителя. Он сверяет исходные цели и публичные связи, сохраняет замечания до проверенного разрешения, возвращает обещанные рассмотрения идей и не открывает закрытые модули ради обычной стыковки. Повторное событие без новых обстоятельств не запускает ещё одну проверку. Последние согласованные решения пользователя сохраняют приоритет.

The semantic procedure lives in module-delivery with short existing entry routes. The existing checkpoint-review adoption requirement checks one actual fresh review and consumed disposition plus unchanged continuation. Deterministic events can expose recorded due obligations, not discover omitted meaning; unsupported background observation remains explicit. No new Guard, scheduler, runtime schema or permanent role is introduced.

Eight sanitized decision cases and 24 criteria are prepared against exact 1.34.1. The maintainer-only stager supports an explicit suite while retaining historical defaults. All 373 local tests passed. The separately authorized C01-C04 comparison used eight Sol 6.1 Low attempts and one independent Sol 6.1 High judgment: both arms passed 12/12, while candidate input increased 16.6% and process time fell 5.1%. The judge's complete streamed result was retained despite native finalization reaching the time limit; no retry was made. These are decision results, not autonomous recovery or subscription savings. C05-C08, bounded multi-step proof and live adoption remain unverified; no release or product change is performed.

Evolution gate: benefit sought is fewer missed parent obligations and repeated connection repairs. Evidence is executable local checks and a small matched decision screen with tied quality and higher input cost. Complexity is one routed review procedure and an offline suite option in existing mechanisms. Verdict: HOLD publication; retain the frozen candidate, target omitted-source discovery and real follow-through before more rule expansion, and add no permanent supervision on this evidence.

## 1.34.1 - 2026-10-03

Изменение функции должно приходить вместе с проверкой того, что уже есть в проекте: что оставить, что исправить и как подтвердить применение. Нужный рефакторинг получает владельца и безопасную точку возврата; ненужный не запускается ради самого обновления.

Синхронизация учитывает не только отправку решений, но и их запись в общие материалы, нахождение и применение другим участником. Это касается графа, карт кода и модулей, контрактов, правил и накопленного опыта. Отсутствующее или устаревшее подтверждение оставляет конкретный незавершённый шаг, а не видимость общей актуальности. Независимая работа продолжается.

Детерминированная проверка сверяет заявленные источники, версии и подтверждения; она не удостоверяет личность участника и не доказывает правильность понимания моделью. Новых фоновых вызовов моделей или управляющих ролей нет.

## 1.34.0 - 2026-10-03

Перед расширением задачи проверяется не только качество решения, но и его необходимость: какую цель оно поддерживает, какие правила платформы сохраняет и почему нельзя обойтись уже работающими модулями. Для новых границ нужен отдельный взгляд; обычные исправления не получают дополнительного цикла согласований.

Память больше не привязана к вместимости одного документа. Если хранилище заполняется, новое решение сохраняется как явное незавершённое обновление, пользователь получает понятное пояснение, а хранение можно расширить без сокращения истории. Добавлен проверяемый перенос в несколько файлов. Обновление памяти уточняет существующие сущности и версии; противоречия разбираются отдельно, а не скрываются дубликатами.

Старые графы и незавершённые задачи остаются совместимыми. Установка добавляет проверку новых механизмов в план внедрения, но сама не переносит рабочую память. Проверки исполняемого маршрута и целостности хранения не доказывают поведение моделей, внедрение в рабочий проект или экономию лимитов.

## 1.33.1 - 2026-10-01

Исполнитель после восстановления контекста сверяет текущее поручение, чтобы не отвечать на давно закрытый вопрос вместо продолжения работы. Если одна адресная попытка восстановления не помогает, оркестратор рассматривает перенос сохранённой работы в свежий контекст с единственным владельцем, а не повторяет напоминания. Паузы пользователя, ограничения доступа и неопределённые внешние операции сохраняют приоритет.

Существующая проверка Guard получает необязательное сопоставление текущего поручения с тем, что исполнитель подтвердил после восстановления контекста. При обновлении проверяется применимость этой защиты в конкретной среде: установка файлов сама по себе её не доказывает и не останавливает независимую работу. Пустой ответ фоновой модели не считается проверкой без расхода модели. При оценке эффективности отдельно показываются эффект перехода на более дешёвую модель и уменьшение повторной работы; расчёт по коэффициентам не объявляется точным списанием лимита подписки.

Проверки и ограничения применения: `docs/evidence/task-continuity-review-2026-10-01.md`.

## 1.33.0 - 2026-09-29

Меньше повторной работы вокруг уже решённых задач. Готовые модули подключаются по документации и фиксированной версии, без повторного изучения их внутреннего кода. Оркестратор, подготовитель и исполнитель работают по одному циклу: понять задачу, собрать достаточный контекст, выполнить, проверить и сохранить результат. При сбоях ответа сохраняется незавершённая операция, чтобы восстановление не начиналось с ненужного повтора.

Обновление совместимо с существующими задачами и памятью. Установка файлов не означает, что конкретный проект уже перешёл на новый режим: его оркестратор отдельно проверяет применение правил, сохраняет незавершённую подготовку и продолжает работу на безопасной границе. Экономия подписочного лимита пока не доказана и не обещается.

Потерянный ответ не должен провоцировать повтор уже выполненной операции. В подключённом командном маршруте неопределённый результат сохраняется даже при смене сессии или номера вызова; чтение и восстановление остаются доступны. Если проверка уже запускалась или условия задачи изменились во время работы, это больше не выдаётся за «ничего не происходило» или обычное завершение. Защита не распространяется автоматически на все инструменты харнеса и не заменяет изоляцию доступа.

Постоянные инструкции сокращаются до общих правил и выбора нужной процедуры. Подробности обновления, Guard, памяти и приёмки остаются в соответствующих разделах и читаются по событию, а не перед каждым действием. Сохраняются полномочия пользователя, границы модулей, возврат результатов и продолжение незавершённой работы. Уменьшение текста измеряется отдельно и пока не считается доказанной экономией лимита.

Исполнитель разбирается в уже разрешённых исходниках и тестах самостоятельно. Оркестратор подключается к поиску, когда полученного контекста действительно недостаточно или источники противоречат друг другу. Это убирает лишний повод останавливать обычную работу, но не разрешает расширять доступ или читать внутренний код подключаемых модулей.

Работа собирается в единый цикл: найти нужную возможность и прошлые решения, определить границу модуля, подготовить достаточный контекст, выполнить, проверить и сохранить результат. Карта кода, память, документация, Discovery и лаборатория получают разные обязанности внутри этого цикла. Развёрнутые правила вынесены из постановки задач в один общий контракт: продолжение текущей работы не требует перечитывания всех инструкций.

Подключение готового модуля получает техническую проверку: новый пакет контекста фиксирует, что можно использовать, а что менять. Попытка передать внутренний код подключаемого модуля подготовителю или включить его в изменяемые файлы отклоняется; артефакт и доказательство подключения привязаны к точной версии. Старые задачи продолжают работать до безопасного перехода и явно не считаются защищёнными новым механизмом. Проверка действует на объявленные границы и поддерживаемый путь, а не перехватывает любые инструменты модели.

Оркестратор должен сам замечать, когда вместо самостоятельного модуля получается набор действий, которым каждый раз приходится управлять вручную. Перед очередной частной правкой он предлагает конкретную границу ответственности и работу по устранению ручной зависимости. Наличие API и успешный пример ещё не доказывают, что модуль самостоятельно выбирает операции, проверяет результат и завершает поиск. Приёмка сохраняет это различие и проверяет полный обещанный путь.

Тактическая просьба не отменяет принятую архитектуру молча: конфликт выносится на понятное решение, временная уступка получает условие возврата. Это не запрет на осознанные решения человека, не обязательные микросервисы и не повод остановить весь проект. Используются существующие brief, Module Contract, исполнители и приёмка; универсальные правила не содержат частных проектных данных.

Существующий Health Review получает обязательную еженедельную сверку курса после подтверждённого сброса лимита, при первом активном обращении: не стали ли новые функции требовать повторного чтения внутренностей готовых модулей и ручного управления результатом. Привязка к лимитному периоду и условие возврата сохраняются при обновлениях и смене контекста; неизвестную дату не угадывают, окно согласуют. Короткая проверка имеет ограниченный бюджет и не расходует автоматически ресурс, нужный для запланированной работы. Она использует карту, контракты и уже полученные результаты, не перечитывает весь код, не будит простаивающий проект и не создаёт второй Guard. Найденное обслуживание согласуется в пределах действующих полномочий отдельно от проверки; срочный риск не откладывается до сброса. Реальная экономия подтверждается наблюдениями, а не обещается по коэффициентам моделей.

Evolution Gate: **Benefit** — готовые возможности используются без повторного раскрытия реализации, а частный успех не подменяет целый результат. **Evidence and limits** — 322 автоматических теста, сравнение на восьми контрольных ситуациях, изолированный пилот с двумя подключениями без исходников производителя и проверка продолжения после обновления. В пилоте остаются ограничения завершения и измерения расхода. Это не доказательство экономии лимита или безошибочности живого оркестратора. **Complexity tradeoff** — один общий цикл вместо повторных инструкций, один проверяющий модуль в существующем пути подготовки, без новых ролей, хранилищ, таймеров или модели-судьи на каждый шаг. **Verdict: simplify**; выпуск проверенного универсального комплекта согласован. Применение в конкретном проекте остаётся обязательной отдельной проверкой при его обновлении.

## 1.32.8 - 2026-09-27

Работа над одной задачей больше не должна скрывать остальные договорённости о подготовке проекта. Если карта уже построена, но часть модулей или документации ещё не готова, оркестратор сохраняет весь план: что готово, что делаем сейчас и к чему вернёмся позже. Завершение текущей задачи не закрывает чужие незаконченные пункты.

Исправлена проверка продолжения: каждый выявленный пробел связан с действующим исполнителем или явно отложенной работой и точкой возврата. Связанные области можно объединять; отдельные задачи на каждый модуль не нужны. При обновлении используются уже готовая карта и решения, без повторного общего аудита, автоматического рефакторинга или остановки независимой продуктовой работы. Принятые модули по-прежнему подключаются по публичному контракту и фиксированной версии; изменение их внутренностей остаётся отдельной работой владельца.

Evolution Gate: **Benefit** — подготовка всей платформы не теряется за одним текущим модулем. **Evidence and limits** — регрессия закрытого владельца и непокрытых областей, сценарии группировки, пауз, частичной приёмки и ограниченного Guard; контроль проверяет связи, но не заменяет проверку смысла плана и качества продукта. **Complexity tradeoff** — список областей в существующих шагах вместо новой роли, очереди или таймера. **Verdict: simplify**, выпуск после тестов и независимого ревью.

## 1.32.7 - 2026-09-27

Подготовка проекта больше не должна исчезать за ссылкой на план и словами «согласуем позже». Если карта или модульность не подтверждены, оркестратор обязан обозначить конкретный следующий шаг, исполнителя, ожидаемый результат и точку возврата. Незавершённое возвращается на рассмотрение после текущего этапа. Если прежнее указание мешает продолжить, человек получает понятное предложение сейчас, а не обещание когда-нибудь задать вопрос.

Проверка состояния связывает эти шаги с существующими задачами и контрольными точками. Наступивший срок вызывает пересмотр, но не отменяет паузу, не разрешает рефакторинг и не запускает работу сам. Настоящий неотвеченный вопрос сохраняется без повторных напоминаний. Оркестратор оценивает работу по принятому и сохранённому результату, времени и общему расходу: обслуживание и модульность нужны для уменьшения повторного поиска и переделок, а не ради новых аудитов.

Evolution Gate: **Benefit** — отложенная подготовка получает проверяемое продолжение, а не вечное ожидание. **Evidence and limits** — регрессия формально корректного пустого плана, сценарии возврата/паузы/вопроса/приёмки и полный набор проверок; структура не доказывает смысл вопроса, качество карты или реальную экономию. Фоновое обнаружение зависит от действующего адаптера Guard. **Complexity tradeoff** — компактные ссылки на шаги в существующем состоянии и прежний формат контрольной точки; без новых ролей, типов ожидания или таймеров. **Verdict: ship** после ревью и проверки применения.

## 1.32.6 - 2026-09-27

После установки оркестратор должен дать два ясных ответа: весь ли код проекта картирован и подтверждена ли модульность архитектуры. Если нет, он показывает, что осталось сделать, зачем это нужно и на каком безопасном этапе работа будет выполнена. Текущая задача влияет на расписание, но не позволяет забыть подготовку. Частичная карта не считается полной, а предложенная переделка не считается уже выполненной.

Используются существующие план и исполнитель. Готовые материалы не собираются заново; явная пауза пользователя сохраняется, независимая работа продолжается, изменения архитектуры по-прежнему согласуются отдельно. Проверка состояния обнаруживает отсутствие ссылки на план или объяснение пользователю, даже если записано ожидание. Новых фоновых циклов нет.

Уточнено, что значит закрыть работу модулем: его можно подключить по контракту, не перечитывая внутренний код и историю разработки. Более крупные модули строятся из таких же проверенных частей и проходят свою проверку общего результата. Внешние ограничения сохраняются в контракте, а алгоритмы, причины решений и отвергнутые подходы остаются в документации для развития модуля. Это сокращает повторное изучение готовых решений, не скрывая важных условий их использования.

Evolution Gate: **Benefit** — подготовка не исчезает за сообщением об установленной версии или текущей продуктовой задачей. **Evidence and limits** — проверяемые двоичные решения, сценарии ожидания/возврата/приёмки и установленный CLI; истинность источников, качество плана и реальное исполнение по-прежнему требуют проверки оркестратором. **Complexity tradeoff** — две вычисляемые проверки и ссылки в существующем состоянии вместо новых типов ожидания, ролей или таймеров. **Verdict: simplify**, затем ship после ревью кандидата.

## 1.32.5 - 2026-09-27

Первая подготовка теперь охватывает устройство всего проекта, а не только участок текущей задачи. Оркестратор должен показать, где уже есть самостоятельные модули, где код связан слишком тесно, какой документации не хватает и что стоит изменить. Для проблемных участков он предлагает понятный план: что сохранить, какие границы выделить, в каком порядке действовать и как проверить, что ничего не сломалось.

Аудит не означает автоматическую переделку платформы. Подготовку можно завершить с предложенным планом, а архитектурные изменения делать только в согласованных задачах. Готовые материалы и их владельцы сохраняются; следующие задачи обновляют затронутые участки карты, не запускают полную ревизию заново. Недоступные части явно отмечаются. Наличие локальной карты или установленной версии больше не заменяет проверку полноты первого обследования.

Evolution Gate: **Benefit** — человек получает картину состояния платформы и план улучшений вместо ложного сообщения о полной готовности. **Evidence and limits** — регрессионные сценарии, переход со старого состояния и проверка установленного CLI; источники и архитектурные выводы проверяет оркестратор, машинный валидатор не доказывает их истинность. Живое применение в проекте ещё не проверено. **Complexity tradeoff** — уточнены существующие карта модулей, подготовка и приёмка; компактная проверка покрытия без новой роли, фонового цикла или обязательного рефакторинга. **Verdict: ship** после ревью кандидата.

## 1.32.4 - 2026-09-27

Подготовка проекта после обновления должна заканчиваться пригодными для работы материалами, а не только найденными ссылками. Проверка теперь различает карту кода, карту модулей, контракты, связи памяти и доказательства проверки: наличие одного больше не позволяет объявить готовыми остальные. Пробелы сохраняются за той же задачей, без новой общей ревизии и без остановки независимой работы.

Если результат исполнителя уже обработан, но в плане всё ещё висит его старая активная контрольная точка, существующая проверка напомнит согласовать следующий шаг. Она не запускает работу повторно, не отменяет паузу и не засыпает оркестратор одинаковыми сообщениями. Новых ролей, таймеров и модельных вызовов на обычных проверках нет.

Evolution Gate: **Benefit** — меньше ложных заявлений о готовности и незаметных остановок между результатом и продолжением. **Evidence and limits** — регрессионные тесты и моделирование существующего цикла; машинная проверка сверяет записи, но не гарантирует правдивость источников и выполнение живой моделью. **Complexity tradeoff** — существующая проверка готовности подключена к Project State, расширена проверка уже согласованной контрольной точки; без второго журнала и нового аудита. **Verdict: ship** после ревью кандидата.

## 1.32.3 - 2026-09-27

Обновление не должно останавливаться на сообщении «файлы установлены», если проекту ещё нужны карта кода и подготовка модулей. Возвращённая инвентаризация теперь требует решения оркестратора: принять подтверждённую готовность, продолжить недостающую работу у того же исполнителя или показать конкретную причину ожидания. Закрытый установочный тред больше не может незаметно оставаться владельцем незавершённой подготовки.

Проверка состояния связывает подготовку с действующей задачей. Существующие паузы, согласование архитектурных изменений и независимая продуктовая работа сохраняются. Нового Guard, фонового аудита, пересборки памяти или повторной установки не требуется. Старые записи нормализуются по уже полученным результатам при обновлении.

Evolution Gate: **Benefit** — после проверки пробелов следует их устранение, а не ожидание нового напоминания человека. **Evidence and limits** — регрессионный сценарий возвращённой инвентаризации, проверки переходов и CLI; это не гарантия доступности внешнего харнеса или полноты проектной памяти. **Complexity tradeoff** — уточнение существующего поручения и проверяемая связь с Execution Lease, без новой роли или цикла. **Verdict: ship** после полного ревью и проверок кандидата.

## 1.32.2 - 2026-09-24

При подключении или подходящем обновлении оркестратор теперь сам проверяет готовность карты кода, модулей, контрактов, связей с памятью и проверки поведения. Недостающую проверку и описание существующей архитектуры он поручает одному общему исполнителю, переиспользуя уже принятую работу между участниками. Дефицит перед зависимой новой задачей остается видимым; независимая разрешенная работа и паузы сохраняются. Новые границы и изменение архитектуры предлагаются человеку до правок.

Установка комплекта и готовность возможности имеют разные результаты. Наличие документов и результат структурного классификатора не заменяют проверку маршрута от источника до задачи, приемки, Return и обновленной памяти. Нового Guard, роли, графа или обязательной проверки на каждом ходе нет.

Evolution Gate: **Benefit** — проект получает конкретного владельца недостающей карты вместо ожидания запроса человека. **Evidence and limits** — локальные исполняемые переходы и полные проверки установки; они не доказывают полноту приватного проекта или поведение живой модели. **Complexity tradeoff** — существующий Project State и adoption plan плюс небольшой read-only classifier, без нового ledger и фонового цикла. **Verdict: ship** как кандидат совместимого patch после ревью.

## 1.32.1 - 2026-09-24

Навыки стали короче: агент получает общие правила из установленного `AGENTS.md` и читает подробную инструкцию для нужного события. Обзорный `FRAMEWORK.md` больше не обязателен для каждого небольшого действия. При обычном продолжении координатор смотрит последнее событие и его lease; неизменившееся состояние не перепубликуется. Согласованный план не требует повторного одобрения перед продолжением.

Полномочия человека, границы модулей, память, возврат результата, тихий Guard и остановка при неизвестном внешнем исходе остаются в действующих workflows. Схемы, роли, CLI и данные проекта не меняются. Оценка уменьшения объема первого чтения не доказывает экономию подписки или поведение живых моделей; применение в проекте проверяется отдельно.

Evolution Gate: **Benefit** — меньше повторного чтения и лишних остановок при сохранении границ. **Evidence and limits** — локальные структурные проверки, полный набор CLI/установочных тестов и расчет объема чтения; живой A/B не проводился. **Complexity tradeoff** — сокращены пять входных навыков, без новых runtime-артефактов. **Verdict: ship** как совместимый patch с отдельной проверкой проектного применения.

## 1.32.0 - 2026-09-23

Перед сложной задачей недорогая модель может найти нужный код и прежние решения, чтобы исполнитель начинал с подготовленного контекста, а не повторял весь поиск. Достаточный актуальный пакет переиспользуется; маленькая задача не получает обязательный дополнительный этап.

Готовые возможности постепенно оформляются в модули с понятными входами, выходами и фиксированной поставкой. Подключение такого модуля не требует чтения или переделки его внутреннего кода. Развитие остается отдельной согласованной работой; обычное обновление помогает пересмотреть незавершенные задачи, не запускает массовую переделку проекта и не отменяет паузы.

- Выбор модели учитывает доказанную пригодность для задачи. Сильное рассуждение сохраняется для оркестрации и нерешенных архитектурных вопросов; текущая работа не понижается автоматически.
- Оркестратор работает на flagship/Low и временно повышает reasoning до High, если подтвержденная ошибка управления осталась после одной прицельной коррекции; после проверки восстановления возвращается на Low. Discovery использует flagship/High. Коэффициенты кредитной стоимости помогают планировать полные затраты, пока практика не даст более точный ориентир по лимиту подписки.
- Удачный пример больше не должен выдаваться за готовый переиспользуемый модуль: область применимости, новые проверочные случаи, повторные запуски с исходного входа и ограничения доказательства проходят через постановку, приемку, документацию и память. Это уточнение существующей приемки, не новая роль и не обещание доказать работу на всех возможных входах.
- Публичный контракт и документация разработчика разделены. Для готовности упаковки требуется независимое подключение через публичный интерфейс без исходников производителя, скрытого тюнинга и ручных промежуточных шагов. Составные модули подчиняются тому же правилу. Новые/изменяемые границы согласуются с человеком; прежние согласования не запрашиваются заново при каждом вызове. Карта и память сохраняют версию, применимость и незакрытые обязательства.
- Подготовка и исполнение разделены: новый исполнитель получает проверенный пакет, но не поисковую переписку и не временные запреты роли сборщика. Проверяются источники, ссылки, применимость ограничений и явные пробелы.
- Координаты цитат и контрольные суммы вычисляет код: модель выбирает реальный файл и точную цитату, а не сочиняет ссылки и номера строк. Неоднозначность требует уточнения источника, а не догадки. Поиск фактов не подменяет Discovery, лабораторный опыт не подменяет проверку на реальном пути, а обязательная документация принимается вместе с изменением.
- Подготовителем управляет оркестратор. Если сведения понадобились уже в ходе работы, он заказывает точное дополнение и возвращает его тому же исполнителю без потери сделанного. Черновики документации тоже проверяются, а не становятся автоматически новой истиной.
- Обычное обновление содержит безопасный порядок подключения. Не нужны пересборка памяти, новый Guard, массовый рефакторинг или остановка проекта. Расход считают вместе с подготовкой, проверкой и исправлениями; снижение подписочного лимита не обещается по одним ценам токенов.

Evolution Gate: **Benefit** — меньше повторного дорогого поиска при сохранении ранее принятых ограничений. **Evidence and limits** — исторический replay прошёл независимые проверки; отдельный четырёхходовый модельный сценарий подтвердил запрос недостающих сведений через управляющего и продолжение тем же исполнителем (13/13 проверок). Качество ссылок осталось LIMITED: непереносимые ссылки и неверные диапазоны должен отклонять валидатор, а не компенсировать догадками исполнитель. Модельный сценарий не был end-to-end проверкой новых CLI-гейтов. Полнота всей памяти и экономия лимита не доказаны. **Complexity tradeoff** — профиль, расширение существующего пакета и небольшой расчёт затрат без автоматического переключения, нового сервиса или контролирующего уровня. **Verdict: simplify** — подключать только проверенные пакеты, оставляя обычный путь и принятые модели доступными.

## 1.31.0 - 2026-09-10

Когда AI перестал отвечать или просто закончил сообщение раньше работы, незавершённое поручение не должно исчезать из внимания. Новый режим Guard проверяет согласованные контрольные точки: появился ли ожидаемый результат к нужному моменту. Для этого не требуется угадывать внутреннее состояние AI-среды.

- Если результата нет, оркестратор получает один вопрос для сверки. Это не команда перезапустить задачу и не доказательство, что она сломалась.
- Готовый результат передаётся обычным маршрутом, паузы сохраняются, повторные проверки молчат. Если уведомление не разобрано или исход отправки неизвестен, предусмотрен один понятный запрос человеку вместо бесконечного ремонта.
- Обычное обновление учитывает подключение реальных рабочих задач. Проверка отчёта об установке не выдаётся за защиту всего проекта; недоступные возможности остаются явно ограниченными.

Сохраняются прежние роли, память, таймер и проверки безопасности. Это совместимый дополнительный режим, без обязательной пересборки графа или ротации оркестратора. Контрольные точки согласуются в существующем задании; новый режим не включается вслепую в старом адаптере.

Evolution Gate: **Benefit** — незавершённая работа получает ограниченную проверку без зависимости от недоступных внутренних данных платформы. **Evidence and limits** — автоматические сценарии проверяют просрочку, результат, паузу, смену получателя, неизвестную отправку, отсутствие ответа менеджера и тихий повтор; сквозная CLI/установка проверяется отдельно. Это моделирование управляющей логики, не доказательство поведения живых моделей или подключения проекта. **Complexity tradeoff** — один чистый классификатор и явный режим существующего Guard вместо нового наблюдателя, хранилища или таймера; реальная доставка и канал запроса человеку остаются обязательными проверками адаптера. **Verdict: simplify** — принимать исходники отдельно от внедрения, повторно не чинить недоступный host API и не обещать автоматического восстановления всей платформы.

## 1.30.4 - 2026-09-08

Когда среда AI не дает сохранить отчет или перестает показывать результат, работа не должна превращаться в повторные просьбы «продолжай». Этот патч помогает отличить реальное препятствие от потерянной видимости и продолжить с уже достигнутого результата.

- Перед запуском и существенным возобновлением проверяются рабочая папка, доступ к источникам, сохранение отчета и его доставка. Режим чтения исходников не принимается за возможность записать результат.
- Пустой ответ API больше не должен вести к слепому повтору: проверяется исход именно последнего хода. Найденный результат возвращается в работу; отказ доступа сохраняется как конкретное препятствие, а не как отсутствие действий.
- Восстановление остается в прежней задаче и в пределах разрешений. Ожидание доступа не будит ее по кругу и не останавливает независимые задачи. Честно записанный ограниченный Guard не считается повреждением графа памяти.

Без нового графа, роли, таймера или ослабления безопасности. Это совместимое уточнение существующей проверки и маршрутизации. Обновление включает проверку среды незавершенных исполнителей и применимости наблюдений Guard; одна смена номера версии не доказывает, что живой адаптер уже умеет восстанавливать эти ситуации.

Evolution Gate: **Benefit** — меньше повторной работы и ручного поиска причин остановки. **Evidence and limits** — изолированные проверки реальных ошибок процесса и полного цикла маршрутизации, отрицательные проверки устаревших/недоступных данных, совместимости, сохранения ожиданий и независимой работы. Они не доказывают поведение живой модели, Codex API или установленного расписания. **Complexity tradeoff** — расширены существующие наблюдения и уточнены действующие инструкции; нет нового исполнителя, механизма прав или обхода истории. **Verdict: candidate** до полного аудита и решения о публикации; исчезновение всех отказов среды не обещается.

## 1.30.3 - 2026-09-08

Готовая работа не должна зависать между исполнителем и оркестратором из-за неясного разрешения на передачу. Патч уточняет согласованный маршрут отчета и честно отделяет «сохранено» от «отправлено».

- При постановке и уточнении задачи явно сохраняются адресат, разрешенный состав отчета и актуальное поручение человека. Проверяется именно нужное сообщение: успешное чтение другой страницы истории не считается подтверждением.
- Создание отчета больше не помечает его отправленным до реальной отправки. Готовый результат сохраняется независимо от того, удалось ли доставить уведомление.
- Отказ безопасности не принимается за потерянное сообщение. Задача сохраняет результат и точную причину, продолжает независимую разрешенную работу и не повторяет запрещенную передачу через другой канал. Ответ человека связывается с конкретным вопросом; уже данное согласие не объявляется потерянным и не запрашивается одинаковыми вопросами по кругу.

Это совместимый патч существующего цикла, без нового графа, роли, расписания или изменения настроек безопасности. Старые записи остаются читаемыми. При обычном обновлении новые инструкции применяются к незавершенным задачам на безопасном этапе; права внешних сервисов, БД, merge и deploy остаются отдельными.

Evolution Gate: **Benefit** — меньше лишних согласований и ложных сообщений об отправке. **Evidence and limits** — два отрицательных теста воспроизвели прежний ложный `SENT`; проверяются точный источник и сохранение незавершенной доставки. Проверка формата не доказывает доверенность адресата, поведение живой модели или решение Auto-review. **Complexity tradeoff** — исправлено значение по умолчанию и уточнены существующие инструкции, без нового механизма разрешений. **Verdict: ship** как ограниченный patch после проверки целостности; отмена всех отказов среды не обещается.

## 1.30.2 - 2026-09-08

Меньше повторных просьб «продолжай»: уточнение задания или ошибка внутреннего теста не должны оставлять согласованную работу без движения. Обновления теперь учитывают и ранее запущенные задачи, а не только оркестратора.

- Исполнитель возвращается к незавершенному поручению после уточнений и побочных вопросов. Неудачная самопроверка ведет к исправлению; остановка требует результата, согласованной контрольной точки, явной паузы или конкретного препятствия. Готовая работа сначала возвращается человеку для проверки, а не ждет его одобрения до отправки. Ограничения безопасности, расходов и прямое управление человека сохраняются.
- При запуске и возобновлении проверяется реальная версия в рабочей папке задачи. Старая ветка не считается обновленной по названию оркестратора. Проверка ничего не устанавливает и не меняет продуктовый код; конфликт или недоступность явно видны.
- Незавершенные задачи получают новые инструкции на безопасном этапе. Приостановленные не будят ради обновления, но проверяют перед продолжением. Завершение обновления различает совпадение файлов и подтвержденное применение инструкций исполнителем.

Это уточнение существующего цикла и проверка установки, без нового графа, управляющей роли или расписания. Автоматические тесты установки не доказывают поведение модели: для него нужны отдельные многоходовые прогоны и проверка применения в конкретном проекте. Фреймворк не перехватывает каждый финальный ответ среды и не обещает безусловного отсутствия остановок.

Evolution Gate: **Benefit** — меньше ручных возобновлений и работы по устаревшим правилам. **Evidence and limits** — повторяющиеся остановки подтверждены; проверка установки отделена от проверки поведения и внедрения. **Complexity tradeoff** — расширен существующий план обновления, без нового фонового процесса. **Verdict** — кандидат для проверки перед публикацией.

## 1.30.1 - 2026-09-06

Меньше работы по кругу: эксперименты сохраняют уже работающие части, новые указания человека не подменяются старым планом, а результат не подтверждается по устаревшим условиям.

Уточнён существующий подход, без нового графа, роли или Guard:

- Когда человек ведёт лабораторную напрямую, оркестратор не перехватывает её параллельными поручениями. Успех эксперимента не разрешает самовольно переносить его в продукт.
- Восстановление опирается на прежний рабочий путь. Эксперимент меняет согласованную часть, сохраняя её связи с остальным продуктом. Тест с отключённым AI не становится поводом переписывать алгоритм, который он не проверял.
- Приёмка повторно сверяет относящиеся к задаче источники, условия и подтверждения после теста. Изменение во время проверки блокирует выдачу результата по устаревшему контексту.
- Сбой сервиса до отправки результата не означает завершение задачи. Сохранённая работа продолжается после устранения реального препятствия; автоматическое восстановление не заявляется до проверки установленного Guard.
- После обновления понятно, где продолжать работу: служебная задача не выглядит вторым оркестратором. Завершение публикации проверяется по действительно доступной версии, а не только по merge.

Проверка включает обычную подготовку задачи, новую человеческую поправку, сохранение прежнего поведения, потерю уведомления, восстановление результата и возврат к решению человека. Команды и проверки исполняются локально; решения участников моделируются явно. Это не доказательство поведения живой модели, полной памяти проекта или активации Guard.

Evolution Gate: **Benefit** — меньше подмен согласованной работы и ложных подтверждений по устаревшим условиям. **Evidence and limits** — отрицательные сценарии сначала воспроизвели ошибочное `VERIFIED`, после исправления блокируются; посторонние изменения не мешают приёмке. Проверки текста не подменяют поведенческие тесты. **Complexity** — повторно используется существующая проверка при приёмке; схемы, роли, расписание и фоновая нагрузка не меняются. **Verdict: ship** как ограниченный patch, без заявления о полном устранении сбоев.

## 1.30.0 - 2026-09-05

Задача получает проверенные относящиеся к ней решения и обязательства, а приёмка проверяет новый результат вместе с ранее принятым поведением. Пропущенный объявленный источник или изменение относящегося к задаче решения блокирует затронутое действие. Исполнитель отдельно читает и подтверждает фактически переданный контекст. Изменения посторонних секций памяти не требуют пересборки; код можно менять обычным образом и проверять после изменения.

Подготовка теперь автоматически собирает файлы и контрольные суммы из источников и смысловых решений, проверенных владельцем. Оркестратор выбирает источники, подтверждает подготовленный план и отвечает за общую память; исполнитель подтверждает чтение, выполняет задачу и проверяет результат. Обычное «обнови фреймворк» теперь включает необходимую [активацию и проверки](workflows/framework-activation.md): установка выдаёт план, действующий оркестратор доводит его до продолжения работы или одного точного вопроса о доступе/решении. Повторный запуск возвращает тот же план, не сбрасывая прогресс и попытки ремонта. Команда согласует изменения памяти в обе стороны через существующие синки; недоступный участник оставляет только затронутую область в ожидании. Новые подходящие задачи используют подготовку по умолчанию, старые исполнители переходят в безопасной точке после чтения контекста.

Общий путь `context-prepare` → `context-run` работает без hooks. Опциональная native-интеграция требует доверенной настройки и охватывает одну объявленную команду. Её вызовы проверены в изолированной CLI-сессии с детерминированным локальным провайдером: отказ до согласования контекста, доступное восстановление, однократное выполнение и блокировка повтора. Это не доказательство интерпретации реальной моделью, наследования настройки в desktop или наблюдения в продукте.

Совместимый minor 1.x: прежние форматы памяти, состояния и подтверждений остаются читаемыми, необходимые шаги активации выполняют агенты при обычном обновлении, без специального запроса человека. Не добавлены новый граф, менеджер или таймер Governor/Guard. Полнота всей живой истории, полное устранение забывания и экономия времени или токенов не заявляются.

Evolution Gate: **Benefit** — обычное обновление доводит проект до проверенного продолжения, сохраняя обязательства и ранее принятое поведение. **Evidence and limits** — 121 локальный тест, включая настоящий старый updater, установка/doctor, валидатор и ограниченный native CLI replay; applicability-сценарии не доказывают семантическое понимание или готовность реального проекта. Исторический тест может быть пропущен при отсутствии старого Git object в shallow checkout. **Complexity** — небольшой декларативный план переиспользует роли, Project State и проверки, скрывая ручную сборку файлов и хешей; нового движка исполнения нет. **Verdict: ship** как совместимое улучшение с активацией, которую агенты ведут при обычном обновлении; общая задача наблюдения надёжности остаётся открытой.

## 1.29.0 - 2026-09-04

Растущий проект не должен становиться для AI набором несвязанных задач. Эта версия помогает перед каждым изменением восстановить не только отдельное решение, но и место затронутой части в продукте: зачем она существует, на какие данные опирается, что производит и какие другие части от нее зависят.

### Что изменится для пользователя

- **Локальная задача видит общий смысл.** Оркестратор проходит от цели через пользовательский сценарий и модуль к входным данным, результатам и потребителям, а затем поднимает связанные требования, решения, уроки и проверки. Изменение одной части реже ломает то, что использует ее дальше.
- **Просьбы «не забыть» перестают висеть в воздухе.** Такое обязательство связывается с конкретными сущностями, владельцем и условием возврата или закрытия. Оно всплывает при следующей подходящей задаче, даже если сменились тред или оркестратор.
- **Исполнитель сначала понимает модуль.** Для устойчивых модулей и capabilities появляется один текущий Module Contract: назначение, входы, алгоритм, выходы, потребители, важные решения, проверка и открытые обязательства. Минимальный порядок задачи теперь `маршрут графа -> документация модуля -> текущий код`; если поведение изменилось, документация обновляется в той же работе и проверяется при приемке.
- **Discovery запускается по доказуемому пробелу.** Полный и непротиворечивый маршрут сразу идет в исполнение. Отсутствующий, устаревший или конфликтующий маршрут, contract, artifact либо граница реализации вызывает ограниченное исследование по известным источникам, а не большой аудит по умолчанию.
- **Существующая история переносится один раз и проверяемо.** Диапазоны исходного brief, диалогов, встреч, задач и вкладов участников отмечаются в Source Coverage Ledger; поздние решения явно заменяют ранние. Действующий graph v3 остается читаемым, пока side-by-side v4 не пройдет обычные, cross-domain и полные source-to-task-to-memory проверки и человек не подтвердит переключение.

Это `MINOR`: Project State v2, роли, задачи, Guard и Return Sync не меняются; нового постоянного агента, scheduler или второго источника истины нет. Новый graph v4 добавляет сущностный каркас и ссылки на живую документацию, но сохраняет чтение v3 во время миграции. Структурные тесты доказывают обязательные связи, документацию, source coverage, commitments и маршруты применения; они не доказывают полноту памяти конкретного проекта, поэтому реальная миграция остается side-by-side и требует содержательных проб до переключения.

**Framework Evolution Gate:** польза подтверждена повторяющимися потерями уже принятых продуктовых связей; автоматические tests проверяют механизм, но не конкретное содержание; цена - одна совместимая версия graph и один существующий тип документации вместо нового управляющего слоя; вердикт - `ship` как совместимый кандидат с обязательным проектным shadow proof.

## 1.28.0 - 2026-09-04

Обновление и восстановление проекта не должны занимать рабочий день из-за того, что контроль принимает собственные нормальные переходы за новые сбои, а важные детали памяти сокращаются по дороге к исполнителю. Эта версия сохраняет строгую проверку, но делает путь короче и устойчивее.

### Что изменится для пользователя

- **Точные договоренности доходят до задачи целиком.** Если важны все шаги, сценарии или условия, оркестратор передает их как проверяемый набор. Исполнитель не сможет объявить их примененными, случайно потеряв одну строку при пересказе. Обычный контекст остается простым человеческим текстом.
- **Старая история не требует ручной переписи.** Известные прежние варианты Return Sync читаются совместимо, а новые результаты всегда создаются в одном формате. Неоднозначные записи по-прежнему блокируются.
- **Нормальное продвижение больше не выглядит новой аварией.** Обновление пояснения или доказательства у того же шага не сбрасывает наблюдение за ним; смена владельца, состояния или самой работы требует свежей проверки.
- **Зависший служебный процесс не останавливает проект навсегда.** Guard отличает живой lock от безопасно устаревшего. Он убирает только доказанно мертвую блокировку, заново сверяет состояние и никогда не повторяет действие с неизвестным исходом.
- **Неотвечающий служебный тред не будят по кругу.** После одной проверки работа один раз переносится в свежий ограниченный контекст от сохраненного состояния либо честно останавливается на точном препятствии. Команды проверки сохраняют реальный код возврата, поэтому ошибка не маскируется красивым JSON.

Инкремент основан на наблюдаемом многочасовом восстановлении, где совместимые старые receipts выглядели как незакрытые, текстовое обновление меняло identity текущего шага, а пустой lock и повторные пробуждения тяжелого service context удерживали систему в ремонте. Исправления покрывают эти причины напрямую; они не добавляют нового управляющего слоя, постоянного треда, расписания, graph или пользовательского ритуала.

Это `MINOR`, потому что появляется проверяемый перенос неделимых обязательств памяти. Project State v2, Project Memory Graph v3, роли, Guard, задачи и обычные Memory Brief остаются совместимыми. Действующий проект читает старую историю без массовой нормализации, обновляет adapter на ближайшей безопасной точке, проверяет один реальный event route и один тихий scheduled pass, затем повторяет только те обычные memory-запросы, которые ранее выявили пропуск.

## 1.27.0 - 2026-09-03

Контроль больше не должен становиться основной работой проекта. Эта версия сохраняет строгую проверку, но убирает служебную петлю, в которой обычное изменение состояния требовало нового дорогого аудита, а исправление одной устаревшей проекции создавало следующую.

### Что изменится для пользователя

- **Быстрее начать, остановить и продолжить.** Обычные переходы проходят локальную детерминированную проверку, одну публикацию и один readback. Новый maximum-reasoning audit для каждого изменения Project State больше не нужен.
- **Оркестратор снова остается менеджером, а не обслуживает собственные отчеты.** Текущие факты записываются один раз; доска и краткие сводки являются производными views. Их рассинхронизация исправляется без модели и без нового control event.
- **Фоновый сбой не превращается в бесконечный ремонт.** Guard хранит один incident ledger, объединяет близкие события, допускает одну ограниченную правку и закрывает ее детерминированно. Если та же причина остается, автоматика останавливается как `CONTROL_DEGRADED` и показывает человеку один понятный checkpoint.
- **Память проверяется в правильном порядке.** Сначала несколько дешевых обычных запросов из реальной работы. Если они теряют нужную связь, широкая проверка не запускается; исправляется конкретный маршрут, затем выполняются targeted regression и безопасное переключение.
- **Graph не переписывается из-за служебного движения.** Он меняется только при новом или уточненном смысле памяти, поэтому control status не раздувает semantic memory и не создает ложных конфликтов.

Инкремент основан на наблюдаемом сбое: за один рабочий день штатные переходы вызвали 27 модельных аудитов, а шесть ремонтов в основном согласовывали повторенные текстовые представления состояния. При этом широкая synthetic-проверка памяти пропустила дефект, который позже нашел короткий natural-language сценарий. Новая последовательность устраняет обе доказанные причины, не ослабляя authority, side-effect, Return Sync, protected pointer, DOD или human checkpoint gates.

Это `MINOR`: роли, Project State v2, Project Memory Graph v3, задачи и Return Sync сохраняются. Нового постоянного треда, пользовательского ритуала или управляющего уровня нет; наоборот, удаляется лишняя связь между State, Graph, views и Governor. Действующий проект обновляет adapter incident ledger, перестает зеркалить control events в Graph и один раз нормализует дублирующие views на ближайшей безопасной точке.

## 1.26.1 - 2026-09-03

Линия 1.26 помогает сохранять общий замысел, прежние решения и работающие части растущего проекта. Это небольшое исправление делает переход с существующей памятью понятнее: особенности оформления не должны превращаться в ложную тревогу о пропавших знаниях.

### Что изменится для пользователя

- Существующие поля распознаются независимо от жирного выделения и обычных вариантов переноса строк. Не нужно переписывать смысл ради оформления.
- Старые записи, которым действительно не хватает явной структуры, получают понятное требование сверки, а не россыпь вторичных ошибок. Проверка не придумывает недостающие связи и не утверждает, что знания потеряны.
- Содержательная работа 1.26 сохраняется: объединить опыт участников, связать решения с целями и зависимыми частями, проверить поиск и применение на задачах. Исправленный формат сам по себе не считается готовой памятью.

Это `PATCH`, не новая модель работы. Проверки дубликатов, отсутствующих данных, неверных ссылок и неподтверждённых результатов остаются строгими. Тесты подтверждают совместимость чтения и диагностику, но не историческую полноту конкретного проекта; безопасная сверка и согласованное переключение памяти и контроля по-прежнему обязательны.

## 1.26.0 - 2026-09-03

Большой проект не должен начинаться заново при каждом изменении. Эта версия помогает восстановить уже принятые решения, сохранить работающие части продукта и провести сложное изменение так, чтобы результаты отдельных задач сложились в одно целое.

### Что изменится для пользователя

- **Меньше повторного изобретения.** Перед изменением AI восстанавливает цель, прежние решения и то, что уже работало. Пустой локальный экран больше не считается достаточным основанием создавать данные или функцию заново; сначала нужно выяснить, где прежний источник и что мешает им пользоваться.
- **Подготовка соответствует задаче.** Простая работа начинается сразу. Для запутанной темы сначала восстанавливается понимание, а большое связанное изменение может сопровождать временный ведущий. Пользователю объясняют причину подготовки и ближайший видимый результат, а не внутренние процедуры.
- **Опыт собирается от всей команды.** При проверке памяти каждый доступный участник через своего оркестратора добавляет значимые решения и уточнения из своей работы. После объединения проверяется, что общее понимание находится и применяется с разных сторон. Недоступная история остается явным пробелом.
- **Согласованность не должна превращаться в простой.** Ведущий включается по делу, не перехватывает исполнение и не держит оркестратора занятым ожиданием. Проверка различает нормальное ожидание, остановившуюся работу и ситуацию, когда участники ждут друг друга; вопрос человеку сохраняется после служебного вмешательства.
- **История и важные оговорки сохраняются.** Память уточняется рядом с прежней версией, с проверкой до переключения. Локальный эксперимент не отменяет незаметно общее решение, а важный контекст не обрезается ради фиксированной длины.

Это `MINOR`: сохраняются три роли, Project State v2 / Graph v3 и существующие маршруты возврата. Ведущий является ограниченным поручением в Discovery, не новым управляющим слоем. Старые адаптеры продолжают работать; режим ведущего включается только после проверки охвата активных ответственных и их ожиданий. При обновлении проектные оркестраторы организуют согласованную проверку памяти и вкладов участников на безопасном этапе, не обнуляют историю и не останавливают независимую работу. Тесты доказывают проверки структуры и маршрутизации на моделируемых событиях; полнота смыслов, доставка в конкретной среде и польза в реальной работе проверяются отдельно при внедрении. Сам выпуск не означает, что память всех проектов уже переорганизована.

## 1.25.0 - 2026-09-03

Служебные проверки не должны оставлять работу на паузе, когда можно продолжать. Оркестратор сохраняет следующий рабочий шаг и возвращается к нему после вмешательства, не ожидая очередного «продолжай» от человека.

### Что изменится для пользователя

- Ремонт не подменяет работу над целью: независимые задачи продолжаются, а зависимые получают конкретное условие возобновления.
- Контроль различает работающего исполнителя, настоящее ожидание и потерянное продолжение. Он не запускает дубликат и не принимает ответ на побочный вопрос за завершение задачи.
- Ожидающий вопрос к человеку сохраняется. Новое решение человека меняет дальнейший маршрут, а не возвращает систему к уже отмененному шагу.
- Проверка использует свежую активность без модельного вызова. Если среда ее не показывает, ограничение видно явно; выдуманного простоя или обещания надежности нет.

Это `MINOR`: существующий Next-Best-Action получает проверяемые состояние, владельца и основание, а Guard - проверку фактического продолжения. Роли, Project State v2 и граф v3 сохраняются; нового управляющего слоя и пользовательского ритуала нет. Действующему проекту нужна ограниченная адаптация текущего шага и локального Guard с проверкой на реальной работе. Тесты комплекта доказывают решения проверки, но сами по себе не доказывают подключение или поведение конкретной агентной среды.

## 1.24.3 - 2026-09-02

Меньше ложных остановок и потерянных результатов: контроль помогает продолжать работу, а не превращает ее в бесконечное обслуживание.

### Что изменится для пользователя

- Новый результат не заслоняет старый, еще не разобранный. Изменение памяти или смена оркестратора не теряет ожидающую работу; неполное подтверждение не выдает ее за завершенную.
- Обычный текст и пустое отображение треда не становятся выдуманной поломкой. Guard проверяет реальные следы, не запускает дубликаты и не путает отправку сообщения с обработкой результата.
- Регулярная проверка получает изменения, а не перечитывает всю историю. Если источник не позволяет это надежно, ограничение остается явным.
- После подтверждения старта задача продолжает согласованную работу. Ремонт и фоновая проверка останавливают только то, для чего действительно не доказана безопасность.

В комплект входят общий parser результатов и регрессионные tests; правила подключения Guard дополнены проверками экономного чтения, доставки и безопасной замены adapter. Действующий локальный Guard обновляет и проверяет отдельная служебная задача: одна смена версии файлов не означает, что adapter уже применил изменения. Нового управляющего слоя, схемы памяти или пользовательского ритуала нет; это `PATCH` существующего контура.

## 1.24.2 - 2026-09-01

Контрольный контур теперь проверяет реальное прохождение состояния и результата, а не только наличие правильного правила в инструкциях.

### Что изменится для пользователя

- Поврежденное или частично записанное Project State больше не принимается за текущее: сначала проверяется полная Candidate, после публикации сверяются ее точный hash и структура, а при mismatch восстанавливается последняя принятая версия.
- Один и тот же уже проверенный сбой или ограничение Guard не начинает новый круг из-за обычного обновления Project State. Incident определяется смыслом проблемы; любая дополнительная или измененная причина, наоборот, обязательно проходит новый audit.
- Return Sync и подтверждение его маршрутизации получили один машинно читаемый парный формат. Guard проверяет реальный producer-to-consumer путь и после успешной маршрутизации должен доказать тихий плановый проход без wakeup, очереди и вызова модели.
- Реализация и smoke самого Guard остаются отдельной служебной задачей. Оркестратор ставит ее, принимает Return Sync и продолжает управлять проектом, не выполняя обслуживание своими руками.

Нового управляющего слоя, постоянного треда или пользовательского ритуала нет. Это проверяемое усиление уже существующих Project State, Return Sync и Project Guard, поэтому релиз имеет уровень `PATCH`.

## 1.24.1 - 2026-09-01

Завершенный результат task больше не зависит от того, покажет ли agent environment ее финальное сообщение и доставит ли native wakeup оркестратору.

### Что изменится для пользователя

- Любой readiness result, checkpoint, blocker или terminal result сначала сохраняется как один канонический `Return Sync`. Технический `Action Receipt` не заменяет его.
- Пустое отображение завершенного треда больше не считается доказательством, что результата нет: durable outbox остается источником истины.
- Project Guard независимо находит новый еще не доставленный `Return Sync` в общем tracker/outbox и будит оркестратор ровно один раз. После маршрутизации повторные проходы молчат.
- Если adapter конкретной agent environment не умеет читать durable returns, проект честно показывает `LIMITED`, а не обещает автовосстановление.

Нового треда, ритуала или схемы памяти нет. Это уточнение уже существующего return contract, поэтому релиз имеет уровень `PATCH`.

## 1.24.0 - 2026-09-01

Оркестратор остается доступным человеку во время фоновой работы, а запрос на решение или проверку больше не теряется за Guard, Return Sync, repair или rotation.

### Что изменится для пользователя

- После подтвержденного запуска отдельной task оркестратор не удерживает свой тред polling или длинным ожиданием. Работа продолжается через durable return route, а человек может параллельно обращаться к своему оркестратору.
- В Project State хранится один понятный `Pending Human Action`: что человеку нужно посмотреть или решить, откуда пришел запрос и после какого вмешательства его надо вернуть.
- При обновлении действующего проекта поле инициализируется из последнего действительно неотвеченного запроса оркестратора; `NONE` допустим только после проверки, что ответ пользователя не ожидается.
- Плановый Guard по-прежнему проверяет проект каждые 30 минут, но здоровый проход и повтор уже доставленного incident остаются полностью тихими: без сообщения, модели и нового треда.
- Реальная проблема получает один bounded wakeup и прежний уровень независимого контроля. После repair или rotation оркестратор обязан снова показать ожидающий вопрос либо явно заменить его более актуальным, не заставляя человека искать его в истории.
- Технические Guard receipts, scheduler state и incident ids остаются внутренней доказательной базой. Для пользователя единственным менеджером и точкой общения остается оркестратор с одним человеческим следующим действием.

Нового постоянного треда, более редкой проверки или ослабления Governor нет. Добавляется совместимый durable attention contract, поэтому релиз имеет уровень `MINOR`.

## 1.23.1 - 2026-09-01

Публичное описание Vydykhai теперь сначала объясняет результат для человека, а уже затем внутреннее устройство автопилота.

### Что изменится для пользователя

- Первый экран прямо показывает три режима применения: один человек с несколькими AI-сессиями, команда с личными оркестраторами и распределенная работа через разные компьютеры, модели и agent environments.
- Пять основных выгод собраны человеческим языком: Vydykhai организует путь к результату, сводит людей и AI, подключает людей только к принадлежащим им решениям, применяет общую память и восстанавливает движение после сбоев.
- Установка одной просьбой агенту поднята выше технических подробностей. Пользователю не нужно изучать framework, выбирать skills или выполнять Git-команды.
- Самовосстановление описано как наблюдаемый результат, а не как набор терминов. Там, где agent environment не поддерживает независимую проверку, обещание остается явно ограниченным.
- Публичная категория `Team Autopilot for People and AI`, каноническое ядро, citation metadata и GitHub About используют одну смысловую формулу. Слово framework остается названием легкой технической формы поставки, которую исполняют агенты.

Операционная модель, schemas, skills и контрольные gates не меняются. Это редакционное уточнение существующего поведения, поэтому релиз имеет уровень `PATCH`.

## 1.23.0 - 2026-09-01

Оркестратор теперь может использовать внутренних advisory-субагентов для более сильного планирования, не позволяя им незаметно заменить рабочие треды.

### Что изменится для команды

- На maximum-profile оркестратор может параллельно проверить DOD, память, риски, зависимости, brief, sequence и routing. Такой анализ остается одноразовой внутренней поддержкой управляющего решения и не создает лишних task contexts.
- У каждого advisory-запроса есть короткая граница: какое control decision улучшается, какие источники доступны, какой orchestration output нужен и когда следует перейти в focused context.
- Если работа устанавливает новую причину, решение, факт о runtime/data, эксперимент, Candidate, test или acceptance proof, она получает видимого владельца в Discovery, Execution, Lab или Maintenance. Read-only и использование субагентов больше не маскируют проектную работу под координацию.
- Существенное утверждение о проекте принимается только из human decision, durable source или focused-context receipt. Advisory-вывод может улучшить выбор оркестратора, но не является проектным доказательством.
- Внешний Project Guard проверяет work origin, когда agent environment показывает внутреннюю активность, а иначе явно отмечает ограничение. `UNOWNED_PROJECT_WORK` сначала получает один ограниченный repair с возвратом работы правильному треду; повтор после repair запускает уже существующий подтверждаемый путь ротации.

Нового постоянного треда и нового действия для человека нет. Существующие DOD Control Line, Project State v2, Memory Graph v3, Execution Leases, tasks и Return Sync продолжают действовать. Это совместимый новый контрольный элемент, поэтому релиз имеет уровень `MINOR`.

## 1.22.0 - 2026-09-01

Проект теперь способен заметить и исправить сбой управления, даже если сам активный оркестратор перестал вовремя запускать проверки, принимать Return Sync или продолжать работу после команды человека.

### Что изменится для команды

- При запуске проекта настраивается один внешний Project Guard. Он принадлежит проекту, а не треду оркестратора, поэтому переживает его repair или rotation.
- Значимые события запускают проверку сразу, а независимый timer страхует пропущенный trigger. Здоровый проход остается локальным и deterministic: без LLM, сообщений и нового треда.
- Durable результат, просроченный checkpoint или открытый return сначала дают один idempotent wakeup. Рассогласование, повторный пропуск или потеря DOD запускают свежий maximum-profile Governor с исходом `HEALTHY`, ограниченный `REPAIR` или подтверждаемая `ROTATE`.
- Один incident id не дает разным машинам и harness повторно будить или проверять одну проблему. Если evaluator сам не вернулся, система сохраняет incident и один раз поднимает точное действие вместо бесконечного цикла.
- Проектные task titles сохраняют привычный формат `<work-id> [<track>] [<mode>] — <результат>` с номером в начале. Только служебные tasks, которые обслуживают систему координации, а не двигают цель проекта, выносят короткий уникальный service id в начало, чтобы интерфейс не обрезал различие; Project State issue не используется как их work id.
- Project Guard также проверяет фактические context metadata: ответ-план без действия, terminal task без принятого Return Sync, дубли или неразличимые control contexts и завершенную работу без выхода.

Нового постоянного управляющего треда и человеческого ритуала нет. Если agent environment не умеет независимый schedule, проект честно получает `PROJECT_READY_WITH_LIMITS`: event-only self-check не называется background recovery. Это совместимый новый операционный элемент, поэтому релиз имеет уровень `MINOR`.

## 1.21.1 - 2026-08-31

Обновление фреймворка теперь считается завершённым только тогда, когда новая версия работает в самом действующем оркестраторе, а не только смержена и проверена в отдельной maintenance-задаче.

### Что изменится для команды

- Перед сменой версии в названии и Project State оркестратор проверяет собственное рабочее дерево: точный принятый commit, live/offline `doctor`, source revision, State/Graph schemas, integrity и перечитывание нового core.
- Проверка update branch, временного worktree или чистого merged-source checkout подтверждает Candidate, но больше не подтверждает активацию рабочего оркестратора.
- Если текущий context нельзя чисто перевести на принятую версию, старая версия остаётся активной, mismatch сохраняется, а Governor выбирает ограниченный repair либо подтверждаемую rotation.

Для человека нового ритуала нет. Изменение закрывает случай, когда GitHub, название треда и Project State уже показывают новую версию, а сам оркестратор продолжает работать по старым файлам.

## 1.21.0 - 2026-08-31

Оркестратор получил замкнутый и независимо проверяемый контур управления: он должен не только помнить правила, но и доказывать, что работа действительно движется к DOD, результаты не потерялись, а отложенные обещания вернулись вовремя.

### Что изменится для команды

- У проекта один короткий DOD Control Line: последний принятый результат, точный оставшийся разрыв и следующее действие. Каждая активная задача явно привязана к нему, поэтому техническая активность без продвижения становится заметной.
- Новая или возобновленная task считается запущенной только после первого наблюдаемого действия. Если исполнитель второй раз отвечает планом вместо работы, оркестратор прекращает напоминания и меняет маршрут: re-brief, замена от durable checkpoint либо настоящий blocker.
- У каждого инкремента один Execution Lease. Он связывает задачу, context, branch/base, profile, DOD, checkpoint и return route и не позволяет незаметно запустить дубль или потерять владельца работы.
- Return Sync сначала записывается в durable task/tracker outbox и только потом отправляется как native wakeup. Оркестратор сверяет очередь на каждом значимом входе, поэтому потерянное межконтекстное сообщение больше не теряет готовый результат и не требует ручного опроса.
- Просьбы «запомнить», «вернуться позже» и временные detours получают owner и проверяемое условие возврата. Они сопоставляются с текущей и следующей работой вместе с решениями и уроками памяти.
- Governor Check независимо читает durable state и проверяет DOD, leases, returns, return gates, memory coverage и здоровье оркестратора. Его receipt действует только для точно проверенного события, поэтому старый `HEALTHY` не пропустит новый сбой. В норме это дешевый deterministic check; свежий maximum-profile evaluator нужен только при anomaly. Результат - `HEALTHY`, ограниченный `REPAIR` или предложение подтверждаемой rotation, но не новый постоянный управляющий context.
- После возможного внешнего действия с потерянным ответом система ставит `OUTCOME_UNKNOWN`, сверяет фактическое состояние и не повторяет действие вслепую.

Технически текущий control snapshot переходит на Project State v2, а semantic memory - на Project Memory Graph v3 с pending events и живыми `CURRENT / NEXT / PRIOR_MISS` probes. При обновлении проект строит их side by side из durable evidence, запускает `control-check`, показывает meaningful delta и только затем переключает current view. Активные tasks продолжают принятые contracts; обязательной rotation оркестратора нет, если Governor не находит доказанного health defect. Новый skill, фоновый model loop и ручной ритуал для человека не добавлены.

## 1.20.0 - 2026-08-20

Одна просьба подключить Vydykhai теперь должна закончиться не установкой файлов, а доказанно готовым к работе проектом.

### Что изменится для команды

- Агент сам находит текущий project repo или помогает подготовить приватный, проверяет remote, host, owner, visibility и существующие briefs, tasks, board, memory, branches, PR и operating rules. Человеку задаются только вопросы, которые нельзя разрешить из доступного состояния.
- `doctor` отвечает только за целостность установленного kit. Живую готовность проверяет `$project-launch`: общий writable repo и tracker, участники, coordination inputs, operations первого DOD, принятый курс, active orchestrator, Return Sync route и next-best-action.
- Фреймворк устанавливается в проект один раз и приходит остальным через pull. Каждый orchestrator сам публикует readiness receipt своей машины и доступов; один участник больше не считается подключенным по предположению другого.
- GitHub Repo + Issues/Projects/PRs и Fathom остаются рекомендуемой и лучше всего отлаженной конфигурацией, но могут быть заменены эквивалентами по возможностям. Если прямого доступа к источнику встречи нет, назначается intake owner и подтвержденный traceable маршрут в shared state.
- На старте не собираются все credentials и production powers. Проверяется только путь к первому DOD: нужные environments, безопасные protected pointers, merge/deploy authority, non-destructive access check, backup/rollback и stop conditions.
- Итог запуска всегда видим: `PROJECT_READY`, `PROJECT_READY_WITH_LIMITS`, `NEEDS_DECISION` или `BLOCKED_BY_ACCESS`, evidence по каждому gate, безопасная граница и одно точное следующее действие. Необязательный gap не останавливает независимую работу, а отсутствующий участник блокирует только пересечение.

Новый skill и ручной setup-ритуал не добавлены. Это совместимый новый операционный элемент внутри bootstrap, `$project-launch`, Project State и существующего orchestrator gate. Текущие tasks продолжаются; receipt появляется при новом проекте, reconnect или перед первым dispatch после обновления.

## 1.19.4 - 2026-08-15

Названия контекстов и ссылки оркестратора на работу снова стали одним понятным навигационным слоем.

### Что изменится для команды

- У каждой живой задачи один формат: owning Issue или стабильный tracker key, этап, при необходимости режим и короткий ожидаемый результат. Номер PR больше не подменяет идентичность задачи.
- В планах, статусах, вопросах и next-best-action оркестратор больше не ссылается на голые номера. PR называется вместе с задачей, ради которой он существует, поэтому человеку не нужно помнить содержание `#123` или угадывать, что обозначает `#456`.
- Активный и прежний оркестраторы получают однозначные `[ORCHESTRATOR]` и `[RETIRED][ORCHESTRATOR]` названия. Меняющийся статус задачи остается в tracker и native context state, а не устаревает в title.
- Результат пишется на рабочем языке проекта, а небольшой набор служебных тегов остается стабильным между разными моделями и agent environments.
- Обновление нормализует активный оркестратор и живые или queued contexts при следующем безопасном касании. Закрытая история не переименовывается массово.

Новый skill или человеческий ритуал не добавлен. Это совместимый patch существующего launch/readback и tracker contract: задача легче находится, планы читаются без расшифровки, а разные оркестраторы перестают импровизировать собственные форматы.

## 1.19.3 - 2026-08-14

Обещание «запомнить и вернуться к этому» теперь должно переживать сжатие памяти и само возвращаться в нужное планирование.

### Что изменится для команды

- Оркестратор сохраняет не только тему, но и ее актуальный смысл, source, слова для будущего поиска, условие возврата, связь с планом и нерешенный вопрос человеку. Неопределенное «позже или уже сейчас» больше не превращается в выбранный агентом срок.
- Перед brief или Discovery открытые обещания пересекаются с затронутой возможностью и checkpoint. Совпавшая отложенная идея возвращается, даже если она была dormant; без доказанного смысла shaping останавливается как `MEMORY_COVERAGE_GAP`.
- Миграция и compaction больше не принимаются по числу перенесенных id. Обычный вопрос о будущей работе должен вернуть конкретный смысл, source и `discuss-before-act` gate.
- Для действующего проекта после доказанного пропуска можно запустить отдельный read-only memory backfill: от принятого brief он проверяет высокосигнальные человеческие коррекции, встречи, повороты и открытые обещания против текущего графа. Поздние решения заменяют ранние, а глубокий разбор нужен только неполным или конфликтующим темам.
- Исполнительные задачи не перечитывают историю и не получают новый ритуал. Оркестратор принимает side-by-side delta, уточняет с человеком только настоящие неоднозначности и обновляет лишь затронутые brief и plan links.

Переход совместим: active tasks продолжаются. Backfill запускается отдельной focused task при подключении к действующему проекту, доказанном memory miss, миграции или ротации и не блокирует незатронутую работу.

## 1.19.2 - 2026-08-14

Health Review снова отвечает не только за состояние задач и памяти, но и за порядок вокруг незавершенной работы.

### Что изменится для команды

- Оркестратор периодически замечает забытые задачи, PR, ветки, task contexts, worktrees, runtimes и monitors и не дает им молча копиться.
- У каждого живого artifact должны быть owner, связь с текущей целью, понятное состояние и условие завершения либо возврата. Возраст запускает проверку, но не автоматическое удаление.
- Оркестратор классифицирует и направляет работу, но не чистит проект сам. Shared-состояние он видит через общий tracker/repo, а local-only состояние проверяет владелец в отдельной focused maintenance task.
- Встроенная классификация различает активную работу, обоснованное ожидание, безопасное завершение, перенос полезного остатка на текущий baseline и осознанное закрытие.
- При завершении task возвращает судьбу своих context, PR, branch, worktree, runtime и monitor. Уникальная или неясная работа сохраняется до проверки; полезная stale-работа переносится вперед, а не оживляется целиком.

Новый skill или человеческий ритуал не добавлен: это восстановленная исполнимая часть существующего Health Review. В Project State хранится только дата проверки и нерешенные исключения, а Project Memory Graph остается компактной памятью решений и уроков, а не инвентарем веток.

## 1.19.1 - 2026-08-14

Три уровня работы получили явную непроницаемую границу.

### Что изменится для команды

- Тред сопровождения канонического Vydykhai занимается только универсальными правилами, релизами и инструментами; он не устанавливает обновления в проекты и не управляет их оркестраторами.
- Проектный оркестратор занимается только организацией конкретного проекта и не выполняет работу.
- Любая проектная работа, включая discovery, lab и maintenance, выполняется только в отдельном focused context и возвращается проектному оркестратору.
- Project State, участники, task links, backlog, private evidence и project next-best-action больше не маршрутизируются в context сопровождения фреймворка. Возможный универсальный урок попадает туда только отдельным явным обезличенным compatibility packet.

Переход совместим и не добавляет новый skill или ритуал. Итог: чистые контексты не загрязняют друг друга, а каждый результат возвращается тому уровню, который действительно им управляет.

## 1.19.0 - 2026-08-14

Vydykhai теперь проверяет не только то, что система знает и собирается сделать, но и то, что действительно произошло.

### Что изменится для команды

- Задача считается запущенной только после проверки фактического контекста, кода, режима и начала работы. Ответ с планом или отправленная команда больше не принимаются за прогресс.
- Результат задачи должен действительно вернуться оркестратору и привести к следующему действию, поэтому человеку не нужно напоминать о завершении.
- Память о защищенном доступе должна содержать безопасный и воспроизводимый путь использования, но не секрет. Если путь неполон, останавливается только зависимое действие.
- Приемка, merge и deploy больше не подменяют друг друга: перед live-действием проверяются точная версия, среда и разрешение.
- Каждую проверку выполняет тот, кто отвечает за действие: оркестратор проверяет запуск и возврат результата, а выполняющая task - собственный доступ, приемку и live-действия. Работа не дублируется и нового человеческого ритуала не появляется.

Переход совместим с действующей работой: активные tasks не перезапускаются, а существующие записи о доступах дополняются при следующем использовании или плановой проверке памяти. Обновление со старых версий проходит обычным путем.

Итог: меньше забытых правил, ложных стартов, повторных вопросов о доступах и потерянных результатов.

## 1.18.0 - 2026-08-12

Память стала замкнутой рабочей петлей: система не только сохраняет опыт, но расследует пропуски, возвращает применимые решения в задачи и проверяет, что они действительно повлияли на результат.

### Что изменится для команды

- Поправка «мы это уже решали» больше не заканчивается извинением и локальным патчем. Оркестратор определяет, отсутствовало ли знание, не нашлось, не применилось или не проверилось, затем исправляет соответствующую часть системы.
- Новая задача получает не список memory ids, а короткие исполнимые указания: почему правило относится к задаче, что применить, чего избежать, как проверить и где источник.
- После задачи видно, чему проект научился, какой узел обновился и какие текущие или будущие задачи это затрагивает. Raw history остается evidence и не раздувает активный контекст.
- При ротации и Health Review свежий оркестратор воспроизводит ожидаемые решения на реальных сценариях, а не только подтверждает наличие записей.

### Что добавлено

- В Project Memory Graph появились стабильные anchor-сущности для outcomes, actors, product entities, surfaces, contracts, data и operations. Атомарные memory nodes связываются с ними и друг с другом типизированными relations.
- Узел хранит одну актуальную мысль отдельно от истории: `Apply`, `Avoid`, область применимости и исключения, recall trigger, relations и source. Новый тип `LESSON` делает неудачный путь переиспользуемым без смешивания его с текущим решением.
- Retrieval использует точные anchors, semantic candidates и обход связей на один-два шага, затем фильтрует superseded, неприменимое и конфликтующее. В Memory Brief остаются только правила, меняющие действие, границу, guardrail или приемку.
- Human correction запускает `Memory Reflection`: `Before / Now / Why / scope`, повторный поиск, классификацию `ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS`, изменение графа и impact check активных и queued tasks.
- Representative Retrieval Scenarios проверяют ожидаемый исполнимый Brief и фактическое применение. Обнаруженный miss становится regression scenario; self-reported совпадение ids не считается coverage.

Переход: совместимый update in place. Активная task продолжает свой принятый contract. До следующего cold-path dispatch, re-brief, acceptance, Health Review или rotation оркестратор атомарно добавляет anchors и executable fields только к затрагиваемым текущим узлам; полная одномоментная перепись и остановка execution не требуются.

Итог: опыт проекта становится не архивом, а проверяемым способом быстрее поставить следующую задачу, не повторить известную ошибку и заметить собственный сбой памяти.

## 1.17.0 - 2026-08-09

Проектная память и GitHub стали одним рабочим контуром: накопленный опыт помогает следующей задаче, а доска показывает реальное состояние работы.

### Что изменится для команды

- Идею, уточнение или «давай по-другому» достаточно сформулировать один раз. После приемки полезный вывод становится общей памятью проекта и возвращается в следующую задачу, которой он действительно нужен.
- Новая задача получает короткий релевантный бриф вместо истории проекта. Исполнитель быстрее начинает работу, расходует меньше контекста и не повторяет уже разобранные ошибки.
- Урок одного участника становится доступен оркестраторам остальных через общий репозиторий, а не остается внутри личного чата.
- GitHub показывает настоящее состояние ближайшей работы: что делается сейчас, что будет дальше, что заблокировано или отложено и что принято.
- Текущую задачу не нужно останавливать, а старый backlog - переписывать ради обновления.

### Что добавлено

- Один компактный `Project Memory Graph` заменяет параллельные активные Idea Memory и Intent Trail. Он хранит только действующие правила, решения, уроки неудачных подходов, подтвержденные будущие идеи и безопасные ссылки на рабочие инструкции; исходная история остается evidence по ссылкам.
- Перед постановкой orchestrator сопоставляет новую работу с памятью и передает задаче минимально полный Memory Brief не более чем из семи релевантных узлов. Полный граф, transcripts и старые обсуждения не попадают в execution context.
- Task и другие источники возвращают `NO_MEMORY_DELTA` либо компактные кандидаты на изменение памяти. Общий граф редактирует orchestrator: он объединяет смысловые дубли, сохраняет источники и не перезаписывает асинхронные обновления других участников.
- Body задачи является ее текущим execution contract, а Project/board - понятной человеку проекцией `Todo / Next / In Progress / In Review / Blocked / Done / Parked`. Они обновляются вместе только при существенных событиях, а не при каждом техническом шаге.
- Existing Idea Memory и Intent Trail остаются migration inputs. После проверки полноты они становятся read-only evidence и больше не конкурируют с текущей памятью.

Переход: совместимый update in place. Текущая задача продолжает принятый contract; новый graph и tracker projection вводятся на безопасном cold-path checkpoint до следующего dispatch или material re-brief. Переписывать весь backlog и прерывать active execution не нужно.

Итог: меньше повторного объяснения и восстановления контекста, быстрее старт задач, точнее общая память и понятнее следующий шаг для всей команды.

## 1.16.0 - 2026-08-07

Reasoning стал маршрутизироваться по роли работы, чтобы общая умность оркестратора не заставляла каждую хорошо поставленную задачу долго переосмыслять уже принятые решения.

- Постоянный `ORCHESTRATOR` использует максимальный доступный reasoning и отвечает за compass, memory, routing, постановку задач, consultation, интеграцию и next-best-action.
- `DISCOVERY` использует глубокий bounded reasoning, когда еще нужно найти решение: в research, продуктовой или архитектурной проработке, неясном UX/UI или visual direction и проектировании эксперимента.
- `EXECUTION` использует эффективный bounded reasoning и сразу реализует уже определенное решение. В средах с такими названиями профили соответствуют `Ultra / XHigh / Low`; другие harnesses выбирают ближайшие эквиваленты и записывают fallback.
- Перед dispatch оркестратор классифицирует ближайшую работу как `ORCHESTRATOR_WORK`, `DISCOVERY`, `EXECUTION` или `STALE_OR_REBRIEF`. Исторический backlog не пересобирается без необходимости.
- Execution запускается только после Low-ready gate: один результат и первый шаг, отсутствие нерешенного product/architecture choice, явные boundaries, объективная приемка, актуальные data/access/environment и короткие material `CONSULT` triggers.
- Discovery возвращает Decision Packet, который оркестратор соединяет с compass и memory до создания execution tasks. По умолчанию это не production implementation; disposable Lab должен быть заявлен явно.
- Застрявшая задача не поднимается механически по лестнице effort. Оркестратор сначала различает implementation defect, слабый acceptance oracle и недостающую проработку, затем выбирает patch, re-brief/split, Discovery или stop.
- High-consequence execution может оставаться на эффективном profile только с явными invariants, deterministic guards и control-plane review evidence и project coherence максимальным profile до human merge или action approval; task acceptance не переносится в orchestrator.
- Manifest и `doctor` показывают role-routed policy. Старое `defaultAgentProfile` сохранено только для совместимости прежних updater versions.

Переход: совместимый update in place. Активная задача сохраняет принятый profile и не прерывается; новая маршрутизация применяется при следующем dispatch или настоящем re-brief. Rotation не обязательна, если состояние текущего orchestrator остается надежным.

Зачем: тратить максимальный reasoning на общую картину и неизвестные решения, а определенную работу выполнять быстрее, дешевле и без повторного планирования, сохраняя качество через task contract, tests, smoke, acceptance и orchestrator review.

## 1.15.0 - 2026-08-07

Оркестратор и task contexts получили явное разделение control plane и execution plane, чтобы координационная умность не замедляла исполнение.

- Оркестратор решает, что, зачем, когда и кем делается, поддерживает общую память и обрабатывает изменения; task context решает, как реализовать и доказать один принятый инкремент.
- Обычное продолжение актуальной задачи стало hot path: без Daily Alignment, повторного scope freshness, Memory Intersection, dashboard rebuild или нового briefing. Полная cold-path проверка остается для dispatch, re-brief, существенных внешних изменений, consultation, parent acceptance, health и rotation.
- Task получает короткий role-`EXECUTION` contract: ближайший DOD, границы, baseline, принятый механизм, один-три отобранных memory items, authority/safety envelope, проверку и узкие consult/return triggers. Raw Project State, Touch Set, transcripts, полная память и оркестрационные размышления остаются у оркестратора.
- Task самостоятельно решает обычные implementation failures и не запускает project launch, start-work, daily-alignment или framework-orchestrator. Он только обнаруживает широкую границу и отправляет компактный `CONSULT`; проектный маршрут выбирает оркестратор.
- Return Sync отправляется автоматически только при named human checkpoint, неустранимом blocker или terminal result. Routine progress и локально исправленные ошибки не создают синк-ритуал.
- Daily Alignment запускается только при существенном изменении безопасного следующего действия другого участника. Delta сопоставляется с active, queued и paused work; незатронутые tasks не будятся, а затронутые получают только адресный patch или re-brief signal.
- `$accept-work`, corrective fixes, exact-current-code smoke, human checkpoint и manual merge остаются в owning task context. Оркестратор принимает verdict без повторной task acceptance и обновляет parent DOD, shared impact, reusable memory и next-best-action.
- Повторное отсутствие DOD progress вызывает одну supervisory diagnosis с маршрутом `CONTINUE`, `REBRIEF`, `LAB` или bounded `MAINTENANCE`, а не очередной Daily Alignment или статусный цикл.

Переход: совместимый update in place. Существующие Project State, memory, issues и active contexts остаются действительными. Новый execution contract применяется при следующем dispatch или реальном re-brief; активная задача получает patch только при материальном влиянии. Обязательная rotation не нужна.

Зачем: task contexts быстрее и дешевле двигаются к проверяемому результату, а оркестратор сохраняет целостность проекта и адресно вмешивается только тогда, когда действительно изменилась безопасная картина работы.

## 1.14.1 - 2026-08-06

Линия 1.14 сделала накопленную память активной частью работы, а не архивом, который должен помнить человек.

- Перед brief, resume, acceptance, milestone и rotation оркестратор сам формирует `Touch Set` и возвращает задаче короткий `Memory Brief` только с относящимися к ней решениями, rejected paths, идеями и безопасными операционными sources.
- Каждая задача возвращает `Memory Delta`: локальные детали остаются в задаче, а переиспользуемый урок объединяется с текущим семейством решений вместо создания еще одного пересказа.
- One Success Line строит новый Candidate от `Accepted Baseline + applicable Memory Brief`, сохраняет доказанно работающие части и учитывает Learning Delta отклоненных кандидатов.
- Idea Memory и Intent Trail поддерживают одно актуальное представление; комментарии остаются evidence, но не превращаются в скрытую конкурирующую память.
- Операционная память хранит безопасные ссылки на environments, owners, private runbooks, backup/restore и secret systems без значений секретов.
- Передача запускаемого результата с данными требует exact revision, environment, schema/migrations, воспроизводимого безопасного data state и доступа получателя. Без них handoff получает `BLOCKED`, а не ложный вывод о качестве продукта.
- Rotation проверяет реальное извлечение памяти на показательных следующих задачах, а не только совпадение двух пересказов состояния.

`1.14.1` завершает этот инкремент как небольшой maintenance patch и не добавляет отдельного пользовательского механизма поверх 1.14.

Переход: совместимый update in place. Существующие задачи и artifacts остаются действительными; проекты на `1.14.0` просто переходят на актуальную версию линии без rotation.

Зачем: накопленный опыт применяется в точке следующего решения, человек меньше повторяет уже известное, а безопасные способы работы с окружениями, данными и восстановлением переживают смену задач и оркестратора.

## 1.14.0 - 2026-08-05

Первый релиз линии активной памяти решений. Актуальное совокупное описание инкремента находится в `1.14.1`; точный исторический текст этого релиза сохранен в Git tag `v1.14.0`.

## 1.13.0 - 2026-08-01

Непрерывность исполнения, передача результата и текущий dashboard стали проверяемыми без новых skills, реестров или state machine.

- Перед patch, resume или correction работающей задачи оркестратор читает события новее последнего Return Sync и совмещает свою инструкцию с более свежими указаниями человека.
- Re-brief, split или смена плана показывают `Сохранено / Заменено / Добавлено / Осталось`; доказанное продвижение больше нельзя молча обнулить новым checklist.
- Task contract различает владельца продуктового результата, получателя и границу зависимости. Вспомогательная, demo, review или transport-задача не получает DOD и burn продуктовой задачи только благодаря изоляции файлов.
- Technical enabler завершает работу честным `Разблокировано / Еще не сделано / Следующий продуктовый slice и owner`. Его техническая приемка не закрывает parent product loop.
- Передача между людьми считается завершенной после recipient-side proof: получатель подтвердил доступ к точному shared artifact или revision и выполнил согласованную проверку; запускаемый результат включает показательный сценарий в его среде. Локальная ссылка, архив или макет сами по себе не являются доставкой.
- Human checkpoint соответствует суждению конкретного человека. Agents проводят техническую проверку; человек получает понятный product, visual, spend, external-action, smoke или merge-вопрос.
- Для zero-spend/no-mutation работы опасная возможность по возможности блокируется технически и проверяются counters до/после. Любое нарушение сохраняется в evidence и не может позже называться нулевым.
- Неизменный fallback monitor не создает сообщений, no-op traces или model wake-ups. `DONT_NOTIFY`, оставляющий след в контексте, не считается тишиной.
- Project State и Alignment Window перестраиваются атомарно: один current DOD, active-work view, framework/agent policy и next-best-action. История остается в связанных comments/windows, а дублирующие или противоречащие текущие секции считаются stale dashboard.

Переход: совместимый update in place. При следующем взаимодействии с активными задачами оркестратор сверяет свежие task events и сохраняет текущий прогресс; существующие artifacts и contexts миграции не требуют.

Зачем: не давать оркестрации случайно перезаписывать человеческое решение, обнулять проделанную работу, путать технический фундамент с пользовательским результатом или считать недоставленный коллеге результат завершенным.

## 1.12.1 - 2026-07-27

Проверка обновлений стала частью обычной активности оркестратора, а не ручной командой или фоновым модельным процессом.

- При первом активном обращении после 24 часов с последней проверки orchestrator сравнивает установленную версию с небольшим canonical manifest. Если версия актуальна, он ничего не сообщает.
- При наличии новой версии читаются все releases новее установленной и не старше latest, от старой к новой. Человек видит диапазон и число пропущенных версий, короткую дельту каждой версии, суммарное влияние на проект и предлагаемый момент обновления; промежуточный релиз не теряется.
- Оркестратор предлагает обновиться сейчас до следующего dispatch, если активная работа не зависит от прежних правил или update закрывает текущий coordination/safety risk. Иначе update ставится после названной задачи или checkpoint.
- Latest seen version, время проверки и один общий update plan хранятся в Project State; participant registry показывает локальную версию и дату проверки. Это не дает нескольким участникам готовить дублирующие updates.
- В выбранное окно переиспользуется или готовится одна update branch, запускаются `update` и `doctor`, затем открывается или обновляется ее PR, а merge остается под project policy. Конфликты не перезаписываются, и правила активной задачи не меняются незаметно посреди исполнения.
- После обновления active orchestrator перечитывает core и объясняет короткую дельту. Совместимый update сам по себе не требует rotation; она нужна только при migration requirement или проблемах context health.

Переход: установленным копиям до `1.12.1` нужен один обычный update. После него проверка работает автоматически во время следующей активности без ежедневного пробуждения agent context.

Зачем: команда узнает о новой версии вовремя, понимает практический смысл изменений и обновляется в наименее мешающий работе момент без ручного контроля и лишнего расхода модели.

## 1.12.0 - 2026-07-27

Узкие task contexts получили легкий способ сохранять целостность общей системы без загрузки всего проектного контекста.

- Минимальный task contract теперь называет принятый механизм, который задача продолжает, от одного до трех применимых invariants и `Consult when / Return to`.
- По умолчанию задача развивает Accepted Baseline. Локальная свобода implementation не означает разрешение молча создать параллельную архитектуру, дизайн-язык, data contract или другой общий механизм.
- При незаявленной сущности, общем механизме или contract, конфликте authority, пересечении ownership либо возможном системном изменении задача отправляет компактный `CONSULT`: `Boundary`, `Evidence`, `Proposed move`, `Safe continuation`.
- Оркестратор не вводит новый state machine: он использует существующие `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, Peer Compass Review или `NEEDS_DECISION`. Останавливается только затронутая граница; независимая работа может продолжаться.
- Acceptance классифицирует существенные изменения как `Inherited`, `Deliberately changed` или `Unexpectedly changed`. Необъясненное неожиданное изменение получает `NEEDS_FIXES`.
- Native instructions, skills, isolated contexts, compaction и messaging остаются обязанностью agent harness. Vydykhai использует существующий Return Sync/tracker transport и не добавляет собственную memory engine, router, message bus или постоянный watcher.
- Для менее способного harness задача сужается и раньше показывает evidence; оркестратор восстанавливает нужную durable truth и эскалирует человеку только реальную неоднозначность или pivot.

Зачем: позволить разным людям, моделям и agent harnesses работать в узком контексте, быстро двигаться к DOD и при этом не дробить продукт на случайно изобретенные локальные системы.

## 1.11.0 - 2026-07-25

Память человеческого замысла и ротация оркестратора стали явными и проверяемыми.

- Idea Memory хранит будущие возможности, а новый компактный Intent Trail - действующий замысел, working rules и причины существенных изменений подхода.
- `INTENT`, `WORKING_RULE` и `APPROACH_PIVOT` фиксируют смысловые изменения через `Было`, `Стало`, `Почему`, `Сохраняем`, `Отбрасываем`, scope и source. Поворот учитывается и внутри одной задачи, даже если DOD не изменился.
- Явные «запомни», «важно», «всегда», «никогда» и «давай по-другому» считаются подтвержденными; предполагаемый более широкий смысл один раз показывается человеку как `PROVISIONAL`.
- Task-local история остается в задаче и возвращается через Intent/Approach Delta в Return Sync; в общую память поднимаются только правила и решения, влияющие шире одной задачи.
- По умолчанию сохраняется краткий смысл и ссылка на source, а не полные сообщения. При planning, resume, acceptance и rotation система восстанавливает текущий подход и причины отказа от прежних вариантов.
- До запуска candidate оркестратор объясняет причину ротации, что переносится, что не меняется, как будет проверена память и какое подтверждение потребуется.
- Candidate сверяет не только packet и dashboard, но и high-signal human sources и task Return Syncs; совпадение двух пересказов больше не считается достаточным Memory Coverage.
- После подтверждения новый orchestrator регистрируется active, поднимается на виду, закрепляется при поддержке среды и публикует понятный activation status с next-best-action.
- Return routes, tracker hooks и monitors переводятся со старого context до его закрывающего сообщения.
- Старый context переименовывается как retired/superseded, открепляется и последним крупным сообщением направляет всю новую работу в активный orchestrator.
- Старый context остается доступной незакрепленной историей и не архивируется или удаляется автоматически.
- Если среда не умеет pin/unpin/rename или terminal notice, оркестратор дает человеку одно точное действие и отмечает `ROTATION_CUTOVER_INCOMPLETE`, а не объявляет переход полностью завершенным.

Зачем: не терять логику человеческих решений между задачами и ротациями и сделать смену управляющего context очевидной в интерфейсе.

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
