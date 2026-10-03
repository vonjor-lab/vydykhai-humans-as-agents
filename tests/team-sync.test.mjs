import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assessTeamSync } from "../scripts/team-sync.mjs";
import { assessCapabilityReadiness, readCapabilityAdoption } from "../scripts/adoption-plan.mjs";

function sync() {
  const artifacts = [{ id: "design-rules", revision: "rules-r2", source: "accepted-design-guide" },
    { id: "memory", revision: "design-meaning-r2", source: "accepted-graph-design-section" }];
  const participants = ["design-owner", "consumer-owner"].map(id => ({ id, sourceRange: `${id}:through-event-2`,
    artifacts: artifacts.map(a => a.id) }));
  const refs = artifacts.map(({ id, revision }) => ({ id, revision }));
  return { scope: "shared-design", registrySource: "reviewed-participant-registry", participants, artifacts,
    receipts: participants.map(p => ({ participant: p.id,
      contribution: { disposition: "DELTA", sourceRange: p.sourceRange, artifacts: structuredClone(refs),
        evidence: `${p.id}:source-backed-packet`, integration: `${p.id}:shared-integration-readback` },
      readback: { artifacts: structuredClone(refs), evidence: `${p.id}:own-readback`,
        retrieval: `${p.id}:ordinary-design-query`, application: `${p.id}:next-task-constraint-applied` } })) };
}

function readiness(teamSync = sync()) {
  const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
  const bindings = Object.fromEntries(ids.map(id => [id, `${id}:r1`]));
  return { trigger: "update", scope: "shared-design", bindings,
    checks: ids.map(id => ({ id, status: "VERIFIED", binding: bindings[id], checkedBinding: bindings[id], source: `${id}:proof` })),
    architecture: { project: "project", scope: "project", source: "module-map", reviewedBy: "owner", review: "coverage-review",
      inventory: { source: "independent-project-inventory", areas: ["interface"] },
      coverage: [{ area: "interface", access: "AVAILABLE", modularity: "ENCAPSULATED", documentation: "CURRENT", evidence: "module-proof" }] },
    ...(teamSync === undefined ? {} : { teamSync }) };
}
const check = input => assessCapabilityReadiness(input, { requireTeamSync: true });
function accepted(input) {
  const routeProof = Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated",
    "semanticIntegration", "nextRetrieval"].map(key => [key, `evidence:${key}`]));
  return { relevantKey: check(input).relevantKey, status: "ACCEPTED", acceptedBy: "owner", routeProof };
}

test("sync coverage requires both contributions and recipient application, including a single participant", () => {
  assert.equal(assessTeamSync(undefined).status, "NOT_REQUESTED");
  assert.equal(assessTeamSync(undefined, { required: true }).status, "MISSING");
  const value = sync();
  assert.equal(assessTeamSync(value).status, "CURRENT");
  assert.equal(assessTeamSync(value).participantIdentity, "NOT_AUTHENTICATED");
  value.participants.splice(1); value.receipts.splice(1);
  assert.equal(assessTeamSync(value).status, "CURRENT");
  value.receipts[0].contribution.disposition = "NO_CHANGE";
  delete value.receipts[0].contribution.integration;
  assert.equal(assessTeamSync(value).status, "CURRENT");
  delete value.receipts[0].readback;
  assert.equal(assessTeamSync(value).status, "PENDING");
});

