# Project State Template

Use one compact issue or equivalent artifact per project or product stream. It is the current control snapshot, not an event archive. Rebuild its body atomically after each material transition, keep exactly one copy of every current section, and put history in linked comments or archived windows. Nothing except whitespace may appear before the start marker or after the end marker.

```md
<!-- vydykhai:project-state v2 -->

# Project State: <project or stream>

Snapshot as of: <latest durable event / revision / date>

## Control Snapshot

Governor: <HEALTHY | REPAIR | ROTATE> | Receipt: <id/link> | Trigger: <event or active 24h> | Audited event: <exact Snapshot as of value> | Route: <deterministic check / fresh independent context>
Orchestrator health: <HEALTHY | REVIEW | REPAIR | ROTATE> | Context: <canonical title/link> | Profile: ORCHESTRATOR / maximum / <resolved mapping> | Last compaction/context-loss signal: <numeric count / date or none>
Last independent check: <date / exact sources / result> | Same-class failures since repair: <count>
DOD Control Line: <current DOD -> last accepted visible proof -> exact remaining gap -> next-best-action>
Memory coverage: <graph/schema/watermark -> CURRENT/NEXT/PRIOR_MISS probes -> PASS, gap, or migration>
Project Memory Graph: <current canonical link> | Last memory delta: <event id / NO_CHANGE / checked>
Framework: <installed version> | Upstream: <url> | Latest seen: <version> | Checked: <date/result> | Update: <current / pending / window / PR>
Agent routing: <latest flagship policy> | Resolved: <ORCHESTRATOR / DISCOVERY / EXECUTION mappings> | Checked: <date/source> | Fallback: <none/pending/reason>
Project activation: <PROJECT_READY | PROJECT_READY_WITH_LIMITS | NEEDS_DECISION | BLOCKED_BY_ACCESS> | Checked: <date/event>
Shared Sync: Repo: <url> | Tracker: <url> | Readiness: <READY | SYNC_LIMITED with gaps>
Coordination inputs: <meeting/chat/docs/manual route + access> | Intake: <direct or named owner> | Active alignment / latest delta: <link/event or none>
Environment adapter: <native / adapter path> | Context mapping: <thread/chat/session/run/workspace/tracker handle>
Task return mapping: durable outbox <tracker event/hook> | Wakeup <native context message or fallback> | Last reconciled receipt: <id/date>
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

| Gate | Result | Evidence | Gap / repair owner |
| --- | --- | --- | --- |
| Home and kit | <PASS / LIMITED / BLOCKED / NOT_REQUIRED> | <repo/remote/visibility/doctor/setup> | <none or action> |
| Shared sync | <...> | <repo/tracker write + readback> | <...> |
| People | <...> | <participant readiness receipts> | <...> |
| Inputs | <...> | <direct access or intake route> | <...> |
| Operations for current DOD | <...> | <environment/pointers/authority/recovery> | <...> |
| Course | <...> | <accepted compass/current DOD/tracker route> | <...> |
| Control loop | <...> | <Governor receipt/orchestrator/Return route/next action> | <...> |

## Participants

| Participant / role | Decision scope / backup | Active orchestrator / agent environment | Framework / Readiness receipt | Active work / availability |
| --- | --- | --- | --- | --- |
| <name / role> | <scope / backup> | <context link/title> | <version / access receipt> | <work / active, away, waiting> |

## Execution Leases

One work id has one owning context and branch. `PREPARED` reserves identity but is not execution; `STARTED` requires readback of the actual context, profile, base and first observable action. A lease stays until its Return Sync is consumed and its artifacts receive a disposition.

| Work | State | Owner / context | Project / repo / worktree / branch | Baseline -> Candidate / profile | DOD contribution | Next receipt or review-by | Return route |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <work-id> [<track>] [<mode>] — <outcome> | <PREPARED / STARTED / WORKING / WAITING / RETURNED / CLOSED / OUTCOME_UNKNOWN> | <owner / canonical link> | <exact identity> | <accepted -> active / role mapping> | <row / enabler continuation> | <trigger / date / burn stop> | <outbox + wakeup> |

## Pending Return Inbox

The durable outbox is authority; native delivery is only a wakeup. Keep only receipts not yet routed. Reconcile this table at every cold path and Governor Check.

| Receipt | Work / sender | State | Durable outbox | Native wakeup | Consumer / routed next action |
| --- | --- | --- | --- | --- | --- |
| <unique id> | <work / context> | <WRITTEN / SENT / RECEIVED / CONSUMED> | <link/evidence> | <sent / unavailable / lost> | <owner / pending> |

## Detours And Recall

Every deliberate departure from the current DOD and every human “remember/revisit” commitment has a return gate. Remove it only after the return decision is consumed or the human explicitly retires it.

| ID | Paused DOD line | Detour or current commitment meaning | Return trigger | Owner question / safe continuation | State |
| --- | --- | --- | --- | --- | --- |
| <id> | <line or none> | <bounded work or remembered meaning> | <event/checkpoint/date> | <human-owned question / what continues> | <OPEN / RETURN_DUE / RESOLVED / RETIRED> |

## Active Work

Show only live work and the immediate next queue. Terminal history leaves this table after Return consumption and artifact disposition.

| Task | Owner / recipient | Lease / dependency | DOD impact | Tracker status | Checkpoint / next |
| --- | --- | --- | --- | --- | --- |
| <canonical work reference> | <owner / recipient> | <lease state / formal links> | <row / required continuation> | <Next / In Progress / In Review / Blocked / Parked> | <observable gate / action> |

## Decisions And Blockers

- <latest explicit decisions, pending inputs, or none>

## Safe Continuation

- <what can continue while a repair, decision, or participant is pending>

## Next-Best-Action

- <one exact action>

<!-- vydykhai:project-state:end -->
```

Update this body after activation, dispatch or resume, material re-brief, human detour/correction, blocker, Return Sync consumption, acceptance, merge, alignment, health review, framework/schema update, or rotation. Write the event to its owning task or tracker record, then atomically rebuild this current view. Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` before declaring activation, schema migration, Governor `HEALTHY`, or rotation cutover. A Governor receipt closes only the exact event named by both `Snapshot as of` and `Audited event`; an older healthy receipt never authorizes a newer transition.
