# Module Contract Template

Goal: make durable capabilities composable through documented public contracts without loading or modifying their internals. Keep consumer instructions separate from maintainer rationale in this project-owned document linked from the Project Memory Graph; it is not another graph or an API wrapper around an unproven algorithm.

A closed module is an accepted, independently connectable capability at a fixed release: one coherent responsibility, explicit inputs/outputs, owned state, declared dependencies and observable failure behavior. "Closed" means consumers need not reopen its implementation or design history; it does not mean immutable forever, error-free or a separate network service. Acceptance still requires the behavior and packaging evidence below.

Use accepted module boundaries as context boundaries. Gradually compose capabilities from accepted public contracts instead of repeatedly rediscovering their internals; the working context follows the changed boundary, not the whole platform. Keep all applicable external obligations. This is the architectural direction for reducing repeated context and preserving validated work, not a promise of unlimited scale or measured savings without evidence.

Create a contract only for a durable module or capability with its own behavior, interfaces, accepted decisions, downstream consumers, or non-obvious algorithm. Do not document every file or helper. Keep the current contract concise enough to read before code, but preserve every material qualification needed to change the module safely.

```md
<!-- vydykhai:module-contract v1 -->

# Module Contract: <canonical module or capability name>

Graph anchor / canonical module identity: <ENT id; stable id across environments>
Serves: <linked capabilities and OUTCOME/JOURNEY anchors>
Implementation / canonical source: <authoritative code paths/packages/services; no environment-specific algorithm forks>
Accepted revision: <commit/artifact/schema/version>
Last verified: <date / revision / conditions / evidence>
Owner / release responsibility / decision gate: <durable accountable owner or owned gap; owning issue/board, visible entry even in an external project, and linked current assignment; executor is not necessarily owner>
Boundary agreement: <human-approved responsibility/interfaces and authorized work scope>
Behavior readiness: <experimental / candidate / accepted / deprecated; evidence and remaining obligations>
Packaging readiness: <unproven / accepted for named consumer scope; independent connection evidence; separate from existing behavior acceptance>

## Consumer Contract
Released artifact / service: <immutable version/digest or observed deployed revision; install/connect entry>
Environment bindings: <selected Lab/demo/production release and configuration; actual actor access/use evidence or gap; no independently edited copies>
Public entry: <export/API/command and supported protocol/schema versions>

## Purpose And Boundary

- Actor outcome: <what becomes possible for whom>
- Responsibility: <what this module owns>
- Accepted public boundary: <entry/input/output and revision; distinguish internal passes and independently accepted capability from unfinished parent>
- Applicability: <supported input families and conditions, excluded cases, defined refusal behavior; an example is not a reusable capability>
- Excludes: <nearby responsibilities it does not own>
- Resolved composition: <parent/child ids and exact releases/dependency lock; aggregate revision, combined proof and upgrade/rollback route; no private imports or direct access to another module's owned data>
- Project architecture: <applicable shared data/identity, interface/versioning, security and dependency rules; references to accepted decisions, not copied policy>

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
- Semantics: <canonical project/area invariant references; units, coordinate origin/axes, scale, rounding, boundary conversions and identity/lifecycle as applicable; no implicit conversion or copied competing rule>
- Dependencies and state: <declared modules/services, owned storage, migrations, runtime resources and safe permission pointers; no secret values>
- Failures and side effects: <typed errors/unsupported cases, timeouts, retry/idempotency/cancellation where relevant; no silent partial success>
- Models and tuning: <declared internal model dependency, nondeterminism and supported settings, or none; no consumer-supplied hidden repair step>
- Execution ownership: <who selects operations, retries, alternatives and termination inside the boundary; required human decisions are explicit inputs/checkpoints, never hidden per-run repair>
- Compatibility: <supported consumer/provider versions, breaking-change decision, rollback and diagnostics available without private-source inspection; one authoritative input schema owner and declared adapter projections; supported new values do not create a new contract>

## Accepted Decisions And Lessons

Link consumer-applicable `REQUIREMENT`, `DECISION`, `INVARIANT`, and `LESSON` nodes here; internal algorithm choices and rejected approaches belong in Maintainer Design. Keep one canonical rule and its source/version, scope and explicit exceptions; graph routes link to it. Changed contracts update the owner's map/test evidence in the same Candidate. A known module id without its cross-module constraint is a memory gap, not sufficient coverage. Do not hide a public limitation or recall commitment among internal notes.

## Verification

- Contract tests: <tests/evidence>
- Representative product path: <actor/environment/scenario>
- Cross-domain checks: <affected consumers and expected result>
- Known limits: <explicitly unproven behavior>
- Retained examples: <source assertion -> frozen input/expected observation -> applicability; link reference-runner metadata when used>
- New result: <task-promised examples plus retained examples on the exact Candidate; expectations change only through an explicit source decision>
- Reusability evidence: <independently chosen held-out/edge inputs and clean-start repetitions on one fixed Candidate through the promised entry; disclose preprocessing, manual steps, saved intermediates, failures and untested boundaries>
- Coverage inventory: <all required entities/stages derived from authoritative inputs, including failed/unsupported/unexamined members; not just the implementation's successful subset>
- Control coverage: <applicable requirement/failure -> detector -> selected operation -> recheck/alternative -> termination/output; evidence for autonomous, operator-assisted and unknown paths; required only for claimed autonomous multi-stage behavior>
- Independent connection: <clean consumer uses only contract + released artifact/public endpoint + declared dependencies; no producer source tree, private import, manual intermediate or module patch; unchanged artifact/revision proof>

## Open Commitments

Link unresolved `COMMITMENT` nodes with owner, return/checkpoint condition, and closure evidence. `none` is valid only after checking the graph.

## Maintainer Design

Implementation map: <owned code/tests/build entry; not a prerequisite for consuming the module>
### Algorithm And Invariants
Describe important algorithm stages, rationale, rejected approaches, assumptions and internal invariants needed for authorized changes. Tie each material choice to its source decision and retained tests; state applicability and known failure cases so future work does not repeat rejected solutions. For iterative behavior include operation selection, feedback across stages, repeat-state handling, termination and distinct technical/search/constraint failures where applicable. Trace known manual successes to source evidence; manual invocation of a documented public entry is not proof of manual geometry/data repair. An interface wrapper alone does not establish autonomous control. Link detailed specifications instead of copying them. Consumers need the applicable externally visible obligations above, not every internal design discussion.

## Change Log

Record only semantic contract changes: date/revision, changed sections, source decision, affected anchors, and verification. Git retains wording history.

<!-- vydykhai:module-contract:end -->
```

