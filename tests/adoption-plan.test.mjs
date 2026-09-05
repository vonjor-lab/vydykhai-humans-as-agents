import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planAdoption, adoptionEvidenceScope } from "../scripts/adoption-plan.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "vydykhai.json"), "utf8"));
const changelog = await readFile(path.join(root, "docs/COLLABORATION_FRAMEWORK_CHANGELOG.md"), "utf8");
const input = { manifest, managedFiles: { "core.md": "reviewed-bundle" }, agentsBlockHash: "core", sourceRevision: "source-1", changelog };
async function fixture(t) {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-adoption-"));
  t.after(() => rm(target, { recursive: true, force: true }));
  const run = (args, cli = path.join(root, "scripts/vydykhai.mjs")) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: target, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  const get = async name => JSON.parse(await readFile(path.join(target, name), "utf8"));
  return { target, run, get, installed: path.join(target, "scripts/vydykhai.mjs") };
}

test("ordinary install automatically exposes an actionable plan, not readiness", async t => {
  const f = await fixture(t), output = f.run(["install", f.target]);
  assert.match(output, /Activation: UNPROVEN_BY_INSTALLER/);
  assert.match(output, /Active orchestrator/);
  const plan = JSON.parse(f.run(["adoption-plan", "--json"], f.installed));
  assert.equal(plan.id, (await f.get(".vydykhai-lock.json")).adoptionPlan.id);
  assert.equal(plan.target.version, "1.30.0");
  assert.equal(plan.progressOwner, "Project State");
  assert.ok(plan.requirements.some(r => r.id === "prepared-work"));
  assert.ok(plan.releases.every(r => r.path && r.heading && !r.notes));
});

test("same target repeat/resume preserves plan and State completion/failed repair history", async t => {
  const f = await fixture(t); f.run(["install", f.target]);
  const plan = JSON.parse(f.run(["adoption-plan", "--json"], f.installed));
  const state = "Accepted baseline retained. One unchanged defect repair already failed. Pending human question retained.\n";
  await writeFile(path.join(f.target, "project-state.md"), state);
  f.run(["update", f.target, "--from", root], f.installed);
  assert.deepEqual(JSON.parse(f.run(["adoption-plan", "--json"], f.installed)), plan);
  assert.equal(await readFile(path.join(f.target, "project-state.md"), "utf8"), state);
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
});

test("skipped releases are ordered and unknown baseline remains conservative on changed target", () => {
  const p = planAdoption({ ...input, previousLock: { installedVersion: "1.27.0" } });
  assert.deepEqual(p.releases.map(r => r.version), ["1.28.0", "1.29.0", "1.30.0"]);
  const unknown = planAdoption(input);
  const changed = planAdoption({ ...input, managedFiles: { "core.md": "changed" }, previousLock: { installedVersion: "1.30.0", adoptionPlan: unknown } });
  assert.equal(changed.reviewFromVersion, null);
  assert.equal(changed.releaseCoverage, "UNKNOWN_BASELINE_REVIEW_ALL_DECLARED");
  assert.deepEqual(changed.requirements, unknown.requirements);
  assert.equal(changed.supersedesPlanId, unknown.id);
});

test("same bundle updates installed provenance without creating a new transition", () => {
  const before = planAdoption(input);
  const after = planAdoption({ ...input, sourceRevision: "source-2", previousLock: { adoptionPlan: before } });
  assert.equal(after.id, before.id); assert.equal(after.sourceRevision, "source-2");
});

test("legacy manifest/lock fallback is read-only and references an existing workflow", async t => {
  const f = await fixture(t); f.run(["install", f.target]);
  const lock = await f.get(".vydykhai-lock.json"); delete lock.adoptionPlan;
  await writeFile(path.join(f.target, ".vydykhai-lock.json"), JSON.stringify(lock));
  const before = await readFile(path.join(f.target, ".vydykhai-lock.json"));
  const a = JSON.parse(f.run(["adoption-plan", "--json"], f.installed));
  assert.deepEqual(JSON.parse(f.run(["adoption-plan", "--json"], f.installed)), a);
  assert.deepEqual(await readFile(path.join(f.target, ".vydykhai-lock.json")), before);
  f.run(["update", f.target, "--from", root], f.installed);
  const b = JSON.parse(f.run(["adoption-plan", "--json"], f.installed));
  assert.equal(b.id, a.id); assert.equal(b.reviewFromVersion, null);
  assert.deepEqual(b.requirements, a.requirements);
  const old = { ...manifest }; delete old.adoptionRequirements;
  const legacy = planAdoption({ ...input, manifest: old });
  assert.match(legacy.next, /framework-orchestrator\.md/);
  assert.doesNotMatch(legacy.next, /framework-activation\.md/);
});

