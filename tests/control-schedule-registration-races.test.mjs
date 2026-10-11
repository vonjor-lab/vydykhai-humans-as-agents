import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, realpath, rm, lstat} from "node:fs/promises";
import {writeFileSync} from "node:fs";
import childProcess from "node:child_process";
import {AsyncLocalStorage} from "node:async_hooks";
import {syncBuiltinESMExports} from "node:module";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {activateControl} from "../scripts/control-activation.mjs";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";
import {controlSchedulePlan, registerControlSchedule, matchesControlRegistration} from "../scripts/control-schedule.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlChild} from "../scripts/control-child.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
const bounded = {skip: process.platform !== "darwin", timeout: 60000};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const role = new AsyncLocalStorage();

async function exists(file) {
  try {await lstat(file); return true;} catch (e) {if (e.code === "ENOENT") return false; throw e;}
}
async function until(check, label, timeoutMs = 7000) {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(20);
  }
  throw Error(`CHECKPOINT_TIMEOUT:${label}`);
}
async function nativeCtl(args) {
  const result = await runControlChild({executable: "/bin/launchctl", args, cwd: "/",
    env: {PATH: "/usr/bin:/bin"}, input: "", timeoutMs: 5000, maxBytes: 128 * 1024});
  assert.equal(result.state, "CLOSED", JSON.stringify(result));
  assert.equal(result.reason, null, JSON.stringify(result));
  return result;
}
const absent = (result, plan) => result.code === 113 && result.errors.includes(`Could not find service "${plan.label}"`);
const observation = result => ({code: result.code, output: result.output, errors: result.errors});
async function journals(x) {
  return {host: await (await openControlStore(x.profile.directory)).read(),
    review: await (await openControlStore(x.profile.review.directory)).read(),
    policy: await readFile(path.join(x.workspace, "policy.md"), "utf8")};
}
async function fixture() {
  const temp = await realpath(await mkdtemp(path.join(tmpdir(), "schedule-registration-race-")));
  const workspace = path.join(temp, "workspace"), root = path.join(temp, "control"), packages = path.join(temp, "packages");
  for (const dir of [workspace, root, packages]) await mkdir(dir, {mode: 0o700});
  const {digest} = await inspectControlRuntime(source);
  const installed = await stageControlRuntime({sourceRoot: source, directory: packages, workspace, expectedDigest: digest});
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "policy", path: "policy.md", purpose: "Disposable scheduler counterexample"}]}), {mode: 0o600});
  await writeFile(path.join(workspace, "policy.md"), "Isolated paused no-model scheduler counterexample.\n");
  const profile = {schema: "control.service.v1", directory: path.join(root, "host"),
    config: {workspace, policy: "a".repeat(64), owner: "owner", executor: "executor", reviewer: "reviewer",
      evidenceRegistry: sourceFile, health: {scope: "Disposable scheduler counterexample", intervalMs: 60000,
        maxBranches: 1, maxWorktrees: 1, triggerSourceIds: ["policy"], repairTasks: []}},
    review: {directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      maxCalls: 1, expiresAt: new Date(Date.now() + 3600000).toISOString(), scope: {kind: "fixture"},
      native: {workspace: path.join(root, "room"), home: path.join(root, "home"), binary: "/never-launch-model",
        model: "no-inference", effort: "low", timeoutMs: 1000}}, timeoutMs: 3000, maxReviewsPerTick: 0};
  const descriptor = await activateControl({sourceRoot: installed.root, root, expectedDigest: digest, profile});
  const runtime = await loadControlRuntime({packageRoot: installed.root, expectedDigest: digest, workspace});
  await (await runtime.service.openControlService(profile)).host.pause(true);
  const options = {descriptorFile: descriptor.descriptorFile, mode: "SESSION", intervalSeconds: 3600};
  const plan = await controlSchedulePlan(options);
  return {temp, root, workspace, profile, options, plan, digest, receipt: path.join(root, "observer-latest.json")};
}

