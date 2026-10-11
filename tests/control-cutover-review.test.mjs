import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, cp, readFile, writeFile, realpath, rm, lstat, chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime, verifyControlRuntime} from "../scripts/control-runtime.mjs";
import {activateControl, acquireControlLease} from "../scripts/control-activation.mjs";
import {switchControlRuntime} from "../scripts/control-cutover.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {registerControlSchedule, controlSchedulePlan} from "../scripts/control-schedule.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {endpointFixture, endpointServices} from "./control-endpoint-fixture.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {runRegisteredContinuations} from "../scripts/control-continuation.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
const darwin = {skip: process.platform !== "darwin", timeout: 30000};
const absent = plan => ({state: "CLOSED", code: 113, output: "",
  errors: `Could not find service "${plan.label}"`});

// Trusted synthetic scheduler responses only; never launchctl bootstrap/bootout,
// native model execution, authentication, or a product workspace.
async function fixture(t, editTarget = async file => {
  await writeFile(file, (await readFile(file, "utf8")) + "\n// Disposable distinct runtime.\n");
}) {
  const temp = await realpath(await mkdtemp(path.join(tmpdir(), "control-cutover-review-")));
  t.after(() => rm(temp, {recursive: true, force: true}));
  const workspace = path.join(temp, "workspace"), root = path.join(temp, "control"),
    packages = path.join(temp, "packages"), candidate = path.join(temp, "source");
  for (const dir of [workspace, root, packages, candidate]) await mkdir(dir, {mode: 0o700});
  const observed = await inspectControlRuntime(source);
  for (const name of Object.keys(observed.description.files)) {
    await mkdir(path.dirname(path.join(candidate, name)), {recursive: true});
    await cp(path.join(source, name), path.join(candidate, name));
  }
  const stage = async sourceRoot => {
    const {digest} = await inspectControlRuntime(sourceRoot);
    return stageControlRuntime({sourceRoot, directory: packages, workspace, expectedDigest: digest});
  };
  const first = await stage(candidate), alternate = path.join(temp, "alternate");
  await cp(candidate, alternate, {recursive: true});
  await editTarget(path.join(alternate, "scripts/control-service.mjs"));
  const second = await stage(alternate);
  await writeFile(path.join(workspace, "policy.md"), "Synthetic paused cutover.\n");
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "policy", path: "policy.md", purpose: "Synthetic review"}]}), {mode: 0o600});
  const profile = {schema: "control.service.v1", directory: path.join(root, "host"),
    config: {workspace, policy: "a".repeat(64), owner: "owner", executor: "executor", reviewer: "reviewer",
      evidenceRegistry: sourceFile, health: {scope: "Disposable cutover", intervalMs: 60000,
        maxBranches: 1, maxWorktrees: 1, triggerSourceIds: ["policy"], repairTasks: ["maintenance"]}},
    review: {directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      native: {workspace: path.join(root, "review-room"), home: path.join(root, "empty-home"),
        authHome: path.join(root, "empty-home"), binary: "/never-launch-model", model: "no-inference",
        effort: "low", timeoutMs: 1000}, maxCalls: 2, expiresAt: new Date(Date.now() + 3600000).toISOString(),
      scope: {kind: "fixture"}}, timeoutMs: 3000, maxReviewsPerTick: 0};
  const descriptor = await activateControl({sourceRoot: first.root, root, expectedDigest: first.digest, profile});
  const runtime = await loadControlRuntime({packageRoot: first.root, expectedDigest: first.digest, workspace});
  await (await runtime.service.openControlService(profile)).host.pause(true);
  const host = await openControlStore(profile.directory), review = await openControlStore(profile.review.directory);
  await review.transact(s => {s.calls = 2; s.runs.spent = {state: "STOPPED"}; return s;});
  const snapshot = async () => ({host: await host.read(), review: await review.read()});
  const before = await snapshot();
  const options = {descriptorFile: descriptor.descriptorFile, expectedOldDigest: first.digest,
    packageRoot: second.root, expectedDigest: second.digest, actor: "operator", evidence: "Synthetic reviewed cutover",
    noRacingSchedulerOperators: true};
  return {temp, root, workspace, profile, descriptor, first, second, options, snapshot, before};
}

test("supported registration cannot publish during the final cutover readback", darwin, async t => {
  const x = await fixture(t);
  let calls = 0, attempted = false;
  const result = await switchControlRuntime(x.options, {readSchedule: async plan => {
    if (++calls === 6) {
      assert.equal(JSON.parse(await readFile(x.descriptor.descriptorFile, "utf8")).runtime.digest, x.second.digest);
      await lstat(path.join(x.root, "observer.lease"));
      await assert.rejects(registerControlSchedule({descriptorFile: x.descriptor.descriptorFile, mode: "SESSION"}),
        /RECOVERY_IN_PROGRESS|LEASE_HELD/);
      await assert.rejects(lstat(plan.file), {code: "ENOENT"});
      attempted = true;
    }
    return absent(plan);
  }});
  assert.equal(attempted, true);
  assert.equal(result.status, "RUNTIME_SWITCHED_PAUSED");
  assert.equal(result.scheduler, "STOPPED_NOT_RESTARTED");
  assert.deepEqual(await x.snapshot(), x.before);
  for (const name of ["observer.lease", "observer-recovery.lease"])
    await assert.rejects(lstat(path.join(x.root, name)), {code: "ENOENT"});
});

