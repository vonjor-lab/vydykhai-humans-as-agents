# Project Memory Graph Template

Use one shared graph per project or product stream. Project State is current control memory; this graph is reusable semantic and decision memory; linked meetings, messages, tasks, PRs, and rejected candidates are episodic evidence. Use [Context Route](context-route.md) for goal-to-evidence navigation, complete relevant context and side-by-side inventory. Rebuild the graph body atomically from integrated events. Never append current meaning after the end marker or make chat history or a visualization another source of truth.

```md
<!-- vydykhai:project-memory-graph v3 -->

# Project Memory Graph: <project or stream>

Project State: <link>
Watermark: <last integrated event id / revision / date>
Declared nodes: <current node count>
Last compaction: <date / trigger / previous snapshot>
Last reflection: <event / miss class / result>
Last retrieval check: <CURRENT/NEXT/PRIOR_MISS receipt / evaluator / result>

## Anchor Index

| ID | Kind | Canonical name / real-world aliases | Scope | Source |
| --- | --- | --- | --- | --- |
| ENT-01 | <OUTCOME / ACTOR / ENTITY / SURFACE / CONTRACT / DATA / OPERATION> | <stable name; phrases people and tasks actually use> | <project / stream / boundary> | <durable source> |

## Current Memory Nodes

### MEM-01 — <short title>
- Type / status: `<INVARIANT / DECISION / LESSON / IDEA / POINTER> / <ACTIVE / PROVISIONAL / CONFLICT>`
- About: <canonical ENT anchor ids, comma-separated>
- Recall when: <capability aliases plus event, condition, task touch, or checkpoint>
- Because: <why this meaning matters to the current course>
- Apply: <one current executable statement>
- Avoid: <rejected path or none>
- Verify: <observable evidence that proves application>
- Applies / exceptions: <scope and explicit exclusions>
- Owner gate: <pending human question plus timing and plan/checkpoint relation, or none>
- Protected pointer (POINTER only): <owner | protected reference, never value | environment and scope | allowed non-destructive route | last safe check time, result, and source | expiry or re-entry condition>
- Relations: <type -> one canonical ENT or MEM id; type -> another id, or none>
- Source / checked: <durable evidence link / date or result>

## Pending Memory Events

Every material task return, meeting decision, correction, detour, recall request, or acceptance is classified as one semantic event or `NO_CHANGE`. Only a semantic event enters Pending Memory Events and advances the graph watermark; `NO_CHANGE` remains a source receipt and routine control events never rewrite Graph. Events remain pending until the graph and affected owning control records are rebuilt and read back.

| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <task / meeting / acceptance / correction> | <compact delta> | <ENT ids / unresolved terms> | <NONE / ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS> | <ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT / NO_CHANGE> | <durable link> | <PENDING / INTEGRATED / NEEDS_HUMAN> |

## Live Retrieval Probes

Coverage is current only when fresh actors can reconstruct executable meaning from ordinary language. Start a candidate with 3-4 cheap unhinted real-task probes before any broad evaluation; a miss blocks promotion and becomes the targeted regression. Keep exactly one current active-work probe, one immediate-next probe, and the latest proven miss; replace them as work changes and retain older receipts as linked evidence.

| Slot | Raw trigger | Expected executable action or gate | Observed brief / evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
| CURRENT | <ordinary language for current work> | <Apply / Avoid / Verify or BLOCKED> | <brief> | <PASS / MISS / date> | <source> |
| NEXT | <ordinary language for immediate next work> | <...> | <...> | <...> | <...> |
| PRIOR_MISS | <latest representative miss language> | <...> | <...> | <...> | <source> |

## Legacy Source Map

| Previous id or artifact | Current node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
| <Intent Trail / Idea Memory / task / decision source> | <MEM ids> | <covered / superseded / evidence only / ambiguous> | <ordinary future-work query and expected result/gate> |

<!-- vydykhai:project-memory-graph:end -->
```

Rules (structural checks do not prove semantic coverage):

- Canonical labels may be plain, `**Apply:**` or `**Apply**:`; emphasis does not create a different field or hide duplicates. Legacy labels such as `Current meaning` need reviewed reconciliation into the canonical fields, not guessed aliases or automatic rewriting. Fixing presentation alone does not establish semantic coverage.
- Anchors give stable identity to outcomes, actors, product entities, surfaces, contracts, data, and operations. Their aliases are words a human or task will actually use, not only historical memory ids. Reuse one anchor across synonyms.
- Keep one reusable current meaning per node. `INVARIANT` is a durable boundary; `DECISION` is a current choice; `LESSON` is reusable cause or failed-path learning; `IDEA` is valuable but outside the nearest DOD; `POINTER` locates protected operational knowledge without copying it.
- A human request to remember, revisit, return after a detour, or discuss something before later work is a recall commitment. Preserve current meaning, source, capability aliases/trigger, applicability/timing/checkpoint, and the pending human question. Link its return gate in Project State; never resolve uncertain timing for the human.
- Current meaning and evidence stay separate. Update `Apply`, `Avoid`, `Verify`, scope, relations, and provenance; link chronology instead of copying it. Use `supersedes` rather than leaving competing current rules. Prefer one typed relation per semicolon-delimited item; existing comma-separated target lists remain valid when every target resolves.
- Task contexts never rewrite shared memory. The orchestrator integrates unseen durable events after rereading the watermark, recomputes on concurrent change, and atomically rebuilds the body. Node count, watermark, pending events, probes, start marker, and end marker must agree before publication.
- On cold-path work, resolve exact anchors and aliases, intersect open commitments/checkpoints first, traverse relevant relations until the applicable goal, contract, decision and consumer context is complete, and filter by authority, status, scope, applicability, and supersession. Return complete applicable `Because / Apply / Avoid / Verify / Source` items. Raise `MEMORY_COVERAGE_GAP` when required meaning is unproven.
- A correction, repeated owner explanation, missed return condition, or forgotten prior direction triggers Memory Reflection before apology or patch: `Before / Now / Why / scope`, related anchors, `ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS`, smallest repair, retrieval replay, and impact on active/queued work.
- Acceptance records every brief item as applied, missed, contradicted, or not exercised. A miss replaces `PRIOR_MISS`; dispatch replaces `CURRENT` and `NEXT`. Graph coverage expires when these slots do not represent current work, even if historical evaluations passed.
- Compact at a milestone, rotation, duplicate cluster, retrieval miss, or loss of scanability. Preserve stable ids, aliases, current meaning, typed relations, old-id mapping, and immutable evidence. A recall commitment survives only when ordinary language returns its concrete meaning, source, return condition, and human gate.
- Never store credentials, private payloads, production data, or recovery values. A protected `POINTER` records owner, protected reference without value, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry/re-entry condition. Otherwise return `MEMORY_COVERAGE_GAP / BLOCKED` before history search, secret request, or live action. Historical reconstruction may repair the node but is not a successful current-memory lookup; pointer probes require zero secret read.
- Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` before activation, schema cutover, or orchestrator rotation. Migrate from older schemas through a side-by-side read-only candidate, natural-first probes, targeted regression, visible loss/conflict delta, human confirmation, and retained rollback source.
