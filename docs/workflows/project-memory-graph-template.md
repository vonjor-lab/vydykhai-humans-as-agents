# Project Memory Graph Template

Use one compact shared graph per project or product stream. Project State is current working memory; this graph is reusable semantic and decision memory; linked meetings, messages, tasks, PRs, and rejected candidates are episodic evidence; each task receives only an executable Memory Brief. Never make chat history or a visualization another source of truth.

```md
<!-- vydykhai:project-memory-graph v2 -->

# Project Memory Graph: <project or stream>

Project State: <link>
Watermark: <last integrated event id / revision / date>
Last compaction: <date / trigger>
Last reflection: <event / miss class / result>
Last retrieval check: <scenario or task / evaluator / result>

## Anchor Index

| ID | Kind | Canonical name / aliases | Scope | Source |
| --- | --- | --- | --- | --- |
| ENT-01 | <OUTCOME | ACTOR | ENTITY | SURFACE | CONTRACT | DATA | OPERATION> | <stable name; accepted aliases> | <project / stream / boundary> | <durable source> |

## Current Memory Nodes

### MEM-01 — <short title>
- Type / status: `<INVARIANT | DECISION | LESSON | IDEA | POINTER> / <ACTIVE | PROVISIONAL | CONFLICT>`
- About: <anchor ids> | Recall when: <task language, condition, or trigger>
- Apply: <one current executable statement>
- Avoid: <rejected path or none>
- Applies / exceptions: <scope and explicit exclusions>
- Protected pointer (POINTER only): <owner | protected reference, never value | environment and scope | allowed non-destructive route | last safe check time, result, and source | expiry or re-entry condition>
- Relations: <about / requires / constrains / supersedes / conflicts / learned-from / verified-by -> ids, or none>
- Source / checked: <durable evidence link / date or result>

## Pending Memory Events

| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <task / meeting / acceptance / correction> | <compact delta> | <ENT ids / unresolved terms> | <NONE | ABSENT | RETRIEVAL_MISS | APPLICATION_MISS | VERIFICATION_MISS> | <ADD | REFINE | SUPERSEDE | RETIRE | CONFLICT | NO_CHANGE> | <durable link> | <pending | integrated | needs human> |

## Representative Retrieval Scenarios

| Raw trigger | Expected executable action or gate | Independent pass 1 | Independent pass 2 | Regression source |
| --- | --- | --- | --- | --- |
| <ordinary task language without node ids or prepared Touch Set> | <Apply / Avoid / Verify or BLOCKED expectation> | <observed action / evidence / pass or miss> | <observed action / evidence / pass or miss> | <source or none> |

## Legacy Source Map

| Previous id or artifact | Current node(s) | Coverage |
| --- | --- | --- |
| <Intent Trail / Idea Memory / task / decision source> | <MEM ids> | <covered | superseded | evidence only | ambiguous> |

<!-- vydykhai:project-memory-graph:end -->
```

Rules:

- Anchors give stable identity to outcomes, actors, product entities, surfaces, contracts, data, and operations. Reuse one anchor across synonyms; do not create a new memory node merely because later work uses different wording.
- Keep one reusable meaning per memory node. `INVARIANT` is a durable boundary; `DECISION` is a current choice; `LESSON` is a reusable cause or failed-path learning; `IDEA` is valuable but outside the nearest DOD; `POINTER` locates protected operational knowledge without copying it.
- Current meaning and evidence stay separate. Update `Apply`, `Avoid`, scope, relations, and provenance; link chronology instead of copying it. Type every relation and use `supersedes` rather than leaving two competing current rules.
- Every task, meeting delta, acceptance, or material human correction emits one compact event or `NO_CHANGE`. Task contexts never rewrite shared memory. Before integration, re-read the watermark and unseen events; recompute on concurrent change, merge semantic duplicates, and ask the human only when equal-authority meaning conflicts.
- A correction or repeated owner explanation triggers Memory Reflection before apology or patch: derive `Before / Now / Why / scope`, resolve anchors, retrieve related nodes, and classify `ABSENT`, `RETRIEVAL_MISS`, `APPLICATION_MISS`, or `VERIFICATION_MISS`. Integrate the smallest correction, rerun retrieval, and intersect the delta with active and queued work.
- For a cold-path query, resolve exact anchors and aliases first, add semantic candidates when wording differs, traverse relevant typed relations one or two hops, then filter by status, source precedence, scope, applicability, and supersession. Prefer current mandatory constraints and direct matches; recency alone never overrides applicability.
- Return no more than seven nodes and fewer when fewer apply, compiled as executable items: `Because <anchor>, apply <rule>, avoid <path>, verify <evidence>, source <link>`. Drop a node that changes neither action, boundary, guardrail, nor acceptance. Raise `MEMORY_COVERAGE_GAP` when required meaning cannot be proven.
- Acceptance records each brief item as applied, missed, contradicted, or not exercised and returns any reusable delta. A miss becomes or updates a representative regression scenario. Coverage passes only when a fresh evaluator can reconstruct the expected executable brief and its acceptance implication; matching ids or self-report alone is insufficient.
- Compact at a milestone, rotation, duplicate cluster, retrieval miss, or loss of scanability. Preserve stable ids, aliases, current meaning, applicability, typed relations, old-id mapping, and immutable evidence.
- Never store credentials, tokens, private payloads, production data, or recovery values. A protected `POINTER` records owner, protected reference without its value, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition. Retrieval must emit these fields directly or return `MEMORY_COVERAGE_GAP / BLOCKED`; historical reconstruction may repair the node but is not a successful lookup. Keep one raw two-pass regression for protected access and prove zero secret read.
