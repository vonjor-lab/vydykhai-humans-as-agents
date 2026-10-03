# Memory Retention And Storage

One logical Project Memory Graph does not mean one issue body or one model prompt. Preserve useful meaning and its history; there is no framework-wide byte, node or hop target. Retrieve only applicable routes into task context. The orchestrator owns semantic integration; an existing maintenance task may prepare a lossless storage move. No new service, permanent role or timer is required.

## Update Meaning, Not Copies

Before accepting a delta, resolve stable entities, aliases, applicable decisions, commitments and source precedence through the graph and its linked evidence. Compare all materially related assertions, including pending deltas. Reuse the same entity and assertion id for a refinement of the same meaning; do not append a second current copy to preserve a chat transcript. Record the old revision, source, why and scope in immutable linked history. A separately applicable new requirement needs its own atomic node, not an overloaded entity paragraph.

Use REFINE for compatible clarification, SUPERSEDE for an authorized replacement, ADD for genuinely new meaning and NO_CHANGE for evidence already represented. Do not merge contradictions by wording them vaguely or silently applying latest-write-wins: keep the conflict and its affected scope visible, resolve authority with the decision owner, and preserve the former rule and source. Dedupe by meaning, applicability and source, not spelling alone. Tasks propose deltas; the orchestrator reviews and integrates them. Structural uniqueness checks cannot decide semantic equivalence.

## Write Boundary

1. Re-read the accepted graph identity/watermark and unseen deltas. Build one candidate from that baseline. Preserve rollback bytes and source-backed revision history. A concurrent change requires reconciliation, not overwriting another participant's work.
2. Check the actual storage provider's limit and counting unit before the write. `memory-storage plan` compares the complete candidate with that physical limit; its growth reserve is the larger of this delta and one current memory record, not a size target. Unknown capacity is reported, not guessed from another provider. No meaning may be dropped to make the write fit.
3. On expansion due or write refusal, retain the full delta durably in the existing source/outbox, including its entities, baseline, owner and return checkpoint. Link that pending delta from the existing control route and show one plain notice: "A storage document is full. The new decision is preserved but is not yet in shared memory. I will move the storage without shortening the history, verify retrieval, then finish this update." Name affected work and the next action. Update the same notice/obligation; do not create repeated incidents or model wakeups.
4. Move to approved versioned storage with room to grow, or create a multipart candidate below. If storage or access authority changes, get that decision first; do not expose private history to another backend. A physical move within already authorized storage needs no new product refactor. Preserve independent work. An affected task may use the existing reviewed owner/task-local overlay; other dependent tasks wait for shared integration, not for the whole project.
5. Validate structure and reviewed semantic changes, publish with the current-baseline guard, then read back the actual stored bytes, references and retrieval route. Only then advance the accepted watermark and mark the delta integrated. Failed, truncated or uncertain writes, a local file or a send acknowledgment are not shared readback. Preserve the old active pointer until the replacement is verified. Close the pending obligation after an ordinary affected query retrieves and applies the updated meaning.

Capacity and write failures are product-visible memory limitations, not a normal omission or a hidden optimization. Do not claim "remembered" merely because the conversation still contains the words. A storage fix does not itself prove that all historical knowledge was recovered.

## Lossless Multipart Candidate

Use agent-owned commands; the person should not need to run them:

```sh
node scripts/vydykhai.mjs memory-storage plan --input graph.md --candidate next-graph.md --limit 262144 --unit utf8-bytes
node scripts/vydykhai.mjs memory-storage pack --input next-graph.md --output memory-candidate --part-bytes 65536
node scripts/vydykhai.mjs control-check --state state.md --graph memory-candidate/graph.json --json
```

Numbers above are examples, not a claim about any provider. Units are `utf8-bytes`, `unicode-points` or `utf16-units`; `--limit unknown` preserves uncertainty. `plan` describes a single destination object, not the total multipart store. Its exits are 0 for FITS, 2 for unknown capacity/expansion due and 1 for overflow or invalid input. Even FITS never means integrated. Check the provider response and exact remote readback as well.

`pack` creates a **new** directory, immutable UTF-8 parts and a `memory.storage.v1` manifest with ordered part hashes, logical graph hash and a derived section/node/anchor lookup index. It rejects an existing output directory. It never switches an active pointer, deletes history or changes graph v3/v4 semantics. A failed build can leave an inactive candidate; inspect or discard only that candidate, never the accepted graph. Retain the old version until the normal storage cutover and rollback agreement.

`control-check` and `guard-check` accept either the original Markdown graph or the manifest as `--graph`. They validate every fragment, order, hash and lookup index, reconstruct the logical graph in code and run the same structural checks. `graphSha256` is the logical Markdown hash, so exact readback remains comparable. A missing/changed part cannot produce a healthy graph. Packing itself reports only `CANDIDATE_VERIFIED` with semantic validation explicitly NOT_PERFORMED.

Publish the manifest and all fragments into the same authorized versioned location; a mutable set of unrelated issue comments is not an atomic snapshot. Re-read them from that location before changing the current pointer. The manifest itself also needs adequate storage. Consumers use its index to find the applicable public routes; they do not load the concatenated graph into every model prompt. Resolve the accepted snapshot through the current pointer, then bind scoped integration evidence to relevant fragments/sections. Do not turn an unrelated global watermark change or byte-identical storage move into a new semantic review for every task. Existing source precedence, semantic review, retained obligations and independent retrieval/application checks still apply.

## Activation And Health

At activation or a memory write/miss, the existing orchestrator reads back the current graph location, storage format, known physical capacity or uncertainty, and any pending unintegrated deltas. An old successful graph probe does not cover newer pending meaning. Reuse current proof on unchanged continuations; no full scan or rebuild each time. Record gaps and their concrete next action in existing Capability adoption/Work hygiene and the pending memory route, not a second graph. At the agreed health checkpoint, reconcile missed writes, duplicates, unresolved contradictions, stale commitments and storage growth using changed records and source coverage. A mere larger file is not a defect; unexplained copies or missing applicable meaning are.
