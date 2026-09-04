# Project Memory Graph Template

Use one shared graph per project or product stream. Project State is current control memory; this graph is reusable semantic and decision memory; linked briefs, meetings, messages, tasks, PRs, code, and accepted artifacts are episodic evidence. Use [Context Route](context-route.md) for goal-to-evidence navigation and [Module Contract](module-contract-template.md) for the current purpose, interfaces, algorithm, and verification of durable modules and capabilities.

Graph v4 separates a stable entity map from atomic current meaning. The entity map answers what this thing is, where it belongs, what it consumes or produces, and what depends on it. Memory nodes answer what is currently required, decided, learned, promised, or safely locatable about those entities. Do not turn an entity anchor into a long knowledge document or copy raw history into current memory.

Build an existing project's v4 Candidate beside its accepted graph. Graph v3 remains readable during migration. Cut over only after source coverage, natural retrieval, task-application, and update replay pass. Rebuild the graph body atomically from integrated events. Never append current meaning after the end marker or make chat history, module documentation, or a visualization another competing memory graph.

```md
<!-- vydykhai:project-memory-graph v4 -->

# Project Memory Graph: <project or stream>

Project State: <link>
Operating Brief: <link and accepted revision>
Source ledger: <durable location or this graph's Source Coverage Ledger>
Watermark: <last integrated event id / revision / date>
Declared anchors: <current anchor count>
Declared routes: <current entity-route count>
Declared nodes: <current node count>
Last compaction: <date / trigger / previous snapshot>
Last reflection: <event / miss class / result>
Last retrieval check: <CURRENT/NEXT/CROSS_DOMAIN/PRIOR_MISS receipt / evaluator / result>

## Anchor Index

| ID | Kind | Canonical name / real-world aliases | Scope / identity | Documentation / implementation | Source / checked |
| --- | --- | --- | --- | --- | --- |
| ENT-01 | <OUTCOME / ACTOR / JOURNEY / MODULE / CAPABILITY / ENTITY / SURFACE / CONTRACT / DATA / ARTIFACT / SYSTEM / OPERATION> | <stable name; phrases people, tasks, UI, and code actually use> | <what this identity includes and excludes> | <for MODULE/CAPABILITY: contract: path-or-link; implementation: paths/services; otherwise accepted artifact or NOT_REQUIRED: reason> | <durable source / date or revision> |

## Entity Routes

| From | Relation | To | Applies / qualification | Source / checked |
| --- | --- | --- | --- | --- |
| <ENT id> | <part-of / serves / produces / consumes / depends-on / stored-in / constrains> | <ENT id> | <scope, direction, and material qualification> | <durable source / date or revision> |

## Current Memory Nodes

### MEM-01 - <short atomic title>
- Type / status: `<INVARIANT / REQUIREMENT / DECISION / LESSON / COMMITMENT / IDEA / POINTER> / <ACTIVE / PROVISIONAL / CONFLICT>`
- About: <one or more canonical ENT anchor ids>
- Recall when: <ordinary aliases plus event, task touch, condition, or checkpoint>
- Because: <why this one meaning matters to the current course>
- Apply: <one current independently applicable statement>
- Avoid: <rejected path or none>
- Verify: <observable evidence that proves application>
- Applies / exceptions: <scope and explicit exclusions>
- Owner gate: <owner and pending human decision, or none>
- Return / close when: <COMMITMENT trigger, checkpoint, closure evidence, and owner; otherwise NOT_REQUIRED>
- Protected pointer (POINTER only): <owner | protected reference, never value | environment and scope | allowed non-destructive route | last safe check time, result, and source | expiry or re-entry condition>
- Relations: <type -> one canonical ENT or MEM id; type -> another id, or none>
- Source / checked: <durable evidence link / date or result>

## Source Coverage Ledger

Process a source range once, then revisit only a changed revision or a declared gap. User corrections and participant decisions are sources, not model narration. Later evidence may supersede earlier meaning but never erases its provenance.

| Source / participant | Range / revision | Anchors | Current nodes | Coverage | Gap / supersession | Checked |
| --- | --- | --- | --- | --- | --- | --- |
| <brief / dialogue / meeting / task / PR / code / artifact / participant packet> | <bounded range or exact revision> | <ENT ids> | <MEM ids or none> | <COVERED / PARTIAL / CONFLICT / UNAVAILABLE / EVIDENCE_ONLY> | <exact missing source, conflict, or superseding node; none when covered> | <actor / date / receipt> |

## Pending Memory Events

Every material task return, meeting decision, correction, detour, recall request, or acceptance is classified as one semantic event or `NO_CHANGE`. Only a semantic event enters Pending Memory Events and advances the graph watermark; `NO_CHANGE` remains a source receipt and routine control events never rewrite Graph. Events remain pending until any required task-owned Module Contract update is present in the accepted Candidate and the graph plus owning control records are rebuilt and read back.

| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <task / meeting / acceptance / correction> | <compact delta> | <ENT ids / unresolved terms> | <NONE / ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS> | <ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT / NO_CHANGE> | <durable link> | <PENDING / INTEGRATED / NEEDS_HUMAN> |

## Live Retrieval Probes

Coverage is current only when fresh actors can reconstruct executable meaning from ordinary language and carry it through a task. Start a Candidate with cheap unhinted real-task probes before any broad evaluation; a miss blocks promotion and becomes the targeted regression. Keep exactly one current active-work probe, one immediate-next probe, one cross-domain consumer probe, and the latest proven miss. Replace them as work changes and retain older receipts as linked evidence.

| Slot | Raw trigger | Expected route and executable action or gate | Observed brief / application evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
| CURRENT | <ordinary language for current work> | <vertical route plus Apply / Avoid / Verify or BLOCKED> | <brief and task evidence> | <PASS / MISS / date> | <source> |
| NEXT | <ordinary language for immediate next work> | <...> | <...> | <...> | <...> |
| CROSS_DOMAIN | <ordinary request touching one entity whose consumers cross modules or systems> | <parent purpose, dependencies, consumers, commitments, docs, and verification> | <brief and task evidence> | <...> | <...> |
| PRIOR_MISS | <latest representative miss language> | <...> | <...> | <...> | <source> |

## Legacy Source Map

| Previous id or artifact | Current anchor/node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
| <Graph v3 / Intent Trail / Idea Memory / task / decision source> | <ENT/MEM ids> | <covered / superseded / evidence only / ambiguous> | <ordinary future-work query and expected result/gate> |

<!-- vydykhai:project-memory-graph:end -->
```