// Delay only transport dispatch. Once released, forward the real launchctl
// stdout/stderr/exit status; no synthetic registration or successful reply.
const gatedTransport = `
import {access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const [gate, args] = process.argv.slice(1);
const end = performance.now() + 8000;
for (;;) {
  try {await access(gate); break;} catch(e) {if(e.code !== 'ENOENT') throw e;}
  if(performance.now() >= end) throw Error('TRANSPORT_GATE_TIMEOUT');
  await new Promise(resolve => setTimeout(resolve, 10));
}
const child = spawn('/bin/launchctl', JSON.parse(args), {stdio: 'inherit'});
child.on('error', e => {console.error(e.message); process.exitCode = 125;});
child.on('close', (code, signal) => {process.exitCode = signal ? 125 : code;});
`;
function intercept(t, x, mode) {
  const spawn = childProcess.spawn, commands = [];
  let aPrints = 0;
  const mock = t.mock.method(childProcess, "spawn", (executable, args, options) => {
    const who = role.getStore();
    if (who) commands.push({role: who, executable, args, at: new Date().toISOString()});
    if (executable === "/bin/launchctl" && who === "A" && args[0] === "print") {
      aPrints++;
      if (aPrints === 2) {
        writeFileSync(path.join(x.temp, "A-bootstrap-before-readback"), "reached", {mode: 0o600});
        if (mode === "interrupted") throw Error("INJECTED_INTERRUPTION_AFTER_BOOTSTRAP_BEFORE_READBACK");
        return spawn(process.execPath, ["--input-type=module", "-e", gatedTransport,
          path.join(x.temp, "A-continue"), JSON.stringify(args)], options);
      }
    }
    return spawn(executable, args, options);
  });
  syncBuiltinESMExports();
  return {commands, restore() {mock.mock.restore(); syncBuiltinESMExports();}};
}
function register(x, who) {
  return role.run(who, () => registerControlSchedule(x.options)).then(
    value => ({value}), error => ({error: error.message}));
}
async function releaseGate(x, who) {
  await writeFile(path.join(x.temp, `${who}-continue`), "continue", {mode: 0o600});
}
async function receiptWithin(x, timeoutMs = 1000) {
  const end = performance.now() + timeoutMs;
  do {
    if (await exists(x.receipt)) return JSON.parse(await readFile(x.receipt, "utf8"));
    await sleep(25);
  } while (performance.now() < end);
  return null;
}
function assertPeriodicResult(result, reused) {
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.value.status, "REGISTERED");
  assert.equal(result.value.readiness, "NOT_CERTIFIED");
  assert.equal(result.value.initialObservation, "NOT_PERFORMED");
  assert.equal(result.value.reused, reused);
}
async function assertRegistrationOnly(x, before, hook) {
  const receipt = await receiptWithin(x), final = await nativeCtl(["print", x.plan.target]);
  assert.equal(final.code, 0, JSON.stringify(observation(final)));
  assert.ok(matchesControlRegistration(final.output, x.plan));
  assert.match(final.output, /^\s*runs = 0\s*$/m);
  assert.doesNotMatch(final.output, /^\s*pid = \d+/m);
  assert.equal(receipt, null, "Periodic registration does not perform or imply initial observation");
  assert.ok(hook.commands.every(c => c.executable === "/bin/launchctl" && ["print", "bootstrap"].includes(c.args[0])),
    "Registrars must not kickstart or directly launch an observer");
  assert.equal(hook.commands.filter(c => c.args[0] === "bootstrap").length, 1);
  assert.deepEqual(await journals(x), before);
  assert.equal(await readFile(x.plan.file, "utf8"), x.plan.plist);
  await assert.rejects(lstat(path.join(x.root, "observer.lease")), {code: "ENOENT"});
  return observation(final);
}
async function cleanup(t, x) {
  const present = await nativeCtl(["print", x.plan.target]);
  if (!absent(present, x.plan)) {
    assert.equal(present.code, 0, JSON.stringify(observation(present)));
    assert.ok(matchesControlRegistration(present.output, x.plan), "Never clean up a foreign registration");
    const stopped = await nativeCtl(["bootout", x.plan.target]);
    assert.equal(stopped.code, 0, JSON.stringify(observation(stopped)));
    await until(async () => absent(await nativeCtl(["print", x.plan.target]), x.plan), "owned cleanup", 12000);
  }
  t.diagnostic(JSON.stringify({cleanup: "OWNED_JOB_ABSENT", target: x.plan.target, root: x.temp}));
  await rm(x.temp, {recursive: true, force: true});
}

