import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assessCapabilityReadiness, readCapabilityAdoption } from "../scripts/adoption-plan.mjs";
import { classifyGuard } from "../scripts/vydykhai.mjs";
import { planAdoption } from "../scripts/adoption-plan.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
const bindings = Object.fromEntries(ids.map(id => [id, `relevant:${id}:r1`]));
const verified = ids.map(id => ({ id, status: "VERIFIED", binding: bindings[id], checkedBinding: bindings[id], source: `source:${id}` }));
const base = { trigger: "launch", scope: "shared-top-level", sourceRevision: "HEAD-1", bindings, checks: [] };
// Pre-assessment snapshots remain readable; current activation is tested separately.
const check = input => assessCapabilityReadiness({ ...base, ...input }, { requireArchitecture: false });
const proof = Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(k => [k, `evidence:${k}`]));
const accepted = () => ({ relevantKey: check({ checks: verified }).relevantKey, status: "ACCEPTED", acceptedBy: "project-owner", routeProof: proof });

test("new empty project starts one focused maintenance route before dependent dispatch", () => {
  const result = check({});
  assert.equal(result.action, "ASSIGN_MAINTENANCE");
  assert.deepEqual(result.gaps, ids);
  assert.equal(result.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  assert.equal(result.independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
});

test("accepted current map is reused across reconnect, update and irrelevant source changes", () => {
  for (const trigger of ["reconnect", "continue", "update"]) {
    const result = check({ trigger, sourceRevision: "unrelated-HEAD-2", checks: verified, accepted: accepted() });
    assert.equal(result.action, "REUSE_ACCEPTED");
    assert.equal(result.dependentDispatch, "READY");
  }
});

test("candidate, stale, inaccessible and damaged evidence cannot certify readiness", () => {
  const candidate = verified.map(c => c.id === "module-map" ? { ...c, status: "CANDIDATE" } : c);
  assert.deepEqual(check({ checks: candidate }).gaps, ["module-map"]);
  assert.equal(check({ checks: candidate }).action, "ASSIGN_MAINTENANCE");
  const stale = verified.map(c => c.id === "module-contracts" ? { ...c, checkedBinding: "old" } : c);
  assert.deepEqual(check({ checks: stale }).gaps, ["module-contracts"]);
  const inaccessible = verified.map(c => c.id === "graph-routes" ? { ...c, status: "INACCESSIBLE" } : c);
  assert.equal(check({ checks: inaccessible }).action, "LIMITED_ACCESS");
  assert.throws(() => check({ checks: [...verified, verified[0]] }), /Invalid capability readiness input/);
  assert.throws(() => check({ checks: verified.map(c => c.id === "code-map" ? { ...c, source: "" } : c) }), /Invalid capability readiness input/);
  assert.throws(() => check({ checks: verified, bindings: { ...bindings, "code-map": "changed" } }), /Invalid capability readiness input/);
  assert.throws(() => check({ checks: verified, boundaryApproved: "yes" }), /Invalid capability readiness input/);
  assert.equal(check({ checks: verified, accepted: { ...accepted(), routeProof: { ...proof, nextRetrieval: "" } } }).action, "REVIEW_ROUTE_PROOF");
});

test("shared owner requires identity and waiting checkpoint; unchanged defect does not retry across kits", () => {
  const relevantKey = check({}).relevantKey;
  const owner = { id: "existing-task", scope: base.scope, relevantKey, status: "WORKING" };
  assert.equal(check({ trigger: "update", owner }).action, "REUSE_OWNER");
  assert.equal(check({ owner }).owner, "existing-task");
  assert.equal(check({ owner: { ...owner, id: "" } }).action, "RECONCILE_OWNER");
  assert.equal(check({ owner: { ...owner, status: "WAITING" } }).action, "RECONCILE_OWNER");
  assert.equal(check({ owner: { ...owner, status: "WAITING", checkpoint: "approved-source-arrives" } }).action, "WAIT_OWNER");
  const changedBindings = { ...bindings, "code-map": "relevant:code-map:r2" };
  const changedChecks = ids.map(id => ({ id, status: "MISSING", binding: changedBindings[id] }));
  const continued = check({ bindings: changedBindings, checks: changedChecks, owner });
  assert.equal(continued.action, "REUSE_OWNER");
  assert.equal(continued.owner, "existing-task");
  assert.notEqual(continued.relevantKey, relevantKey);
  const defectKey = check({}).defectKey;
  assert.equal(check({ trigger: "update", sourceRevision: "new-kit-HEAD", repairAttemptedFor: defectKey }).action, "WAIT_CHECKPOINT");
  const afterFailedRepair = check({ bindings: changedBindings, checks: changedChecks, repairAttemptedFor: defectKey });
  assert.equal(afterFailedRepair.action, "WAIT_CHECKPOINT");
  assert.equal(afterFailedRepair.defectKey, defectKey);
});

test("new boundary decision outranks accepted evidence; independent work continues", () => {
  const pending = check({ boundaryChange: true, checks: verified, accepted: accepted() });
  assert.equal(pending.action, "PROPOSE_MIGRATION");
  assert.equal(pending.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  assert.equal(pending.independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
  assert.equal(check({ boundaryChange: true, boundaryApproved: true, checks: verified, accepted: accepted() }).action, "ASSIGN_MAINTENANCE");
  assert.equal(check({ boundaryChange: true, boundaryApproved: true, checks: verified,
    repairAttemptedFor: check({}).defectKey }).action, "WAIT_CHECKPOINT");
});

test("packaging proof is separate and gates only a selected consuming module", () => {
  const result = check({ checks: verified, accepted: accepted(), modules: [{ id: "candidate", requiredForConsumption: true, behavior: "ACCEPTED", packaging: "UNPROVEN" }] });
  assert.equal(result.action, "REUSE_ACCEPTED");
  assert.equal(result.status, "ACCEPTED_WITH_LIMITS");
  assert.deepEqual(result.packagingGaps, ["candidate"]);
  assert.equal(result.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  assert.equal(check({ checks: verified, accepted: accepted(), modules: [{ id: "other", requiredForConsumption: false, behavior: "CANDIDATE", packaging: "UNPROVEN" }] }).dependentDispatch, "READY");
  assert.throws(() => check({ checks: verified, modules: [{ id: "bad", requiredForConsumption: true, behavior: "DONE", packaging: "UNPROVEN" }] }), /Invalid capability readiness input/);
});

test("1.32.1 update exposes one diagnostic requirement while repeated plan retrieval preserves identity", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "vydykhai.json"), "utf8"));
  const changelog = await readFile(path.join(root, "docs/COLLABORATION_FRAMEWORK_CHANGELOG.md"), "utf8");
  const input = { manifest, managedFiles: { "core.md": "bundle" }, agentsBlockHash: "core", sourceRevision: "kit-source", changelog };
  const first = planAdoption({ ...input, previousLock: { installedVersion: "1.32.1" } });
  assert.deepEqual(first.releases.map(r => r.version), ["1.32.2", "1.32.3", "1.32.4", "1.32.5"]);
  assert.ok(first.requirements.some(r => r.id === "module-boundaries" && r.action.includes("first inventory")));
  const repeated = planAdoption({ ...input, previousLock: { installedVersion: "1.32.2", adoptionPlan: first } });
  assert.equal(repeated.id, first.id);
  assert.deepEqual(repeated.releases, first.releases);
});

test("returned inventory demands parent review, not another assignment or a passive owner", () => {
  const owner = { id: "maintenance", scope: base.scope, status: "RETURNED" };
  for (const trigger of ["update", "reconnect", "continue"]) {
    const result = check({ trigger, owner });
    assert.equal(result.action, "REVIEW_MAINTENANCE_RETURN");
    assert.equal(result.owner, owner.id);
    assert.equal(result.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  }
  assert.equal(check({ owner: { ...owner, status: "PREPARED" } }).action, "START_OWNER");
  assert.equal(check({ owner: { ...owner, status: "CLOSED" } }).action, "RECONCILE_OWNER");
  const repaired = check({ owner, checks: verified });
  assert.equal(repaired.action, "REVIEW_MAINTENANCE_RETURN", "returned files are not accepted route proof");
  assert.equal(check({ owner, checks: verified, accepted: accepted() }).action, "REUSE_ACCEPTED");
});

const obligation = { schemaVersion: 1, status: "PENDING", scope: base.scope,
  evidence: "inventory-receipt", work: "MAINT-1", phase: "INVENTORY" };
const adoptionState = value => `Framework: 1.32.3\nCapability adoption: ${JSON.stringify(value)}`;
const lease = (state, checkpoint = "inventory-return") =>
  [["MAINT-1 [SYSTEM] - preparation", state, "maintenance", "repo", "baseline", "setup", checkpoint, "outbox"]];

const currentState = value => `Framework: 1.32.4\nCapability adoption: ${JSON.stringify(value)}`;
const readiness = { bindings, checks: verified, accepted: accepted() };

test("published readiness cannot substitute graph routes for the other artifact checks", () => {
  const graphOnly = { bindings, checks: verified.filter(c => c.id === "graph-routes") };
  const pending = readCapabilityAdoption(currentState({ ...obligation, readiness: graphOnly }), lease("WORKING"));
  assert.deepEqual(pending.issues, []);
  assert.deepEqual(pending.readiness.gaps, ids.filter(id => id !== "graph-routes"));
  assert.equal(pending.readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  for (const status of ["ACCEPTED", "ACCEPTED_WITH_LIMITS"]) {
    const claimed = { schemaVersion: 1, scope: base.scope, evidence: "graph-route-receipt", status,
      limits: "packaging not yet proven", readiness: { ...graphOnly, accepted: accepted() } };
    assert.equal(readCapabilityAdoption(currentState(claimed), []).coverage, "INVALID");
  }
});

test("current adoption needs scoped evidence and complete leases, not an installation claim", () => {
  assert.equal(readCapabilityAdoption(currentState(obligation), lease("WORKING")).coverage, "INVALID");
  const record = { ...obligation, readiness };
  assert.equal(readCapabilityAdoption(currentState(record), lease("WORKING")).coverage, "STRUCTURE_ONLY");
  assert.equal(readCapabilityAdoption(currentState(record), [lease("WORKING")[0].slice(0, 7)]).coverage, "INVALID");
  assert.equal(readCapabilityAdoption(currentState({ ...record, readiness: { ...readiness, scope: "narrower-task" } }), lease("WORKING")).coverage, "INVALID");
  assert.equal(readCapabilityAdoption(currentState({ ...record, readiness: { bindings, checks: "bad" } }), lease("WORKING")).coverage, "INVALID");
});

test("source-bound acceptance, proof and packaging limits survive published State readback", () => {
  const complete = { schemaVersion: 1, status: "ACCEPTED", scope: base.scope, evidence: "durable-proof", readiness };
  assert.equal(readCapabilityAdoption(currentState(complete), []).readiness.dependentDispatch, "READY");
  const missingProof = { ...readiness, accepted: { ...accepted(), routeProof: { ...proof, nextRetrieval: "" } } };
  assert.equal(readCapabilityAdoption(currentState({ ...complete, readiness: missingProof }), []).coverage, "INVALID");
  const packaging = { ...readiness, modules: [{ id: "producer", requiredForConsumption: true, behavior: "ACCEPTED", packaging: "UNPROVEN" }] };
  assert.equal(readCapabilityAdoption(currentState({ ...complete, readiness: packaging }), []).coverage, "INVALID");
  const limited = readCapabilityAdoption(currentState({ ...complete, status: "ACCEPTED_WITH_LIMITS", limits: "producer connection unproven", readiness: packaging }), []);
  assert.deepEqual(limited.issues, []);
  assert.equal(limited.readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  const malformed = readCapabilityAdoption(currentState({ ...complete, work: "old-work" }), []);
  assert.equal(malformed.coverage, "INVALID");
  assert.equal(malformed.readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  const stale = { ...readiness, checks: verified.map(c => c.id === "code-map" ? { ...c, checkedBinding: "old-map" } : c) };
  assert.equal(readCapabilityAdoption(currentState({ ...complete, readiness: stale }), []).coverage, "INVALID");
});

test("update replay closes inventory, repair, proof and retrieval with the same maintenance work", () => {
  const owner = { id: "maintenance", scope: base.scope, status: "WORKING" };
  const evaluate = (record, state) => readCapabilityAdoption(currentState({ readiness: { bindings, checks: [] }, ...record }), lease(state));
  assert.deepEqual(evaluate(obligation, "WORKING").issues, []);
  assert.deepEqual(evaluate(obligation, "WORKING").readiness.gaps, ids);
  assert.ok(evaluate(obligation, "RETURNED").issues.some(i => /requires routing/.test(i)));
  assert.ok(evaluate(obligation, "CLOSED").issues.length, "a finished installer cannot own pending capability");
  assert.equal(check({ owner: { ...owner, status: "RETURNED" } }).action, "REVIEW_MAINTENANCE_RETURN");
  const repair = { ...obligation, phase: "REPAIR", evidence: "reviewed-inventory-followup",
    readiness: { bindings, checks: verified.filter(c => c.id === "graph-routes") } };
  assert.deepEqual(evaluate(repair, "WORKING").issues, []);
  assert.deepEqual(evaluate(repair, "WORKING").readiness.gaps, ids.filter(id => id !== "graph-routes"));
  assert.equal(check({ owner }).action, "REUSE_OWNER");
  const provedDocs = { ...repair, phase: "PROOF", evidence: "repaired-docs", readiness: { bindings, checks: verified } };
  assert.deepEqual(evaluate(provedDocs, "WORKING").issues, []);
  assert.equal(evaluate(provedDocs, "WORKING").readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  assert.equal(check({ checks: verified }).action, "REVIEW_ROUTE_PROOF");
  const complete = { schemaVersion: 1, status: "ACCEPTED", scope: base.scope, evidence: "reviewed-route-and-retrieval-proof", readiness };
  assert.deepEqual(evaluate(complete, "CLOSED").issues, []);
  assert.equal(evaluate(complete, "CLOSED").readiness.dependentDispatch, "READY");
  assert.equal(check({ checks: verified, accepted: accepted() }).action, "REUSE_ACCEPTED");
});

test("pending capability cannot hide behind product continuation; existing Guard routes once", () => {
  const stalled = readCapabilityAdoption(adoptionState(obligation), lease("CLOSED"));
  const result = { ok: false, stateIssues: stalled.issues, graphIssues: [] };
  const first = classifyGuard(result, "Project Guard: ACTIVE | Incident: none");
  assert.equal(first.action, "WAKE");
  assert.equal(classifyGuard(result, "", { acceptedIncidentId: first.incidentId }).action, "NOOP");
  const progressing = readCapabilityAdoption(adoptionState({ ...obligation, phase: "REPAIR" }), lease("WORKING"));
  assert.equal(classifyGuard({ ok: true, stateIssues: progressing.issues, graphIssues: [] }, "").action, "NOOP");
});

test("capability waits preserve pauses, access and repair limits without restarting work", () => {
  for (const checkpoint of ["human-pause-1", "participant-access-1", "repair-limit-decision-1"]) {
    assert.deepEqual(readCapabilityAdoption(adoptionState(obligation), lease("WAITING", checkpoint)).issues, []);
    assert.equal(check({ owner: { id: "maintenance", scope: base.scope, status: "WAITING", checkpoint } }).action, "WAIT_OWNER");
  }
  assert.ok(readCapabilityAdoption(adoptionState(obligation), lease("WAITING", "none")).issues.length);
  for (const state of ["PREPARED", "OUTCOME_UNKNOWN", "CLOSED", "RETURNED"]) {
    assert.ok(readCapabilityAdoption(adoptionState(obligation), lease(state)).issues.length);
  }
  assert.ok(readCapabilityAdoption(adoptionState(obligation), []).issues.length);
  assert.ok(readCapabilityAdoption(adoptionState(obligation), [...lease("WORKING"), ...lease("WORKING")]).issues.length);
});

test("legacy snapshots remain explicit unverified; new activation requires a structured obligation", () => {
  assert.equal(readCapabilityAdoption("Framework: 1.32.2\nCapability adoption: pending", []).coverage, "LEGACY_UNVERIFIED");
  assert.equal(readCapabilityAdoption("Framework: 1.32.3", []).coverage, "INVALID");
  assert.equal(readCapabilityAdoption("Framework: 1.32.3\nCapability adoption: pending", []).coverage, "INVALID");
  assert.equal(readCapabilityAdoption(adoptionState(obligation) + "\nCapability adoption: {}", []).coverage, "INVALID");
  const limits = { schemaVersion: 1, status: "ACCEPTED_WITH_LIMITS", scope: base.scope, evidence: "accepted-scoped-proof" };
  assert.ok(readCapabilityAdoption(adoptionState(limits), []).issues.length);
  assert.equal(readCapabilityAdoption(adoptionState({ ...limits, limits: "unavailable-participant" }), []).coverage, "STRUCTURE_ONLY");
  assert.ok(readCapabilityAdoption(adoptionState({ ...obligation, status: "ACCEPTED" }), lease("CLOSED")).issues.length);
});

test("CLI classifies a transient Project State export without writing adoption progress", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "vydykhai-readiness-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = args => spawnSync(process.execPath, [path.join(root, "scripts/vydykhai.mjs"), ...args], { encoding: "utf8" });
  assert.equal(run(["install", dir]).status, 0);
  const input = path.join(dir, "readiness.json");
  await writeFile(input, JSON.stringify(base));
  const before = await readFile(path.join(dir, ".vydykhai-lock.json"), "utf8");
  const result = run(["adoption-plan", dir, "--input", input, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).capabilityReadiness.action, "ASSIGN_MAINTENANCE");
  assert.equal(await readFile(path.join(dir, ".vydykhai-lock.json"), "utf8"), before);
});
