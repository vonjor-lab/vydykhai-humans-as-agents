# Alignment Issue Template

Use this as the body of a GitHub issue for a meeting, daily cycle, or short product stream window. The body is a dashboard rebuilt from comments; comments remain canonical.

```md
<!-- codex-alignment:dashboard v1 -->

# Alignment Journal: <date or product stream>

Status: <READY | READY_WITH_CAUTIONS | WAITING | BLOCKED>
Meeting scope: <date, title, transcript or recording link>
Expected participants: <owners or "unknown">
Latest Team Alignment Delta: <delta id and comment link, or none>

## Packet Status

| Participant | Latest packet | Packet state | Covered by latest delta | Notes |
| --- | --- | --- | --- | --- |
| <owner> | <packet id or none> | <posted / missing / not_applicable / stale> | <yes / no> | <short note> |

## Current Shared Delta

- <short human-readable summary of latest Team Alignment Delta>

## Active Task Threads

| Task | Owner | Task thread | Branch / PR | DOD impact | Status | Next |
| --- | --- | --- | --- | --- | --- | --- |
| <issue> | <owner> | <thread link, id, pending, or manual prompt> | <branch or PR> | <named DoD row> | <active / paused / review / accepted / blocked> | <next action> |

## Pending Inputs

- <participant, packet, decision, or none>

## Safe-To-Continue Guidance

- <continue, continue with cautions, or wait>

## Next Required Action

- <who or which Codex should do what next>

<!-- codex-alignment:dashboard:end -->
```

Operating rules:

- Create one issue per meaningful meeting, daily cycle, or compact stream window.
- Prefer comments for new facts; update the body only as a derived scan-friendly dashboard.
- If two Codex instances update concurrently, preserve both comments and rebuild the body from the combined log.
- Close the issue after the final delta is reflected in durable docs, tasks, briefs, or PRs.
