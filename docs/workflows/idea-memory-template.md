# Idea Memory Compatibility Template

For projects using the current memory policy, store future ideas as `IDEA` nodes in `project-memory-graph-template.md`; do not create a second active memory. This file remains for migrating an existing Idea Memory without losing its ids or sources.

Idea Memory is not a backlog, task list, promise, or permission to implement or spend. During migration, map each active or ambiguous entry to the Project Memory Graph, retain sources as evidence, then mark this artifact legacy/read-only.

```md
# Idea Memory: <project or stream>

Purpose: protect the nearest DOD while preserving useful ideas for the right planning moment.
Project State: <link>
Last full review: <date/checkpoint>

| ID | Idea and value | Touches | Recall when | Owner question / timing | Source | Last checked |
| --- | --- | --- | --- | --- | --- | --- |
| IM-01 | <outcome, not implementation plan> | <entities, surfaces, contracts, DOD rows> | <capability aliases plus planning trigger> | <pending decision and plan/checkpoint relation, or none> | <human decision, meeting, task, research, or evidence link> | <date/checkpoint> |
```

Rules:

- Freeze new writes when migration starts. Treat the current body and later comments as source evidence, not as two competing current lists.
- Map each still-useful, human-confirmed option to an `IDEA` node with its current meaning, source, capability aliases and trigger, applicability/timing plus plan/checkpoint relation, and pending human question. A date alone is not a useful recall trigger; unresolved timing stays a question rather than becoming an agent-selected horizon.
- Mark an entry `absorbed`, `duplicated`, `superseded`, `retired`, or `ambiguous` when it should not remain an active idea. Human approval is required before an idea changes current scope, DOD, sequence, or becomes a task.
- Merge semantic duplicates into one graph node while preserving every old id, reason, and destination in the graph's Legacy Source Map.
- Finish only after ordinary future-work queries retrieve every materially distinct open recall commitment with its concrete meaning, source, return condition, and human gate, representative planning Touch Sets retrieve the expected ideas, and every old id has a disposition. Id coverage alone is insufficient. Then mark Idea Memory legacy/read-only; all future idea capture and recall use the Project Memory Graph.
