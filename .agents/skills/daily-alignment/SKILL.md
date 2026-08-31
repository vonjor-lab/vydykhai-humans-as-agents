---
name: daily-alignment
description: Use only in an orchestrator context to reconcile a meaningful meeting or external coordination event that materially changes another participant's safe next action. Do not use for task-local failures, routine progress, urgency, a Return Sync with no cross-person impact, or ordinary resume/continue.
---

# Daily Alignment

Reconcile asynchronous human and agent work without requiring simultaneous availability.

## Read

1. `AGENTS.md`
2. `docs/FRAMEWORK.md`
3. `docs/workflows/daily-alignment.md`

Load packet, delta, dashboard, and brief-patch templates only when writing them.

## Contract

- Verify the Shared Sync Contract and relevant source route before claiming coverage. Use direct access for each relevant orchestrator or one named intake owner whose accessible source becomes an approved traceable shared delta. If neither route or the repo/tracker is available, mark `SYNC_LIMITED` and name the affected boundary.
- Treat meeting recordings, transcripts, chat, and notes as raw inputs; Fathom, Read AI, tl;dv, another recorder, or an approved manual source are equivalent once accessible.
- Identify the meeting/event scope, expected participants, affected tasks/contracts, active Alignment Window, and latest delta.
- Apply source precedence; a current human correction supersedes an old task-context plan.
- Classify optional future ideas as `IDEA` candidates. Capture meaningful intent, invariants, «do it differently» changes, and reusable failed-path lessons with Before/Now/Why/Keep/Drop/anchors/source even when DOD is unchanged. A correction or repeated owner explanation triggers orchestrator-owned Memory Reflection and `ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS`; inferred wider applicability stays `PROVISIONAL` until echoed.
- Publish this participant's Local Alignment Packet only when meeting or local state materially changes shared work.
- Never overwrite or invent another participant's packet or uncommitted state.
- Reconcile the packets that matter and list missing participants explicitly.
- Let unrelated work continue. Use cautions or wait only for overlapping surfaces, contracts, decisions, or sequence.
- Publish a Team Alignment Delta when several packets need reconciliation or shared guidance changes.
- Rebuild the Alignment Window body in the same operation as the delta.
- Update the participant registry with orchestrator context link, installed framework version, resolved orchestrator profile/check date, latest packet, active task, and status.
- Create a Brief Patch for a small approved change; route material goal, scope, sequence, ownership, or task-map changes to `$start-work`.
- Intersect the delta with active, queued, and paused tasks. Do not wake an unaffected task. Send an affected active task only `what changed / applies to / preserved / action`: a compatible patch lets it continue, while an invalidating change pauses only the affected boundary for `PATCH_REQUIRED` or `REBRIEF_REQUIRED`. Tasks never process raw meeting or alignment inputs.
- Mark affected queued or paused tasks `PATCH_REQUIRED` or `REBRIEF_REQUIRED`; do not mutate scope silently or treat age alone as a scope change.
- Rotate and archive the Alignment Window after a milestone or when it is no longer quickly scannable.
- Update the DOD Control Line, affected Execution Leases and detour/recall return gates, tracker projection, and next-best-action. Put each material reusable delta or `NO_CHANGE` in Pending Memory Events before advancing the graph watermark; rerun affected retrieval and rebuild current views atomically without secret values.

## Finish

Return `CONTINUE`, `CONTINUE_WITH_CAUTIONS`, `WAIT`, or `BLOCKED`, with sync readiness, links to the active window, packet/delta, missing inputs, and exact next action.
