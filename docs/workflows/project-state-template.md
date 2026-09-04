# Project State Template

Use one compact issue or equivalent artifact per project or product stream. It is the current control snapshot, not an event archive. The authoritative current record is only `Control Snapshot`, `Current DOD`, `Execution Leases`, `Pending Return Inbox`, `Detours And Recall`, and `Next-Best-Action`; record each fact once in its owning section. The activation receipt is immutable evidence, while tracker, graph summaries, and any legacy `Active Work`, `Decisions And Blockers`, or `Safe Continuation` sections are disposable views and never another control source. Rebuild the authoritative body atomically after each material transition and put history in linked comments or archived windows. Render and validate a complete Candidate before touching the accepted body; publish it once with an exact-current-body guard when available, then read back the whole body and compare its SHA-256 and `control-check` result. On mismatch, restore and verify the exact last accepted body. A partial or failed write never becomes current truth. Nothing except whitespace may appear before the start marker or after the end marker.

````md
<!-- vydykhai:project-state v2 -->

# Project State: <project or stream>

Snapshot as of: <latest durable event / revision / date>

## Control Snapshot

Governor: <HEALTHY | REPAIR | ROTATE> | Receipt: <id/link> | Trigger: <semantic anomaly or active 24h review> | Audited incident: <semantic incident id / none at activation> | Basis event: <snapshot inspected> | Route: <deterministic close / fresh independent context>
Project Guard: <ACTIVE | LIMITED | MISSING> | Runner: <project-owned external adapter/id and lock liveness> | Independent: <YES | NO> | Event route: <hook/outbox/activity watermark> | Schedule: <interval/native job> | Last proof: <time/result/source> | Wakeup: <active-context route> | Incident: <display-only last/current id or none; runner ledger is authority>
Human attention: <NONE | PENDING | RESURFACE_DUE> | ID: <stable id> | Request: <one plain-language decision or review> | Source: <task/result/link> | Raised: <event/time> | Resume after: <none or Guard/repair/rotation id>
Orchestrator health: <HEALTHY | REVIEW | REPAIR | ROTATE> | Context: <canonical title/link> | Profile: ORCHESTRATOR / maximum / <resolved mapping> | Last compaction/context-loss signal: <numeric count / date or none>
Work origin: <PASS | REVIEW | UNOWNED_PROJECT_WORK> | Advisory contract: <CONTROL_ONLY / ROUTE_TO_FOCUSED_CONTEXT / none> | Accepted evidence owner: <human decision / durable source / focused-context receipt / gap> | Last checked: <event/time/source>
Last independent check: <date / exact sources / result> | Same-class failures since repair: <count>
DOD Control Line: <current DOD -> last accepted visible proof -> exact remaining gap -> next-best-action>
Memory coverage: <graph/schema/watermark -> CURRENT/NEXT/CROSS_DOMAIN/PRIOR_MISS probes -> PASS, gap, or migration>
Project Memory Graph: <current canonical link> | Last memory delta: <memory event id / NO_CHANGE / checked; routine control events do not advance it>
Framework: <installed version> | Upstream: <url> | Latest seen: <version> | Checked: <date/result> | Update: <current / pending / window / PR>
Framework context readback: <active orchestrator own cwd> | HEAD: <accepted project revision> | Doctor: <installed/source/schema/integrity> | Core reread: <PASS / gap> | Result: <PASS / ACTUAL_CONTEXT_COHERENCE>
Agent routing: <latest flagship policy> | Resolved: <ORCHESTRATOR / DISCOVERY / EXECUTION mappings> | Checked: <date/source> | Fallback: <none/pending/reason>
Project activation: <PROJECT_READY | PROJECT_READY_WITH_LIMITS | NEEDS_DECISION | BLOCKED_BY_ACCESS> | Checked: <date/event>
Shared Sync: Repo: <url> | Tracker: <url> | Readiness: <READY | SYNC_LIMITED with gaps>
Coordination inputs: <meeting/chat/docs/manual route + access> | Intake: <direct or named owner> | Active alignment / latest delta: <link/event or none>
Environment adapter: <native / adapter path> | Context mapping: <thread/chat/session/run/workspace/tracker handle>
Task return mapping: durable outbox <tracker event/hook> | Durable discovery <event plus timer / adapter> | Wakeup <native context message or fallback> | Last reconciled receipt: <id/date>
Orchestrator rotation: <stable / repair / candidate / awaiting confirmation / cutover incomplete / complete> | Candidate / previous: <links or none>
Tracker projection: <board/view> | Last reconciled: <event/date>
Scope freshness: <policy days> | Last project-level check: <date/event/result>
Work hygiene: <last checked/result; unresolved artifact disposition or none>
Operational sources: <safe pointer ids and runbooks needed by current DOD, never values>
Updated from durable event: <event/link/date>

## Current DOD

- Compass: <accepted goal/brief link>
- Current DOD: <one actor-visible outcome and rows>
- Accepted proof: <latest exact evidence>
- Remaining: <shortest complete path>
- Explicitly outside this DOD: <later work>

## Project Activation Receipt

This is immutable launch evidence. Never rewrite its historical rows to mirror current task, framework, Guard, or memory status.

| Gate | Result | Evidence | Gap / repair owner |
| --- | --- | --- | --- |
| Home and kit | <PASS / LIMITED / BLOCKED / NOT_REQUIRED> | <repo/remote/visibility/doctor/setup> | <none or action> |
| Shared sync | <...> | <repo/tracker write + readback> | <...> |
| People | <...> | <participant readiness receipts> | <...> |
| Inputs | <...> | <direct access or intake route> | <...> |
| Operations for current DOD | <...> | <environment/pointers/authority/recovery> | <...> |
| Course | <...> | <accepted compass/current DOD/tracker route> | <...> |
| Control loop | <...> | <Project Guard registration/Governor receipt/orchestrator/Return route/next action> | <...> |

