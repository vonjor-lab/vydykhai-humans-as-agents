# Supported Context Preparation

The agent prepares a task from ordinary reviewed inputs using `context-prepare`;
the person states the desired work and makes existing semantic decisions. No
manual hash graph, test helper, provider call or hook installation is required.

## Inputs and ownership

Use `examples/context-preparation/package-modular.json` as the current input shape (`package.json` is the legacy v1 fixture). All paths are
relative to the current workspace. Run from that workspace with the installed
`scripts/vydykhai.mjs` entry. Copy the example into a separate scratch workspace
to exercise it; its Candidate deliberately lacks the new case-insensitive fix.

New prepared implementation tasks use [module-bound packages](module-context.md) (`context.package.v3`, including goal/necessity alignment); compatible `context.package.v1` declares owner, task/worker/scope/action/Candidate
files, module boundary/oracle/verifier, original complete event exports, explicit
event and assertion dispositions, relevant dependencies and existing shared
artifacts. Every assertion names a unique literal source quote, scope, reason,
target, supersession and any deferred trigger/owner gate. The builder computes
byte ranges and hashes; it cannot decide meaning or certify unseen history.
An event without assertions needs an explicit `no_change` or `evidence_only`
decision. Missing classifications and unresolved required meaning block.

Shared artifacts are paths or `{path,startMarker,endMarker}` selectors. Selected
sections are pinned individually, including multiple sections in one file.
Unrelated section changes do not invalidate that binding. Sources, oracle,
verifier and declared dependencies retain their exact identities. Candidate
implementation may change after preparation: acceptance verifies its current
behavior against retained and new examples. Do not list mutable implementation
as an immutable dependency unless that restriction is intended. In consume tasks, Candidate files are consumer wiring; the accepted producer release/contract is an immutable dependency, not mutable implementation. Pin bounded release identity/observed remote revision rather than scanning its source tree; hashing bytes is not model-context loading.

Include agreed entry/mechanism, relevant upstream and consumer boundaries,
actual runtime/test conditions and direct-human-control decisions in these
existing scoped sources/dependencies. Refresh them from observed evidence at a
material change; declaration alone is not a live observation. Never include
secret values. The caller cannot notice an unexported human correction or an
undeclared environment change, and it does not intercept arbitrary native tools.

## One ordinary path

Agent-side command sequence (replace paths/identities with the actual task):

```sh
node scripts/vydykhai.mjs context-prepare plan --input package-modular.json --output prepared
node scripts/vydykhai.mjs context-prepare confirm --output prepared --owner module-owner --decision approved
node scripts/vydykhai.mjs context-prepare read --output prepared --worker bundle-worker
node scripts/vydykhai.mjs context-prepare ack --output prepared --worker bundle-worker --evidence worker-evidence.txt
node scripts/vydykhai.mjs context-run --input prepared/preflight.json
node scripts/vydykhai.mjs context-run --input prepared/resume.json
node scripts/vydykhai.mjs context-run --input prepared/accept.json
```

1. `plan` writes only a reviewable plan with semantic inputs and exact derived
   artifact references. It executes no dependent action and activates no reviews.
2. The authorized owner reviews that plan and explicitly confirms it. `confirm`
   checks unchanged inputs, records that one decision and materializes derived
   review records under its provenance. Those records are not invented additional
   independent reviews. Actual shared readback must succeed before the integration
   receipt and prepared capsule are written; no shared graph is edited.
3. The assigned worker uses `read` to receive the actual context, then writes its
   own readback evidence and calls `ack`. This is a distinct actor step, not an
   automatic acknowledgment by the builder. Identity strings and pinned evidence
   establish transport identity, not authentication or semantic understanding.
4. The worker makes the intended Candidate change and uses `context-run` for the
   declared action and verification. The example fix changes `entry.id` to
   `entry.id.toLowerCase()` only for duplicate comparison. B1/B2 must remain valid
   and N1 must pass. `VERIFIED` does not replace human acceptance.

