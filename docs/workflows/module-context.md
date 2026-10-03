# Module-Bound Context Packages

This is the executable declaration for the [Module Delivery Cycle](module-delivery.md), not a second module registry. Project maps/contracts are authoritative; the orchestrator selects their relevant boundaries into the existing reviewed task package.

## Shape

New prepared implementation tasks use `context.package.v3`: the v2 fields (`navigation` and `moduleAccess`) plus the source-bound `alignment` below. Research that is supposed to resolve unknown boundaries does not require this implementation package first. Existing v1/v2 packets remain readable; v1 reports module access unchecked, and both report alignment unchecked. Adopt only at a safe rebrief, not by restarting current workers.

Example addition to the package (hashes are generated from actual files, not these illustrative values):

```json
{
  "schema": "context.package.v2",
  "moduleAccess": {
    "schema": "context.module-access.v1",
    "modules": [
      {
        "id": "aggregate",
        "intent": "create",
        "contractFiles": ["docs/aggregate-public.md"],
        "privatePaths": ["src/aggregate", "tests/aggregate"],
        "release": null
      },
      {
        "id": "layout",
        "intent": "consume",
        "contractFiles": ["docs/layout-public.md"],
        "privatePaths": ["src/layout"],
        "release": {
          "artifact": {"path": "releases/layout.bin", "sha256": "<actual sha256>"},
          "connection": {"path": "evidence/layout-connection.json", "sha256": "<actual sha256>"}
        }
      }
    ]
  }
}
```

The example is an excerpt, not a complete runnable package. The existing package supplies task, module, sources, dependencies, classifications, sharedArtifacts, owner and navigation.

## Goal And Necessity Before Implementation

The orchestrator selects the accepted goal, applicable platform invariants, current public mechanisms and combined consumer acceptance from the existing brief/graph/contracts. Do not derive requirements solely from the chosen implementation or the requested screen. Keep deferrals and their owner/return gates in the existing classified source memory; a future platform improvement is neither permission to expand today's task nor cancellation of today's invariants.

The v3 `alignment` fields are:

- `goalRef`, nonempty `invariantRefs`, `acceptanceRef`: task-wide navigation reference ids containing the goal, applicable architecture constraints and combined input-to-output/consumer test. References must resolve to actual source quotations outside mutable Candidate files.
- `decisions`: exactly one per declared module, each `{moduleId,boundaryChange,gapRef,existingRef,rationale}`. `existingRef` identifies the usable existing public mechanism or evidenced absence. For change/create, `gapRef` identifies the unmet requirement and observed gap; rationale explains why the existing mechanism cannot suffice and why this is the smallest adequate increment. Consume has no gap and `boundaryChange: false`; create always has `boundaryChange: true`. Internal fixes may keep the boundary unchanged.
- `review`: null for an unchanged-boundary correction or a pinned `{path,sha256}` review. Any new/changed public boundary requires a separate existing REVIEW perspective before implementation. It judges the **necessity and fit of the solution**, not just whether the chosen implementation passes. It must consider the simpler existing route and required security/storage/ownership guarantees. A supported security gap is a reason to change, not "unnecessary architecture". Human direction and accepted deferral gates remain authoritative.

Without a required review, `context-prepare plan` returns `ALIGNMENT_REVIEW_REQUIRED` with the exact review basis and its digest, before commands or approval. Review that basis plus its public sources in a fresh bounded context, without the executor's defense/history. The review is `{schema: "context.alignment-review.v1",basisSha256,reviewer,decision,reason}`. Only `decision: "fit"` proceeds; name a reviewer distinct from orchestrator/worker/preparer. A request for revision routes one scoped rebrief, not repeated self-certification or a new architecture program. Review is not a new grant of user authority.

