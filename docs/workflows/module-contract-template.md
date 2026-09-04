# Module Contract Template

Goal: give every durable module or capability one current, human-readable explanation of why it exists, what it consumes and produces, how its important algorithm works, what depends on it, and how to prove it still works. This is project-owned product/engineering documentation linked from the Project Memory Graph, not another memory graph and not generated API reference.

Create a contract only for a durable module or capability with its own behavior, interfaces, accepted decisions, downstream consumers, or non-obvious algorithm. Do not document every file or helper. Keep the current contract concise enough to read before code, but preserve every material qualification needed to change the module safely.

```md
<!-- vydykhai:module-contract v1 -->

# Module Contract: <canonical module or capability name>

Graph anchor: <ENT id>
Serves: <OUTCOME/JOURNEY anchors>
Implementation: <current code paths/packages/services>
Accepted revision: <commit/artifact/schema/version>
Last verified: <date / revision / evidence>
Owner / decision gate: <owner or none>

## Purpose And Boundary

- Actor outcome: <what becomes possible for whom>
- Responsibility: <what this module owns>
- Excludes: <nearby responsibilities it does not own>

## Inputs And Authority

| Input / anchor | Meaning and required state | Authority / provenance | Failure behavior |
| --- | --- | --- | --- |
| <contract/data/artifact/entity/system> | <current input> | <source/version/owner> | <block/fallback/limited behavior> |

## Algorithm And Invariants

Describe the current stages and only the reasoning needed to preserve them. Link detailed specifications instead of copying them. State ordering, determinism, identity, geometry, calculation, safety, or other invariants that a local edit must not violate.

## Outputs And Consumers

| Output / anchor | Contract or artifact | Consumer anchors | Observable consequence |
| --- | --- | --- | --- |
| <data/artifact/entity> | <shape/version/identity> | <modules/capabilities/surfaces/systems> | <what breaks or changes> |

## Accepted Decisions And Lessons

Link the current `REQUIREMENT`, `DECISION`, `INVARIANT`, and relevant `LESSON` nodes. Keep rejected approaches only when their failure changes future work.

## Verification

- Contract tests: <tests/evidence>
- Representative product path: <actor/environment/scenario>
- Cross-domain checks: <affected consumers and expected result>
- Known limits: <explicitly unproven behavior>

## Open Commitments

Link unresolved `COMMITMENT` nodes with owner, return/checkpoint condition, and closure evidence. `none` is valid only after checking the graph.

## Change Log

Record only semantic contract changes: date/revision, changed sections, source decision, affected anchors, and verification. Git retains wording history.

<!-- vydykhai:module-contract:end -->
```

Read order for any task touching the module or capability:

The minimum preparation order is `graph route -> Module Contract -> current code`.

1. Retrieve its goal-to-entity route and applicable atomic memory nodes.
2. Read this current Module Contract and linked accepted specifications.
3. Inspect current implementation and tests; documentation never overrides observed code silently.
4. If graph, documentation, code, or accepted behavior disagree, stop the affected implementation boundary as `MEMORY_COVERAGE_GAP` and route bounded Discovery or re-brief.

A task reports `Documentation impact: NONE` only when purpose, boundary, inputs, outputs, consumers, algorithm/invariants, accepted behavior, operational dependencies, and verification remain unchanged. Otherwise the owning task updates this Module Contract in the same Candidate and returns the exact files/sections plus affected graph anchors. Acceptance verifies documentation against current behavior. The orchestrator integrates accepted shared-memory meaning after task acceptance; it never edits product code or module documentation itself.