Changed source meaning needs a new reviewed package in a fresh output directory;
unchanged calls are reusable. Output collisions, crossed task packets, stale
approvals, changed selected inputs and missing worker readback block. Preparation
does not overwrite a previous packet or erase its pending state.

## Optional cheap preparation

Check context sufficiency for every task. Reuse an adequate current packet; use
the opt-in `PREPARATION` profile when context is missing, stale or scattered.
Start from the ordinary module map/index and entity-linked memory, then Module
Contracts: public-use sections and fixed releases for consume, maintainer design and owned code for change/create. Missing map or prior decision is a visible gap, not
permission to fabricate a complete history. Mechanical file/symbol indexes should
link existing contracts; do not create duplicate prose documentation or split
proven code solely to meet a universal line count. Update affected contracts/map
links with the owning increment; reusable semantic changes remain owner-reviewed. Stop retrieval at an accepted public boundary, including composites: deliver its relevant obligations, not every child's source or algorithm history. Changing a composite needs its own maintainer context plus child public contracts; expand inside a child only for a separately scoped change or evidenced diagnostic question. Cheap retrieval is not permission to scan every closed module.

Preparation is a profile for bounded evidence retrieval in an ordinary focused
Discovery context with its existing lease/Return Sync, not a new management role.
It retrieves evidence, not new product/architecture decisions. Resolve
the lowest model proven for the task class and record actual model/effort plus
fallback. Keep unresolved solution design in `DISCOVERY`. A failed check first
distinguishes missing evidence, environment failure and reasoning failure; do not
oscillate models automatically. Preserve explicit human model decisions.

