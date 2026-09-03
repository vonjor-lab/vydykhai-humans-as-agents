import assert from "node:assert/strict";
import test from "node:test";
import { classifyGuard, evaluateLeaseActivity, evaluateProductionContinuation, readLeaseActivityScope,
  readProductionContinuation, validateDurableOutbox } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
function snapshot(states = ["WAITING", "WORKING"], manager = "manager") {
  const next = { schemaVersion: 1, id: "NEXT-1", work: "WORK-1", action: "Complete the accepted implementation",
    owner: "worker", state: "WORKING", evidence: "first-action-receipt" };
  return `Orchestrator health: HEALTHY | Context: ${manager} | Profile: maximum
Project Guard: ACTIVE | Incident: none
Human attention: PENDING | ID: HUMAN-1 | Request: Choose the accepted appearance | Source: checkpoint-1 | Raised: event-1 | Resume after: none
## Execution Leases
| Work | State | Owner / context |
| --- | --- | --- |
| LEAD-1 [DESIGN] [DISCOVERY] - Preserve the design | ${states[0]} | author / lead |
| WORK-1 [DESIGN] - Implement the accepted design | ${states[1]} | builder / worker |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify(next)}
\`\`\`
<!-- vydykhai:project-state:end -->`;
}
const waiting = (dependsOn, status = "PENDING") => ({ status, dependsOn,
  resumeWhen: "The named evidence or decision arrives", evidence: "current-dependency-receipt" });
function observation(content, overrides = {}) {
  return { schemaVersion: 1, observedAt: new Date(now).toISOString(),
    continuationKey: readProductionContinuation(content).key, leaseKey: readLeaseActivityScope(content).key,
    orchestrator: { context: "manager", status: "IDLE", evidence: "native-manager" },
    owner: { context: "worker", status: "ACTIVE", evidence: "native-worker" },
    leases: [
      { work: "LEAD-1", context: "lead", status: "IDLE", evidence: "native-lead", wait: waiting(["WORK-1"]) },
      { work: "WORK-1", context: "worker", status: "ACTIVE", evidence: "native-worker" },
    ], ...overrides };
}
function check(content, activity = observation(content), outbox = "", options = {}) {
  const continuation = evaluateProductionContinuation(content, activity, { now });
  const leaseActivity = evaluateLeaseActivity(content, activity, { now });
  const durable = validateDurableOutbox(outbox);
  const stateIssues = [...continuation.issues, ...leaseActivity.issues];
  const result = { ok: stateIssues.length + durable.issues.length === 0, continuation, leaseActivity,
    stateIssues, graphIssues: [], outbox: durable };
  return { ...result, ...classifyGuard(result, content, options) };
}
function returnSync(id) {
  return `<!-- vydykhai:return-sync v1 -->
# Return Sync
Status: CHECKPOINT_READY
Return receipt id: ${id}
Return lifecycle: WRITTEN
Task / context / PR / commit / artifact: WORK-1 / worker / none / abc123 / accepted-checkpoint
Memory candidates: NO_MEMORY_DELTA
Artifact disposition: context -> WAITING / review of the parent change remains
Recommended orchestrator next action: route the evidence to the existing lead
<!-- vydykhai:return-sync:end -->`;
}
function returnRoute(id, manager = "manager") {
  return `<!-- vydykhai:return-route v1 -->
# Return Route
Return receipt id: ${id}
Return lifecycle: RECEIVED -> CONSUMED -> ROUTED
Consumer: ${manager}
Routed next action: existing lead reviews the checkpoint; parent remains open
Evidence: current-control-event
<!-- vydykhai:return-route:end -->`;
}

test("legacy adapters stay compatible without claiming whole-lease coverage", () => {
  const content = snapshot();
  const activity = observation(content);
  delete activity.leases;
  assert.equal(check(content, activity).leaseActivity.coverage, "NOT_REQUESTED");
  assert.equal(check(content, activity).action, "NOOP");
});

test("waiting lead and active executor stay quiet without keeping a model running", () => {
  const result = check(snapshot());
  assert.equal(result.leaseActivity.coverage, "COVERED");
  assert.equal(result.action, "NOOP");
});

test("an active executor cannot hide an idle lead still recorded as working", () => {
  const content = snapshot(["WORKING", "WORKING"]);
  const result = check(content);
  assert.equal(result.continuation.signal, null);
  assert.equal(result.action, "WAKE");
  assert.match(result.leaseActivity.issues[0], /LEAD-1.*idle without a wait/);
  assert.equal(check(content, observation(content), "", { acceptedIncidentId: result.incidentId }).action, "WAKE");
});

test("mutual and self waits audit; observation order cannot change the incident", () => {
  const content = snapshot(["WAITING", "WAITING"]);
  const activity = observation(content);
  activity.leases[1].wait = waiting(["LEAD-1"]);
  const first = evaluateLeaseActivity(content, activity, { now });
  assert.match(first.issues.join("\n"), /circular wait/);
  const classify = (leaseActivity) => classifyGuard({ ok: false, stateIssues: leaseActivity.issues,
    graphIssues: [], leaseActivity }, content);
  assert.equal(classify(first).action, "AUDIT_REQUIRED");
  const reversed = evaluateLeaseActivity(content, { ...activity, leases: [...activity.leases].reverse() }, { now });
  assert.equal(classify(first).incidentId, classify(reversed).incidentId);
  activity.leases[0].wait = waiting(["LEAD-1"]);
  assert.match(evaluateLeaseActivity(content, activity, { now }).issues.join("\n"), /circular wait/);
});