// These assert the new periodic-only contract. The failing immediate-wake
// counterexamples remain raw historical evidence, not regraded test results.
test("concurrent registration and later reuse perform no initial observation or kick", bounded, async t => {
  const x = await fixture(), before = await journals(x), hook = intercept(t, x, "concurrent");
  const pending = [];
  try {
    const a = register(x, "A"); pending.push(a);
    await until(() => exists(path.join(x.temp, "A-bootstrap-before-readback")), "A bootstrapped under its lease");
    const aLease = await readFile(path.join(x.root, "observer.lease"), "utf8");
    assert.equal(JSON.parse(aLease).pid, process.pid);
    const bootstrapped = await nativeCtl(["print", x.plan.target]);
    assert.equal(bootstrapped.code, 0);
    assert.ok(matchesControlRegistration(bootstrapped.output, x.plan));
    const b = register(x, "B"); pending.push(b);
    const concurrent = await b;
    assert.equal(concurrent.error, "CONTROL_OBSERVER_LEASE_HELD_RECONCILIATION_REQUIRED");
    assert.equal(await readFile(path.join(x.root, "observer.lease"), "utf8"), aLease);
    assert.equal(hook.commands.filter(c => c.role === "B").length, 0);
    await releaseGate(x, "A");
    const first = await a;
    assertPeriodicResult(first, false);
    // A new explicit registration request after a known pre-dispatch refusal,
    // not an automatic retry of any unknown observer effect.
    const subsequent = await register(x, "C");
    assertPeriodicResult(subsequent, true);
    const final = await assertRegistrationOnly(x, before, hook);
    t.diagnostic(JSON.stringify({case: "periodic-concurrent-and-reuse", runtime: x.digest, root: x.temp,
      commands: hook.commands, concurrent, initialObservation: first.value.initialObservation,
      reusedInitialObservation: subsequent.value.initialObservation, final, receipt: null, journalsUnchanged: true,
      limits: "Registration only; no startup, actual timer, or attribution of historical SESSION failure"}));
  } finally {
    await releaseGate(x, "A");
    await Promise.allSettled(pending);
    hook.restore();
    await cleanup(t, x);
  }
});

test("reuse after interrupted bootstrap readback remains periodic and does not fabricate initial observation", bounded, async t => {
  const x = await fixture(), before = await journals(x), hook = intercept(t, x, "interrupted");
  try {
    const first = await register(x, "A");
    assert.equal(first.error, "INJECTED_INTERRUPTION_AFTER_BOOTSTRAP_BEFORE_READBACK");
    await assert.rejects(lstat(path.join(x.root, "observer.lease")), {code: "ENOENT"});
    const bootstrapped = await nativeCtl(["print", x.plan.target]);
    assert.equal(bootstrapped.code, 0);
    assert.ok(matchesControlRegistration(bootstrapped.output, x.plan));
    assert.equal(await exists(x.receipt), false);
    const second = await register(x, "B");
    assertPeriodicResult(second, true);
    const final = await assertRegistrationOnly(x, before, hook);
    t.diagnostic(JSON.stringify({case: "periodic-interrupted-readback", runtime: x.digest, root: x.temp,
      commands: hook.commands, A: first, initialObservation: second.value.initialObservation,
      bootstrapped: observation(bootstrapped), final, receipt: null, journalsUnchanged: true,
      limits: "Injected exception after actual bootstrap; registration only, no startup or actual timer proof"}));
  } finally {
    hook.restore();
    await cleanup(t, x);
  }
});
