# Executable Memory Brief

Goal: keep an indivisible memory obligation intact from retrieval through execution without turning all project memory into rigid machine data.

## Use It Proportionately

Most Memory Brief content remains concise advisory prose in `Because / Apply / Avoid / Verify / Source` form. Use an executable envelope only when shortening, merging, reordering, or omitting one part could invalidate the work, for example:

- an exact ordered migration or recovery sequence;
- a required path, actor, compatibility, or environment matrix;
- a safety gate or human checkpoint with several inseparable clauses;
- a previously missed obligation whose recurrence needs item-level proof.

Do not use the envelope for background, rationale that can be summarized safely, ordinary recommendations, or orchestration narration. It is a loss-prevention carrier, not another memory graph, task system, authority grant, or universal prompt format.

## Compile Once

The orchestrator retrieves current meaning through [Context Route](context-route.md), separates only non-factorable obligations into atomic items, and compiles them as `memory.executable-brief.v1` with `compileExecutableBrief` from `scripts/memory-brief.mjs`. The compiler, not a model or hand-written summary, derives all required item, clause, and row ids and computes the digest over the header and payload using canonical JSON.

The input is:

```json
{
  "authorityReceipt": {
    "activeGraphId": "current-graph-id",
    "activeGraphBodySha256": "64-lowercase-hex",
    "retrievalSnapshotId": "current-retrieval-id",
    "retrievalSnapshotSha256": "64-lowercase-hex",
    "sourceRefs": ["durable-source-reference"]
  },
  "ordinaryPromptSha256": "64-lowercase-hex",
  "atomicItems": []
}
```

Run `node scripts/vydykhai.mjs memory-brief-compile --input <brief-input.json>`. Put the returned `atomicRender` into the task contract unchanged, followed by ordinary advisory Memory Brief text via `composeBrief`. The envelope is read-only and never authorizes a merge, deploy, spend, secret access, or shared-state mutation.

Two atomic item kinds are supported:

- `ordered_action`: one item with ordered `clauses`, each carrying its own stable id, exact text, and source references;
- `repeated_rows`: one item with an explicit `rowCount` and independently identified `rows`, each retaining its path, route, terminal expectation, and sources.

Item, clause, and row ids are globally distinct. Missing sources, duplicate ids, hand-written manifests, malformed fields, or digest ambiguity fail before dispatch. If a material obligation cannot be represented by these two shapes, keep the affected work blocked and improve the contract rather than flattening it into prose.

## Apply And Prove

The focused task reads the envelope but does not edit it. Before claiming that the Memory Brief was applied, it returns a `memory.application-receipt.v1` bound to the same authority receipt, ordinary prompt hash, and brief digest. The receipt repeats the compiler-derived required ids, lists applied ids in original order, and reports either:

- `APPLIED`, only when every required id is present and there are no issues;
- `BLOCKED`, with the exact missing item, clause, or row ids and no invented substitute.

Run `node scripts/vydykhai.mjs memory-brief-validate --envelope <brief-envelope.json> --receipt <application-receipt.json>`. Unknown ids, changed authority, changed prompt, digest mismatch, reordered ids, incomplete manifests, duplicate ids, or inaccurate missing-id reports fail closed. Advisory prose cannot satisfy an atomic id.

The task still returns ordinary item-level `applied / missed / contradicted / not exercised` evidence for the rest of the Memory Brief. An executable receipt proves transport and explicit application coverage; it does not prove that the source meaning was correct or that product behavior passed. Acceptance still verifies the result, and the orchestrator still owns Memory Reflection.

## Update Without Rewriting History

Readers may consume accepted envelopes from earlier work, but a new task compiles against the current graph body, retrieval snapshot, and ordinary prompt. A changed source or applicable human decision produces a new envelope and digest; it never edits a historical envelope in place.

On framework adoption, do not convert the whole graph. First run ordinary unhinted retrieval probes. When one exposes a real compression or application miss, repair that route, compile only its indivisible obligations, rerun the same witness, and then continue the existing targeted regression and shadow-integration sequence. This preserves semantic history while avoiding a second migration ritual.
