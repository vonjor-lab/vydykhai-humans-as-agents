# Local Alignment Packet

Append this as a GitHub issue comment. Do not edit another participant's packet.

```md
<!-- codex-alignment:local-packet v1
packet_id: <YYYYMMDD-owner-shortid>
supersedes: <previous-packet-id-or-none>
owner: <name-or-github-handle>
trigger_type: <meeting | scope_changed | blocked | accepted | merged | follow_up_split | catch_up>
meeting_keys: <date-title-or-fathom-id-list>
event_key: <issue-pr-branch-or-none>
created_at: <ISO-8601>
-->

## Local Alignment Packet

Owner: <name-or-github-handle>
Trigger: <meeting | scope_changed | blocked | accepted | merged | follow_up_split | catch_up>
Meetings covered: <date, title, transcript or recording link>
Event key: <issue, PR, branch, task, or none>
Active work: <issue, branch, PR, or task>
Local visibility: <clean, uncommitted-local-work, pushed-branch, PR-open, unknown>

### Meeting Decisions Affecting My Work

- <decision or assumption>

### Task Event Summary

- <what changed for other participants, or none>

### Local Delta Since Previous Packet

- <local change, branch/PR link, or concise uncommitted work summary>

### Shared Surfaces Or Contracts Touched

- <surface, contract, data shape, user flow, integration, or none>

### Conflicts, Overlaps, Or Risks

- <known conflict, possible overlap, missing packet, or none>

### Needs From Others

- <decision, packet, review, artifact, or none>

### Safe-To-Continue Recommendation

Status: <CONTINUE | CONTINUE_WITH_CAUTION | WAIT>
Boundary: <what can continue and what must not continue yet>

<!-- codex-alignment:local-packet:end -->
```

Rules:

- Publish enough local context for another Codex to reason about alignment.
- Link to commits, PRs, issues, docs, or branches when available.
- Summarize uncommitted work; do not paste large diffs.
- Use event-triggered packets for meaningful task events between daily alignment cycles.
- Do not publish noisy commit-by-commit progress updates.
- If no local work is affected, still post a packet with `not_applicable` in the Local Delta section.
- If a new packet replaces an older one, set `supersedes` and explain the difference.
