import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, realpath, readdir, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import {fixture, hash} from "./context-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {openControlService} from "../scripts/control-service.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";

const fail = "process.stdout.write('service-exit-seven'); process.stderr.write('PRIVATE_STDERR'); process.exit(7);\n";
const files = async root => Object.fromEntries(await Promise.all((await readdir(root)).sort().map(async name =>
  [name, sha256(await readFile(path.join(root, name)))])));

async function setup(t, {readOnly = false, body = fail} = {}) {
  const f = await fixture(t, {actionBody: body}), prepared = await f.prepare();
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "service-command-recovery-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  const directory = path.join(root, "host"), reviewDirectory = path.join(root, "review");
  await mkdir(directory, {mode: 0o700}); await mkdir(reviewDirectory, {mode: 0o700});
  await f.put("policy.md", "Public synthetic command recovery policy.\n");
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace: f.root,
    sources: [{id: "policy", path: "policy.md", purpose: "Public fixture policy"}]}), {mode: 0o600});
  const config = {workspace: f.root, policy: sha256("service-fixture"), owner: "owner", executor: "worker",
    reviewer: "reviewer", evidenceRegistry: sourceFile};
  const profile = {schema: "control.service.v1", directory, config, timeoutMs: 2000, maxReviewsPerTick: 0,
    review: {directory: reviewDirectory, controlRoot: root, reviewer: "reviewer", sourceFile,
      maxCalls: 1, expiresAt: "2099-01-01T00:00:00Z", scope: {kind: "public-service-command-fixture"},
      native: {binary: "/never-dispatch", model: "synthetic-not-dispatched", effort: "low", timeoutMs: 1000}}};
  const store = await openControlStore(directory), closes = new Map(), spawn = childProcess.spawn;
  // Instrument real child events: no synthetic exit/result replaces the command.
  t.mock.method(childProcess, "spawn", (...args) => {
    const child = spawn(...args), startedAt = Date.now();
    child.once("close", (code, signal) => closes.set(child.pid, {code, signal, startedAt, closedAt: Date.now(),
      executable: args[0], argsSha256: hash(args[1]), cwd: args[2].cwd}));
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {t.mock.restoreAll(); syncBuiltinESMExports();});
  const sandboxLaunch = readOnly ? await localControlSandbox({workspace: f.root, controlRoot: root, readOnly: true}) : null;
  let baseline, effectState = "RECONCILED", observerCalls = 0;
  const observeCommandFailure = async input => {
    observerCalls++;
    const current = await store.read(); assert.equal(current.digest, input.journalDigest);
    const failure = current.state.reservations[input.reservation.reservationId].failure;
    assert.deepEqual(failure, input.reservation.failure);
    const close = closes.get(failure.process.pid); assert.ok(close, "independent real close evidence required");
    assert.equal(close.code, failure.exitCode); assert.equal(close.signal, failure.signal);
    assert.equal(close.executable, failure.process.launchExecutable);
    assert.equal(close.argsSha256, failure.process.launchArgsSha256); assert.equal(close.cwd, failure.cwd);
    assert.ok(Math.abs(close.startedAt - Date.parse(failure.process.startedAt)) < 1000);
    assert.ok(Math.abs(close.closedAt - Date.parse(failure.process.closedAt)) < 1000);
    assert.equal(failure.commandSha256, input.binding.commandSha256);
    assert.equal(failure.stdoutSha256, sha256("service-exit-seven"));
    assert.equal(failure.stderrSha256, sha256("PRIVATE_STDERR"));
    const proof = {reservationId: input.reservation.reservationId, bindingSha256: input.reservation.bindingSha256,
      failureSha256: input.failureSha256};
    let effects = "UNKNOWN";
    if (sandboxLaunch) {
      const launch = sandboxLaunch({executable: input.binding.executable, args: f.task.action.args, cwd: f.root});
      assert.equal(launch.executable, close.executable); assert.equal(hash(launch.args), close.argsSha256);
      assert.deepEqual(await files(f.root), baseline);
      assert.equal(input.scopeSha256, hash({workspace: f.root, binding: input.binding}));
      effects = effectState;
    }
    return {termination: {...proof, state: "STOPPED", processSha256: hash(failure.process),
      evidence: `independently-observed-child-close:${hash(close)}`},
    effects: {...proof, state: effects, scopeSha256: input.scopeSha256,
      evidence: `exact-read-only-sandbox-and-file-readback:${hash(baseline ?? null)}`}};
  };
  const service = await openControlService(profile, {observeCommandFailure});
  await service.host.initialize(); await service.review.initialize();
  const bindingFor = async p => ({operation: "resume", taskId: f.task.id, taskSha256: f.request.task.sha256,
    capsuleSha256: f.request.capsule.sha256, sourceDigest: p.coverageBasis.sourceDigest,
    dependencyDigest: p.coverageBasis.dependencyDigest, commandSha256: hash(f.task.action),
    executable: await realpath(process.execPath), cwd: f.root, kind: "dependent"});
  const binding = await bindingFor(prepared);
  const approve = (b = binding, dependencies = []) => service.host.approveCommand(b, {reviewer: "reviewer",
    reviewReceipt: "synthetic-current-readiness", dependencies, expiresAt: Date.now() + 120000});
  const run = () => runControlledContextTransition({...f.request, operation: "resume"},
    {control: service.host.control, ...(sandboxLaunch ? {sandboxLaunch} : {})});
  const seal = async () => {baseline = await files(f.root);};
  const recovery = async () => ({reservationId: hash(binding), expectedJournalDigest: (await store.read()).digest,
    owner: "owner", evidence: "owned-public-service-reconciliation"});
  return {f, root, profile, service, store, binding, bindingFor, approve, run, seal, recovery,
    observeCommandFailure, observerCalls: () => observerCalls, effects: state => {effectState = state;}};
}

