import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assessCapabilityReadiness } from "../scripts/adoption-plan.mjs";
import { planAdoption } from "../scripts/adoption-plan.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
const bindings = Object.fromEntries(ids.map(id => [id, `relevant:${id}:r1`]));
const verified = ids.map(id => ({ id, status: "VERIFIED", binding: bindings[id], checkedBinding: bindings[id], source: `source:${id}` }));
const base = { trigger: "launch", scope: "shared-top-level", sourceRevision: "HEAD-1", bindings, checks: [] };
const check = input => assessCapabilityReadiness({ ...base, ...input });
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
  assert.equal(check({ owner: { ...owner, status: "WAITING", checkpoint: "approved-source-arrives" } }).action, "REUSE_OWNER");
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
  assert.deepEqual(first.releases.map(r => r.version), ["1.32.2"]);
  assert.ok(first.requirements.some(r => r.id === "module-boundaries" && r.action.includes("first inventory")));
  const repeated = planAdoption({ ...input, previousLock: { installedVersion: "1.32.2", adoptionPlan: first } });
  assert.equal(repeated.id, first.id);
  assert.deepEqual(repeated.releases, first.releases);
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