test("actual historical updater copies new kit; new entry retrieves unknown plan without dirtying files", async t => {
  // Historical source may be absent in a shallow CI checkout; local acceptance
  // runs this real old binary. No synthetic fixture is labelled historical proof.
  const archive = spawnSync("git", ["archive", "d46692adfbbb32ab1049794677a0e704830d362c"], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
  if (archive.status !== 0) { t.skip("Historical source object unavailable in this checkout"); return; }
  const f = await fixture(t), old = path.join(f.target, "old-source"); await mkdir(old);
  assert.equal(spawnSync("tar", ["-x", "-C", old], { input: archive.stdout }).status, 0);
  const target = path.join(f.target, "installed"); await mkdir(target);
  f.run(["install", target], path.join(old, "scripts/vydykhai.mjs"));
  const installed = path.join(target, "scripts/vydykhai.mjs");
  const output = f.run(["update", target, "--from", root], installed);
  assert.doesNotMatch(output, /adoption plan/);
  const before = await readFile(path.join(target, ".vydykhai-lock.json"));
  assert.equal(JSON.parse(before).adoptionPlan, undefined);
  const plan = JSON.parse(f.run(["adoption-plan", target, "--json"], installed));
  assert.equal(plan.reviewFromVersion, null); assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
  assert.deepEqual(await readFile(path.join(target, ".vydykhai-lock.json")), before);
  assert.match(await readFile(path.join(target, "AGENTS.md"), "utf8"), /older updater/);
  f.run(["update", target, "--from", root], installed);
  const repeated = JSON.parse(f.run(["adoption-plan", target, "--json"], installed));
  assert.equal(repeated.id, plan.id); assert.equal(repeated.reviewFromVersion, null);
});

test("single-user graph reuse versus real gap compares scope only, never semantic success", () => {
  const r = manifest.adoptionRequirements.find(r => r.id === "team-memory");
  const current = { participant: "local", sourceRange: "range-1", moduleContract: "contract-1", sharedWatermark: "meaning-1" };
  const first = adoptionEvidenceScope(r, current);
  const reused = adoptionEvidenceScope(r, { ...current, unrelatedGraphSection: "changed" }, first);
  assert.equal(reused.status, "REVIEW_EXISTING_EVIDENCE"); assert.equal(reused.acceptance, "NOT_ESTABLISHED");
  assert.equal(adoptionEvidenceScope(r, { ...current, sourceRange: "new-gap" }, first).status, "REVIEW_CHANGED_SCOPE");
});

test("absent participant leaves its scope missing; arriving delta changes only its applicability", () => {
  const r = manifest.adoptionRequirements.find(r => r.id === "team-memory");
  assert.equal(adoptionEvidenceScope(r, { participant: "remote" }).status, "MISSING_SCOPE");
  const local = { participant: "local", sourceRange: "local-1", moduleContract: "contract", sharedWatermark: "meaning" };
  const prior = adoptionEvidenceScope(r, local);
  assert.equal(adoptionEvidenceScope(r, { ...local, participant: "remote", sourceRange: "remote-delta" }, prior).status, "REVIEW_CHANGED_SCOPE");
  assert.equal(adoptionEvidenceScope(r, local, prior).status, "REVIEW_EXISTING_EVIDENCE");
});

test("Guard recipient change invalidates reuse; unrelated target version does not", () => {
  const r = manifest.adoptionRequirements.find(r => r.id === "guard-continuity");
  const scope = { guardBundle: "tested-service", recipient: "owner-1", installedTimer: "timer-1" }, previous = adoptionEvidenceScope(r, scope);
  assert.equal(adoptionEvidenceScope(r, { ...scope, targetVersion: "new" }, previous).status, "REVIEW_EXISTING_EVIDENCE");
  assert.equal(adoptionEvidenceScope(r, { ...scope, recipient: "owner-2" }, previous).status, "REVIEW_CHANGED_SCOPE");
});

test("worker identity changes require review; planner grants no inheritance or repair reset", () => {
  const r = manifest.adoptionRequirements.find(r => r.id === "prepared-work");
  const scope = { sourceRange: "range", moduleContract: "contract", worker: "old", verificationBoundary: "boundary" };
  const previous = adoptionEvidenceScope(r, scope);
  assert.equal(adoptionEvidenceScope(r, { ...scope, worker: "new" }, previous).status, "REVIEW_CHANGED_SCOPE");
  const plan = planAdoption(input);
  assert.equal(plan.completed, undefined); assert.equal(plan.repairAttempts, undefined);
  assert.match(plan.requirements.find(r => r.id === "resume-or-checkpoint").action, /never reset attempts/);
});