async function priorAcceptance(x) {
  const ref = name => x.f.put(`${name}.md`, name);
  await x.service.host.accept({schema: "work.product-acceptance.v1", id: "prior", project: "public-synthetic",
    task: "prior-task", owner: "owner", executor: "worker", status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: await ref("return"), artifact: await ref("artifact"), technicalProof: await ref("proof"), goal: await ref("goal"),
    retention: await Promise.all(retentionKinds.map(async id => ({id, required: true, expected: await ref(id)})))});
  const offer = await x.service.host.claimReview("prior");
  // Prior acceptance is protocol setup, not model semantic qualification. No review is dispatched.
  await x.service.host.review("prior", offer, {phase: "POST_ACCEPT", key: offer.key, reviewer: "reviewer", runId: offer.runId,
    resultUse:{status:"ALLOW",acceptanceSha256:hash(offer.input.acceptance),evidence:"fixture:independent-result",findingIds:[]},
    observedAt: new Date().toISOString(), findings: [],
    rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: "synthetic-protocol-only"}))});
  await x.service.owner.readVerdict("prior");
  await x.service.owner.respond("prior", {owner: "owner", action: "CONTINUE", nextAction: x.binding.taskId,
    evidence: "fixture-current-owner-disposition"});
}

test("actual service SDK reconciles real exit 7 under read-only isolation; fresh same-task correction is one-use", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const body = "import {writeFileSync} from 'node:fs'; try {writeFileSync('forbidden-write','bad');process.exit(98);} catch {}\n" + fail;
  const x = await setup(t, {readOnly: true, body}); await priorAcceptance(x);
  const configKey = (await x.store.read()).state.configKey;
  await x.approve(x.binding, ["prior"]); await x.seal();
  const failed = await x.run(); assert.equal(failed.status, "BLOCKED"); assert.equal(failed.actionOutcome, "OUTCOME_UNKNOWN");
  const captured = await x.store.read(), failedRow = captured.state.reservations[hash(x.binding)];
  const originalFile = path.join(x.profile.directory, `${String(captured.revision).padStart(10, "0")}.json`);
  const originalBytes = await readFile(originalFile);
  assert.equal(failedRow.status, "IN_FLIGHT"); assert.equal(failedRow.failure.exitCode, 7);
  assert.equal(failedRow.failure.signal, null); assert.equal(failedRow.failure.reason, "COMMAND_FAILED");
  assert.ok(!JSON.stringify(failed).includes("PRIVATE_STDERR")); assert.ok(!originalBytes.includes("PRIVATE_STDERR"));
  await x.service.host.pause(true); await x.service.host.pause(false);
  const alternate = {...x.binding, commandSha256: sha256("different-current-command")}; await x.approve(alternate);
  await assert.rejects(x.service.host.control.authorize(alternate), /TASK_OUTCOME_UNKNOWN/);
  await x.service.host.pause(true);
  x.effects("UNKNOWN");
  await assert.rejects(x.service.host.reconcileCommand(await x.recovery()), /COMMAND_EFFECTS_UNRECONCILED/);
  assert.equal((await x.service.host.snapshot()).reservations[hash(x.binding)].status, "IN_FLIGHT");
  x.effects("RECONCILED"); const request = await x.recovery();
  assert.equal((await x.service.host.reconcileCommand(request)).status, "FAILED_RECONCILED");
  const reconciled = await x.service.host.snapshot();
  assert.equal(reconciled.paused, true); assert.equal(reconciled.configKey, configKey);
  const retained = reconciled.reservations[hash(x.binding)];
  assert.deepEqual(retained.failure, failedRow.failure); assert.equal(retained.resultSha256, undefined);
  assert.equal(retained.reconciliation.previousJournalDigest, request.expectedJournalDigest);
  assert.equal(reconciled.acceptances.prior.disposition.continuationEvidence, undefined);
  assert.notEqual(reconciled.acceptances.prior.enrollment, "FINAL_READBACK_DUE");
  await assert.rejects(x.service.host.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  await assert.rejects(x.approve(), /COMMAND_ALREADY_RESERVED/);
  await x.service.host.pause(false); await assert.rejects(x.service.host.close("prior"), /CONTROL_NOT_COMPLETE/);
  await x.service.host.pause(true);
  await x.f.put("correction.mjs", "process.stdout.write('service-read-only-correction');\n");
  x.f.task.action.args = ["correction.mjs"]; await x.f.refresh();
  x.f.request.capsule = null; x.f.request.readback = null; const p = await x.f.prepare();
  const corrected = await x.bindingFor(p);
  await x.service.host.pause(false);
  assert.equal((await x.run()).status, "BLOCKED", "reconciliation grants no new command authority");
  await x.approve(corrected, ["prior"]); assert.equal((await x.run()).status, "ACTION_COMPLETED");
  const afterCorrection = await x.service.host.snapshot(); assert.equal((await x.run()).status, "BLOCKED");
  assert.deepEqual(await x.service.host.snapshot(), afterCorrection);
  assert.equal(afterCorrection.reservations[hash(corrected)].status, "COMPLETED");
  assert.deepEqual(afterCorrection.reservations[hash(x.binding)], retained);
  assert.deepEqual(await readFile(originalFile), originalBytes);
  const reopened = await openControlService(x.profile, {observeCommandFailure: x.observeCommandFailure});
  assert.deepEqual(await reopened.host.snapshot(), afterCorrection);
  assert.equal((await reopened.review.capacity()).used, 0);
  assert.equal((await x.service.review.capacity()).used, 0); assert.equal(x.observerCalls(), 2);
  assert.deepEqual((await (await openControlStore(x.profile.review.directory)).read()).state.runs, {});
});

