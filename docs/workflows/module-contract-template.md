# Module Contract Template

Goal: make durable capabilities composable through documented public contracts without loading or modifying their internals. Keep consumer instructions separate from maintainer rationale in this project-owned document linked from the Project Memory Graph; it is not another graph or an API wrapper around an unproven algorithm.

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
Boundary agreement: <human-approved responsibility/interfaces and authorized work scope>
Behavior readiness: <experimental / candidate / accepted / deprecated; evidence and remaining obligations>
Packaging readiness: <unproven / accepted for named consumer scope; independent connection evidence; separate from existing behavior acceptance>

## Consumer Contract

Released artifact / service: <immutable version/digest or observed deployed revision; install/connect entry>
Public entry: <export/API/command and supported protocol/schema versions>

## Purpose And Boundary

- Actor outcome: <what becomes possible for whom>
- Responsibility: <what this module owns>
- Accepted public boundary: <entry/input/output and revision; distinguish internal passes and independently accepted capability from unfinished parent>
- Applicability: <supported input families and conditions, excluded cases, defined refusal behavior; an example is not a reusable capability>
- Excludes: <nearby responsibilities it does not own>
- Composition: <parent/child capabilities and public dependencies; no private imports or direct access to another module's owned data>

## Inputs And Authority

| Input / anchor | Meaning and required state | Authority / provenance | Failure behavior |
| --- | --- | --- | --- |
| <contract/data/artifact/entity/system> | <current input> | <source/version/owner> | <block/fallback/limited behavior> |

## Outputs And Consumers

| Output / anchor | Contract or artifact | Consumer anchors | Observable consequence |
| --- | --- | --- | --- |
| <data/artifact/entity> | <shape/version/identity> | <modules/capabilities/surfaces/systems> | <what breaks or changes> |

## Connection And Failure Behavior

- Minimal use: <documented request/result example, configuration and public compatibility check>
- Semantics: <units, coordinate frames, identity/lifecycle and invariants consumers must preserve>
- Dependencies and state: <declared modules/services, owned storage, migrations, runtime resources and safe permission pointers; no secret values>
- Failures and side effects: <typed errors/unsupported cases, timeouts, retry/idempotency/cancellation where relevant; no silent partial success>
- Models and tuning: <declared internal model dependency, nondeterminism and supported settings, or none; no consumer-supplied hidden repair step>
- Compatibility: <supported consumer/provider versions, breaking-change decision, rollback and diagnostics available without private-source inspection>

## Accepted Decisions And Lessons

Link consumer-applicable `REQUIREMENT`, `DECISION`, `INVARIANT`, and `LESSON` nodes here; internal algorithm choices and rejected approaches belong in Maintainer Design. Do not hide a public limitation or recall commitment among internal notes.

## Verification

- Contract tests: <tests/evidence>
- Representative product path: <actor/environment/scenario>
- Cross-domain checks: <affected consumers and expected result>
- Known limits: <explicitly unproven behavior>
- Retained examples: <source assertion -> frozen input/expected observation -> applicability; link reference-runner metadata when used>
- New result: <task-promised examples plus retained examples on the exact Candidate; expectations change only through an explicit source decision>
- Reusability evidence: <independently chosen held-out/edge inputs and clean-start repetitions on one fixed Candidate through the promised entry; disclose preprocessing, manual steps, saved intermediates, failures and untested boundaries>
- Coverage inventory: <all required entities/stages derived from authoritative inputs, including failed/unsupported/unexamined members; not just the implementation's successful subset>
- Independent connection: <clean consumer uses only contract + released artifact/public endpoint + declared dependencies; no producer source tree, private import, manual intermediate or module patch; unchanged artifact/revision proof>

## Open Commitments

Link unresolved `COMMITMENT` nodes with owner, return/checkpoint condition, and closure evidence. `none` is valid only after checking the graph.

## Maintainer Design

