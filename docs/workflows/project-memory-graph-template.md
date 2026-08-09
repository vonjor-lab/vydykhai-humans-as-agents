# Project Memory Graph Template

Use one compact shared current view per project or product stream. It keeps only knowledge that can change a future decision: active invariants, decisions, useful deferred ideas, rejected-path lessons, and safe pointers to operational instructions. Raw discussions, routine progress, and secret values stay outside it as linked evidence.

```md
<!-- vydykhai:project-memory-graph v1 -->

# Project Memory Graph: <project or stream>

Project State: <link>
Watermark: <last integrated event id / revision / date>
Last compaction: <date / trigger>
Last retrieval check: <task or Touch Set / result>

## Current Nodes

| ID | Type / status | Current rule or value | Applies to / touch keys | Why / rejected path | Relations | Source |
| --- | --- | --- | --- | --- | --- | --- |
| MEM-01 | <INVARIANT | DECISION | IDEA | POINTER> / <ACTIVE | PROVISIONAL> | <smallest reusable statement> | <outcomes, entities, actors/surfaces, contracts/authorities, data/operations> | <rationale and what must not be repeated, or none> | <supports, conflicts, supersedes, depends on, or none> | <durable evidence link> |

## Pending Candidates

| Event | Action | Proposed change | Touch keys | Source | State |
| --- | --- | --- | --- | --- | --- |
| <id> | <ADD | REFINE | SUPERSEDE | RETIRE | CONFLICT | NO_CHANGE> | <compact candidate> | <keys> | <durable link> | <pending | integrated | needs human> |

## Legacy Source Map

| Previous id or artifact | Current node(s) | Coverage |
| --- | --- | --- |
| <Intent Trail / Idea Memory / task / decision source> | <MEM ids> | <covered | superseded | evidence only | ambiguous> |

<!-- vydykhai:project-memory-graph:end -->
```

Rules:

- `INVARIANT` is a durable product, quality, authority, safety, or operating boundary. `DECISION` is a current choice and its useful rejected path. `IDEA` is valuable but outside the nearest DOD. `POINTER` locates a protected runbook, environment, access, backup, or recovery route without copying secrets.
- Every task, meeting delta, acceptance, or human pivot may append one compact candidate event or `NO_CHANGE`. The orchestrator integrates reusable candidates; task contexts never rewrite the graph.
- Before changing the current body, re-read its watermark and all unseen candidate events. If the body changed during integration, recompute from the new revision instead of overwriting another participant's update.
- Apply one action per candidate: `ADD`, `REFINE`, `SUPERSEDE`, `RETIRE`, `CONFLICT`, or `NO_CHANGE`. Merge semantic duplicates into the existing node. Ask the human only when sources with equal authority conflict or meaning would be lost.
- At a cold-path brief, derive the Touch Set and return the smallest complete Memory Brief, normally three to seven nodes and fewer when fewer apply. Include source links and a visible `MEMORY_COVERAGE_GAP` when relevant memory cannot be proven. Never load the full graph into an execution task.
- Compact at a milestone, rotation, repeated duplicate, retrieval miss, or when the current view stops being quickly scannable. Preserve rule, scope, authority, rationale/rejected path, relations, and provenance; keep old evidence and id mapping rather than copied chronology.
- Never store credentials, tokens, private payloads, production data, or recovery values. A `POINTER` records only the protected location, owner, allowed retrieval route, and last non-destructive access check.
