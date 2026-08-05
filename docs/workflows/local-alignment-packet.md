# Local Alignment Packet

Append one packet when a participant's meeting or local state materially changes shared work.

```md
<!-- vydykhai:local-packet v1
packet_id: <stable id>
supersedes: <id or none>
participant: <name>
orchestrator: <link/title>
framework_version: <version>
agent_profile: <model / reasoning / checked date>
scope: <meeting/event/task>
source_access: <covered | limited, with gap>
created_at: <ISO timestamp>
-->

## Local Alignment Packet

Active task / PR:
Meeting or event decisions affecting my work:
Intent / Approach Delta: <none | type/status; Before / Now / Why / Keep / Drop / applies to / source>
Memory Delta: <none | task-local only | reusable: confirmed / refined / superseded / new decision family; evidence/touch keys/safe source>
Material local delta:
Touch Set / shared surfaces or contracts:
Conflicts, overlaps, or needs:
Human checkpoint:
Safe continuation: <continue | cautions | wait | blocked, with boundary>
```

Do not paste large diffs. Link commits, PRs, issues, or artifacts. Never overwrite another participant's packet or claim their uncommitted state.