Rules (structural checks do not prove semantic coverage):

- Anchors are navigation addresses, not prose containers. Use one stable identity across human terms, UI labels, code names, and historical aliases. `JOURNEY`, `MODULE`, and `CAPABILITY` create the goal-to-implementation spine; `ENTITY`, `CONTRACT`, `DATA`, `ARTIFACT`, `SYSTEM`, and `OPERATION` describe inputs, outputs, persistence, integrations, and execution boundaries. Do not create a new kind when one of these plus a typed relation expresses the meaning.
- Keep one canonical direction for each entity route and traverse it in both directions. `part-of` expresses composition; `serves` connects work to an outcome or journey; `produces` and `consumes` express artifact/data flow; `depends-on` expresses a prerequisite; `stored-in` locates durable state; `constrains` carries a mandatory boundary. Do not add inverse duplicates such as `used-by`.
- Every non-actor anchor must connect to an `OUTCOME` through entity routes. Every anchor must participate in a route or current node. A disconnected anchor is not retrievable project memory.
- Every durable `MODULE` and `CAPABILITY` anchor uses `contract: <path-or-link>; implementation: <paths/services>` to link a current Module Contract and exact implementation boundary. A helper, file, or temporary experiment that has no durable behavior, decisions, consumers, or independent documentation need not become an anchor.
- A node contains one independently applicable, verifiable, and supersedable meaning. If one clause can change without changing the rest, split it. `INVARIANT` is a durable boundary; `REQUIREMENT` is a demanded behavior; `DECISION` is a current choice; `LESSON` preserves reusable cause or failed-path learning; `COMMITMENT` is an unresolved promise to return; `IDEA` is valuable but outside the nearest DOD; `POINTER` safely locates operational knowledge without copying it.
- A `COMMITMENT` is never an orphan note. It names affected entities, ordinary recall aliases, owner or decision gate, exact return/checkpoint condition, closure evidence, source, and current status. Intersect commitments before topical ranking so a lower lexical match cannot hide a required return.
- Current meaning and evidence stay separate. Update `Apply`, `Avoid`, `Verify`, scope, relations, and provenance; link chronology instead of copying it. Use `supersedes` rather than leaving competing current rules. Prefer one typed relation per semicolon-delimited item; existing comma-separated target lists remain readable during v3 migration when every target resolves.
- Task contexts never rewrite shared memory. When accepted behavior changes, the owning task updates affected project-owned Module Contracts in the same Candidate and returns source-backed graph candidates plus exact documentation impact. The orchestrator integrates unseen durable events after rereading the watermark, recomputes on concurrent change, and atomically rebuilds only the shared graph. It never edits product code or Module Contracts. Node/anchor/route counts, watermark, source ledger, pending events, probes, start marker, and end marker must agree before publication.
- On cold-path work, resolve exact anchors and aliases, intersect open commitments/checkpoints, traverse the vertical spine and applicable cross-domain routes, then filter by authority, status, scope, applicability, and supersession. Read linked Module Contracts before current code. Return complete applicable `Because / Apply / Avoid / Verify / Source` items plus documentation/code evidence. Raise `MEMORY_COVERAGE_GAP` when required meaning or documentation is missing, stale, or contradicted.
- Use bounded Discovery when a required route, accepted artifact, module contract, source qualification, or current implementation cannot be established; when several modules/systems are affected; or when the request is to recover previous behavior. The graph supplies the search map. Discovery reads only linked source ranges plus the exact gaps it uncovers, then returns repaired understanding before implementation.
- A correction, repeated owner explanation, missed return condition, or forgotten prior direction triggers Memory Reflection before apology or patch: `Before / Now / Why / scope`, related anchors, `ABSENT / RETRIEVAL_MISS / APPLICATION_MISS / VERIFICATION_MISS`, smallest repair, retrieval replay, and impact on active/queued work.
- Acceptance records every brief item as applied, missed, contradicted, or not exercised; checks documentation impact; and links observed behavior back to outcome, affected entities, accepted artifact, and current code revision. A miss replaces `PRIOR_MISS`; dispatch replaces `CURRENT` and `NEXT`; a cross-module change refreshes `CROSS_DOMAIN`.
- Compact at a milestone, rotation, duplicate cluster, retrieval miss, or loss of scanability. Preserve stable ids, aliases, entity routes, current meaning, typed relations, source coverage, old-id mapping, and immutable evidence. Compaction may reorganize; it cannot silently merge independently changeable meanings.
- Never store credentials, private payloads, production data, or recovery values. A protected `POINTER` records owner, protected reference without value, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry/re-entry condition. Otherwise return `MEMORY_COVERAGE_GAP / BLOCKED` before history search, secret request, or live action.
- Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` before activation, graph cutover, or orchestrator rotation. Graph v3 remains compatible evidence during migration but does not prove v4 entity routing, documentation coverage, source coverage, or cross-domain retrieval. Promote v4 only through side-by-side inventory, natural probes, source-to-task application replay, visible loss/conflict delta, human confirmation, and retained rollback source.
