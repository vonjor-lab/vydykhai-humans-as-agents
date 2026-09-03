import assert from "node:assert/strict";
import test from "node:test";
import { classifyGuard, evaluateProductionContinuation, readProductionContinuation } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
const next = { schemaVersion: 1, id: "NEXT-1", work: "WORK-1", action: "Dispatch the accepted increment",
  owner: "manager", state: "READY", evidence: "accepted-brief-1" };
function state(record = next, leaseState = "PREPARED") {
  return `Orchestrator health: HEALTHY | Context: manager | Profile: maximum
Project Guard: ACTIVE | Incident: none
Human attention: NONE
## Execution Leases
| Work | State | Owner / context |
| --- | --- | --- |
| WORK-1 [GOAL] - accepted flow | ${leaseState} | executor |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify(record)}
\`\`\`
<!-- vydykhai:project-state:end -->`;
}
function observation(content, overrides = {}) {
  return { schemaVersion: 1, continuationKey: readProductionContinuation(content).key,
    observedAt: new Date(now).toISOString(),
    orchestrator: { context: "manager", status: "IDLE", evidence: "native-control-1" },
    owner: { context: "executor", status: "ACTIVE", evidence: "native-task-1" },
    wait: { status: "PENDING", evidence: "current-gate-1" }, ...overrides };
}
function check(content, activity = observation(content), stateIssues = [], options = {}) {
  const continuation = evaluateProductionContinuation(content, activity, { now });
  const issues = [...stateIssues, ...continuation.issues];
  return { continuation, ...classifyGuard({ ok: issues.length === 0, stateIssues: issues, graphIssues: [], continuation }, content, options) };
}

test("service interruption leaves one routable step; dispatch then makes checks quiet", () => {
  const pending = state();
  const first = check(pending);
  assert.equal(first.action, "WAKE");
  assert.equal(first.continuation.value.action, next.action);
  const serviceUpdate = pending.replace("Human attention: NONE", "Human attention: NONE\nService: repair dispatched");
  assert.equal(readProductionContinuation(serviceUpdate).key, readProductionContinuation(pending).key);
  assert.equal(check(serviceUpdate, observation(pending)).incidentId, first.incidentId);

  // Simulate the adapter's existing incident lease, not a live harness guarantee.
  const deliveries = new Set();
  const routed = [];
  for (const snapshot of [pending, serviceUpdate, serviceUpdate]) {
    const result = check(snapshot);
    if (result.action === "WAKE" && !deliveries.has(result.incidentId)) {
      deliveries.add(result.incidentId);
      routed.push({ work: result.continuation.value.work, operation: "dispatch-existing-lease" });
    }
  }
  assert.deepEqual(routed, [{ work: "WORK-1", operation: "dispatch-existing-lease" }]);
  const working = state({ ...next, state: "WORKING", owner: "executor", evidence: "first-action-receipt" }, "WORKING");
  assert.equal(check(working).action, "NOOP");
});

test("an active coordinator is not interrupted, but unresolved work is not accepted away", () => {
  const content = state();
  const active = observation(content, { orchestrator: { context: "manager", status: "ACTIVE", evidence: "turn-1" } });
  assert.equal(check(content, active).action, "NOOP");
  const returned = check(content, active, ["Project State: pending return RET-1 requires reconciliation"]);
  assert.equal(returned.action, "NOOP");
  assert.equal(returned.requiredAction, "WAKE");
  assert.equal(returned.deferred, true);
  const idle = check(content);
  assert.equal(check(content, observation(content), [], { acceptedIncidentId: idle.incidentId }).action, "WAKE");
  assert.equal(check(content.replace("Incident: none", `Incident: ${idle.incidentId}`), observation(content),
    [`Project State: Project Guard incident ${idle.incidentId} requires reconciliation`]).action, "AUDIT_REQUIRED");
});

test("a terminal side answer cannot satisfy a WORKING lease", () => {
  const content = state({ ...next, state: "WORKING", owner: "executor", evidence: "launch-receipt" }, "WORKING");
  const stopped = observation(content, { owner: { context: "executor", status: "IDLE", evidence: "terminal-side-answer" } });
  const result = check(content, stopped);
  assert.equal(result.action, "WAKE");
  assert.match(result.continuation.signal, /without a routed continuation/);
  assert.equal(result.continuation.value.owner, "executor");
  const active = check(content, observation(content));
  assert.equal(active.action, "NOOP");
});