Implementation map: <owned code/tests/build entry; not a prerequisite for consuming the module>
### Algorithm And Invariants
Describe important algorithm stages, rationale, rejected approaches and internal invariants needed for authorized changes. Link detailed specifications instead of copying them. Consumers need the applicable externally visible obligations above, not every internal design discussion.

## Change Log

Record only semantic contract changes: date/revision, changed sections, source decision, affected anchors, and verification. Git retains wording history.

<!-- vydykhai:module-contract:end -->
```

## Use, Change Or Create

At task shaping and material rebrief, map the requested outcome to an existing module before proposing a new one. Record `consume / change / create` per affected module in the existing brief. A composite has its own contract and connects children only through public boundaries; do not unfold its entire internal tree for a consumer task. Module boundaries follow coherent product responsibilities, not file length or one service per helper; an in-process package can be as encapsulated as a network service.

- **Consume:** retrieve goal/constraints, applicable public commitments, consumer contract, accepted release identity and declared operational dependencies. Read consumer-side wiring as needed, not producer internals or maintainer history. Connect the unchanged artifact through its public entry and test the consumer outcome. No implicit code extraction, private imports, shared-table edits or hidden output repair.
- **Change:** require an explicit human development/fix request or approved bounded scope covering the module. Read maintainer rationale, relevant history, implementation and tests after the public contract. Produce a new Candidate/version, preserve the accepted release and prove retained plus new behavior; do not silently mutate the installed accepted module while integrating it.
- **Create:** first show why existing capabilities cannot satisfy the request, propose responsibility, input/output, owned state and public dependencies, and obtain the human boundary agreement. Build and package through the same acceptance path; a name or documentation alone does not make code encapsulated.

Every brief tells the person which module is used or changed and what stays untouched. Reuse an explicit existing boundary agreement for ordinary connections; new/split/merged boundaries, changed public behavior or authority require agreement before mutation. An already explicit development request need not be asked again. Human review owns product/boundary choices, not technical proof.

For a connection failure, first check public input validity, configuration, version and environment using external diagnostics. Cheap preparation retrieves missing known facts; unresolved design uses Discovery. Reading internals needs an evidenced diagnostic question, and editing still needs the bounded change authority. Preserve the frozen failed input and accepted release; do not quietly convert a connection task into algorithm development. Continue independent safe work and retain explicit pauses.

To accept a packaged module, verify public contract tests, declared input families, clean-start repeatability and an independent consumer connection without producer source. Pin the supplied version and all non-obvious runtime/data/model dependencies; record observed deployment identity for remote services. Build exports, dependency rules or boundary tests should enforce no private imports/shared writes where supported; otherwise state the unproven boundary. Artifact hash checks prove identity, not hidden-dependency absence or complete correctness.

Use two linked views of the same module map: public capability/contract/release/dependencies for consumers, implementation/algorithm/tests for maintainers. Keep approved decisions and unfinished commitments linked in the graph, including restrictions that apply to consumers; do not hide them just because internals are encapsulated. Update only the affected module and direct public compatibility routes, expanding on concrete evidence rather than walking every internal dependency.

A task reports `Documentation impact: NONE` only when purpose, boundary, inputs, outputs, consumers, algorithm/invariants, accepted behavior, operational dependencies, and verification remain unchanged. Otherwise the owning task updates this Module Contract in the same Candidate and returns the exact files/sections plus affected graph anchors. Acceptance verifies documentation against current behavior. The orchestrator integrates accepted shared-memory meaning after task acceptance; it never edits product code or module documentation itself.

Lab acceptance and packaging are separate facts: preserve a working experiment, but do not call it a ready donor until the connection proof passes. Task Return names contract/release, applicability, consumer evidence, unchanged/changed modules and remaining gaps; the orchestrator integrates those limits before dependent dispatch. Existing maintenance handles real drift or repeated costly integration, not periodic rewriting or a project-wide packaging campaign.
