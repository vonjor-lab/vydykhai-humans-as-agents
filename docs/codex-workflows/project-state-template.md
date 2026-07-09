# Project State Template

Use one compact issue or equivalent artifact per project or product stream. It is the current dashboard, not an append-only event archive.

```md
<!-- vydykhai:project-state v1 -->

# Project State: <project or stream>

Framework: <installed version> | Upstream: <url> | Last doctor: <result/date>
Agent policy: latest available flagship / xhigh
Resolved agent: <model id> | Checked: <date/source> | Fallback: <none, pending, or reason>
Compass: <brief/doc/issue link>
Current DOD: <milestone and rows>
Active Alignment Window: <link or none>
Latest Team Alignment Delta: <id/link or none>
Updated from durable event: <event/link/date>

## Participants

| Participant | Active orchestrator | Framework | Agent profile | Latest packet | Active task | Status |
| --- | --- | --- | --- | --- | --- | --- |
| <name> | <thread link/title> | <version> | <model / effort / checked> | <packet/link> | <task/link> | <active / away / waiting / superseded> |

## Active Work

| Task | Owner | Task thread | PR/artifact | Human checkpoint | DOD impact | Status | Next |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <task> | <owner> | <link> | <link> | <checkpoint> | <row> | <state> | <action> |

## Decisions And Blockers

- <latest explicit decisions, pending inputs, or none>

## Safe Continuation

- <what can continue, cautions, or wait>

## Next-Best-Action

- <one exact action>

<!-- vydykhai:project-state:end -->
```

Update this body after accepted work, merge, material alignment, owner change, health review, or orchestrator rotation. Link archived Alignment Windows instead of copying their full history.
