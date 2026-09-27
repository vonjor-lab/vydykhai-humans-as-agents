import test from "node:test";
import assert from "node:assert/strict";
import { readCapabilityAdoption, assessCapabilityReadiness } from "../scripts/adoption-plan.mjs";
import { classifyGuard } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-02T12:00:00Z");
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
function fixture() {
  const readiness = { bindings: Object.fromEntries(ids.map(id => [id, id + ":r1"])) };
  readiness.checks = ids.map(id => ({ id, status: "VERIFIED", binding: readiness.bindings[id],
    checkedBinding: readiness.bindings[id], source: "proof:" + id }));
  readiness.architecture = { project: "project", scope: "project", inventory: { source: "outline:r1", areas: ["input", "engine", "catalog"] },
    source: "map:r1", reviewedBy: "manager", review: "review:r1", proposal: { source: "proposal:r1", disposition: "PROPOSED" },
    coverage: ["input", "engine", "catalog"].map(area => ({ area, access: "AVAILABLE", modularity: "PARTIAL",
      documentation: "GAPS", evidence: "proof:" + area, followUp: area === "engine" ? "ENGINE" : "PREP" })) };
  const record = { schemaVersion: 1, scope: "project", status: "PENDING", work: "ENGINE", phase: "PROOF", evidence: "map:r1", readiness,
    plan: "plan:all-areas", notice: "message:whole-plan", steps: [
      { covers: ["modular"], areas: ["engine"], work: "ENGINE", action: "Prove fixed public engine release" },
      { covers: ["modular"], areas: ["input", "catalog"], work: "PREP", action: "Review remaining boundaries and propose staged migration" }] };
  const leases = ["ENGINE", "PREP"].map(work => [work, work === "ENGINE" ? "WORKING" : "WAITING", "owner:" + work,
    "repo", "base", "scope", JSON.stringify({ id: work + ":review", owner: "owner:" + work,
      dueAt: "2026-01-02T13:00:00Z", expected: work + ":result", receiptId: work + ":return", authority: "human:bounded-scope" }), "outbox"]);
  return { record, leases };
}
const human = "Human attention: PENDING | ID: PREP-QUESTION | Request: Complete remaining documentation after this stage? | Source: human:pause | Resume after: explicit answer";
function check({ record, leases }, { version = "1.32.8", time = now, attention = "Human attention: NONE" } = {}) {
  return readCapabilityAdoption(`Framework: ${version}\n${attention}\nCapability adoption: ${JSON.stringify(record)}`, leases, { now: time });
}

test("regression: a local product step cannot hide abandoned project preparation", () => {
  const f = fixture(); f.record.steps.pop(); delete f.record.steps[0].areas;
  f.leases[1][1] = "CLOSED";
  assert.deepEqual(check(f, { version: "1.32.7" }).issues, []);
  const r = check(f);
  assert.equal(r.coverage, "INVALID");
  assert.ok(r.issues.some(i => i.includes("catalog: unresolved area")));
  assert.equal(r.readiness.preparation.codeMapped, true);
  assert.equal(r.readiness.preparation.modular, false);
});

test("grouped coverage reuses actual work; no task per module and no product stop", () => {
  const f = fixture(); const before = JSON.stringify(f);
  assert.deepEqual(check(f).issues, []);
  assert.equal(JSON.stringify(f), before);
  assert.equal(assessCapabilityReadiness({ ...f.record.readiness, scope: "project", trigger: "continue" }).independentWork,
    "CONTINUE_WITHIN_EXISTING_AUTHORITY");
});

test("every gap needs unique scoped coverage and a matching current work reference", () => {
  for (const mutate of [
    f => { f.record.steps[1].areas = ["input"]; },
    f => { f.record.steps[1].areas.push("engine"); },
    f => { f.record.steps[1].areas.push("not-in-inventory"); },
    f => { f.record.steps[1].areas.push("catalog"); },
    f => { f.record.steps[1].areas = "input,catalog"; },
    f => { f.record.readiness.architecture.coverage[2].followUp = "old-closed-preparation#plan"; },
    f => { f.record.steps[1].work = "missing-owner"; },
    f => { f.leases[1][1] = "CLOSED"; },
    f => { f.leases[1][1] = "RETURNED"; },
    f => { f.leases[1][1] = "PREPARED"; },
    f => { f.record.steps.push({ covers: ["modular"], work: "ENGINE", action: "Unscoped work" }); },
  ]) { const f = fixture(); mutate(f); assert.equal(check(f).coverage, "INVALID"); }
});

