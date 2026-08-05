# Intent Trail Template

Use one compact shared current view per project or stream when meaningful human intent or the first significant approach pivot must survive beyond one context. Idea Memory holds future options; Intent Trail is the current decision map: active intent, working rules, and why important decisions changed.

It is not a transcript, backlog, or copy of every instruction. Message length is irrelevant. Preserve the smallest useful lineage and link the source.

```md
# Intent Trail: <project or stream>

Purpose: make current human intent and reusable lessons findable before related work, without repeating rejected approaches.
Project State: <link>
Last reconciliation: <date/checkpoint>

| ID | Type / status | Now | Before / why / keep / drop | Touch keys | Relations | Source |
| --- | --- | --- | --- | --- | --- | --- |
| INT-01 | <INTENT | WORKING_RULE | APPROACH_PIVOT> / <CONFIRMED | PROVISIONAL> | <current decision or approach> | <prior path, reason, proven parts, rejected parts> | <outcomes, entities, actors/surfaces, contracts/authorities, data/operations> | <supersedes, supports, conflicts, related idea/runbook, or none> | <message, meeting, task, runbook, or evidence link> |
```

Rules:

- Capture semantic impact, not verbosity. Explicit remember/important/always/never/do-it-differently language and a human-approved pivot are `CONFIRMED`; inferred wider applicability is `PROVISIONAL` and must be echoed once for correction.
- `APPROACH_PIVOT` applies even when DOD is unchanged and the change is operational or task-local, if it replaces the main method, layer, baseline, sequence, boundary, or verification route.
- Keep task-local lineage in the task issue or context and include it in Return Sync. Promote it here only when it affects another task, a reusable mechanism, a project quality bar, or future planning.
- Merge a reusable delta into its existing decision family instead of appending a semantic duplicate. Rebuild the current body atomically so newer comments never leave the active map stale; keep superseded evidence in linked history.
- Derive touch keys from the work rather than asking people to tag memory. At brief, resume, consultation, acceptance, milestone, and rotation, match the task Touch Set to current cards and return a compact Memory Brief or an explicit `MEMORY_COVERAGE_GAP`.
- Operational cards contain only safe metadata: service/environment, owner, secret-manager reference, runbook/backup/restore link, required guardrail, and last safe check. Never store credentials, secret values, private payloads, or recovery material in this view.
- Do not copy full messages by default. Preserve a privacy-safe summary and source link; quote or copy exact text only when the human requests it or the source is not durable and the wording is necessary.
- At task return, use Memory Delta only to route existing Learning, Intent/Approach, or operational evidence: `none`, `task-local only`, or `reusable` as confirmed, refined, superseded, or new. It is not a second narrative; only the orchestrator merges reusable deltas into this map.
- At rotation, compact decision families and test retrieval against representative current or upcoming Touch Sets. State coverage is not enough when the candidate cannot find the applicable rule, rejected path, idea, or safe operational source.