test("human wait stays quiet; changed gate routes a decision, never authorizes execution", () => {
  const waiting = state({ ...next, state: "WAITING", action: "Wait for review", evidence: "human-request-1",
    resumeWhen: "Reviewer accepts or corrects the result" }, "WAITING");
  assert.equal(check(waiting).action, "NOOP");
  const changed = observation(waiting, { wait: { status: "CHANGED", evidence: "human-rejection-2" } });
  assert.equal(check(waiting, changed).action, "WAKE");
  assert.equal(check(waiting, changed).continuation.value.state, "WAITING");
  assert.equal(check(waiting, observation(waiting), ["Project State: human attention H-1 requires resurfacing"]).action, "WAKE");
  assert.equal(readProductionContinuation(state({ ...next, state: "WAITING" })).key, null);
});

test("new human direction and recipient rotation invalidate only the old observation", () => {
  const old = state();
  const changed = state({ ...next, id: "NEXT-2", action: "Pause for the new product decision", state: "WAITING",
    evidence: "human-change-2", resumeWhen: "Human resolves the changed scope" });
  assert.equal(check(changed, observation(old)).continuation.coverage, "LIMITED");
  assert.equal(check(changed).action, "NOOP");
  const rotated = state({ ...next, owner: "new-manager" }).replace("Context: manager", "Context: new-manager");
  assert.equal(check(rotated, observation(old)).continuation.coverage, "LIMITED");
  const fresh = observation(rotated, { orchestrator: { context: "new-manager", status: "IDLE", evidence: "cutover-2" } });
  assert.equal(check(rotated, fresh).action, "WAKE");
});

test("unknown, missing, stale or malformed activity is LIMITED, never inferred idle", () => {
  const content = state();
  for (const activity of [null, {}, observation(content, { observedAt: "bad" }),
    observation(content, { observedAt: new Date(now - 301000).toISOString() }),
    observation(content, { observedAt: new Date(now + 6000).toISOString() }),
    observation(content, { orchestrator: { context: "manager", status: "UNKNOWN", evidence: "empty-native-view" } }),
    observation(content, { orchestrator: { context: "other-manager", status: "IDLE", evidence: "wrong-context" } }),
    observation(content, { orchestrator: { context: "manager", status: "IDLE", evidence: "<missing>" } }),
    observation(content, { orchestrator: { context: "manager", status: "IDLE", evidence: "" } })]) {
    const result = check(content, activity);
    assert.equal(result.continuation.coverage, "LIMITED");
    assert.equal(result.continuation.signal, null);
    assert.equal(result.action, "AUDIT_REQUIRED");
  }
  const working = state({ ...next, state: "WORKING", owner: "executor" }, "WORKING");
  assert.equal(check(working, observation(working, { owner: null })).continuation.coverage, "LIMITED");
  const waiting = state({ ...next, state: "WAITING", resumeWhen: "Human decides" });
  assert.equal(check(waiting, observation(waiting, { wait: { status: "PENDING", evidence: "<missing>" } })).continuation.coverage, "LIMITED");
});

test("safety and ownership gates dominate a ready action, even while manager is active", () => {
  const content = state();
  const active = observation(content, { orchestrator: { context: "manager", status: "ACTIVE", evidence: "turn" } });
  assert.equal(check(content, active, ["Project State: ambiguous side-effect outcome"]).action, "AUDIT_REQUIRED");
  assert.equal(readProductionContinuation(state(next, "OUTCOME_UNKNOWN")).key, null);
  for (const record of [{ ...next, owner: "executor" }, { ...next, state: "WORKING" },
    { ...next, state: "WORKING", owner: "other-task" }, { ...next, evidence: "<missing>" },
    { ...next, schemaVersion: 2 }, { ...next, state: "DONE" }]) {
    assert.ok(readProductionContinuation(state(record)).issues.length);
  }
  for (const content of ["## Next-Best-Action\n- do something", state().replace(/```json[\s\S]*?```/, "```json\n{broken\n```"),
    state().replace("<!-- vydykhai:project-state:end -->", "```json\n{}\n```\n<!-- vydykhai:project-state:end -->")]) {
    assert.equal(readProductionContinuation(content).key, null);
  }
});
