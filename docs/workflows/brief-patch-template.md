# Brief Patch Template

Use this when daily alignment finds a small change to an epic or task brief that does not require a full re-brief.

```md
## Brief Patch

Patch id: <YYYYMMDD-brief-patch-shortid>
Applies to: <epic or task issue>
Source: <meeting, packet, delta, or human request>
Status: <proposed | approved | applied>

### What Changed

- <brief wording, assumption, boundary, dependency, acceptance criterion, or task detail>

### Why

- <meeting decision, new evidence, conflict resolution, or clarification>

Intent / Approach Delta: <none | Before / Now / Why / Keep / Drop / applies to / source>
Memory Brief change: <none | added / refined / conflicted / coverage gap; source>

### Impact

- Affected tasks: <issues or none>
- Affected owners: <people or none>
- Affected contracts/entities: <items or none>

### Safe-To-Continue Guidance

- <what can continue and what must wait>

### Required Updates After Approval

- <brief, issue, task, doc, or none>
```

Rules:

- Use a Brief Patch only for small explicit changes.
- Route to `$start-work` when goal, scope, ownership, sequence, or task map changes materially.
- Do not apply the patch to durable docs or shared-tracker tasks until the human approves it.
