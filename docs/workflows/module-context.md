# Module-Bound Context Packages

This is the executable declaration for the [Module Delivery Cycle](module-delivery.md), not a second module registry. Project maps/contracts are authoritative; the orchestrator selects their relevant boundaries into the existing reviewed task package.

## Shape

New prepared implementation tasks use `context.package.v2`: the v1 fields plus mandatory `navigation` and `moduleAccess`. Research that is supposed to resolve unknown boundaries does not require this implementation package first. Existing v1 packets remain readable; their receipts report module access as unchecked.

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
