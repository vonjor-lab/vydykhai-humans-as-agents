# Alignment Window Template

Use one issue for one meeting, milestone, or compact work period. Comments are append-only evidence; this body is rebuilt whenever a Team Alignment Delta is published.

```md
<!-- vydykhai:alignment-window v1 -->

# Alignment Window: <scope>

Status: <READY | READY_WITH_CAUTIONS | WAITING | BLOCKED>
Scope/source: <meeting, event, links>
Project State: <link>
Expected participants: <names>
Latest delta: <id/link>
Dashboard rebuilt from event: <id/date>

## Packet Coverage

| Participant | Orchestrator | Framework | Latest packet | State | Covered |
| --- | --- | --- | --- | --- | --- |
| <name> | <link/title> | <version> | <id/link> | <posted / missing / n/a / stale> | <yes/no> |

## Shared Delta

- <what changed and cross-work impact>

## Safe Continuation

- <continue, cautions, wait, or blocked boundary>

## Pending Inputs

- <participant, decision, review, or none>

## Next Action

- <one exact action>

<!-- vydykhai:alignment-window:end -->
```

Publish the delta comment and rebuild this body in the same operation. Close/archive the window once its final state is reflected in Project State, briefs, tasks, or PRs.
