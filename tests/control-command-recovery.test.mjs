import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, realpath, readdir, readFile, writeFile, rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import {fixture, hash} from "./context-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {createReturnSync} from "../scripts/vydykhai.mjs";
import {migrateControlHost, settledCommandHistory} from "../scripts/control-migration.mjs";

const failedBody = "process.stdout.write('failed-attempt'); process.stderr.write('SECRET_STDERR'); process.exit(7);\n";
const snapshot = async root => Object.fromEntries(await Promise.all((await readdir(root)).sort().map(async name =>
  [name, sha256(await readFile(path.join(root, name)))])));

async function setup(t, {body = failedBody, readOnly = false} = {}) {
  const f = await fixture(t, {actionBody: body});
  const prepared = await f.prepare();
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "command-recovery-")));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const config = {workspace: f.root, policy: sha256("public-fixture-policy"), owner: "owner", executor: "worker", reviewer: "reviewer"};
  const closes = new Map(), spawn = childProcess.spawn;
  // Observe real child events independently; never replace execution with a scripted result.
  t.mock.method(childProcess, "spawn", (...args) => {
    const child = spawn(...args);
    const startedAt = Date.now();
    child.once("close", (code, signal) => closes.set(child.pid, {code, signal, startedAt, closedAt: Date.now(),
      executable: args[0], argsSha256: hash(args[1]), cwd: args[2].cwd}));
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {t.mock.restoreAll(); syncBuiltinESMExports();});
  const store = await openControlStore(directory);
  let baseline = null, sandboxLaunch = null, observationChange = value => value;
  if (readOnly) sandboxLaunch = await localControlSandbox({workspace: f.root, controlRoot: directory, readOnly: true});
  const observeCommandFailure = async input => {
    const row = await store.read();
    assert.equal(row.digest, input.journalDigest);
    const failure = row.state.reservations[input.reservation.reservationId].failure;
    assert.deepEqual(failure, input.reservation.failure);
    const closed = closes.get(failure.process.pid);
    assert.ok(closed, "exact real child close must have been observed");
    assert.equal(closed.code, failure.exitCode); assert.equal(closed.signal, failure.signal);
    assert.equal(closed.executable, failure.process.launchExecutable);
    assert.equal(closed.argsSha256, failure.process.launchArgsSha256); assert.equal(closed.cwd, failure.cwd);
    assert.ok(Math.abs(closed.startedAt - Date.parse(failure.process.startedAt)) < 1000);
    assert.ok(Math.abs(closed.closedAt - Date.parse(failure.process.closedAt)) < 1000);
    const proof = {reservationId: input.reservation.reservationId, bindingSha256: input.reservation.bindingSha256,
      failureSha256: input.failureSha256};
    let effects = "UNKNOWN";
    if (readOnly) {
      const launch = sandboxLaunch({executable: input.binding.executable, args: f.task.action.args, cwd: f.root});
      assert.equal(hash(launch.args), failure.process.launchArgsSha256);
      assert.deepEqual(await snapshot(f.root), baseline);
      effects = "RECONCILED";
    }
    return observationChange({termination: {...proof, state: "STOPPED", processSha256: hash(failure.process),
      evidence: `independent-real-close:${hash(closed)}`},
    effects: {...proof, state: effects, scopeSha256: input.scopeSha256,
      evidence: `enforced-read-only-sandbox-and-readback:${hash(baseline)}`}});
  };
  const host = await openControlHost(directory, config, {observeCommandFailure, createReturnSync}); await host.initialize();
  const bindingFor = p => ({operation: "resume", taskId: f.task.id, taskSha256: f.request.task.sha256,
    capsuleSha256: f.request.capsule.sha256, sourceDigest: p.coverageBasis.sourceDigest,
    dependencyDigest: p.coverageBasis.dependencyDigest, commandSha256: hash(f.task.action),
    cwd: f.root, executable: process.execPath, kind: "dependent"});
  const binding = bindingFor(prepared); binding.executable = await realpath(process.execPath);
  const approve = (b = binding, dependencies = []) => host.approveCommand(b, {reviewer: config.reviewer,
    reviewReceipt: "fixture-independent-current-readiness", dependencies, expiresAt: Date.now() + 120000});
  const run = (h = host, extra = {}) => runControlledContextTransition({...f.request, operation: "resume"},
    {control: h.control, ...(sandboxLaunch ? {sandboxLaunch} : {}), ...extra});
  const freeze = async () => {baseline = await snapshot(f.root);};
  const request = async () => ({reservationId: hash(binding), expectedJournalDigest: (await store.read()).digest,
    owner: config.owner, evidence: "owned-exact-failed-attempt-reconciliation"});
  return {f, directory, config, host, store, binding, bindingFor, approve, run, freeze, request, closes,
    observeCommandFailure, changeObservation: fn => {observationChange = fn;}};
}