test("a consultation assigns actionable work to the lead instead of mutual waiting", () => {
  const content = snapshot(["WORKING", "WAITING"]);
  const activity = observation(content);
  activity.leases[0].status = "ACTIVE";
  activity.leases[1].status = "IDLE";
  activity.owner.status = "IDLE";
  activity.leases[1].wait = waiting(["LEAD-1"]);
  const result = evaluateLeaseActivity(content, activity, { now });
  assert.deepEqual(result.issues, []);
  assert.equal(result.coverage, "COVERED");
});

test("a changed wait requires routing without granting authority or closing the parent", () => {
  const content = snapshot();
  const activity = observation(content);
  activity.leases[0].wait.status = "CHANGED";
  const first = check(content, activity);
  assert.equal(first.action, "WAKE");
  assert.ok(content.includes("| WAITING | author / lead |"));
  const active = check(content, { ...activity, orchestrator: { ...activity.orchestrator, status: "ACTIVE" } });
  assert.equal(active.action, "NOOP");
  assert.equal(active.deferred, true);
  assert.equal(active.requiredAction, "WAKE");
  assert.equal(check(content, activity, "", { acceptedIncidentId: first.incidentId }).action, "WAKE");
});

test("missing, ambiguous and stale whole-lease observations are LIMITED", () => {
  const content = snapshot();
  const base = observation(content);
  const variants = [
    { ...base, leases: null }, { ...base, leases: [] }, { ...base, leases: [base.leases[0]] },
    { ...base, leaseKey: "old" }, { ...base, observedAt: new Date(now - 301000).toISOString() },
    { ...base, observedAt: new Date(now + 6000).toISOString() },
    { ...base, leases: [...base.leases, base.leases[0]] },
    { ...base, owner: { ...base.owner, status: "IDLE" } },
    ...[null, { ...base.leases[0], context: "wrong" }, { ...base.leases[0], status: "UNKNOWN" },
      { ...base.leases[0], evidence: "<missing>" }, { ...base.leases[0], wait: undefined },
      { ...base.leases[0], wait: waiting(["missing-work"]) },
      { ...base.leases[0], wait: waiting(["WORK-1", "WORK-1"]) },
      { ...base.leases[0], wait: { ...waiting([]), resumeWhen: "" } },
    ].map((view) => ({ ...base, leases: [view, base.leases[1]] })),
  ];
  for (const activity of variants) {
    const result = check(content, activity);
    assert.equal(result.leaseActivity.coverage, "LIMITED");
    assert.equal(result.action, "AUDIT_REQUIRED");
  }
});

test("unrelated memory edits preserve observations; a rotated owner or changed lease invalidates them", () => {
  const content = snapshot();
  const activity = observation(content);
  assert.equal(check(content.replace("Human attention:", "Memory: unrelated refinement\nHuman attention:"), activity).action, "NOOP");
  for (const changed of [snapshot(undefined, "successor"), content.replace("author / lead", "author / new-lead")]) {
    assert.equal(evaluateLeaseActivity(changed, activity, { now }).coverage, "LIMITED");
  }
  const rotated = snapshot(undefined, "successor");
  const fresh = observation(rotated, { orchestrator: { context: "successor", status: "IDLE", evidence: "cutover" } });
  assert.equal(check(rotated, fresh).action, "NOOP");
});

test("closed dependencies wake a waiting owner; genuine human waits remain quiet", () => {
  const content = snapshot(["WAITING", "CLOSED"]);
  const activity = observation(content);
  activity.leases.pop();
  assert.match(evaluateLeaseActivity(content, activity, { now }).issues.join("\n"), /wait condition changed/);
  activity.leases[0].wait = waiting([]);
  assert.deepEqual(evaluateLeaseActivity(content, activity, { now }).issues, []);
});

test("checkpoint return survives native loss, service input and rotation, then quiets after routing", () => {
  const initial = snapshot();
  const outbox = returnSync("CHECKPOINT-1");
  const pending = check(initial, observation(initial), outbox);
  assert.equal(pending.action, "WAKE");
  const service = initial.replace("Human attention: PENDING", "Service: bounded repair\nHuman attention: RESURFACE_DUE");
  assert.equal(readLeaseActivityScope(initial).key, readLeaseActivityScope(service).key);
  assert.deepEqual(validateDurableOutbox(outbox).pendingReturnIds, ["CHECKPOINT-1"]);
  const rotated = snapshot(undefined, "successor");
  const activity = observation(rotated, { orchestrator: { context: "successor", status: "IDLE", evidence: "cutover" } });
  assert.equal(check(rotated, activity, outbox).action, "WAKE");
  const routed = check(rotated, activity, `${outbox}\n${returnRoute("CHECKPOINT-1", "successor")}`);
  assert.equal(routed.action, "NOOP");
  assert.deepEqual(routed.outbox.routedReturnIds, ["CHECKPOINT-1"]);
  assert.ok(rotated.includes("Request: Choose the accepted appearance"));
  assert.ok(rotated.includes("| WAITING | author / lead |"));
});

test("all closed leases need no owner observation and cannot wake a retired lead", () => {
  const content = snapshot(["CLOSED", "CLOSED"]);
  const activity = observation(content, { leases: [] });
  assert.deepEqual(evaluateLeaseActivity(content, activity, { now }).issues, []);
  const stale = observation(content);
  assert.equal(evaluateLeaseActivity(content, stale, { now }).coverage, "LIMITED");
});
