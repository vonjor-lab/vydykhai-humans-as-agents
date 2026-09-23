# Owner-Controlled Context Routing

This extends [Context Preparation](context-preparation.md), not the management
hierarchy. Context readiness is checked at every start and material information
gap. Reuse a sufficient current packet; do not repeat an exhaustive search.

## Responsibilities

- The orchestrator owns purpose, scope, constraints, required Module Contracts,
  the question assigned to preparation, model/effort selection and packet review.
  It receives a concise evidence/gap/decision summary, not search transcripts.
- The preparer finds and combines source-backed facts through map/index -> graph
  and contracts -> relevant code. It labels unread, unavailable and contradictory
  sources separately. It does not choose product direction, design a new solution,
  broaden authority, or declare history complete from a filename search.
- The executor implements and verifies the approved increment. It reads current
  code at the declared boundary and reports a real information gap via `CONSULT`
  to the orchestrator; it does not assign work or models to preparation itself.
- Post-task preparation may draft index links or documentation from an exact
  accepted diff and evidence under a separate bounded owner request. The executor
  checks technical accuracy; the orchestrator accepts shared semantic changes.
  New rationale, contracts and graph decisions are not mechanical documentation.

User communication remains through the orchestrator: explain the useful result
and next step, not internal routing. Preparation uses the existing focused-task
lease, Return Sync and cleanup, never a permanent new manager or Guard loop.

## Initial Handoff and Later Gaps

1. The orchestrator sets a bounded question, source routes, required contracts,
   outcome, protected baseline and stop condition. The preparer returns facts,
   exact workspace-relative citations, gaps and a navigation packet. The owner
   reviews coverage, source meaning, citations and audience before confirmation.
   Invalid packets use the existing bounded repair/fallback path, not repeated
   full searches or delivery as if complete. Reuse valid findings on fallback.
2. Initial delivery goes to a fresh executor without the preparer's transcript.
   The executor reads/acknowledges and starts authorized work in the same turn.
   Reuse the same worker for later supplements; do not replay finished work.
3. At a real gap, the executor reports the exact missing fact, affected operation
   and retained progress to the orchestrator. Continue independent safe work.
   The orchestrator distinguishes missing evidence, new solution design and
   environment failure; only bounded retrieval goes to cheap preparation.
4. The orchestrator approves a narrow supplementary question. The preparer
   returns an evidence delta; the owner incorporates it into a complete revised
   package retaining prior applicable constraints. A delta alone is not the task.
5. Confirm that package in a fresh output directory, then the same worker reads
   and acknowledges it, continues, verifies retained and new behavior, and sends
   the current-task Return Sync. No new human checkpoint for an already authorized
   internal handoff. Changed scope/authority needs the ordinary rebrief instead.

Every navigation packet has `assignment` with exactly `owner`, `requestId`,
`question`, `phase`, `previous`. Owner equals package owner; request id and question
are nonempty. For `phase: "initial"`, `previous` is null. For `"supplement"`, it is
`{plan:{path,sha256},approval:{path,sha256}}` pointing to the previous approved
package. The builder checks those bytes, owner approval and exact task identity,
worker, scope, action and Candidate files. Paths are workspace-relative.

Supplement input and output use new names; never overwrite predecessor evidence.
Confirmation records `<previous-plan-path>.superseded.json` pointing to the exact
successor. The supported `context-run` path rejects the old package and a competing
successor; the new worker must acknowledge the new package. A failed confirmation
is not permission to dispatch. Review its exact state and retry the same output;
do not create parallel successors. These checks neither authenticate identities
nor intercept arbitrary native edits; ordinary owner/lease control still applies.

## Cost Comparison

The orchestrator selects the lowest proven capable route for the task class,
honoring explicit human choices and fallback. Prefer observed subscription usage
when it is attributable; credit estimates are a secondary proxy, not allowance
coefficients. Do not stop other work to measure account limits without permission.
Unknown costs remain unknown. No automatic model oscillation at checkpoints.

Use `node scripts/vydykhai.mjs context-prepare estimate --input cost.json` for an
optional read-only comparison; it does not dispatch or authorize work. Input:

```json
{
  "schema": "context.cost.v1", "owner": "manager", "taskId": "task-1",
  "rates": [{"id": "current", "model": "resolved-model", "speed": "standard",
    "checkedAt": "2026-01-01", "source": "verified rate card",
    "input": 10, "cachedInput": 1, "output": 20}],
  "routes": [{"id": "prepared", "eligible": true, "evidence": "task-class proof",
    "stages": [{"purpose": "preparation", "rateId": "current", "effort": "low",
      "inputTokens": 1000, "cachedInputTokens": 500, "outputTokens": 100,
      "basis": "comparable observed task"}],
    "unknownCosts": ["remaining stages not measured"]}]
}
```

Numbers above are illustrative, not actual model rates. Rates are credits per
million tokens with dated source and speed; record effort per stage. Include
`preparation`, `execution`, `review`, `recovery`, `coordination`, and all repeated
turns; an omitted category produces PARTIAL. An inapplicable category may have
zero tokens with an explicit reason, never a fabricated measurement. Cached
input is a subset of total input; reasoning output, if separately reported, is
already included in output and must not be added again.

The calculation is `(input-cache)*inputRate + cache*cacheRate + output*outputRate`,
divided by one million, summed over the chain. Only eligible routes enter the
comparison; if any eligible route has unknown costs no cheapest route is claimed.
`subscriptionUsage: UNKNOWN` stays explicit. Capability, rate freshness, estimates
and the final decision remain the owner's responsibility, not this calculator's.