test("real exit 7 stays held until exact stop and sandbox effects reconciliation; fresh correction executes once", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const body = "import {writeFileSync} from 'node:fs'; try { writeFileSync('forbidden-effect', 'bad'); process.exit(98); } catch {}\n" + failedBody;
  const x = await setup(t, {body, readOnly: true});
  await x.approve(); await x.freeze();
  const failed = await x.run(); assert.equal(failed.status, "BLOCKED");
  assert.equal(failed.actionOutcome, "OUTCOME_UNKNOWN");
  const first = (await x.host.snapshot()).reservations[hash(x.binding)];
  assert.equal(first.status, "IN_FLIGHT"); assert.equal(first.failure.exitCode, 7);
  assert.equal(first.failure.signal, null); assert.equal(first.failure.reason, "COMMAND_FAILED");
  assert.equal(first.failure.stdoutSha256, sha256("failed-attempt"));
  assert.equal(first.failure.stderrSha256, sha256("SECRET_STDERR"));
  assert.ok(!JSON.stringify(await x.store.read()).includes("SECRET_STDERR"));
  await x.host.pause(true); await x.host.pause(false);
  const different = {...x.binding, commandSha256: sha256("different")};
  await x.approve(different);
  await assert.rejects(x.host.control.authorize(different), /TASK_OUTCOME_UNKNOWN/);
  await x.host.pause(true);
  const reconciled = await x.host.reconcileCommand(await x.request());
  assert.equal(reconciled.status, "FAILED_RECONCILED"); assert.equal((await x.host.snapshot()).paused, true);
  const retained = (await x.host.snapshot()).reservations[hash(x.binding)];
  assert.deepEqual(retained.failure, first.failure); assert.equal(retained.resultSha256, undefined);
  assert.equal(retained.continuationStatus, undefined);
  await assert.rejects(x.host.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  await assert.rejects(x.approve(), /COMMAND_ALREADY_RESERVED/);
  await assert.rejects(x.host.control.observe(first, {outcome: "COMPLETED", bindingSha256: hash(x.binding),
    resultSha256: sha256("fabricated-success")}), /FAILED_COMMAND_NOT_COMPLETED/);
  await x.f.put("correction.mjs", "process.stdout.write('read-only-correction');\n");
  x.f.task.action.args = ["correction.mjs"]; await x.f.refresh();
  x.f.request.capsule = null; x.f.request.readback = null; const p = await x.f.prepare();
  const corrected = x.bindingFor(p); corrected.executable = await realpath(process.execPath);
  await x.host.pause(false);
  assert.equal((await x.run()).status, "BLOCKED", "reconciliation cannot mint a fresh grant");
  await x.approve(corrected); assert.equal((await x.run()).status, "ACTION_COMPLETED");
  assert.equal((await x.run()).status, "BLOCKED", "corrected grant also stays one-use");
  const final = await x.host.snapshot();
  assert.equal(final.reservations[hash(corrected)].status, "COMPLETED");
  assert.deepEqual(final.reservations[hash(x.binding)].failure, first.failure);
  assert.equal(final.reservations[hash(x.binding)].status, "FAILED_RECONCILED");
  const history = await readdir(x.directory);
  assert.ok(history.filter(name => /^\d{10}\.json$/.test(name)).length > 5);
});

test("actual mutation before exit 7 is a counterexample: exact termination alone never reconciles effects", async t => {
  const x = await setup(t, {body: "import {writeFileSync} from 'node:fs'; writeFileSync('effect.txt','retained-effect');\n" + failedBody});
  await x.approve(); await x.freeze(); await x.run();
  assert.equal(await readFile(path.join(x.f.root, "effect.txt"), "utf8"), "retained-effect");
  await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_EFFECTS_UNRECONCILED/);
  assert.equal((await x.host.snapshot()).reservations[hash(x.binding)].status, "IN_FLIGHT");
});