test("external plist publication during scheduler readback holds reconciliation, never stopped proof", darwin, async t => {
  const x = await fixture(t);
  let calls = 0, published;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    const observation = absent(plan);
    if (++calls === 3) {
      await lstat(path.join(x.root, "observer.lease"));
      await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS|LEASE_HELD/);
      // A raw external writer is outside the supported lease protocol.
      assert.equal(path.dirname(plan.file), x.root);
      await writeFile(plan.file, plan.plist, {mode: 0o600, flag: "wx"});
      published = plan;
    }
    return observation;
  }}), error => {
    assert.equal(error.message, "CONTROL_CUTOVER_RECONCILIATION_REQUIRED");
    assert.equal(error.cause.message, "CONTROL_CUTOVER_SCHEDULE_STOP_REQUIRED");
    assert.equal(error.recoveryError, "CONTROL_CUTOVER_SCHEDULE_STOP_REQUIRED");
    return true;
  });
  assert.equal(await readFile(published.file, "utf8"), published.plist);
  assert.equal(JSON.parse(await readFile(x.descriptor.descriptorFile, "utf8")).runtime.digest, x.first.digest);
  assert.deepEqual(await x.snapshot(), x.before);
  await lstat(path.join(x.root, "observer-recovery.lease"));
  await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS|LEASE_HELD/);
});

test("post-publication rollback receipt names the restored runtime and preserves attempted target", darwin, async t => {
  const x = await fixture(t);
  let failed = false, rollback;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    if (!failed && JSON.parse(await readFile(x.descriptor.descriptorFile, "utf8")).runtime.digest === x.second.digest) {
      failed = true;
      throw Error("Synthetic post-publication failure");
    }
    return absent(plan);
  }}), error => {
    assert.equal(error.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.equal(error.cause.message, "Synthetic post-publication failure");
    rollback = error.receipt;
    return true;
  });
  const selected = JSON.parse(await readFile(x.descriptor.descriptorFile, "utf8"));
  assert.equal(failed, true);
  assert.equal(rollback.status, "ROLLED_BACK_PAUSED");
  assert.equal(selected.runtime.digest, x.first.digest);
  assert.equal(rollback.to.digest, selected.runtime.digest);
  assert.equal(rollback.attempted.digest, x.second.digest);
  assert.deepEqual(await x.snapshot(), x.before);
});

test("unchanged used calls cannot conceal replenished target capacity", darwin, async t => {
  const x = await fixture(t, async file => {
    const bytes = await readFile(file, "utf8");
    const anchor = "return {host,review,owner,ownerDelivery,sourceCoverage:";
    assert.ok(bytes.includes(anchor));
    await writeFile(file, bytes.replace(anchor,
      "return {host,review:{...review,capacity:async()=>({used:2,remaining:999})},owner,ownerDelivery,sourceCoverage:"));
  });
  const first = await loadControlRuntime({packageRoot: x.first.root, expectedDigest: x.first.digest, workspace: x.workspace});
  assert.equal((await (await first.service.openControlService(x.profile)).review.capacity()).remaining, 0);
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => absent(plan)}), error => {
    assert.equal(error.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.equal(error.cause.message, "CONTROL_CUTOVER_TARGET_BUDGET_READBACK_MISMATCH");
    assert.equal(error.receipt.to.digest, x.first.digest);
    return true;
  });
  assert.equal(JSON.parse(await readFile(x.descriptor.descriptorFile, "utf8")).runtime.digest, x.first.digest);
  const second = await loadControlRuntime({packageRoot: x.second.root, expectedDigest: x.second.digest, workspace: x.workspace});
  assert.deepEqual(await (await second.service.openControlService(x.profile)).review.capacity(), {used: 2, remaining: 999});
  assert.deepEqual(await x.snapshot(), x.before);
});