test("a sent packet, unintegrated insight or bare acknowledgment cannot count as team sync", () => {
  for (const mutate of [v => { v.receipts = []; }, v => { delete v.receipts[0].contribution; },
    v => { delete v.receipts[0].contribution.integration; }, v => { v.receipts[0].contribution.disposition = "GAP"; },
    v => { delete v.receipts[1].readback.retrieval; }, v => { v.receipts[1].readback.application = "pending"; }]) {
    const value = sync(); mutate(value);
    assert.equal(assessTeamSync(value).status, "PENDING");
    assert.equal(assessTeamSync(value).independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
  }
});

test("changed design rules and source ranges invalidate only relevant evidence, not an unrelated graph edit", () => {
  const value = sync(), before = assessTeamSync(value);
  value.artifacts.push({ id: "other-module", revision: "changed-unrelated-r3", source: "other-contract" });
  assert.equal(assessTeamSync(value).key, before.key);
  value.receipts.reverse(); value.artifacts.reverse(); value.participants.reverse();
  assert.equal(assessTeamSync(value).key, before.key);
  value.artifacts.find(a => a.id === "design-rules").revision = "rules-r3";
  assert.equal(assessTeamSync(value).status, "PENDING");
  assert.notEqual(assessTeamSync(value).key, before.key);
  const sourceChanged = sync(); sourceChanged.participants[0].sourceRange = "new-human-correction";
  assert.equal(assessTeamSync(sourceChanged).status, "PENDING");
  assert.equal(assessTeamSync(sourceChanged).participants.find(p => p.id === "consumer-owner").status, "CURRENT");
  const stale = sync(); stale.receipts[1].readback.artifacts[0].revision = "rules-r1";
  assert.equal(assessTeamSync(stale).participants.find(p => p.id === "consumer-owner").status, "PENDING");
});

test("missing participant cannot be hidden by an extra receipt or a duplicate identity", () => {
  const value = sync(); value.participants.push({ id: "returning-owner", sourceRange: "range-3", artifacts: ["memory"] });
  assert.equal(assessTeamSync(value).participants.find(p => p.id === "returning-owner").status, "PENDING");
  for (const mutate of [v => v.participants.push(v.participants[0]), v => v.receipts.push(v.receipts[0]),
    v => { v.receipts[0].participant = "unregistered"; }, v => { v.participants[0].artifacts = ["missing"]; },
    v => { v.registrySource = "unknown"; }, v => { v.participants = []; }]) {
    const invalid = sync(); mutate(invalid); assert.throws(() => assessTeamSync(invalid), /Invalid team sync/);
  }
});

test("adoption reuses current sync and routes a lost acknowledgment through the same owner without restarting work", () => {
  const input = readiness(); input.accepted = accepted(input);
  assert.equal(check(input).action, "REUSE_ACCEPTED");
  delete input.teamSync.receipts[1].readback;
  const missing = check(input);
  assert.equal(missing.action, "RECONCILE_TEAM_SYNC");
  assert.equal(missing.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  input.repairAttemptedFor = missing.defectKey;
  assert.equal(check(input).action, "WAIT_CHECKPOINT");
  input.owner = { id: "shared-maintenance", scope: input.scope, status: "WORKING" };
  assert.equal(check(input).action, "REUSE_OWNER");
  input.owner.status = "WAITING"; input.owner.checkpoint = "participant-returns-with-readback";
  assert.equal(check(input).action, "WAIT_OWNER");
  input.owner.status = "RETURNED";
  assert.equal(check(input).action, "REVIEW_MAINTENANCE_RETURN");
  input.teamSync = sync();
  assert.equal(check(input).action, "REUSE_ACCEPTED");
  input.teamSync.scope = "unrelated";
  assert.throws(() => check(input), /Mismatched team sync/);
});

test("current State cannot claim accepted adoption with pending sync; old snapshots remain explicit unchecked", () => {
  const input = readiness(); input.accepted = accepted(input);
  const record = { schemaVersion: 1, status: "ACCEPTED", scope: input.scope, evidence: "accepted-route", readiness: input };
  const state = (version, value) => `Framework: ${version}\nCapability adoption: ${JSON.stringify(value)}`;
  assert.equal(readCapabilityAdoption(state("1.34.1", record), []).coverage, "STRUCTURE_ONLY");
  delete input.teamSync.receipts[0].readback;
  const invalid = readCapabilityAdoption(state("1.34.1", record), []);
  assert.equal(invalid.coverage, "INVALID"); assert.equal(invalid.readiness.teamSync.status, "PENDING");
  assert.equal(invalid.readiness.dependentDispatch, "WAIT_FOR_APPLICABLE_PROOF");
  record.status = "PENDING"; record.work = "MAINT-1"; record.phase = "PROOF";
  const leases = [["MAINT-1 [SYSTEM] - shared preparation", "WAITING", "owner", "repo", "baseline", "sync", "participant-return", "outbox"]];
  assert.equal(readCapabilityAdoption(state("1.34.1", record), leases).coverage, "STRUCTURE_ONLY");
  delete input.teamSync;
  assert.equal(readCapabilityAdoption(state("1.34.0", record), leases).readiness.teamSync.status, "NOT_REQUESTED");
  assert.equal(readCapabilityAdoption(state("1.34.1", record), leases).readiness.teamSync.status, "MISSING");
});

test("installed adoption command exposes missing/current team proof without writing progress", async t => {
  const root = fileURLToPath(new URL("../", import.meta.url)), target = await mkdtemp(path.join(tmpdir(), "team-sync-adoption-"));
  t.after(() => rm(target, { recursive: true, force: true }));
  const run = (entry, args) => {
    const r = spawnSync(process.execPath, [entry, ...args], { cwd: target, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  run(path.join(root, "scripts/vydykhai.mjs"), ["install", target]);
  const cli = path.join(target, "scripts/vydykhai.mjs"), snapshot = path.join(target, "readiness.json");
  const lock = await readFile(path.join(target, ".vydykhai-lock.json"));
  const input = readiness(); input.accepted = accepted(input);
  await writeFile(snapshot, JSON.stringify(input));
  const before = await readFile(snapshot);
  assert.equal(JSON.parse(run(cli, ["adoption-plan", "--input", snapshot, "--json"])).capabilityReadiness.teamSync.status, "CURRENT");
  assert.deepEqual(await readFile(snapshot), before);
  delete input.teamSync;
  await writeFile(snapshot, JSON.stringify(input));
  const result = JSON.parse(run(cli, ["adoption-plan", "--input", snapshot, "--json"])).capabilityReadiness;
  assert.equal(result.teamSync.status, "MISSING"); assert.equal(result.action, "RECONCILE_TEAM_SYNC");
  assert.deepEqual(await readFile(path.join(target, ".vydykhai-lock.json")), lock);
});
