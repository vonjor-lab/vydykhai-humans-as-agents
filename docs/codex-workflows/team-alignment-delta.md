# Team Alignment Delta

Append this as a GitHub issue comment after reading all available Local Alignment Packets. A later delta may supersede it when new packets arrive.

```md
<!-- codex-alignment:team-delta v1
delta_id: <YYYYMMDD-delta-shortid>
supersedes: <previous-delta-id-or-none>
meeting_keys: <date-title-or-fathom-id-list>
covered_packets: <packet-id-list>
pending_packets_or_people: <packet-id-or-owner-list>
created_at: <ISO-8601>
-->

## Team Alignment Delta

Status: <READY | READY_WITH_CAUTIONS | WAITING | BLOCKED>
Meetings covered: <date, title, transcript or recording link>
Covered packets: <packet ids>
Pending packets or people: <owners, packet ids, or none>

### What Changed

- <decision, assumption, task, brief, or rule that changed>

### Cross-Work Impact

- <who or what is affected>

### Required Updates

- <docs, issues, briefs, tasks, PRs, or none>

### Brief Patch Or Re-Brief

- <none, Brief Patch needed, or re-brief through $start-work>

### Safe-To-Continue Guidance

- <who can continue, what can continue, and what must wait>

### Next Trigger

- <which participant, packet, decision, or meeting should trigger the next delta>

<!-- codex-alignment:team-delta:end -->
```

Status rules:

- `READY`: all expected packets are covered and no known conflict blocks work.
- `READY_WITH_CAUTIONS`: work can continue inside explicit boundaries while missing packets or uncertainties remain.
- `WAITING`: alignment is incomplete and the next action is to wait for named packets or decisions.
- `BLOCKED`: packets conflict or a product decision is required before affected work continues.

The delta must always list which packets it covers. That list is the mechanism that lets later Codex instances see which updates have already been incorporated.