test("historical inventory inspection cannot authorize cutover without its observer entrypoint", darwin, async t => {
  const x = await fixture(t), incomplete = path.join(x.temp, "missing-observer");
  await cp(x.second.root, incomplete, {recursive: true});
  const file = path.join(incomplete, "runtime.json");
  const description = JSON.parse(await readFile(file, "utf8"));
  delete description.files["scripts/control-observer-run.mjs"];
  await rm(path.join(incomplete, "scripts/control-observer-run.mjs"));
  await chmod(file, 0o600);
  await writeFile(file, canonicalJson(description) + "\n");
  await chmod(file, 0o400);
  const digest = sha256(canonicalJson(description));
  assert.equal((await verifyControlRuntime(incomplete, digest)).status, "STAGED_NOT_ACTIVATED");
  const descriptorBefore = await readFile(x.descriptor.descriptorFile, "utf8");
  await assert.rejects(switchControlRuntime({...x.options, packageRoot: incomplete, expectedDigest: digest},
    {readSchedule: async plan => absent(plan)}), error => {
    assert.equal(error.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.equal(error.cause.message, "CONTROL_ACTIVATION_OBSERVER_RUNTIME_INCOMPLETE");
    assert.equal(error.receipt.to.digest, x.first.digest);
    assert.equal(error.receipt.attempted.digest, digest);
    return true;
  });
  assert.equal(await readFile(x.descriptor.descriptorFile, "utf8"), descriptorBefore);
  const plan = await controlSchedulePlan({descriptorFile: x.descriptor.descriptorFile, mode: "SESSION"});
  assert.equal(plan.args[1], path.join(x.first.root, "scripts/control-observer-run.mjs"));
  await lstat(plan.args[1]);
  for (const name of ["observer.lease", "observer-recovery.lease"])
    await assert.rejects(lstat(path.join(x.root, name)), {code: "ENOENT"});
  assert.deepEqual(await x.snapshot(), x.before);
});

for (const boundary of ["before-admission", "before-reserve"])
test(`removing automatic opt-in ${boundary} cannot execute or close`, darwin, async t => {
  const x = await endpointFixture(t), ref = name => x.f.put(`${name}.md`, name);
  const acceptance = {schema: "work.product-acceptance.v1", id: "consumer", project: "fixture", task: "prior",
    owner: "owner", executor: "worker", status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: await ref("return"), artifact: await ref("artifact"), technicalProof: await ref("proof"),
    goal: await ref("goal"), retention: []};
  for (const id of retentionKinds) acceptance.retention.push({id, required: true, expected: await ref(id)});
  await x.host.accept(acceptance);
  await runControlTick(x.host, {review: async offer => ({phase: "POST_ACCEPT", key: offer.key,
    runId: offer.runId, reviewer: "reviewer", observedAt: new Date().toISOString(), findings: [],
    rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: "Synthetic protocol, not semantic proof"}))})});
  const owner = ownerControl(x.host, "owner");
  await owner.readVerdict("consumer");
  await owner.respond("consumer", {owner: "owner", action: "CONTINUE", nextAction: "TASK-1", evidence: "fixture:approved"});
  await x.approve();
  const grant = Object.values((await x.host.snapshot()).grants)[0];
  const approval = {reviewer: "reviewer", reviewReceipt: "fixture:explicit-execution", dependencies: ["consumer"],
    expiresAt: Date.now() + 60000};
  await x.host.approveCommand(grant.binding, {...approval, executionRequest: {...x.f.request, operation: "resume"}});
  let replaced = false, replacedState;
  const replace = async () => {
    await x.host.approveCommand(grant.binding, {...approval, reviewReceipt: "fixture:ordinary-only"});
    replacedState = await x.host.snapshot();
    assert.equal(Object.hasOwn(replacedState.grants[grant.id], "executionRequest"), false);
    assert.equal(Object.keys(replacedState.reservations).length, 0);
    replaced = true;
  };
  const host = {...x.host, assess: async id => {
    const result = await x.host.assess(id);
    if (!replaced && boundary === "before-admission") {
      assert.equal(result.action, "VERIFY_CONTINUATION");
      await replace();
    }
    return result;
  }, control: {...x.host.control, authorize: async binding => {
    const authorized = await x.host.control.authorize(binding);
    if (!replaced && boundary === "before-reserve") await replace();
    return authorized;
  }}};
  const result = await runRegisteredContinuations({mode: "REGISTERED_PREAPPROVED_ONLY", maxActions: 1},
    {host, workspace: x.f.root, controlRoot: x.privateRoot, services: endpointServices});
  assert.equal(replaced, true);
  assert.equal(result.results[0].action, "CONTINUATION_NOT_COMPLETED");
  assert.equal(result.results[0].code, "CONTROL_ADMISSION_FAILED");
  assert.equal(result.results[0].outcome, "NOT_INVOKED");
  await assert.rejects(readFile(path.join(x.f.root, "actions.log")), {code: "ENOENT"});
  const final = await x.host.snapshot();
  assert.equal(Object.hasOwn(final.grants[grant.id], "executionRequest"), false);
  assert.notEqual(final.acceptances.consumer.enrollment, "CLOSED");
  assert.equal(final.acceptances.consumer.disposition.continuationEvidence, undefined);
  assert.deepEqual(final, replacedState);
  assert.equal((await runRegisteredContinuations({mode: "REGISTERED_PREAPPROVED_ONLY", maxActions: 1},
    {host, workspace: x.f.root, controlRoot: x.privateRoot, services: endpointServices})).calls, 0);
});