## Use, Change Or Create

At task shaping and material rebrief, trace needed capabilities to existing modules before proposing new ones. Record `consume / change / create` per affected module in the existing brief. A composite has its own contract and connects modules only through public boundaries; consumers do not unfold the composition. Module boundaries follow coherent responsibilities, not file length or process boundaries.

For a composite, name the accepted child releases and prove the combined input-to-output behavior through public entries. Its public contract carries the child constraints, failures, side effects and operational requirements that affect callers; do not conceal them behind the parent name. The composite maintainer needs child public contracts, not their private algorithms. A child change is a separately scoped change, followed by affected compatibility tests; children passing alone does not establish the composite's acceptance. Apply this same rule at each composition level.

- **Consume:** use the public contract, applicable commitments, fixed release and declared dependencies. Read consumer wiring as needed, not producer internals or maintainer history. Prove the consumer outcome with the unchanged release. No producer rewrite, private import, code extraction, shared-table edit or hidden output repair.
- **Change:** route through the [module owner](context-routing.md#execution-context-at-a-safe-boundary) under an explicit human development/fix request or approved bounded scope. Read public contract, then relevant maintainer rationale, history, code and tests. Preserve the accepted release; prove retained and new behavior on the new Candidate before integration consumes it as a release.
- **Create:** first show why existing capabilities cannot satisfy the request, propose responsibility, input/output, owned state and public dependencies, and obtain the human boundary agreement. Build and package through the same acceptance path; a name or documentation alone does not make code encapsulated.

Every brief tells the person which module is used or changed and what stays untouched. Apply [boundary leadership](start-work.md#lead-the-module-boundary-decision) before a missing boundary or hidden operator control becomes another local patch. Reuse an explicit existing boundary agreement for ordinary connections; new/split/merged boundaries, changed public behavior or authority require agreement before mutation. An already explicit development request need not be asked again. Human review owns product/boundary choices, not technical proof.

For a connection failure, first check public input validity, configuration, version and environment using external diagnostics. Cheap preparation retrieves missing known facts; unresolved design uses Discovery. Reading internals needs an evidenced diagnostic question, and editing still needs the bounded change authority. Preserve the frozen failed input and accepted release; do not quietly convert a connection task into algorithm development. Continue independent safe work and retain explicit pauses.

To accept a packaged module, verify public contract tests, declared input families, clean-start repeatability and an independent consumer connection without producer source. Pin the supplied version and all non-obvious runtime/data/model dependencies; record observed deployment identity for remote services. Build exports, dependency rules or boundary tests should enforce no private imports/shared writes where supported; otherwise state the unproven boundary. Artifact hash checks prove identity, not hidden-dependency absence or complete correctness.

Use two views of the same map: public capabilities/contracts/releases/dependencies for consumers, implementation/rationale/tests for maintainers. Link actor outcomes and capabilities to stable module IDs and their canonical contracts, owners, releases and consumers. These links are many-to-many; record parent/child composition where it exists, not a mandatory hierarchy. A diagram projects the same entries, not a separately maintained truth; memory links decisions and open obligations, including consumer restrictions. Distinguish the latest available release from actually selected environment bindings; keep verification revision/conditions and actual user availability explicit. Update only affected entries and relevant public compatibility routes.

At launch, unknown-readiness reconnect or relevant framework update, inventory the whole accessible top-level responsibility map once through `framework-activation.md`, then repair only proven gaps. Link responsibility -> public contract -> owned implementation/tests/data -> consumers/dependencies to existing graph anchors and source revisions. A candidate document is not an active module, accepted behavior is not packaged readiness, and inaccessible areas stay marked rather than inferred from names. Existing verified contracts remain current when their relevant sources have not changed. The focused maintenance owner may inspect producer code for this diagnostic; an ordinary consumer cannot use that inspection as permission to edit internals. Describe existing architecture in the same maintenance scope; propose new boundaries to the human before any code or interface mutation.

## Initial Project Assessment

Before claiming initial preparation complete, assess the whole accessible platform once, not just the current integration. Reuse a source-backed accepted assessment on later updates/reconnects; new or changed responsibilities reopen only affected coverage. The result lives in the existing project-owned module map and linked contracts, not a parallel architecture ledger. An empty/new project still records its current responsibility and intended boundaries explicitly.

First derive the expected top-level areas from the accepted brief, repository/workspace entrypoints, runtime/data ownership and current product flows; include known external/participant-owned areas. Establish this inventory independently of the worker's chosen task route and have the orchestrator review it against those sources. A source-complete local slice contributes evidence but cannot shrink the project inventory. This is architectural responsibility coverage, not one module per folder, file-length splitting or compulsory microservices; a modular monolith can be a valid result.

For every area, retain the following in the same module map:

| Area / goal / owner | Actual implementation and data | Modularity / coupling | Documentation and verification | Proposed action / owner / gate |
| --- | --- | --- | --- | --- |
| Stable responsibility and product outcome | Entry, owned code/tests/data, inputs/outputs, callers, public/private dependencies and source revision | Encapsulated, partial, tangled or unknown; cite shared writes, private imports, hidden tuning and other boundary evidence | Consumer contract, maintainer algorithm/rationale/rejected approaches, test coverage, missing/stale/conflicting docs | Keep, document, package, split or bounded research; separate current modules from proposed ones |

Names, folders, source hashes and documents do not prove encapsulation. Inspect actual entry/exit, ownership and cross-boundary behavior; distinguish behavior from packaging. Unknown or inaccessible inventory entries retain a reason, owner and review/access trigger, not assumed coverage or deletion. An explicit deferred keep records why, who owns it and what triggers review in the existing map or plan. Documentation is CURRENT only when it matches observed implementation and limits, including relevant rationale and prior decisions.

For partial/tangled areas, present one plain-language current-to-target proposal: current behavior to preserve, proposed responsibilities/input/output/state/dependencies, benefit to delivery/context cost, sequence and dependencies, risk, retained/new tests, rollback and impact on active work. Tie each finding to its owner and decision/task checkpoint. Architecture choices use existing Discovery judgment; cheap preparation gathers source facts, and maintenance documents known structure. The orchestrator reviews coverage and presents the proposal. No new role, unbounded research or automatic migration is authorized by the audit.

Report two independent YES/NO answers: all project code mapped; modular architecture confirmed. YES requires reviewed whole-project coverage and current corresponding artifact checks; any unknown or inaccessible area means NO. Internal per-area findings guide remaining work, never a "partially ready" substitute. Every NO has a visible owned plan at a named safe checkpoint. Assessment can finish with modularization PROPOSED or explicitly DEFERRED, but the modularity answer remains NO. Preserve the human decision and obtain agreement before changing boundaries; assessment metadata grants no mutation authority. Do not wait for product integration to succeed before mapping existing code.

### Coverage Metadata

`readiness.architecture` is a compact projection of that map, not a second owner/progress ledger. Use stable ids and evidence references, no code or report bodies. `adoption-plan --input` checks this coverage; ordinary hot-path work reuses accepted evidence.

```json
{"project":"project-id","scope":"project-id","inventory":{"source":"accepted-project-outline@revision","areas":["intake","planning"]},"source":"module-map@revision#assessment","reviewedBy":"orchestrator","review":"coverage-review@revision","coverage":[{"area":"intake","access":"AVAILABLE","modularity":"ENCAPSULATED","documentation":"CURRENT","evidence":"map@revision#intake"},{"area":"planning","access":"AVAILABLE","modularity":"TANGLED","documentation":"GAPS","evidence":"map@revision#planning","followUp":"PREP-MODULES"}],"proposal":{"source":"plan@revision","disposition":"PROPOSED"}}
```

`project` is the established project identity; `scope` must match it. `inventory.areas` is the independently reviewed complete responsibility list, not generated from successful assessment rows. `coverage` accounts for each id exactly once. Access is AVAILABLE or INACCESSIBLE; modularity is ENCAPSULATED, PARTIAL, TANGLED or UNKNOWN; documentation is CURRENT, GAPS or UNKNOWN. Every row has evidence. Gaps, modularity findings and inaccessible areas need `followUp` referencing an owned task or decision checkpoint. From 1.32.8 in Project State it is the exact work key of the covering `Capability adoption.steps` entry; that step names its unresolved `areas` and uses the existing live/wait lease. The example requires a PREP-MODULES step and lease; retain its decision/source in the plan and applicable human gate. INACCESSIBLE rows keep modularity/documentation UNKNOWN; accessible UNKNOWN remains unfinished assessment. A source-backed resolved row can retain its historical follow-up without an active task.
PARTIAL/TANGLED findings require `proposal.source` and disposition PROPOSED, APPROVED or DEFERRED; the latter two require a human `decision` reference. `reviewedBy`/`review` records parent review of inventory completeness, classifications and follow-ups, not only the producer's claim. Machine checks do not authenticate sources or prove completeness. Missing/local/inaccessible coverage cannot establish full mapping or modularity; retain access owner/checkpoint and existing evidence. Relevant metadata changes invalidate acceptance; unrelated commits or kit versions do not.

After initial acceptance, each task updates the touched map/contract entries in the same Candidate. Acceptance checks that new responsibilities were added to the inventory, boundaries and proposed-versus-accepted status remain truthful, and module decisions/obligations are integrated into memory. Only relevant changes trigger reinspection; do not rerun the full audit on every task or release. Use reviewed gaps to plan work rather than repeatedly rediscovering them.

A task reports `Documentation impact: NONE` only when purpose, boundary, inputs, outputs, consumers, algorithm/invariants, accepted behavior, operational dependencies, and verification remain unchanged. Otherwise the owning task updates this Module Contract in the same Candidate and returns the exact files/sections plus affected graph anchors. Acceptance verifies documentation against current behavior. The orchestrator integrates accepted shared-memory meaning after task acceptance; it never edits product code or module documentation itself.

Lab acceptance and packaging are separate facts: preserve a working experiment, but do not call it a ready donor until the connection proof passes. Task Return names contract/release, applicability, consumer evidence, unchanged/changed modules and remaining gaps; the orchestrator integrates those limits before dependent dispatch. Existing maintenance handles real drift or repeated costly integration, not periodic rewriting or a project-wide packaging campaign.
