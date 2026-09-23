# Owner-Controlled Context Routing

This extends [Context Preparation](context-preparation.md), not the management
hierarchy. Context readiness is checked at every start and material information
gap. Reuse a sufficient current packet; do not repeat an exhaustive search.

## Responsibilities

- The orchestrator owns purpose, scope, constraints, required Module Contracts,
  the question assigned to preparation, model/effort selection and packet review.
  It receives a concise evidence/gap/decision summary, not search transcripts.
  It preserves the accepted applicability and proof limits of donor modules in briefs and graph integration; a passed example is not permission to claim a reusable chain.
- The preparer finds and combines source-backed facts through map/index -> graph
  and contracts -> relevant code. It labels unread, unavailable and contradictory
  sources separately. It does not choose product direction, design a new solution,
  broaden authority, or declare history complete from a filename search.
- The executor implements and verifies the approved increment. It reads current
  code at the declared boundary and reports a real information gap via `CONSULT`
  to the orchestrator; it does not assign work or models to preparation itself.
- Preparation may draft index links or documentation from an exact Candidate
  and evidence under a bounded owner request. The executor incorporates and
  verifies required Module Contract changes before accepting that same Candidate.
  Post-task clerical work cannot defer required docs beyond acceptance. The
  orchestrator alone integrates shared meaning; new rationale is not clerical work.

User communication remains through the orchestrator: explain the useful result
and next step, not internal routing. Preparation uses the existing focused-task
lease, Return Sync and cleanup, never a permanent new manager or Guard loop.

## Fit With Existing Work

Mode names describe work, not automatic model assignments. Preparation locates
known evidence; solution Discovery resolves what should be done with it.

| Situation | Route and completion |
| --- | --- |
| Current sufficient context | Direct execution; no preparer or additional approval. |
| Known evidence is scattered | Owner-scoped Preparation, checked packet, then its intended consumer. |
| Meaning or solution is unresolved | Bounded deep Discovery; preparation may supply facts, not the decision. |
| Experimental proof is needed | Lab keeps baseline, variable, conditions and cap; preparation finds prior evidence, never substitutes a fixture for real-flow proof. |
| Integration or repair | Focused Execution preserves the actual accepted mechanism; unknown architecture returns to Discovery, not guessed adapters. |
| Maintenance | Same routing by question; prove the original flow improved and return to it, not maintenance for its own sake. |
| Documentation and memory | Executor verifies required docs in the Candidate; orchestrator accepts reusable memory candidates. |
| Guard, update or rotation | Existing liveness/activation rules; no retrieval timer or forced model/worker restart. Carry pending consultations and human control forward. |

Lab is isolation, not a model tier: unresolved solution choices use Discovery;
execution of an agreed experiment uses its proven execution profile or explicit
human model choice. Its proof does not silently authorize production transfer.

Research starts with the known scope, authoritative sources, explicit gaps and a
permitted report route; it does not need the complete implementation packet that
it is supposed to discover. Missing inputs do not authorize dependent mutation.
Do not recursively require preparation of preparation. Reuse a Discovery packet
when sufficient for implementation; no automatic extra retrieval stage.
An unresolved owner decision goes to that owner, not another search round.
Preparation has its own bounded retrieval result/lease, not ownership of the
implementation Candidate. While it runs, the affected executor waits on that
named dependency; the preparer never waits on the same executor. Return consumption
resumes the existing consumer under current authority, not a competing task.
Respect direct human control: a supplement supplies facts, not a new direction.

## Initial Handoff and Later Gaps

1. The orchestrator sets a bounded question, source routes, required contracts,
   outcome, protected baseline and stop condition. The preparer returns facts,
   exact workspace-relative citations, gaps and a navigation packet. The owner
   reviews coverage, source meaning, citations and audience before confirmation.
   Invalid packets use the existing bounded repair/fallback path, not repeated
   full searches or delivery as if complete. Reuse valid findings on fallback.
2. A new implementation starts in a fresh executor without the preparer's transcript.
   The executor reads/acknowledges and starts authorized work in the same turn.
   Reuse the same worker for later supplements; do not replay finished work.
   Preparation for a manager/Discovery decision returns scoped evidence to that
   existing owner instead; it does not create an implementation task prematurely.
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

Use `agentRoutingPolicy.effortPolicy` over legacy profile fields. Orchestration uses flagship/Low; solution Discovery uses flagship/High. These are harness mappings, not model ids.
A control failure means evidenced wrong routing, lost obligation or invalid readiness judgment. Diagnose it and make one targeted correction; if that fails the same success criterion, use High for bounded recovery, not another blind Low retry.
Network/access failures, authorized pauses, missing human decisions and a worker's failing test alone do not trigger this escalation. Safety/authority uncertainty stops the affected action immediately; never try an unsafe action to earn a higher effort.
Record the failure, correction, recovery criterion and effective effort in the existing next-action/State record. A High recovery ends only after observable handoff/return and retained obligations pass the criterion, not a promise or rewritten plan; return to Low at the next safe boundary.
If High recovery still fails, use the existing blocker/confirmed-rotation path; do not oscillate Low/High, add retries or override human control. A missing switch capability has an explicit supported fallback/checkpoint, never a claimed switch. Independent work remains usable.
Effort escalation never resets Guard repair limits, leases or burn caps: after a circuit breaker, High may diagnose/rebrief within authority, not replay the stopped action. Existing independent Governor anomaly evaluation is unchanged; routine checks remain model-free.

The orchestrator selects the lowest proven capable route for the task class,
honoring explicit human choices and fallback. Prefer observed subscription usage
when it is attributable; credit estimates are a secondary proxy, not allowance
coefficients. Do not stop other work to measure account limits without permission.
Until attributable allowance data exists, use dated credit-rate coefficients as the planning proxy, then calibrate against practical whole-chain usage and time to accepted result. Unknown costs remain unknown; no automatic model oscillation at checkpoints.

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

The existing loop closes through source-backed context -> scoped work -> retained/new behavior and documentation review -> consumed Return -> integrated graph meaning and next action. Required docs/map links belong to the Candidate; required reusable memory stays an explicit owner obligation until integrated, not an implied side effect of delivery. Compare total effort and rework per accepted outcome, not activity counts. Repeated misses or rising coordination cost trigger existing Health Review/maintenance with proof of improvement on the original flow; no new timer, role or global memory rebuild.