test("migration admits real protected exit-7 reconciliation without success, replay or budget reset", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const x = await setup(t, {readOnly: true});
  await x.approve(); await x.freeze();
  assert.equal((await x.run()).actionOutcome, "OUTCOME_UNKNOWN");
  const failed = await x.store.read(), id = hash(x.binding);
  await x.host.pause(true);
  const reviewDirectory = await realpath(await mkdtemp(path.join(tmpdir(), "reconciled-migration-review-")));
  t.after(() => rm(reviewDirectory, {recursive: true, force: true}));
  const sourceFile = path.join(reviewDirectory, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace: x.f.root,
    sources: [{id: "policy", path: "action.mjs", purpose: "Synthetic recovery fixture"}]}), {mode: 0o600});
  const targetConfig = {...x.config, evidenceRegistry: sourceFile,
    health: {scope: "Reconciled failure migration", intervalMs: 60000, maxBranches: 1, maxWorktrees: 1,
      triggerSourceIds: ["policy"], repairTasks: ["maintenance"]}};
  const reviewStore = await openControlStore(reviewDirectory);
  const review = await reviewStore.initialize({schema: "control.model-review.v1", configKey: sha256("review"),
    calls: 2, runs: {spent: {state: "STOPPED"}}});
  const options = {directory: x.directory, sourceConfig: x.config, targetConfig,
    expectedSourceConfigKey: hash(x.config), expectedJournalDigest: (await x.store.read()).digest,
    review: {directory: reviewDirectory, expectedDigest: review.digest, expectedConfigKey: review.state.configKey},
    actor: "operator", rationale: "Only enroll health after settled command failure",
    approval: {reviewer: "reviewer", targetConfigKey: hash(targetConfig), registryAddition: true,
      evidence: "synthetic independent migration approval"}};
  const trusted = {withSafeBoundary: run => run({actor: "operator", directory: x.directory, reviewDirectory,
    state: "QUIESCENT", oldHost: "STOPPED", evidence: "synthetic exclusive boundary"})};
  await assert.rejects(migrateControlHost(options, trusted), /ACTION_OUTCOME_UNKNOWN/);
  await x.host.reconcileCommand(await x.request());
  const original = (await x.store.read()).state.reservations[id];
  for (const corrupt of [
    r => {delete r.reconciliation;},
    r => {r.reconciliation.owner = "worker";},
    r => {r.reconciliation.observation.termination.processSha256 = sha256("foreign-process");},
    r => {r.reconciliation.observation.effects.scopeSha256 = sha256("subset");},
    r => {r.reconciliation.observation.effects.state = "UNKNOWN";},
    r => {r.reconciliation.observation.effects.evidence = r.reconciliation.observation.termination.evidence;},
    r => {r.reconciliation.previousJournalDigest = sha256("invented-journal");},
    r => {r.reconciliation.previousJournalDigest = failed.digest;},
    r => {r.failure.exitCode = 0;},
    r => {r.resultSha256 = sha256("forged-success");},
    r => {r.continuationStatus = "COMPLETED";},
    r => {r.status = "UNKNOWN";},
  ]) {
    await x.store.transact(s => {corrupt(s.reservations[id]); return s;});
    const held = await x.store.read(); options.expectedJournalDigest = held.digest;
    await assert.rejects(migrateControlHost(options, trusted), /ACTION_OUTCOME_UNKNOWN/);
    assert.deepEqual(await x.store.read(), held); assert.deepEqual(await reviewStore.read(), review);
    await x.store.transact(s => {s.reservations[id] = structuredClone(original); return s;});
  }
  const settled = await x.store.read(), names = await readdir(x.directory);
  const bytes = await Promise.all(names.map(name => readFile(path.join(x.directory, name))));
  options.expectedJournalDigest = settled.digest;
  assert.equal((await migrateControlHost(options, trusted)).status, "JOURNAL_MIGRATED_ONLY");
  const modern = await openControlHost(x.directory, targetConfig, {}), state = await modern.snapshot();
  assert.equal(state.paused, true);
  assert.deepEqual(state.reservations, settled.state.reservations);
  assert.deepEqual(state.grants, settled.state.grants);
  assert.deepEqual(state.reservations[id].failure, failed.state.reservations[id].failure);
  assert.equal(state.reservations[id].status, "FAILED_RECONCILED");
  assert.equal(state.reservations[id].resultSha256, undefined);
  assert.equal(state.reservations[id].continuationStatus, undefined);
  assert.equal(await settledCommandHistory(x.store, await x.store.read(), targetConfig), true,
    "v1 reconciliation remains settled for v2 cutover after approved health-only migration");
  const current = await x.store.read();
  const foreignMigration = structuredClone(current);
  foreignMigration.state.controlMigration.sourceConfig.owner = "foreign-owner";
  assert.equal(await settledCommandHistory(x.store, foreignMigration, targetConfig), false);
  assert.deepEqual(await reviewStore.read(), review);
  for (let i = 0; i < names.length; i++) assert.deepEqual(await readFile(path.join(x.directory, names[i])), bytes[i]);
  await assert.rejects(modern.approveCommand(x.binding, {reviewer: "reviewer", reviewReceipt: "not a retry",
    dependencies: [], expiresAt: Date.now() + 120000}), /COMMAND_ALREADY_RESERVED/);
  await assert.rejects(modern.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
});

