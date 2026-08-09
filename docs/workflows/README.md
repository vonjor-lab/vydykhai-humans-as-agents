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

- `project-launch.md`: activate the project, Project State, participants, compass, and DOD.
- `framework-orchestrator.md`: restore state, dispatch, supervise, recover, rotate, and choose next-best-action.
- `start-work.md`: turn a raw or changed topic into an epic brief and minimum task contracts.
- `daily-alignment.md`: reconcile meeting/event/local deltas across participants.
- `accept-work.md`: accept work against current intent and exact-current-code evidence.

## Durable Artifacts

- `project-state-template.md`: compact current project/stream dashboard.
- `project-memory-graph-template.md`: one compact active memory for decisions, ideas, lessons, and safe operational pointers.
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
node scripts/vydykhai.mjs update
```

Use project-specific instructions outside framework-managed files.