The optional `navigation` object in `context.package.v1` contains `taskId`,
`worker`, a distinct `preparedBy`, `outcome`, `references`, `constraints`, `gaps`,
and owner-issued `assignment`; see [Context Routing](context-routing.md). Each reference declares `id`, workspace-relative `path` copied from the actual file inventory,
exact `quote`, `purpose`, `appliesTo` (`task` or `preparation`). By default omit line numbers: the builder resolves a unique literal quote and computes inclusive `startLine`/`endLine` and hashes; no model-authored Markdown links. Ambiguous/missing quotes require source selection, never fuzzy matching.
Explicit `startLine`/`endLine` remain supported and strictly checked, never silently repaired. Each constraint has `text`, `appliesTo`, `referenceIds`.
Each gap has `text` and boolean `critical`; critical gaps block implementation handoff, not an authorized scoped research task to resolve them.
For this route the owner declares nonempty `module.contractFiles` from the module
map/graph independently of the preparer's found-code list. Each must have a
task-wide cited quote; an omitted contract blocks. Review the complete applicable
contract for the declared use/change mode, not just a keyword hit or all maintainer internals. Distinguish an unavailable source from an
available but unread source: neither proves absence of the underlying decision. Recover existing access decisions before asking again; follow [safe pointer recall](memory-recall.md#operational-recall), separating historical authority from current readiness.
The builder checks bounds/quotes and computes file hashes. Owner review still
decides semantic coverage, correct audience and unresolved contradictions;
structural checks cannot detect a wrongly classified natural-language rule.

Only task-wide references/constraints and assignment identity reach `navigation.json` and worker `read`; the preparer's question stays in the owner plan.
Preparation-only read-only restrictions do not grant or remove executor rights;
actual authority remains the current task. Real task-wide read-only rules stay.
Navigation inputs are pinned by the existing plan except declared mutable
Candidate/implementation files: their cited hashes describe the pre-change
baseline, not a ban on the authorized edit. After edits use current-code
`context-run` checks; re-prepare navigation if it must describe the new revision.
The complete original semantic classifications remain mandatory; navigation is
not a replacement for the Memory Brief, source coverage or owner confirmation.

At the initial approved handoff, use a fresh authorized execution context with the checked packet, not preparer history. Model switching in the same conversation does not remove history. Verify native readiness, packet read/ack and first action; no ACK-only pause. Unsupported fresh-context capability stays LIMITED. A gap returns to preparation and the same logical task; it does not require an immortal conversation. At a safe boundary an authorized successor may continue that task, preserving its identity, candidate and spend, with the old executor inactive. Never create competing workers or rotate an in-flight effect. Orchestrator rotation retains its separate human-confirmed migration rule.

Keep durable memory separate from working input. Use the [working-selection and context-pivot protocol](memory-recall.md#working-selection-and-context-pivot) when the current selection is incomplete or wrong, not only oversized. Retrieve graph anchors for the current goal and module, then applicable contracts, negative findings, authority and exact source selectors. Archive access remains available; no whole-history export, recursive child implementation or global graph rebuild by default. Every expansion names a concrete unresolved question and stops when answered. Full logs/pins remain artifacts; return outcome, changed identities, failure evidence and next action, not repeated full manifests. Semantic obligations must not be dropped to meet a token target.

Before dispatch choose a task-class input budget and record its rationale in the existing packet/lease; no universal hard cap. Include host instructions/history/tool overhead, not only capsule bytes. If native telemetry is absent, economy is UNPROVEN, not zero. At the first action and material repair/role boundary compare actual request input with that budget. Overshoot triggers the existing safe-boundary reframe: identify inherited history, oversized outputs, unnecessary retrieval or genuinely required complexity; compact/rebind an authorized context or record a justified exception. Do not interrupt DOD work, truncate required evidence or add a timer/model check for every tool call.

Use `context-prepare measure --input usage.json` for a read-only assessment. Input `context.usage.v1` has `owner`, `taskId`, positive `maxInputTokens`, boolean `complete`, `unknownCosts`, and `samples`. Each sample has a unique request `id`, `role` (preparation/execution/review/recovery/coordination), actual `model`, `effort`, `evidence`, `inputTokens`, `cachedInputTokens`, `outputTokens`. Supply deduplicated per-request telemetry, never cumulative session totals; merge rotations without double counting. Completeness is a caller declaration. The command cannot authenticate telemetry or shrink the host context; an alert is not adoption or authority.

The migration packet retains goal/acceptance, current candidate/effects, unresolved UNKNOWN, applicable negative findings, human questions/pauses, model/fallback authority, independent reviewer, cumulative usage, remaining step and Return route. The recipient proves retrieval/application against these sources before the old context is released; a small summary alone is not coverage. Preparation may use the lowest proven capable factual model; uncertainty returns to the owner, not a cheaper invented decision. Preserve the accepted reviewer profile. A model switch alone earns no context-saving claim.

Record all roles, input/cached/output, elapsed time, retrieval and repair to accepted outcome, including preparation overhead. Cached input and reasoning output are subsets. Separate monetary cost, credit proxy and subscription allowance; concurrent activity prevents causal quota attribution. Compare a suitable retained baseline and the next real task with quality/coverage and retained behavior; without comparability, report measured size only, not percentage savings. No mandatory repeat experiment. Match the final receipt to current task/artifact; accepted installation does not establish this economy.

## Optional lifecycle adapter

`ack` also emits an inert `hooks.template.json` for one declared action. The
common command path above works without it. Installing/reviewing/trusting an
exact native definition is a separate opt-in adapter step; no global settings
are touched and no other task inherits interception. See
[Context Hook Adapter](context-hook-adapter.md) for limits and host requirements.

After an actual callback writes a source event, the authorized owner can use:

```sh
node scripts/vydykhai.mjs context-prepare bind --output prepared --owner module-owner --event prepared/hook-metadata/event-KEY.json
```

This binds only an exact observed prompt body already covered by this approved
package. A different or ambiguous body blocks until its meaning is reviewed in
the ordinary preparation path. Existing event bindings, conflict markers and
action observations remain intact. Hooks admit the host-owned action; they do
not execute it or grant permission. Tested callback transport alone does not
establish native adoption or complete live history.
