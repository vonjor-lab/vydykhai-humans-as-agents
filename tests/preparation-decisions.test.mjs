import test from "node:test";
import assert from "node:assert/strict";
import { assessCapabilityReadiness, readCapabilityAdoption } from "../scripts/adoption-plan.mjs";
import { classifyGuard } from "../scripts/vydykhai.mjs";

const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
const input = () => ({
  trigger: "update", scope: "project-preparation",
  bindings: Object.fromEntries(ids.map(id => [id, id + ":r1"])),
  checks: ids.map(id => ({ id, status: "VERIFIED", binding: id + ":r1", checkedBinding: id + ":r1", source: "review:" + id })),
  architecture: { project: "sample", scope: "sample", inventory: { source: "project-outline", areas: ["import", "export"] },
    source: "module-map:r1", reviewedBy: "orchestrator", review: "coverage-review",
    coverage: ["import", "export"].map(area => ({ area, access: "AVAILABLE", modularity: "ENCAPSULATED",
      documentation: "CURRENT", evidence: "review:" + area })) },
});
const accept = data => ({ ...data, accepted: { status: "ACCEPTED", acceptedBy: "orchestrator",
  relevantKey: assessCapabilityReadiness(data).relevantKey,
  routeProof: Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance",
    "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(step => [step, "proof:" + step])) } });
const pending = data => ({ schemaVersion: 1, scope: data.scope, status: "PENDING", evidence: "inventory",
  work: "maintenance", phase: "INVENTORY", readiness: data });
const state = (record, version = "1.32.6") => "Framework: " + version + "\nCapability adoption: " + JSON.stringify(record);
const lease = (status = "WAITING", checkpoint = "current-task-saved-result") =>
  [["maintenance", status, "same-owner", "repo", "baseline", "preparation", checkpoint, "outbox"]];
const planned = record => ({ ...record, plan: "existing-plan#owner-and-safe-checkpoint", notice: "user-message#remaining-work-and-timing" });

test("mapping and modularity are independent binary decisions, not partial readiness", () => {
  for (const mapped of [true, false]) for (const modular of [true, false]) {
    const data = input();
    if (!mapped) data.checks.find(c => c.id === "code-map").status = "MISSING";
    if (!modular) {
      data.architecture.coverage[0].modularity = "TANGLED";
      data.architecture.coverage[0].followUp = "proposal#import-owner-and-checkpoint";
      data.architecture.proposal = { source: "proposal", disposition: "PROPOSED" };
    }
    const result = assessCapabilityReadiness(data).preparation;
    assert.equal(result.codeMapped, mapped);
    assert.equal(result.modular, modular);
    assert.equal(result.required.length, Number(!mapped) + Number(!modular));
  }
});

test("unknown, inaccessible, local and incomplete project coverage never count as yes", () => {
  for (const mutate of [
    data => { delete data.architecture; },
    data => { data.architecture.scope = "import-only"; },
    data => { data.architecture.coverage.pop(); },
    data => { delete data.architecture.review; },
    data => { Object.assign(data.architecture.coverage[0], { access: "INACCESSIBLE", modularity: "UNKNOWN",
      documentation: "UNKNOWN", followUp: "access-owner:checkpoint" }); },
  ]) {
    const data = input(); mutate(data);
    const facts = assessCapabilityReadiness(data).preparation;
    assert.equal(facts.codeMapped, false);
    assert.equal(facts.modular, false);
  }
  const data = input(); data.architecture.coverage[0].modularity = "UNKNOWN";
  assert.equal(assessCapabilityReadiness(data).preparation.modular, false);
});

test("generic waiting or ongoing product work cannot substitute for the visible preparation plan", () => {
  const data = input(); delete data.architecture;
  const record = pending(data);
  for (const status of ["WORKING", "WAITING"]) {
    const result = readCapabilityAdoption(state(record), lease(status, "unrelated-product-question"));
    assert.equal(result.coverage, "INVALID");
    assert.ok(result.issues.some(issue => issue.includes("missing visible preparation plan")));
  }
  for (const missing of ["plan", "notice"]) {
    const r = planned(record); delete r[missing];
    assert.equal(readCapabilityAdoption(state(r), lease()).coverage, "INVALID");
  }
  assert.equal(readCapabilityAdoption(state(record, "1.32.5"), lease()).coverage, "STRUCTURE_ONLY",
    "old snapshots remain readable, new activation must acquire the plan");
});

test("modularity confirmation requires current module navigation and documentation, not names alone", () => {
  for (const mutate of [
    data => { data.checks = data.checks.filter(c => c.id !== "module-map"); },
    data => { data.checks.find(c => c.id === "module-contracts").status = "STALE"; },
    data => { data.architecture.coverage[0].documentation = "UNKNOWN"; },
    data => { data.architecture.coverage[0].documentation = "GAPS"; },
  ]) {
    const data = input(); mutate(data);
    assert.equal(assessCapabilityReadiness(data).preparation.modular, false);
    assert.equal(readCapabilityAdoption(state(pending(data)), lease()).coverage, "INVALID",
      "unconfirmed modularity needs a visible plan even with available source code");
  }
});

test("planned work retains explicit pauses, access limits and independent production", () => {
  const data = input(); delete data.architecture;
  for (const checkpoint of ["human-pause", "access-decision", "approved-budget", "current-task-saved-result"]) {
    const result = readCapabilityAdoption(state(planned(pending(data))), lease("WAITING", checkpoint));
    assert.deepEqual(result.issues, []);
    const advice = assessCapabilityReadiness({ ...data, owner: { id: "same-owner", scope: data.scope, status: "WAITING", checkpoint } });
    assert.equal(advice.action, "WAIT_OWNER");
    assert.equal(advice.independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
    assert.equal(advice.preparation.codeMapped, false);
  }
});

test("known mapping with unknown modularity plans investigation, not a premature refactor", () => {
  const data = input(); data.architecture.coverage[0].modularity = "UNKNOWN";
  const result = readCapabilityAdoption(state(planned(pending(data))), lease("WORKING"));
  assert.deepEqual(result.issues, []);
  assert.equal(result.readiness.preparation.codeMapped, true);
  assert.equal(result.readiness.preparation.modular, false);
  assert.equal(result.readiness.architecture.productMutation, "NOT_AUTHORIZED");
  assert.equal(data.architecture.proposal, undefined);
});

test("limited access cannot be presented as completed whole-project mapping", () => {
  const data = input();
  Object.assign(data.architecture.coverage[0], { access: "INACCESSIBLE", modularity: "UNKNOWN",
    documentation: "UNKNOWN", followUp: "access-owner:checkpoint" });
  const r = planned({ ...pending(accept(data)), status: "ACCEPTED_WITH_LIMITS", limits: "import-inaccessible" });
  delete r.work; delete r.phase;
  const result = readCapabilityAdoption(state(r), []);
  assert.equal(result.coverage, "INVALID");
  assert.ok(result.issues.some(issue => issue.includes("mapping is not complete")));
});

test("mapping completion does not relabel an approved or deferred migration as modularity", () => {
  for (const disposition of ["PROPOSED", "APPROVED", "DEFERRED"]) {
    const data = input();
    Object.assign(data.architecture.coverage[0], { modularity: "TANGLED", followUp: "proposal#import-owner-and-checkpoint" });
    data.architecture.proposal = { source: "proposal", disposition, ...(disposition !== "PROPOSED" ? { decision: "human-source" } : {}) };
    const r = planned({ ...pending(accept(data)), status: "ACCEPTED" }); delete r.work; delete r.phase;
    const result = readCapabilityAdoption(state(r), []);
    assert.deepEqual(result.issues, []);
    assert.equal(result.readiness.preparation.codeMapped, true);
    assert.equal(result.readiness.preparation.modular, false);
    assert.equal(result.readiness.architecture.productMutation, "NOT_AUTHORIZED");
    delete r.notice;
    assert.equal(readCapabilityAdoption(state(r), []).coverage, "INVALID");
  }
});

test("missing plan uses the existing deduplicated Guard route, planned waiting stays quiet", () => {
  const data = input(); delete data.architecture;
  const check = record => {
    const result = readCapabilityAdoption(state(record), lease());
    return { ok: !result.issues.length, stateIssues: result.issues, graphIssues: [] };
  };
  const gap = check(pending(data));
  const incident = classifyGuard(gap, "");
  assert.equal(incident.action, "WAKE");
  assert.equal(classifyGuard(gap, "", { acceptedIncidentId: incident.incidentId }).action, "NOOP");
  assert.equal(classifyGuard(check(planned(pending(data))), "").action, "NOOP");
});

test("update, safe checkpoint, return, complete map and next update reuse one owner and evidence", () => {
  const data = input(); data.checks = [];
  const owner = { id: "same-owner", scope: data.scope, status: "WAITING", checkpoint: "current-task-saved-result" };
  assert.equal(assessCapabilityReadiness({ ...data, owner }).action, "WAIT_OWNER");
  assert.deepEqual(readCapabilityAdoption(state(planned(pending(data))), lease()).issues, []);
  owner.status = "WORKING";
  assert.equal(assessCapabilityReadiness({ ...data, owner }).action, "REUSE_OWNER");
  data.checks = input().checks; owner.status = "RETURNED";
  assert.equal(assessCapabilityReadiness({ ...data, owner }).action, "REVIEW_MAINTENANCE_RETURN");
  const done = accept(data);
  const record = { ...pending(done), status: "ACCEPTED" }; delete record.work; delete record.phase;
  const result = readCapabilityAdoption(state(record), []);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.readiness.preparation, { codeMapped: true, modular: true, required: [] });
  assert.equal(assessCapabilityReadiness({ ...done, trigger: "update", sourceRevision: "unrelated-commit" }).action, "REUSE_ACCEPTED");
});