test("unknown, inaccessible, undocumented and missing rows remain routed", () => {
  for (const kind of ["unknown", "inaccessible", "docs", "missing"]) {
    const f = fixture(); const row = f.record.readiness.architecture.coverage[2];
    if (kind === "unknown") row.modularity = "UNKNOWN";
    if (kind === "inaccessible") Object.assign(row, { access: "INACCESSIBLE", modularity: "UNKNOWN", documentation: "UNKNOWN" });
    if (kind === "docs") row.modularity = "ENCAPSULATED";
    if (kind === "missing") f.record.readiness.architecture.coverage.pop();
    if (["missing", "inaccessible"].includes(kind)) f.record.steps[1].covers.push("codeMapped");
    assert.deepEqual(check(f).issues, [], kind);
    f.record.steps[1].areas = ["input"];
    assert.equal(check(f).coverage, "INVALID", kind);
  }
});

test("deferred areas return for bounded review, not forced implementation or a new guard loop", () => {
  const f = fixture(); const result = check(f, { time: now + 3600000 });
  assert.ok(result.issues.some(i => i.includes("review checkpoint is due")));
  const report = { ok: false, stateIssues: result.issues, graphIssues: [] };
  const wake = classifyGuard(report, "");
  assert.equal(wake.action, "WAKE");
  assert.equal(classifyGuard(report, "", { acceptedIncidentId: wake.incidentId }).action, "NOOP");
  assert.equal(classifyGuard(report, "", { wokenIncidentId: wake.incidentId }).action, "AUDIT_REQUIRED");
  assert.equal(classifyGuard(report, "", { wokenIncidentId: wake.incidentId, repairIncidentId: wake.incidentId, repairAttempts: 1 }).action, "CONTROL_DEGRADED");
  assert.equal(f.leases[1][1], "WAITING");
});

test("explicit unanswered pause stays quiet even while other covered work continues", () => {
  const f = fixture(); f.record.steps[1].decisionId = "PREP-QUESTION";
  const cp = JSON.parse(f.leases[1][6]); cp.dueAt = "2026-01-01T13:00:00Z"; f.leases[1][6] = JSON.stringify(cp);
  assert.deepEqual(check(f, { attention: human }).issues, []);
  assert.equal(check(f).coverage, "INVALID", "answered gate must be reconciled");
  assert.equal(check(f, { attention: human.replace("PREP-QUESTION", "OTHER-QUESTION") }).coverage, "INVALID");
});

test("partial completion keeps unrelated obligations; closure requires successor or accepted row evidence", () => {
  const f = fixture(); const row = f.record.readiness.architecture.coverage[1];
  Object.assign(row, { modularity: "ENCAPSULATED", documentation: "CURRENT" });
  assert.equal(check(f).coverage, "INVALID", "remove satisfied area from live steps");
  f.record.steps.shift(); f.record.work = "PREP"; f.leases[0][1] = "CLOSED";
  assert.deepEqual(check(f).issues, []);
  f.leases[1][1] = "CLOSED";
  assert.equal(check(f).coverage, "INVALID");
  const next = [...f.leases[1]]; next[0] = "NEXT"; next[1] = "WORKING"; f.leases.push(next);
  f.record.work = "NEXT"; f.record.steps[0].work = "NEXT";
  for (const area of ["input", "catalog"]) f.record.readiness.architecture.coverage.find(r => r.area === area).followUp = "NEXT";
  assert.deepEqual(check(f).issues, []);
});

test("first inventory and global contract verification still work without fabricated areas", () => {
  const f = fixture(); delete f.record.readiness.architecture;
  f.record.steps = [{ covers: ["codeMapped", "modular"], work: "ENGINE", action: "Inventory actual project first" }];
  assert.deepEqual(check(f).issues, []);
  const g = fixture();
  for (const row of g.record.readiness.architecture.coverage) Object.assign(row, { modularity: "ENCAPSULATED", documentation: "CURRENT" });
  g.record.readiness.checks.find(c => c.id === "module-contracts").status = "STALE";
  g.record.steps = [{ covers: ["modular"], work: "PREP", action: "Verify current global contract binding" }];
  assert.deepEqual(check(g).issues, []);
});

test("completed evidence leaves no artificial preparation task", () => {
  const f = fixture(); const data = f.record.readiness;
  for (const row of data.architecture.coverage) Object.assign(row, { modularity: "ENCAPSULATED", documentation: "CURRENT" });
  data.accepted = { status: "ACCEPTED", acceptedBy: "manager",
    relevantKey: assessCapabilityReadiness({ ...data, trigger: "continue", scope: "project" }).relevantKey,
    routeProof: Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(k => [k, "proof:" + k])) };
  f.record.status = "ACCEPTED"; delete f.record.work; delete f.record.phase; delete f.record.steps;
  f.leases = [];
  assert.deepEqual(check(f).issues, []);
  assert.equal(check(f).readiness.preparation.modular, true);
});