test("missing SDK callback and profile/JSON claims cannot reconcile the service's retained real failure", async t => {
  const x = await setup(t); await x.approve(); await x.run();
  const before = await x.service.host.snapshot();
  const profiles = [x.profile, {...x.profile, observeCommandFailure: "serialized-function-claim"},
    JSON.parse(JSON.stringify({...x.profile, services: {observeCommandFailure: {state: "STOPPED"}}})),
    {...x.profile, observeCommandFailure: () => {throw Error("PROFILE_CALLBACK_MUST_NOT_RUN");}}];
  for (const profile of profiles) {
    const reopened = await openControlService(profile);
    await assert.rejects(reopened.host.reconcileCommand(await x.recovery()), /COMMAND_OBSERVER_REQUIRED/);
    assert.deepEqual(await reopened.host.snapshot(), before);
    assert.equal((await reopened.review.capacity()).used, 0);
  }
  assert.equal(x.observerCalls(), 0);
});

test("invalid and serialized SDK callbacks refuse; arbitrary services cannot override built-in authorities", async t => {
  const x = await setup(t);
  const beforeHost = await x.service.host.snapshot(), beforeReview = (await openControlStore(x.profile.review.directory)).read;
  const reviewSnapshot = await beforeReview();
  for (const value of [null, false, 7, "function(){}", {}, {state: "STOPPED"}, []])
    await assert.rejects(openControlService(x.profile, {observeCommandFailure: value}), /COMMAND_OBSERVER_INVALID/);
  for (const services of [null, [], "serialized", {createReturnSync: () => {}}, {observeReviewRun: () => {}},
    {observeCommandFailure: x.observeCommandFailure, observeReviewRun: () => {}}])
    await assert.rejects(openControlService(x.profile, services), /COMMAND_OBSERVER_INVALID/);
  const absent = await openControlService(x.profile, {observeCommandFailure: undefined});
  assert.deepEqual(await absent.host.snapshot(), beforeHost);
  assert.deepEqual(await beforeReview(), reviewSnapshot); assert.equal(x.observerCalls(), 0);
});
