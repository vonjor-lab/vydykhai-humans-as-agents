# Project State Template

Use one compact issue or equivalent artifact per project or product stream. It is the current dashboard, not an append-only event archive.

```md
<!-- vydykhai:project-state v1 -->

# Project State: <project or stream>

Framework: <installed version> | Upstream: <url> | Last doctor: <result/date>
Shared Sync: Repo: <url> | Tracker: <url> | Readiness: <READY | SYNC_LIMITED, with gaps>
Coordination inputs: <meeting recorder/transcript/chat/docs/manual route> | Access checked: <date/result>
Agent policy: latest available flagship / deepest bounded reasoning
Resolved agent: <model id / reasoning mapping> | Checked: <date/source> | Fallback: <none, pending, or reason>
Environment adapter: <native | adapter path> | Context mapping: <thread/chat/session/run/workspace/tracker handle>
Task return mapping: <native context message | tracker event/hook | fallback monitor>
Orchestrator rotation: <stable | reconciling | candidate ready | human confirmed>
Candidate orchestrator context: <link/title or none>
Previous orchestrator context: <pinned history/reference link or none>
Memory coverage: <Rotation Memory Packet link | candidate check link | missing/ambiguous count>
Compass: <brief/doc/issue link>
Current DOD: <milestone and rows>
Active Alignment Window: <link or none>
Latest Team Alignment Delta: <id/link or none>
Idea Memory: <link, section, or none> | Last intersection: <brief/checkpoint/date or none>
Scope freshness policy: <days; default 7> | Last project-level check: <date/event>
Updated from durable event: <event/link/date>

## Participants

| Participant | Active orchestrator | Framework | Agent profile | Sync access | Latest packet | Active task | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <name> | <context link/title> | <version> | <model / reasoning / checked> | <repo/tracker/input status> | <packet/link> | <task/link> | <active / away / waiting / superseded> |

## Active Work

| Task | Owner | Task context | Baseline -> Candidate | PR/artifact | Human checkpoint | DOD impact | Status | Next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <task> | <owner> | <link> | <accepted -> active> | <link> | <checkpoint> | <row> | <state> | <action> |

## Decisions And Blockers

- <latest explicit decisions, pending inputs, or none>

## Safe Continuation

- <what can continue, cautions, or wait>

## Next-Best-Action

- <one exact action>

<!-- vydykhai:project-state:end -->
```

Update this body after accepted work, merge, material alignment, owner change, health review, or orchestrator rotation. Link archived Alignment Windows instead of copying their full history.