test("missing observer, worker claims, foreign proof, stale CAS and conflicting failure refuse", async t => {
  const x = await setup(t); await x.approve(); await x.freeze(); await x.run();
  const request = await x.request(), row = (await x.host.snapshot()).reservations[hash(x.binding)];
  const missing = await openControlHost(x.directory, x.config, {});
  await assert.rejects(missing.reconcileCommand(request), /COMMAND_OBSERVER_REQUIRED/);
  await assert.rejects(x.host.reconcileCommand({...request, observation: {state: "STOPPED"}}), /COMMAND_RECONCILIATION_INVALID/);
  await assert.rejects(x.host.reconcileCommand({...request, owner: "worker"}), /COMMAND_RECONCILIATION_INVALID/);
  x.changeObservation(v => ({...v, termination: {...v.termination, bindingSha256: sha256("foreign")}}));
  await assert.rejects(x.host.reconcileCommand(request), /COMMAND_TERMINATION_UNPROVEN/);
  x.changeObservation(v => ({...v, effects: {...v.effects, state: "RECONCILED", scopeSha256: sha256("subset")}}));
  await assert.rejects(x.host.reconcileCommand(request), /COMMAND_EFFECTS_UNRECONCILED/);
  await x.host.pause(true);
  await assert.rejects(x.host.reconcileCommand(request), /COMMAND_RECONCILIATION_STALE/);
  await assert.rejects(x.host.control.captureFailure(row, {bindingSha256: hash(x.binding),
    failure: {...row.failure, exitCode: 8}}), /COMMAND_FAILURE_CONFLICT/);
  await assert.rejects(x.host.control.observe(row, {outcome: "COMPLETED", bindingSha256: hash(x.binding),
    resultSha256: sha256("worker-success")}), /FAILED_COMMAND_NOT_COMPLETED/);
  assert.equal((await x.host.snapshot()).reservations[hash(x.binding)].status, "IN_FLIGHT");
});

test("timeout and signal preserve exact termination metadata but do not settle effects", async t => {
  for (const mode of ["timeout", "signal"]) {
    const x = await setup(t, {body: mode === "timeout" ? "setInterval(()=>{},1000);" : "process.kill(process.pid,'SIGTERM');"});
    if (mode === "timeout") {x.f.task.action.timeoutMs = 100; await x.f.refresh();
      x.f.request.capsule = null; x.f.request.readback = null; const p = await x.f.prepare();
      Object.assign(x.binding, x.bindingFor(p), {executable: await realpath(process.execPath)});}
    await x.approve(); await x.freeze(); await x.run();
    const failure = (await x.host.snapshot()).reservations[hash(x.binding)].failure;
    assert.equal(failure.reason, mode === "timeout" ? "COMMAND_TIMEOUT" : "COMMAND_SIGNALLED");
    assert.equal(failure.signal, mode === "timeout" ? "SIGKILL" : "SIGTERM");
    await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_EFFECTS_UNRECONCILED/);
    x.changeObservation(() => ({termination: {state: "TIMEOUT"}, effects: {state: "RECONCILED"}}));
    await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_TERMINATION_UNPROVEN/);
  }
});

test("trusted observations cannot reconcile across a concurrent journal change", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const x = await setup(t, {readOnly: true}); await x.approve(); await x.freeze(); await x.run();
  x.changeObservation(async value => {await x.host.pause(true); return value;});
  await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_RECONCILIATION_STALE/);
  assert.equal((await x.host.snapshot()).reservations[hash(x.binding)].status, "IN_FLIGHT");
  assert.equal((await x.host.snapshot()).paused, true);
});

