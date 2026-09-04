# Vydykhai Workflows

These environment-neutral workflows are conditional references for the repo-scoped skills under `.agents/skills`. The canonical operating core is `docs/FRAMEWORK.md`; optional adapter metadata does not change skill behavior.

## Human Interface

People normally stay in a personal Framework Orchestrator context and speak naturally:

```text
Start this project.
Continue this stream.
Process the latest meeting.
Check the work and continue.
```

The orchestrator selects the required skill and workflow.

## Workflows

- `project-launch.md`: prove project readiness, connect shared sync and participants, then activate Project State, compass, and first DOD.
- `project-guard.md`: run the project-owned event and schedule safety check outside the active orchestrator context.
- `framework-orchestrator.md`: restore state, dispatch, supervise, recover, rotate, and choose next-best-action.
- `start-work.md`: turn a raw or changed topic into an epic brief and minimum task contracts.
- `context-route.md`: connect goals, inherited decisions and affected consumers to each task; inventory existing memory without losing evidence.
- `memory-brief-envelope.md`: preserve indivisible ordered clauses or repeated rows through dispatch and prove item-level application.
- `daily-alignment.md`: reconcile meeting/event/local deltas across participants.
- `accept-work.md`: accept work against current intent and exact-current-code evidence.

## Durable Artifacts

- `project-state-template.md`: compact current dashboard for the DOD line, execution leases, pending returns, detours, and next action.
- `project-memory-graph-template.md`: stable anchors, reusable meaning, pending memory events, typed relations, and live current/next/prior-miss retrieval probes.
- `idea-memory-template.md`: compatibility input for projects migrating older Idea Memory into the graph.
- `intent-trail-template.md`: compatibility input for projects migrating an older Intent Trail into the graph.
- `alignment-issue-template.md`: one meeting, milestone, or compact work window.
- `local-alignment-packet.md`: one participant's material local delta.
- `team-alignment-delta.md`: reconciled shared guidance.
- `brief-patch-template.md`: small approved compass/brief change.
- `task-context-handoff-template.md`: minimum executable task contract.

## Framework Tooling

```text
node scripts/vydykhai.mjs doctor
node scripts/vydykhai.mjs control-check --state <project-state-body> --graph <memory-graph-body> [--expect-state-sha <candidate-sha256>]
node scripts/vydykhai.mjs guard-check --state <project-state-body> --graph <memory-graph-body> --outbox <durable-outbox-export> [--accepted-incident <semantic-id>]
node scripts/vydykhai.mjs memory-brief-compile --input <brief-input.json>
node scripts/vydykhai.mjs memory-brief-validate --envelope <brief-envelope.json> --receipt <application-receipt.json>
node scripts/vydykhai.mjs update
```

Use project-specific instructions outside framework-managed files.
