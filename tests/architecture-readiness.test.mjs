import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assessArchitectureCoverage, assessCapabilityReadiness, readCapabilityAdoption } from "../scripts/adoption-plan.mjs";
import { classifyGuard } from "../scripts/vydykhai.mjs";

const areas = ["intake", "planning", "delivery"];
const architecture = () => ({ project: "sample-platform", scope: "sample-platform",
  inventory: { source: "project-outline:r1", areas: [...areas] }, source: "module-map:r1#assessment",
  reviewedBy: "project-orchestrator", review: "coverage-review:r1",
  coverage: areas.map(area => ({ area, access: "AVAILABLE", modularity: "ENCAPSULATED",
    documentation: "CURRENT", evidence: `module-map:r1#${area}` })) });
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
const bindings = Object.fromEntries(ids.map(id => [id, `${id}:r1`]));
const input = () => ({ trigger: "update", scope: "existing-adoption", bindings,
  checks: ids.map(id => ({ id, status: "VERIFIED", binding: bindings[id], checkedBinding: bindings[id], source: `evidence:${id}` })),
  architecture: architecture() });
const accept = data => ({ ...data, accepted: { status: "ACCEPTED", acceptedBy: "project-orchestrator",
  relevantKey: assessCapabilityReadiness(data).relevantKey,
  routeProof: Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(k => [k, `proof:${k}`])) } });
const record = data => `Framework: 1.32.5\nCapability adoption: ${JSON.stringify({ schemaVersion: 1,
  status: "ACCEPTED", scope: data.scope, evidence: "accepted-preparation", readiness: data })}`;

test("initial preparation requires an architecture assessment, not five checked file types alone", () => {
  const data = input(); delete data.architecture;
  const result = assessCapabilityReadiness(accept(data), { requireArchitecture: true });
  assert.equal(result.status, "PENDING");
  assert.equal(result.action, "ASSIGN_MAINTENANCE");
  assert.equal(result.architecture.status, "PENDING");
  assert.equal(readCapabilityAdoption(record(accept(data)), []).coverage, "INVALID");
});

test("a local route cannot replace the independently inventoried project coverage", () => {
  const local = architecture(); local.scope = "planning-only";
  assert.equal(assessArchitectureCoverage(local).status, "PENDING");
  local.scope = local.project; local.coverage = local.coverage.slice(0, 1);
  assert.deepEqual(assessArchitectureCoverage(local).gaps, ["planning: not assessed", "delivery: not assessed"]);
  const data = input(); const accepted = accept(data);
  data.architecture.coverage.pop();
  assert.equal(assessCapabilityReadiness({ ...data, accepted: accepted.accepted }).status, "PENDING");
});