test("caller mutation during independent observation cannot change the retained reconciliation", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const x = await setup(t, {readOnly: true}); await x.approve(); await x.freeze(); await x.run();
  const request = await x.request(), original = structuredClone(request);
  x.changeObservation(value => {
    request.owner = "worker"; request.evidence = "changed-owner-claim";
    request.reservationId = sha256("foreign"); request.expectedJournalDigest = sha256("stale");
    return value;
  });
  const result = await x.host.reconcileCommand(request);
  assert.equal(result.reservationId, original.reservationId);
  const retained = (await x.host.snapshot()).reservations[original.reservationId];
  assert.equal(retained.status, "FAILED_RECONCILED");
  assert.equal(retained.reconciliation.owner, original.owner);
  assert.equal(retained.reconciliation.evidence, original.evidence);
  assert.equal(retained.reconciliation.previousJournalDigest, original.expectedJournalDigest);
});

test("direct failure capture snapshots validated arguments before its journal await", async t => {
  const x = await setup(t); await x.approve(); await x.freeze(); await x.run();
  const row = (await x.host.snapshot()).reservations[hash(x.binding)], claim = structuredClone(row);
  const observed = {bindingSha256: hash(x.binding), failure: structuredClone(row.failure)};
  const pending = x.host.control.captureFailure(claim, observed);
  claim.reservationId = sha256("foreign"); observed.bindingSha256 = sha256("foreign");
  observed.failure.exitCode = 0; observed.failure.stdoutBytes = -1;
  const receipt = await pending;
  assert.equal(receipt.reservationId, row.reservationId);
  assert.deepEqual((await x.host.snapshot()).reservations[hash(x.binding)].failure, row.failure);
});

test("ordinary launcher errors with fabricated failure properties cannot enter protected capture", async t => {
  const x = await setup(t); await x.approve();
  const fake = Error("PRIVATE_ERROR"); fake.failure = {exitCode: 7};
  const result = await x.run(x.host, {sandboxLaunch: () => {throw fake;}});
  assert.equal(result.status, "BLOCKED"); assert.ok(!JSON.stringify(result).includes("PRIVATE_ERROR"));
  const reservation = (await x.host.snapshot()).reservations[hash(x.binding)];
  assert.equal(reservation.status, "IN_FLIGHT"); assert.equal(reservation.failure, undefined);
  await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_RECONCILIATION_CONFLICT/);
});

test("failed dependency cannot earn continuation or acceptance closure, even after reconciliation", {
  skip: process.platform !== "darwin" && "requires existing macOS read-only sandbox"
}, async t => {
  const x = await setup(t, {readOnly: true});
  const ref = async name => x.f.put(`${name}.md`, name);
  const acceptance = {schema: "work.product-acceptance.v1", id: "prior", project: "synthetic", task: "prior-task",
    owner: "owner", executor: "worker", status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: await ref("return"), artifact: await ref("artifact"), technicalProof: await ref("proof"), goal: await ref("goal"),
    retention: await Promise.all(retentionKinds.map(async id => ({id, required: true, expected: await ref(id)})))};
  await x.host.accept(acceptance);
  const offer = await x.host.claimReview("prior");
  const verdict = {phase: "POST_ACCEPT", key: offer.key, reviewer: "reviewer", runId: offer.runId,
    observedAt: new Date().toISOString(), findings: [], rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: "protocol-only"}))};
  await x.host.review("prior", offer, verdict);
  await x.host.disposition("prior", {owner: "owner", reviewKey: hash(verdict), action: "CONTINUE",
    nextAction: x.binding.taskId, evidence: "synthetic-owner-disposition"});
  await x.approve(x.binding, ["prior"]); await x.freeze(); await x.run();
  await x.host.reconcileCommand(await x.request());
  const row = (await x.host.snapshot()).acceptances.prior;
  assert.equal(row.disposition.continuationEvidence, undefined);
  assert.notEqual(row.enrollment, "FINAL_READBACK_DUE");
  await assert.rejects(x.host.close("prior"), /CONTROL_NOT_COMPLETE/);
  await assert.rejects(x.host.reconcileCommand(await x.request()), /COMMAND_RECONCILIATION_CONFLICT/);
});
