# Supported Context Preparation

The agent prepares a task from ordinary reviewed inputs using `context-prepare`;
the person states the desired work and makes existing semantic decisions. No
manual hash graph, test helper, provider call or hook installation is required.

## Inputs and ownership

Use `examples/context-preparation/package.json` as the input shape. All paths are
relative to the current workspace. Run from that workspace with the installed
`scripts/vydykhai.mjs` entry. Copy the example into a separate scratch workspace
to exercise it; its Candidate deliberately lacks the new case-insensitive fix.

The `context.package.v1` input declares owner, task/worker/scope/action/Candidate
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
as an immutable dependency unless that restriction is intended.

Include agreed entry/mechanism, relevant upstream and consumer boundaries,
actual runtime/test conditions and direct-human-control decisions in these
existing scoped sources/dependencies. Refresh them from observed evidence at a
material change; declaration alone is not a live observation. Never include
secret values. The caller cannot notice an unexported human correction or an
undeclared environment change, and it does not intercept arbitrary native tools.

## One ordinary path

Agent-side command sequence (replace paths/identities with the actual task):

```sh
node scripts/vydykhai.mjs context-prepare plan --input package.json --output prepared
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
Contracts and relevant code. Missing map or prior decision is a visible gap, not
permission to fabricate a complete history. Mechanical file/symbol indexes should
link existing contracts; do not create duplicate prose documentation or split
proven code solely to meet a universal line count. Update affected contracts/map
links with the owning increment; reusable semantic changes remain owner-reviewed.

Preparation is a profile for bounded evidence retrieval in an ordinary focused
Discovery context with its existing lease/Return Sync, not a new management role.
It retrieves evidence, not new product/architecture decisions. Resolve
the lowest model proven for the task class and record actual model/effort plus
fallback. Keep unresolved solution design in `DISCOVERY`. A failed check first
distinguishes missing evidence, environment failure and reasoning failure; do not
oscillate models automatically. Preserve explicit human model decisions.

The optional `navigation` object in `context.package.v1` contains `taskId`,
`worker`, a distinct `preparedBy`, `outcome`, `references`, `constraints`, `gaps`,
and owner-issued `assignment`; see [Context Routing](context-routing.md) for its initial/supplement contract and cost comparison. Each reference declares `id`, workspace-relative `path`, one-based inclusive
`startLine`/`endLine`, exact `quote`, `purpose`, `appliesTo` (`task` or
`preparation`). Each constraint has `text`, `appliesTo`, `referenceIds`.
Each gap has `text` and boolean `critical`; critical gaps block preparation.
For this route the owner declares nonempty `module.contractFiles` from the module
map/graph independently of the preparer's found-code list. Each must have a
task-wide cited quote; an omitted contract blocks. Review the complete applicable
contract, not just a keyword hit. Distinguish an unavailable source from an
available but unread source: neither proves absence of the underlying decision.
The builder checks bounds/quotes and computes file hashes. Owner review still
decides semantic coverage, correct audience and unresolved contradictions;
structural checks cannot detect a wrongly classified natural-language rule.

Only task-wide references/constraints reach `navigation.json` and worker `read`.
Preparation-only read-only restrictions do not grant or remove executor rights;
actual authority remains the current task. Real task-wide read-only rules stay.
Navigation inputs are pinned by the existing plan except declared mutable
Candidate/implementation files: their cited hashes describe the pre-change
baseline, not a ban on the authorized edit. After edits use current-code
`context-run` checks; re-prepare navigation if it must describe the new revision.
The complete original semantic classifications remain mandatory; navigation is
not a replacement for the Memory Brief, source coverage or owner confirmation.

At the initial approved handoff, launch a fresh executor with task and checked packet, not
the preparer's history. Switching models in the same conversation does not
remove that history. Verify actual host read/write readiness on the normal tool
path, then worker read/ack and first authorized action; no ACK-only pause.
An unavailable fresh-context capability is an explicit fallback, not a false
freshness claim. Later gaps go through the orchestrator to preparation and back to the same worker with retained progress. Match the final receipt to the current task/expected artifact
before routing its next action; an old successful report cannot close new work.

Record native per-role input/cached/output, elapsed time, expanded reads, review,
rescue and retained/new test results. Include preparation overhead; cached input
and reasoning output are subsets, not additional totals. Credit prices do not
prove subscription allowance multipliers; concurrent account activity prevents
causal attribution. No hidden quota-measurement pause or mandatory control arm.

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