test("a monolith can finish assessment with a proposed plan, without executing refactoring", () => {
  const data = input();
  data.architecture.coverage[1] = { ...data.architecture.coverage[1], modularity: "TANGLED", documentation: "GAPS", followUp: "plan:r1#planning-owner-and-decision" };
  assert.equal(assessArchitectureCoverage(data.architecture).status, "PENDING", "findings need an actionable proposal");
  data.architecture.proposal = { source: "plan:r1", disposition: "PROPOSED" };
  const complete = assessCapabilityReadiness(accept(data));
  assert.equal(complete.status, "ACCEPTED");
  assert.deepEqual(complete.architecture.improvements, ["planning"]);
  assert.equal(complete.architecture.productMutation, "NOT_AUTHORIZED");
  assert.equal(readCapabilityAdoption(record(accept(data)), []).coverage, "STRUCTURE_ONLY");
  data.modules = [{ id: "planning-module", requiredForConsumption: true, behavior: "CANDIDATE", packaging: "UNPROVEN" }];
  const consuming = assessCapabilityReadiness(accept(data));
  assert.equal(consuming.status, "ACCEPTED_WITH_LIMITS");
  assert.equal(consuming.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF", "audit completion does not seal a module");
});

test("documentation gaps and ambiguous boundaries need owned follow-ups; inaccessible areas remain explicit", () => {
  const a = architecture();
  a.coverage[0].documentation = "GAPS";
  assert.equal(assessArchitectureCoverage(a).status, "PENDING");
  a.coverage[0].followUp = "maintenance-1:intake-docs";
  assert.equal(assessArchitectureCoverage(a).status, "COMPLETE");
  a.coverage[1].modularity = "UNKNOWN";
  a.coverage[1].followUp = "discovery-1:boundary-question";
  a.proposal = { source: "plan:r1", disposition: "PROPOSED" };
  assert.equal(assessArchitectureCoverage(a).status, "PENDING", "unexamined architecture is not complete");
  a.coverage[1] = { area: "planning", access: "INACCESSIBLE", modularity: "UNKNOWN", documentation: "UNKNOWN",
    evidence: "participant-access-denied", followUp: "owner-2:access-checkpoint" };
  const limited = assessArchitectureCoverage(a);
  assert.equal(limited.status, "COMPLETE_WITH_LIMITS");
  assert.deepEqual(limited.limits, ["planning"]);
  const data = accept({ ...input(), architecture: a });
  assert.equal(assessCapabilityReadiness(data).status, "ACCEPTED_WITH_LIMITS");
  assert.equal(readCapabilityAdoption(record(data), []).coverage, "INVALID", "cannot publish unlimited acceptance");
});

test("bad inventories, duplicate areas, unexplained exclusions and invented plan approval fail closed", () => {
  for (const mutate of [a => { a.inventory.areas = []; }, a => { a.inventory.areas.push("planning"); },
    a => { a.coverage.push(a.coverage[0]); }, a => { a.coverage[0].area = "outside-scope"; },
    a => { a.coverage[0].modularity = "DONE"; }, a => { a.proposal = { source: "plan", disposition: "APPROVED" }; }]) {
    const a = structuredClone(architecture()); mutate(a);
    assert.throws(() => assessArchitectureCoverage(a), /Invalid architecture assessment/);
  }
  const a = architecture(); delete a.review;
  assert.equal(assessArchitectureCoverage(a).status, "PENDING", "producer assertions need parent coverage review");
});

test("accepted assessment survives unrelated commits and kit updates, not changed project coverage", () => {
  const data = accept(input()); const first = assessCapabilityReadiness(data);
  for (const trigger of ["launch", "reconnect", "update", "continue"]) {
    const reused = assessCapabilityReadiness({ ...data, trigger, sourceRevision: "unrelated-new-commit" });
    assert.equal(reused.action, "REUSE_ACCEPTED"); assert.equal(reused.relevantKey, first.relevantKey);
  }
  const changed = structuredClone(data); changed.architecture.inventory.areas.push("reporting");
  const pending = assessCapabilityReadiness(changed);
  assert.equal(pending.status, "PENDING"); assert.equal(pending.defectKey, first.defectKey);
});

test("the existing owner carries audit gaps through return and human wait without duplicate work", () => {
  const data = input(); data.architecture.coverage.pop();
  const owner = { id: "maintenance-1", scope: data.scope, status: "WORKING" };
  assert.equal(assessCapabilityReadiness({ ...data, owner }).action, "REUSE_OWNER");
  assert.equal(assessCapabilityReadiness({ ...data, owner: { ...owner, status: "RETURNED" } }).action, "REVIEW_MAINTENANCE_RETURN");
  assert.equal(assessCapabilityReadiness({ ...data, owner: { ...owner, status: "WAITING", checkpoint: "access-decision" } }).action, "WAIT_OWNER");
  const first = assessCapabilityReadiness(data);
  assert.equal(assessCapabilityReadiness({ ...data, repairAttemptedFor: first.defectKey }).action, "WAIT_CHECKPOINT");
  assert.equal(first.independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
});

test("safe activation retains prior work but cannot carry local-only acceptance into the new kit", () => {
  const data = input(); delete data.architecture;
  const legacy = accept(data);
  assert.equal(readCapabilityAdoption(record(legacy).replace("1.32.5", "1.32.4"), []).coverage, "STRUCTURE_ONLY");
  assert.equal(readCapabilityAdoption(record(legacy), []).coverage, "INVALID");
  const pending = { schemaVersion: 1, status: "PENDING", scope: data.scope,
    evidence: "retained-local-inventory", work: "MAINT-1", phase: "INVENTORY", readiness: legacy };
  const state = `Framework: 1.32.5\nCapability adoption: ${JSON.stringify(pending)}`;
  for (const checkpoint of ["inventory-return", "human-pause", "access-decision"]) {
    const lease = [["MAINT-1", "WAITING", "same-owner", "repo", "baseline", "setup", checkpoint, "outbox"]];
    const result = readCapabilityAdoption(state, lease);
    assert.deepEqual(result.issues, []);
    assert.equal(result.readiness.architecture.status, "PENDING");
    assert.equal(result.readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  }
});

test("existing Guard stays quiet for owned assessment or human wait and routes an abandoned audit once", () => {
  const data = input(); delete data.architecture;
  const pending = { schemaVersion: 1, status: "PENDING", scope: data.scope,
    evidence: "retained-inventory", work: "MAINT-1", phase: "INVENTORY", readiness: data };
  const state = `Framework: 1.32.5\nCapability adoption: ${JSON.stringify(pending)}`;
  const check = status => {
    const lease = [["MAINT-1", status, "same-owner", "repo", "baseline", "setup", "human-checkpoint", "outbox"]];
    const result = readCapabilityAdoption(state, lease);
    return { ok: !result.issues.length, stateIssues: result.issues, graphIssues: [] };
  };
  for (const status of ["WORKING", "WAITING"]) assert.equal(classifyGuard(check(status), "").action, "NOOP");
  const abandoned = check("CLOSED");
  const incident = classifyGuard(abandoned, "");
  assert.equal(incident.action, "WAKE");
  assert.equal(classifyGuard(abandoned, "", { acceptedIncidentId: incident.incidentId }).action, "NOOP");
  const completed = accept(input());
  assert.equal(assessCapabilityReadiness({ ...completed, boundaryChange: true }).action, "PROPOSE_MIGRATION");
});

test("installed CLI routes incomplete architecture to the existing owner and reuses reviewed completion", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "vydykhai-architecture-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = fileURLToPath(new URL("../", import.meta.url));
  const installed = spawnSync(process.execPath, [path.join(root, "scripts/vydykhai.mjs"), "install", dir], { encoding: "utf8" });
  assert.equal(installed.status, 0, installed.stderr);
  const lockPath = path.join(dir, ".vydykhai-lock.json");
  const lock = await readFile(lockPath, "utf8");
  const inputPath = path.join(dir, "assessment-input.json");
  const cli = path.join(dir, "scripts/vydykhai.mjs");
  const run = async data => {
    await writeFile(inputPath, JSON.stringify(data));
    const result = spawnSync(process.execPath, [cli, "adoption-plan", dir, "--input", inputPath, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).capabilityReadiness;
  };
  const data = input(); delete data.architecture;
  const missing = await run(data);
  assert.equal(missing.action, "ASSIGN_MAINTENANCE");
  assert.equal(missing.architecture.status, "PENDING");
  assert.deepEqual(missing.preparation, { codeMapped: false, modular: false,
    required: ["COMPLETE_PROJECT_MAP", "ASSESS_AND_PLAN_MODULES"] });
  data.owner = { id: "existing-maintenance", scope: data.scope, status: "WORKING" };
  assert.equal((await run(data)).action, "REUSE_OWNER");
  data.architecture = architecture();
  data.architecture.coverage[0].modularity = "PARTIAL";
  data.architecture.coverage[0].followUp = "proposal:r1#owner-and-checkpoint";
  data.architecture.proposal = { source: "proposal:r1", disposition: "PROPOSED" };
  data.owner.status = "RETURNED";
  assert.equal((await run(data)).action, "REVIEW_MAINTENANCE_RETURN");
  assert.equal((await run(accept(data))).teamSync.status, "MISSING", "architecture proof alone cannot certify participant sync");
  const refs = [{ id: "module-map", revision: bindings["module-map"] }];
  data.teamSync = { scope: data.scope, registrySource: "fixture:single-owner-registry",
    artifacts: [{ ...refs[0], source: "fixture:module-map" }],
    participants: [{ id: "project-orchestrator", sourceRange: "fixture:through-assessment", artifacts: ["module-map"] }],
    receipts: [{ participant: "project-orchestrator",
      contribution: { disposition: "NO_CHANGE", sourceRange: "fixture:through-assessment", artifacts: refs,
        evidence: "fixture:source-review" },
      readback: { artifacts: refs, evidence: "fixture:own-readback", retrieval: "fixture:planning-module-query",
        application: "fixture:preserve-proposed-boundary-without-refactoring" } }] };
  const complete = await run(accept(data));
  assert.equal(complete.action, "REUSE_ACCEPTED");
  assert.equal(complete.preparation.codeMapped, true);
  assert.equal(complete.preparation.modular, false);
  const human = spawnSync(process.execPath, [cli, "adoption-plan", dir, "--input", inputPath], { encoding: "utf8" });
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /Whole project mapped: YES; modular architecture confirmed: NO/);
  assert.equal(complete.architecture.productMutation, "NOT_AUTHORIZED");
  assert.equal(await readFile(lockPath, "utf8"), lock, "classification must not rewrite installed state");
});
