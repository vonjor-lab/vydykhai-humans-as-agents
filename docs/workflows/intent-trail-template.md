# Intent Trail Compatibility Template

For projects using the current memory policy, store reusable intent, working rules, and approach pivots as `INVARIANT` or `DECISION` nodes in `project-memory-graph-template.md`; do not create a second active decision map. This file remains for migrating an existing Intent Trail without losing lineage or sources.

It is not a transcript, backlog, or copy of every instruction. During migration, preserve the smallest useful lineage, link the source, map old ids to graph nodes, and leave this artifact read-only after cutover.

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

- Freeze new writes when migration starts. Treat the current body and later comments as source evidence, not as two competing current maps.
- Map `INTENT` and `WORKING_RULE` to the smallest reusable `INVARIANT` or `DECISION`. Map an `APPROACH_PIVOT` to a `DECISION` when it changed the main method, baseline, sequence, boundary, or verification route even if DOD stayed the same.
- Derive Touch keys and relations from the work. Keep task-local lineage as evidence unless it affects another task, a reusable mechanism, a project quality bar, or future planning.
- Merge semantic duplicates into one graph node and map every old id to `covered`, `superseded`, `evidence only`, or `ambiguous` in the graph's Legacy Source Map. Preserve source links and rejected-path lessons without copying chronology.
- Inferred wider applicability remains `PROVISIONAL` until echoed once for human correction. Equal-authority conflicts remain visible for a human decision.
- Operational entries become safe `POINTER` nodes containing only owner, protected reference without its value, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition. Never store credentials, secret values, private payloads, or recovery material.
- Finish only after representative Touch Sets retrieve the expected current decisions and every old id has a disposition. Then mark the Intent Trail legacy/read-only; all future retrieval and updates use the Project Memory Graph.
