---
name: daily-alignment
description: Use when the user asks for daily alignment, post-meeting alignment, meeting update, "daily alignment", "продолжи по daily", "сделай апдейт после встречи", "сделай daily alignment", or similar. Use for execution-time team alignment, not ordinary implementation.
---

# Daily Alignment

Run the repository's asynchronous post-meeting alignment workflow.

## Required References

Read these files before acting:

1. `AGENTS.md`
2. `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
3. `docs/codex-workflows/daily-alignment.md`

Then load these templates only when needed:

- `docs/codex-workflows/local-alignment-packet.md`
- `docs/codex-workflows/team-alignment-delta.md`
- `docs/codex-workflows/alignment-issue-template.md`
- `docs/codex-workflows/brief-patch-template.md`

## Operating Contract

- Treat the GitHub alignment issue comments as the canonical append-only journal.
- Treat the GitHub alignment issue body as a rebuildable dashboard.
- Publish this participant's Local Alignment Packet before claiming alignment is complete.
- Never overwrite another participant's packet.
- A Team Alignment Delta must list covered packet ids and pending participants or packets.
- When running inside a Framework Orchestrator thread, update the orchestrator state after publishing or reading the latest delta.
- If other participants have not posted yet, return `READY_WITH_CAUTIONS` or `WAITING` instead of pretending the team is fully aligned.
- Local uncommitted work from other participants is unknowable until their Codex publishes a packet; say this explicitly when it matters.
- If the meeting or merge event changes an epic brief, create a Brief Patch. If it changes goal, scope, sequence, ownership, or task map materially, route to `$start-work` for re-briefing.

## User-Facing Outcome

End with one clear recommendation:

- continue;
- continue with cautions;
- wait.

Include the alignment issue link, packet id, latest delta id, and missing participants or packets when available.
