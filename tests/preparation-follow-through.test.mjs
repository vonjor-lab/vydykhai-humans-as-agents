import test from "node:test";
import assert from "node:assert/strict";
import { readCapabilityAdoption, assessCapabilityReadiness } from "../scripts/adoption-plan.mjs";
import { classifyGuard } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-02T12:00:00Z");
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
const readiness = () => ({ bindings: Object.fromEntries(ids.map(id => [id, id + ":r1"])), checks: [] });
const record = () => ({ schemaVersion: 1, scope: "whole-project", status: "PENDING",
  evidence: "retained-inventory", work: "PREP-1", phase: "INVENTORY", readiness: readiness(),
  plan: "plan#preparation", notice: "message#proposal",
  steps: [{ covers: ["codeMapped", "modular"], work: "PREP-1", action: "Complete unexamined code routes and propose module boundaries" }] });
const checkpoint = () => ({ id: "PREP-REVIEW-1", owner: "maintenance-owner", dueAt: "2026-01-02T13:00:00Z",
  expected: "Reviewed whole-project coverage and bounded modularization proposal", receiptId: "PREP-RETURN-1",
  authority: "update-request#safe-documentation" });
const lease = (state = "WORKING", cp = checkpoint()) =>
  [["PREP-1", state, "maintenance-owner", "repo", "baseline", "whole-project-preparation", JSON.stringify(cp), "durable-outbox"]];
const attention = id => "Human attention: PENDING | ID: " + id +
  " | Request: Complete only unexamined areas after the saved result, without changing product code? | Source: user#prior-pause | Raised: 2026-01-02 | Resume after: explicit answer";
const content = (r, human = "Human attention: NONE", version = "1.32.7") =>
  "Framework: " + version + "\n" + human + "\nCapability adoption: " + JSON.stringify(r);
const check = (r = record(), leases = lease(), human, time = now) =>
  readCapabilityAdoption(content(r, human), leases, { now: time });

test("regression: two NOs with plan links and generic future wait no longer pass", () => {
  const r = record(); delete r.steps; r.phase = "PROOF";
  const leases = lease("WAITING"); leases[0][6] = "human scope decision and future module proof";
  assert.equal(readCapabilityAdoption(content(r, undefined, "1.32.6"), leases).coverage, "STRUCTURE_ONLY");
  const result = check(r, leases);
  assert.equal(result.coverage, "INVALID");
  assert.ok(result.issues.some(i => i.includes("not plan links alone")));
});

test("both NOs require unique coverage, an action and a real continuing owner", () => {
  for (const mutate of [
    r => { r.steps[0].covers = ["codeMapped"]; },
    r => { r.steps.push(structuredClone(r.steps[0])); },
    r => { r.steps[0].covers.push("madeUp"); },
    r => { r.steps[0].action = "TBD"; },
    r => { r.steps[0].work = "missing"; },
  ]) { const r = record(); mutate(r); assert.equal(check(r).coverage, "INVALID"); }
  for (const state of ["PREPARED", "RETURNED", "CLOSED", "OUTCOME_UNKNOWN"]) {
    assert.equal(check(record(), lease(state)).coverage, "INVALID");
  }
  assert.equal(check(record(), [...lease(), ...lease()]).coverage, "INVALID");
});

test("reuse the agreed lease checkpoint; free-form waiting, missing result and impossible dates fail", () => {
  for (const mutate of [
    cp => { delete cp.expected; }, cp => { cp.owner = "other-owner"; },
    cp => { cp.dueAt = "next safe stage"; }, cp => { cp.dueAt = "2026-02-30T13:00:00Z"; },
    cp => { delete cp.authority; }, cp => { delete cp.receiptId; },
  ]) { const cp = checkpoint(); mutate(cp); assert.equal(check(record(), lease("WAITING", cp)).coverage, "INVALID"); }
  assert.deepEqual(check().issues, []);
  assert.deepEqual(check(record(), lease("WAITING")).issues, []);
});

test("a due checkpoint routes one manager review, not execution or repeated guard wakeups", () => {
  const leases = lease("WAITING"); const r = record();
  const result = check(r, leases, undefined, now + 3600000);
  assert.equal(result.coverage, "INVALID");
  assert.ok(result.issues.some(i => i.includes("review checkpoint is due")));
  const report = { ok: false, stateIssues: result.issues, graphIssues: [] };
  const first = classifyGuard(report, "");
  assert.equal(first.action, "WAKE");
  assert.equal(classifyGuard(report, "", { acceptedIncidentId: first.incidentId }).action, "NOOP");
  const unresolved = classifyGuard(report, "", { wokenIncidentId: first.incidentId });
  assert.equal(unresolved.action, "AUDIT_REQUIRED", "an ignored delivered review retains the existing bounded escalation");
  const exhausted = classifyGuard(report, "", { wokenIncidentId: first.incidentId,
    repairIncidentId: first.incidentId, repairAttempts: 1 });
  assert.equal(exhausted.action, "CONTROL_DEGRADED", "no second automatic repair loop");
  r.steps[0].decisionId = "PREP-QUESTION";
  assert.deepEqual(check(r, leases, attention("PREP-QUESTION"), now + 3600000).issues, [],
    "reconciliation into the actual human gate clears the due condition without resuming work");
  delete r.steps[0].decisionId;
  assert.equal(leases[0][1], "WAITING", "a review does not lift a pause");
  assert.equal(check(r, leases, undefined, now + 7200000).issues[0], result.issues[0], "clock ticks retain semantic incident identity");
});

