# Project State Template

Use one compact issue or equivalent artifact per project or product stream. It is the current dashboard, not an append-only event archive. Rebuild its body atomically after each material update and keep exactly one current DOD, Active Work view, framework/agent policy, and Next-Best-Action. Put history in linked comments or archived windows; reject duplicate or contradictory current sections.

```md
<!-- vydykhai:project-state v1 -->

# Project State: <project or stream>

Snapshot as of: <date / latest durable event>

Framework: <installed version> | Upstream: <url> | Latest seen: <version> | Checked: <date/result> | Update: <current | check pending | now | after task/checkpoint | PR/link | blocked>
Project activation: <PROJECT_READY | PROJECT_READY_WITH_LIMITS | NEEDS_DECISION | BLOCKED_BY_ACCESS> | Checked: <date/event>
First route: <START_WORK | ALIGN | ORCHESTRATE> | Next-best-action: <one exact action>
Shared Sync: Repo: <url> | Tracker: <url> | Readiness: <READY | SYNC_LIMITED, with gaps>
Coordination inputs: <meeting recorder/transcript/chat/docs/manual route> | Intake: <direct per relevant orchestrator | named intake owner + approval route> | Access checked: <date/result>
Operational sources: Current DOD: <complete protected POINTER ids | NOT_REQUIRED: owner / environment+scope / current baseline+revision / protected reference / allowed non-destructive route / expiry or re-entry; never secret values> | Merge/deploy/recovery authority: <route> | Access checked: <date/result/source>
Agent routing: latest available flagship | ORCHESTRATOR: maximum available | DISCOVERY: deep bounded | EXECUTION: efficient bounded
Resolved profiles: <model id / orchestrator mapping / discovery mapping / execution mapping> | Checked: <date/source> | Fallback: <none, pending, or reason>
Environment adapter: <native | adapter path> | Context mapping: <thread/chat/session/run/workspace/tracker handle>
Task return mapping: <native context message | tracker event/hook | fallback monitor>
Orchestrator rotation: <stable | announced | reconciling | candidate ready | awaiting confirmation | cutover incomplete | complete>
Candidate orchestrator context: <link/title or none>
Previous orchestrator context: <retired unpinned history/reference link or none>
Context visibility: <active pinned/foreground | previous unpinned + final notice | exact manual action pending>
Memory coverage: <Rotation Memory Packet link | candidate retrieval check | missing/ambiguous count>
Compass: <brief/doc/issue link>
Current DOD: <milestone and rows>
Active Alignment Window: <link or none>
Latest Team Alignment Delta: <id/link or none>
Project Memory Graph: <link or section> | Schema: <version> | Watermark: <event/revision/date> | Last reflection/retrieval check: <event/scenario/result>
Last memory delta: <task/event -> nodes added/refined/superseded/retired/conflicted or NO_CHANGE -> affected work>
Legacy memory inputs: <Intent Trail / Idea Memory links awaiting or completing migration, or none>
Tracker projection: <project/board link or equivalent> | Mapping: <statuses/fields/views> | Last reconciled: <event/date>
Scope freshness policy: <days; default 7> | Last project-level check: <date/event> | Work hygiene: <last checked/result; unresolved artifact + ACTIVE/WAITING/FINISH/SALVAGE/RETIRE disposition, or none>
Updated from durable event: <event/link/date>

## Project Activation Receipt

| Gate | Result | Evidence | Gap / repair owner |
| --- | --- | --- | --- |
| Home and kit | <PASS / LIMITED / BLOCKED / NOT_REQUIRED> | <repo/remote/visibility/doctor/setup change> | <none or action/owner> |
| Shared sync | <...> | <repo/tracker write + readback> | <...> |
| People | <...> | <current participant readiness receipts> | <...> |
| Inputs | <...> | <direct access or intake-owner route> | <...> |
| Operations for first DOD | <...> | <environment/pointers/authority/recovery or NOT_REQUIRED> | <...> |
| Course | <...> | <accepted goal/first DOD/tracker route> | <...> |
| Control loop | <...> | <active orchestrator/Return Sync mapping/next action> | <...> |

## Participants

| Participant / role | Decision scope / backup | Active orchestrator / agent environment | Framework / doctor | Repo / tracker / input | Readiness receipt | Active task | Availability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <name / role> | <scope / backup or absence route> | <context link/title> | <version / checked> | <READY / SYNC_LIMITED with gaps> | <event/link> | <task/link> | <active / away / waiting / superseded> |

## Active Work

| Task | Owner / recipient | Context | Baseline -> Candidate | Parent / dependencies | PR/artifact | DOD impact | Tracker status | Checkpoint / next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <work-id> [<track>] [<mode>] — <short outcome> | <owner / recipient or none> | <role/profile + canonical title/link> | <accepted -> active> | <formal links or none> | <PR/artifact linked to owning work> | <row> | <Todo / Next / In Progress / In Review / Blocked / Done / Parked> | <checkpoint / action> |

## Decisions And Blockers

- <latest explicit decisions, pending inputs, or none>

## Safe Continuation

- <what can continue, cautions, or wait>

## Next-Best-Action

- <one exact action>

<!-- vydykhai:project-state:end -->
```

Update this body after dispatch, material re-brief, blocker, accepted work, merge, material alignment, owner change, health review, or orchestrator rotation. In the same operation, reconcile the task issue's current contract and tracker projection. Link archived Alignment Windows instead of copying their full history.
