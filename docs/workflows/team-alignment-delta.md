# Team Alignment Delta

Publish when several packets require reconciliation or shared guidance changes.

```md
<!-- vydykhai:team-delta v1
delta_id: <stable id>
supersedes: <id or none>
covered_packets: <ids>
pending_participants_or_packets: <names/ids or none>
created_at: <ISO timestamp>
-->

## Team Alignment Delta

Status: <READY | READY_WITH_CAUTIONS | WAITING | BLOCKED>
Scope:
Shared Sync / source coverage: <READY | SYNC_LIMITED, with gaps>
Covered packets:
Pending participants/packets:
Applicable shared artifacts / revisions:
Participant contribution / integration and retrieval / application receipts:

### What Changed

- <decision or material event>
- Intent / Approach Delta: <none | confirmed/provisional pivot or rule and durable destination>
- Memory candidates: <NO_MEMORY_DELTA | integrated/pending graph candidates and source>

### Cross-Work Impact

- <task, owner, surface, contract, or DOD impact>

### Brief / Task Updates

- <patch, re-brief, issue update, or none>

### Safe Continuation

- <boundary>

### Next Trigger

- <packet, decision, checkpoint, merge, or none>
```

In the same operation, rebuild the Alignment Window body and update Project State. Missing participants block only overlapping work.

## Sync Proof

Use an export of the existing participant registry, source ledger, accepted shared artifacts and participant receipts as `readiness.teamSync` in Capability adoption. Pass the same readiness export to `adoption-plan --input <snapshot.json> --json`; it remains read-only. This is proof metadata, not a new ledger, transport or background service.

- `scope`: matches capability readiness scope; `registrySource`: independently reviewed reference identifying the affected participants. Do not derive the expected set from whoever happened to answer. A single-person project still names its one participant.
- `artifacts`: `{id,revision,source}` for applicable graph sections, code/module maps, contracts, design guidance or shared procedural rules. Use scoped meaning/content identities, not the global graph watermark. All referenced sources must be accessible through the agreed shared route.
- `participants`: `{id,sourceRange,artifacts:[id]}`. Source range bounds the participant's relevant new knowledge; artifact ids name what their next affected work must use. Recheck this applicability at changed scope, not each tool call.
- `receipts`: one per participant, with `participant`, `contribution` and `readback`. Contribution is `{disposition: DELTA|NO_CHANGE,sourceRange,artifacts:[{id,revision}],evidence,integration?}`. A DELTA requires the actual shared integration/readback reference; NO_CHANGE requires source-backed review, never silence. Unavailable/conflicting contributions stay pending.
- Readback is `{artifacts:[{id,revision}],evidence,retrieval,application}` from that participant's own environment. It identifies the current applicable artifacts, an ordinary retrieval question/result and its application to the next task or bounded no-mutation rehearsal. A link to the sent packet or generic acknowledgment is insufficient.

The deterministic check requires matching participant/source ranges, artifact identities and both directions of evidence. Missing, stale or unintegrated evidence yields MISSING/PENDING and `RECONCILE_TEAM_SYNC`, or reuses the existing owner/wait. It never edits artifacts, overwrites remote work, grants refactoring authority or certifies a teammate from another environment. It compares **declared receipts only**: the orchestrator must verify their real contents and provenance. CURRENT is not proof of semantic correctness, identity authentication or whole-team scope completeness. A claimed accepted capability with pending sync is rejected from 1.34.1; old records remain explicitly unchecked until safe adoption.

No extra standing role or model call is needed for unchanged proof. Use the existing orchestration/maintenance owner to collect missing evidence, settle conflicts and update task constraints. Keep a named checkpoint for a returning participant, preserve explicit pauses and continue independent work. A changed source, rule or new affected participant reopens only the relevant receipt, not everyone's full history.