## Participants

| Participant / role | Decision scope / backup | Active orchestrator / agent environment | Framework / Readiness receipt | Active work / availability |
| --- | --- | --- | --- | --- |
| <name / role> | <scope / backup> | <context link/title> | <version / access receipt> | <work / active, away, waiting> |

## Execution Leases

One work id has one owning context and branch. `PREPARED` reserves identity but is not execution; `STARTED` requires readback of the actual context, profile, base and first observable action. A lease stays until its terminal Return Sync is consumed and its artifacts receive a disposition. A bounded Discovery lead uses this same table; after a research checkpoint it is `WAITING` on a named dependency/review-by, not continuously `WORKING` or prematurely `CLOSED`. Link its parent and covered work through this lease, the owning brief, and the tracker view. Consultation must give one owner an actionable next step rather than mutual waiting.

| Work | State | Owner / context | Project / repo / worktree / branch | Baseline -> Candidate / profile | DOD contribution | Next receipt or review-by | Return route |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <work-id> [<track>] [<mode>] — <outcome> | <PREPARED / STARTED / WORKING / WAITING / RETURNED / CLOSED / OUTCOME_UNKNOWN> | <owner / canonical link> | <exact identity> | <accepted -> active / role mapping> | <row / enabler continuation> | <trigger / date / burn stop> | <outbox + wakeup> |

## Pending Return Inbox

The durable outbox is authority; native delivery and native thread reads are only hints. Every checkpoint, readiness, blocker, or terminal outcome uses a Return Sync; an Action Receipt never replaces it. Keep only receipts not yet routed. Project Guard independently discovers new unrouted ids from the durable outbox on write events and timer, then wakes once. Reconcile this table at every cold path and Governor Check.

| Receipt | Work / sender | State | Durable outbox | Native wakeup | Consumer / routed next action |
| --- | --- | --- | --- | --- | --- |
| <unique id> | <work / context> | <WRITTEN / SENT / RECEIVED / CONSUMED> | <link/evidence> | <sent / unavailable / lost> | <owner / pending> |

## Detours And Recall

Every deliberate departure from the current DOD and every human “remember/revisit” commitment has a return gate. Remove it only after the return decision is consumed or the human explicitly retires it.

| ID | Paused DOD line | Detour or current commitment meaning | Return trigger | Owner question / safe continuation | State |
| --- | --- | --- | --- | --- | --- |
| <id> | <line or none> | <bounded work or remembered meaning> | <event/checkpoint/date> | <human-owned question / what continues> | <OPEN / RETURN_DUE / RESOLVED / RETIRED> |

## Next-Best-Action

```json
{"schemaVersion":1,"id":"<stable action id>","work":"<existing work key>","action":"<one productive step>","owner":"<exact current context>","state":"READY","evidence":"<accepted brief or action/gate reference>"}
```

<!-- vydykhai:project-state:end -->
````

The existing next action follows [Production Continuation](production-continuation.md): `READY`, `WORKING`, or `WAITING` with a concrete `resumeWhen`. Preserve it across service events; only completion or an explicit sourced decision supersedes it. Receipt/evidence wording may refresh without changing its stable action binding; owner, state, lease, or action identity changes require a fresh observation. `control-check` validates the record; `guard-check --activity` separately requires fresh adapter evidence before claiming liveness coverage.

`Human attention` is `NONE` when no answer is due. Otherwise keep one stable user-facing request as `PENDING`; if a Guard, repair, rotation, or later system event has displaced it, use `RESURFACE_DUE` until the orchestrator shows it again. A new request must combine with, resolve, or explicitly supersede the prior one; it may not silently replace it.

Update this body after activation, dispatch or resume, material re-brief, human detour/correction, blocker, Return Sync consumption, acceptance, merge, alignment, health review, framework/schema update, rotation, or a Human attention transition. Build one next authoritative record, validate it, publish once, and read it back once; do not publish intermediate `prepared`, Guard, or formatting snapshots merely to make a later snapshot valid. `control-check --json` returns the Candidate hashes; after publication export the body again and run `control-check --expect-state-sha <candidate-sha256>` before declaring it current. Keep the accepted body or immutable revision reference until readback passes. `Work origin` records the latest material control decision or independent adapter check; compliant advisory analysis remains control-only and creates no per-run history. A routine transition that passes deterministic validation does not require a fresh Governor or Graph write. Governor authority is bound to its semantic incident and evidence, not every later snapshot hash; a prior receipt never closes a changed anomaly or authorizes live work. After one bounded `REPAIR`, rerun deterministic checks: PASS closes the incident without another model audit; the same remaining condition becomes `CONTROL_DEGRADED`, stops background retries, preserves the last accepted state, and surfaces one plain-language checkpoint. Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` before declaring activation, schema migration, or rotation cutover; an external runner uses `guard-check` on events and schedule. Framework activation additionally requires the active orchestrator's own cwd/HEAD and live/offline doctor readback; a maintenance or verification worktree cannot satisfy it.

## Canonical Return Route Receipt

After the orchestrator consumes and routes a marked Return Sync, append this paired receipt to the same durable outbox or its stable linked control record. It is the machine-readable proof Project Guard compares with the producer receipt.

```md
<!-- vydykhai:return-route v1 -->

# Return Route

Return receipt id: <same id as Return Sync>
Return lifecycle: RECEIVED -> CONSUMED -> ROUTED
Consumer: <active orchestrator / durable pointer>
Routed next action: <closed lease / human checkpoint / next work / blocked gate>
Evidence: <Project State event and stable source>

<!-- vydykhai:return-route:end -->
```