The builder resolves the facts, pins the review, delivers only the decision/reference view to the worker and binds acknowledgment. Full review basis stays in the artifact, not duplicated over existing navigation quotations in the worker prompt. The runner rechecks it before supported actions and acceptance; changed facts or scope invalidate approval. Unchanged continuation reuses the same review, with no new model call. A preparation supplement cannot quietly change these decisions; use the existing explicit rebrief. No extra command or reviewer for every tool call.

Receipts report `REVIEW_BOUND`, `UNCHANGED_BOUNDARIES_DECLARED` or `LEGACY_UNCHECKED`. A reviewer name/hash cannot authenticate a separate person/context or establish semantic truth. These checks make omitted evidence and stale approval detectable within the supported path; they do not reason about undeclared dependencies or police arbitrary native tools. Live adoption requires one actual worker readback plus a source-to-task-to-Return replay. Do not label installation alone as enforced architecture leadership.

## Meaning And Checks

- `module.publicBoundary` names a change/create entry owning the task outcome. Integrating existing modules changes/creates consumer wiring, not the consumed module.
- Each entry selects its intent, public contract files and owned implementation roots/files from the reviewed map. Paths are normalized workspace-relative paths, not glob patterns. Different module ownership roots cannot overlap. A consumed service with no local implementation may have empty privatePaths; do not invent local source paths.
- Every declared Candidate file and implementation file belongs to a change/create entry, either its private paths or its contract files. Consumed code, public contracts, artifacts and connection receipts are immutable for this task.
- Every selected contract is in `module.contractFiles` and has a task-wide navigation reference. The preparer cannot choose coverage solely from the files it happened to find.
- Consumption requires a fixed artifact and a pinned independent connection receipt. Both are relevant immutable `dependencies`. The owner reviews their actual applicability, accepted status and scope; nonempty hashes do not prove semantic adequacy.
- Navigation, event sources and shared meaning cannot read consumed private paths or quote a released executable, even for preparation-only context. A declared release may be hashed and executed without putting its bytes in model context.
- The builder checks before confirmation; the approved plan pins the declaration. `context-run` checks immutable releases at preparation, preflight, execution and acceptance, including after a dependent action. Unexpected mutation after an action is an uncertain outcome requiring reconciliation, never automatic replay.
- Worker readback delivers the same moduleAccess declaration and its digest alongside the scoped memory/navigation packet; acknowledgment is bound to that delivery. A supplement cannot remove or change these boundaries: that needs a reviewed rebrief, not an unnoticed context refresh.
- The receipt's `coverageBasis.moduleAccess` is `DECLARED_BOUNDARIES` for this route or `LEGACY_UNCHECKED` without it. Neither label means product acceptance. Acceptance still needs the whole promised behavior and independent consumer proof.

## Limits And Adoption

These are checks on declared paths and the supported caller, not an OS sandbox or a mechanism that understands arbitrary source contents. They cannot detect a copied source hidden in an unrelated text file, an omitted module, fabricated evidence, arbitrary native reads/edits, external provider drift or an undeclared runtime dependency. An approved child process inherits host filesystem/network permissions; the runner reports `processIsolation: NOT_ENFORCED`. The negative-control test deliberately reads a harmless external fixture to preserve that distinction. Review completeness against the map and evidence; do not call missing enforcement active.

For a remote service, bind an observed version/identity receipt as the artifact and retain its real consumer proof; the file hash does not establish remote availability or prevent remote changes. Verify the relevant live revision before use.

At framework activation, read back the actual worker kit and route. Reuse existing mapping/contract evidence; where absent retain one owned preparation step with a safe checkpoint under the existing activation workflow. Migrate a qualifying worker only at a safe rebrief, preserve Candidate and obligations, and exercise a public-only connection plus a rejected private-read case before claiming adoption. Do not automatically rebuild memory, refactor product code, restart workers or add Guard jobs.

An old harness must not receive v2 and be described as ready: use its accepted legacy path with the limitation explicit until a supported update/readback. A missing boundary or connection proof routes the existing scoped preparation/Discovery/packaging task, not a global project stop.