test("human gate must be the actual pending question; another product question is not preparation consent", () => {
  const r = record(); r.steps[0].decisionId = "PREP-QUESTION";
  for (const human of ["Human attention: NONE", attention("PRODUCT-QUESTION"), attention("PREP-QUESTION").replace("PENDING", "RESURFACE_DUE")]) {
    assert.equal(check(r, lease("WAITING"), human).coverage, "INVALID");
  }
  assert.equal(check(r, lease("WORKING"), attention("PREP-QUESTION")).coverage, "INVALID");
  const held = check(r, lease("WAITING"), attention("PREP-QUESTION"), now + 86400000);
  assert.deepEqual(held.issues, [], "an unanswered source-backed human gate stays quiet, not auto-expired");
  assert.equal(classifyGuard({ ok: true, stateIssues: held.issues, graphIssues: [] }, "").action, "NOOP");
});

test("answered question cannot leave the same silent WAITING record valid", () => {
  const r = record(); r.steps[0].decisionId = "PREP-QUESTION";
  assert.deepEqual(check(r, lease("WAITING"), attention("PREP-QUESTION")).issues, []);
  assert.equal(check(r, lease("WAITING"), "Human attention: NONE").coverage, "INVALID");
  delete r.steps[0].decisionId;
  assert.deepEqual(check(r, lease("WORKING"), "Human attention: NONE").issues, []);
});

const complete = () => {
  const data = readiness();
  data.checks = ids.map(id => ({ id, status: "VERIFIED", binding: data.bindings[id], checkedBinding: data.bindings[id], source: "proof:" + id }));
  data.architecture = { project: "whole-project", scope: "whole-project", inventory: { source: "independent-inventory", areas: ["input", "output"] },
    source: "module-map", reviewedBy: "manager", review: "coverage-review",
    coverage: ["input", "output"].map(area => ({ area, access: "AVAILABLE", modularity: "ENCAPSULATED", documentation: "CURRENT", evidence: "proof:" + area })) };
  return data;
};
const accept = data => ({ ...data, accepted: { status: "ACCEPTED", acceptedBy: "manager",
  relevantKey: assessCapabilityReadiness({ ...data, trigger: "update", scope: "whole-project" }).relevantKey,
  routeProof: Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(k => [k, "proof:" + k])) } });

test("end-to-end records: deferred stage, visible question, same-owner execution, mapping, proposal, modular completion", () => {
  const r = record(); let leases = lease("WAITING");
  assert.deepEqual(check(r, leases).issues, []);
  assert.equal(check(r, leases, undefined, now + 3600000).coverage, "INVALID");
  r.steps[0].decisionId = "PREP-QUESTION";
  assert.deepEqual(check(r, leases, attention("PREP-QUESTION"), now + 3600000).issues, []);
  delete r.steps[0].decisionId; leases = lease("WORKING");
  assert.deepEqual(check(r, leases).issues, []);
  const data = complete(); data.architecture.coverage[1].modularity = "TANGLED";
  data.architecture.coverage[1].followUp = "PREP-1#proposal";
  data.architecture.proposal = { source: "proposal", disposition: "PROPOSED" };
  r.readiness = accept(data); r.status = "ACCEPTED"; delete r.work; delete r.phase;
  r.steps[0] = { covers: ["modular"], work: "PREP-1", action: "Present bounded module migration preserving existing behavior", decisionId: "PREP-QUESTION" };
  const proposed = check(r, lease("WAITING"), attention("PREP-QUESTION"));
  assert.deepEqual(proposed.issues, []);
  assert.deepEqual(proposed.readiness.preparation, { codeMapped: true, modular: false, required: ["ASSESS_AND_PLAN_MODULES"] });
  assert.equal(proposed.readiness.architecture.productMutation, "NOT_AUTHORIZED");
  r.readiness = accept(complete()); delete r.steps;
  const done = check(r, []);
  assert.deepEqual(done.issues, []);
  assert.deepEqual(done.readiness.preparation, { codeMapped: true, modular: true, required: [] });
});

test("split preparation uses existing independent leases without duplicate coverage", () => {
  const r = record();
  r.steps = [{ covers: ["codeMapped"], work: "PREP-1", action: "Complete project map" },
    { covers: ["modular"], work: "PREP-2", action: "Assess interfaces and propose migration" }];
  const second = lease()[0]; second[0] = "PREP-2";
  second[6] = JSON.stringify({ ...checkpoint(), id: "PREP-REVIEW-2", receiptId: "PREP-RETURN-2" });
  assert.deepEqual(check(r, [...lease(), second]).issues, []);
});
