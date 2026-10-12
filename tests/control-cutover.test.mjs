import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, cp, readFile, writeFile, realpath, rm, lstat, chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";
import {activateControl, acquireControlLease, verifyControlActivation} from "../scripts/control-activation.mjs";
import {switchControlRuntime, inspectControlCutover, recoverControlCutover} from "../scripts/control-cutover.mjs";
import {controlSchedulePlan} from "../scripts/control-schedule.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {changeControlProfile, recoverControlProfileChange} from "../scripts/control-profile-change.mjs";
import {inspectControlRecovery, recoverStoppedControlObserver} from "../scripts/control-recovery.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
const darwin = {skip: process.platform !== "darwin", timeout: 30000};
const hash = value => sha256(canonicalJson(value));
const missing = plan => ({state: "CLOSED", code: 113, output: "",
  errors: `Could not find service "${plan.label}" in domain for user gui: ${process.getuid()}`});
const stopped = {readSchedule: async plan => missing(plan)};

function profileChange(x) {
  const profile = structuredClone(x.profile);
  profile.review.directory = path.join(x.root,"review-next");
  profile.review.maxCalls = 4;
  profile.review.expiresAt = new Date(Date.now()+3600000).toISOString();
  return {descriptorFile:x.descriptor.descriptorFile,expectedDescriptorHash:hash(JSON.parse(x.oldBytes)),
    profile,actor:"operator",evidence:"fixture:explicit fresh allocation, not refunded history",
    noRacingSchedulerOperators:true,noConcurrentStateWriters:true,
    allocations:{review:{maxCalls:4,expiresAt:profile.review.expiresAt,evidence:"fixture:four new authorized slots"}}};
}

test("profile transition retains expired spent journals and creates a separate finite allocation",darwin,async t=>{
  const x=await fixture(t,{ttlMs:-1000}),options=profileChange(x);
  const result=await changeControlProfile(options,stopped);
  assert.equal(result.status,"PROFILE_CHANGED_PAUSED");
  assert.equal(result.projectReadiness,"NOT_CERTIFIED");
  await x.unchanged();await noOwnership(x);
  const selected=await verifyControlActivation(x.descriptor.descriptorFile);
  assert.notEqual(selected.descriptor.profileFile,x.descriptor.profileFile);
  assert.deepEqual(selected.profile,options.profile);
  const service=await selected.runtime.service.openControlService(selected.profile);
  assert.deepEqual(await service.review.capacity(),{remaining:4,used:0});
  assert.equal((await x.stores.review.read()).state.calls,2);
  const history=JSON.parse(await readFile(result.historyFile,"utf8"));
  assert.deepEqual(history.oldJournals.review,{revision:x.before.review.revision,digest:x.before.review.digest});
  assert.deepEqual((await service.host.snapshot()).acceptances.retained.findings,x.before.host.state.acceptances.retained.findings);
});

for(const [name,change,code] of [
  ["in-place renewal",o=>{o.profile.review.directory=path.join(path.dirname(o.descriptorFile),"review");},"OLD_ALLOCATION_IMMUTABLE"],
  ["unapproved budget",o=>{delete o.allocations.review;},"NEW_ALLOCATION_REQUIRED"],
  ["different owner",o=>{o.profile.config.owner="someone-else";},"HOST_CHANGE_FORBIDDEN"],
  ["old owner refund",o=>{o.profile.ownerDelivery.maxCalls=4;},"OLD_OWNER_ALLOCATION_IMMUTABLE"]
])test(`profile transition refuses ${name} without changing original state`,darwin,async t=>{
  const x=await fixture(t),options=profileChange(x);change(options);
  await assert.rejects(changeControlProfile(options,stopped),new RegExp(code));
  await x.unchanged();await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile),x.oldBytes);
});

test("profile transition refuses unknown model history before staging any allocation",darwin,async t=>{
  const x=await fixture(t),options=profileChange(x);
  await x.stores.review.transact(s=>{s.runs.spent.state="UNKNOWN";return s;});
  const before=await x.snapshot();
  await assert.rejects(changeControlProfile(options,stopped),/MODEL_OR_OWNER_OUTCOME_UNKNOWN/);
  await x.unchanged(before);await noOwnership(x);
  await assert.rejects(lstat(options.profile.review.directory),{code:"ENOENT"});
});

test("profile transition refuses a live scheduler without touching journals",darwin,async t=>{
  const x=await fixture(t);
  await assert.rejects(changeControlProfile(profileChange(x),{readSchedule:async plan=>({
    state:"CLOSED",code:0,errors:"",output:`path = ${plan.file}\nprogram = ${plan.args[0]}\narguments = {\n${plan.args.join("\n")}\n}\n`
  })}),/SCHEDULE_STOP_REQUIRED/);
  await x.unchanged();await noOwnership(x);
});

test("interrupted profile selection retains the lease until exact stopped-operator recovery",darwin,async t=>{
  const x=await fixture(t),options=profileChange(x);
  const code=`import {changeControlProfile} from ${JSON.stringify(new URL("../scripts/control-profile-change.mjs",import.meta.url).href)};
    let n=0;await changeControlProfile(${JSON.stringify(options)},{readSchedule:async plan=>{
      if(++n===4)process.exit(63);return {state:'CLOSED',code:113,output:'',errors:'Could not find service "'+plan.label+'"'};}});`;
  const r=spawnSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8",timeout:15000});
  assert.equal(r.status,63,r.stderr);assert.equal(r.signal,null);
  const intent=JSON.parse(await readFile(path.join(x.root,"observer-recovery.lease"),"utf8"));
  assert.equal(intent.schema,"control.profile-change.v1");
  await assert.rejects(acquireControlLease(x.root),/RECOVERY_IN_PROGRESS/);
  const recovered=await recoverControlProfileChange({descriptorFile:x.descriptor.descriptorFile,
    expectedIntentKey:hash(intent),actor:"supervisor",evidence:"fixture:exact operator stopped, histories unchanged",
    noRacingSchedulerOperators:true,noConcurrentStateWriters:true},{...stopped,observeStop:async()=>({
      state:"STOPPED",pid:intent.pid,token:intent.token,evidence:"fixture child exited63"})});
  assert.equal(recovered.status,"PROFILE_ROLLED_BACK_PAUSED");
  await x.unchanged();await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile),x.oldBytes);
});

async function fixture(t, {calls = 2, ttlMs = 3600000, continuation, noOwner = false} = {}) {
  const temp = await realpath(await mkdtemp(path.join(tmpdir(), "control-cutover-test-")));
  t.after(() => rm(temp, {recursive: true, force: true}));
  const workspace = path.join(temp, "workspace"), root = path.join(temp, "control"),
    packages = path.join(temp, "packages"), candidate = path.join(temp, "candidate");
  for (const dir of [workspace, root, packages, candidate]) await mkdir(dir, {mode: 0o700});
  const observed = await inspectControlRuntime(source);
  t.diagnostic(`Disposable base runtime ${observed.digest}; no runtime allowlist changes.`);
  for (const name of Object.keys(observed.description.files)) {
    await mkdir(path.dirname(path.join(candidate, name)), {recursive: true});
    await cp(path.join(source, name), path.join(candidate, name));
  }
  assert.equal((await inspectControlRuntime(candidate)).digest, observed.digest);
  const stage = async sourceRoot => {
    const {digest} = await inspectControlRuntime(sourceRoot);
    return stageControlRuntime({sourceRoot, directory: packages, workspace, expectedDigest: digest});
  };
  const first = await stage(candidate), alternate = path.join(temp, "alternate");
  await cp(candidate, alternate, {recursive: true});
  const observer = path.join(alternate, "scripts/control-observer-run.mjs");
  await writeFile(observer, (await readFile(observer, "utf8")) + "\nprocess.stderr.write('fixture-new-runtime\\n');\n");
  const second = await stage(alternate);
  await writeFile(path.join(workspace, "policy.md"), "Retained product, unfinished task and human pause.\n");
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "policy", path: "policy.md", purpose: "Disposable cutover"}]}), {mode: 0o600});
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const profile = {schema: "control.service.v1", directory: path.join(root, "host"),
    config: {workspace, policy: "a".repeat(64), owner: "owner", executor: "executor", reviewer: "reviewer",
      evidenceRegistry: sourceFile, health: {scope: "Disposable cutover", intervalMs: 60000,
        maxBranches: 1, maxWorktrees: 1, triggerSourceIds: ["policy"], repairTasks: ["maintenance"]}},
    review: {directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      native: {workspace: path.join(root, "review-room"), home: path.join(root, "empty-home"), authHome: path.join(root, "empty-home"),
        binary: "/never-launch-model", model: "no-inference", effort: "low", timeoutMs: 1000},
      maxCalls: 2, expiresAt, scope: {kind: "fixture"}},
    notifications: {directory: path.join(root, "notifications"), transportActor: "control-owner-transport"},
    ownerDelivery: {directory: path.join(root, "owner-delivery"), maxCalls: 2,
      expiresAt,
      delegation: {mode: "NATIVE_CONTROL_DISPOSITION", owner: "owner", authorizedBy: "owner",
        evidence: "fixture:explicit delegation", nextAction: "next"},
      native: {workspace: path.join(root, "owner-room"), home: path.join(root, "owner-home"),
        authHome: path.join(root, "empty-home"), binary: "/never-launch-model", model: "no-inference",
        effort: "low", timeoutMs: 1000}}, timeoutMs: 3000, maxReviewsPerTick: 0,
    ...(continuation ? {continuation} : {})};
  if(noOwner) {delete profile.ownerDelivery;delete profile.notifications;}
  const descriptor = await activateControl({sourceRoot: first.root, root, expectedDigest: first.digest, profile});
  const runtime = await loadControlRuntime({packageRoot: first.root, expectedDigest: first.digest, workspace});
  const service = await runtime.service.openControlService(profile); await service.host.pause(true);
  const stores = {};
  for (const [id, directory] of Object.entries({host: profile.directory, review: profile.review.directory,
    ...(profile.ownerDelivery ? {owner: profile.ownerDelivery.directory,notifications:profile.notifications.directory} : {})}))
    stores[id] = await openControlStore(directory);
  await stores.host.transact(s => {
    s.acceptances.retained = {acceptance: {id: "retained", status: "ACCEPTED", owner: "owner"},
      enrollment: "REPAIR_DUE", reviewLease: null, findings: [{id: "open", attempts: 1, status: "OPEN"}],
      history: [{evidence: "failed repair retained"}]};
    s.reservations.done = {status: "COMPLETED", evidence: "never replay"};
    return s;
  });
  for (const id of ["review", "owner"].filter(id=>stores[id])) await stores[id].transact(s => {
    s.calls = calls; s.runs.spent = {state: "STOPPED", evidence: "failed attempt remains spent"}; return s;
  });
  const snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(stores).map(async ([id, store]) =>
    [id, await store.read()])));
  const before = await snapshot(), profileBytes = await readFile(descriptor.profileFile),
    oldBytes = await readFile(descriptor.descriptorFile), productBytes = await readFile(path.join(workspace, "policy.md"));
  const options = {descriptorFile: descriptor.descriptorFile, expectedOldDigest: first.digest,
    packageRoot: second.root, expectedDigest: second.digest, actor: "operator", evidence: "fixture:approved same-profile switch",
    noRacingSchedulerOperators: true};
  const unchanged = async (expected = before) => {
    assert.deepEqual(await snapshot(), expected); assert.deepEqual(await readFile(descriptor.profileFile), profileBytes);
    assert.deepEqual(await readFile(path.join(workspace, "policy.md")), productBytes);
  };
  const command = (args, status = 0) => {
    const r = spawnSync(process.execPath, args, {cwd: root, encoding: "utf8", timeout: 10000,
      env: {PATH: "/usr/bin:/bin", HOME: path.join(root, "empty-home")}, maxBuffer: 1024 * 1024});
    assert.equal(r.error, undefined, r.error?.message); assert.equal(r.signal, null, r.stderr);
    assert.equal(r.status, status, r.stderr); return r;
  };
  const observe = async mark => {
    const selected = JSON.parse(await readFile(descriptor.descriptorFile));
    const r = command([path.join(selected.runtime.root, "scripts/control-observer-run.mjs"), descriptor.descriptorFile]);
    if (mark) assert.match(r.stderr, /fixture-new-runtime/); else assert.doesNotMatch(r.stderr, /fixture-new-runtime/);
    const result = JSON.parse(r.stdout);
    assert.equal(result.descriptorHash, hash(selected)); assert.equal(result.paused, true);
    assert.equal(result.calls, 0); assert.equal(result.ownerDelivery.calls, 0);
    assert.equal(result.projectReadiness, "NOT_CERTIFIED"); await unchanged();
    return result;
  };
  return {temp, root, workspace, profile, descriptor, candidate, alternate, stage, first, second,
    options, stores, snapshot, before, oldBytes, unchanged, command, observe};
}
function profileChild(options, hook = "") {
  const code = `import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
    ${hook};syncBuiltinESMExports();
    const {changeControlProfile}=await import(${JSON.stringify(new URL("../scripts/control-profile-change.mjs",import.meta.url).href)});
    await changeControlProfile(${JSON.stringify(options)},{readSchedule:async plan=>({state:'CLOSED',code:113,
      output:'',errors:'Could not find service "'+plan.label+'"'})});`;
  const r=spawnSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8",timeout:15000});
  assert.equal(r.status,63,r.stderr);assert.equal(r.signal,null);
}
const recoveryInput = (x,intent) => ({descriptorFile:x.descriptor.descriptorFile,expectedIntentKey:hash(intent),
  actor:"supervisor",evidence:"fixture:exact stopped process and unchanged state",
  noRacingSchedulerOperators:true,noConcurrentStateWriters:true});
const stopProof = intent => ({...stopped,observeStop:async()=>({state:"STOPPED",pid:intent.pid,
  token:intent.token,evidence:"fixture child completed with exit63"})});

test("profile transition resumes exact unused first-owner staging after interrupted initialization and rollback",darwin,async t=>{
  const x=await fixture(t,{noOwner:true}),o=profileChange(x);
  o.profile.notifications={directory:path.join(x.root,"notifications"),transportActor:"control-owner-transport"};
  o.profile.ownerDelivery={directory:path.join(x.root,"owner-delivery"),maxCalls:2,expiresAt:o.profile.review.expiresAt,
    delegation:{mode:"NATIVE_CONTROL_DISPOSITION",owner:"owner",authorizedBy:"owner",evidence:"fixture approval",nextAction:"next"},
    native:{workspace:path.join(x.root,"owner-room"),home:path.join(x.root,"owner-home"),authHome:o.profile.review.native.authHome,
      binary:"/never-launch-model",model:"no-inference",effort:"low",timeoutMs:1000}};
  o.allocations.owner={maxCalls:2,expiresAt:o.profile.ownerDelivery.expiresAt,evidence:"fixture two new slots"};
  profileChild(o,`const link=fs.link;fs.link=async(...args)=>{const r=await link(...args);
    if(args[1]===${JSON.stringify(path.join(x.root,"owner-delivery","0000000000.json"))})process.exit(63);return r;}`);
  const intent=JSON.parse(await readFile(path.join(x.root,"observer-recovery.lease"),"utf8"));
  assert.equal(intent.phase,"PREPARED");
  const rolled=await recoverControlProfileChange(recoveryInput(x,intent),stopProof(intent));
  assert.equal(rolled.status,"PROFILE_ROLLED_BACK_PAUSED");await x.unchanged();await noOwnership(x);
  await assert.rejects(changeControlProfile(o,stopped),/PROFILE_ALREADY_EXISTS/);
  const result=await changeControlProfile({...o,resumeFrom:rolled.resumeFrom},stopped);
  assert.equal(result.status,"PROFILE_CHANGED_PAUSED");await x.unchanged();await noOwnership(x);
  const selected=await verifyControlActivation(x.descriptor.descriptorFile);
  const service=await selected.runtime.service.openControlService(selected.profile);
  assert.equal((await service.ownerDelivery.capacity()).used,0);
  assert.equal((await service.review.capacity()).remaining,4);
});

test("interruption while writing profile intent leaves no torn published marker or new allocation",darwin,async t=>{
  const x=await fixture(t),o=profileChange(x);
  profileChild(o,`const open=fs.open;fs.open=async(...args)=>{const fd=await open(...args);
    if(String(args[0]).includes('.profile-intent-'))fd.writeFile=async()=>{await fd.write('{');process.exit(63);};return fd;}`);
  await assert.rejects(lstat(path.join(x.root,"observer-recovery.lease")),{code:"ENOENT"});
  await assert.rejects(lstat(o.profile.review.directory),{code:"ENOENT"});await x.unchanged();
  const before=await inspectControlRecovery(x.descriptor.descriptorFile);
  await recoverStoppedControlObserver({descriptorFile:x.descriptor.descriptorFile,expectedKey:before.key,
    actor:"supervisor",evidence:"fixture child stopped before atomic intent",observeStop:async lease=>({
      state:"STOPPED",...lease,evidence:"fixture exit63"})});
  await noOwnership(x);await x.unchanged();
  assert.equal((await changeControlProfile(o,stopped)).status,"PROFILE_CHANGED_PAUSED");
});

test("profile recovery completes after an interrupted cleanup has already removed the observer lease",darwin,async t=>{
  const x=await fixture(t),o=profileChange(x);
  profileChild(o,`const unlink=fs.unlink;fs.unlink=async file=>{
    if(file===${JSON.stringify(path.join(x.root,"observer-recovery.lease"))})process.exit(63);return unlink(file);}`);
  const intent=JSON.parse(await readFile(path.join(x.root,"observer-recovery.lease"),"utf8"));
  // Normal completion removes the intent first; exercise recovery's opposite
  // cleanup order by failing its second unlink after the stopped lease removal.
  const code=`import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
    const unlink=fs.unlink;fs.unlink=async file=>{if(file===${JSON.stringify(path.join(x.root,"observer-recovery.lease"))})
      throw Error('fixture cleanup failure');return unlink(file);};syncBuiltinESMExports();
    const {recoverControlProfileChange}=await import(${JSON.stringify(new URL("../scripts/control-profile-change.mjs",import.meta.url).href)});
    try{await recoverControlProfileChange(${JSON.stringify(recoveryInput(x,intent))},{readSchedule:async plan=>({state:'CLOSED',code:113,
      output:'',errors:'Could not find service "'+plan.label+'"'}),observeStop:async()=>(${JSON.stringify({state:"STOPPED",pid:intent.pid,token:intent.token,evidence:"fixture stopped"})})});}
    catch(e){if(e.message==='fixture cleanup failure')process.exit(63);throw e;}`;
  const r=spawnSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8",timeout:15000});
  assert.equal(r.status,63,r.stderr);await assert.rejects(lstat(path.join(x.root,"observer.lease")),{code:"ENOENT"});
  await assert.rejects(lstat(path.join(x.root,"profile-change-recovery.lease")),{code:"ENOENT"});
  const retained=JSON.parse(await readFile(path.join(x.root,"observer-recovery.lease"),"utf8"));
  const recovered=await recoverControlProfileChange(recoveryInput(x,retained),stopProof(retained));
  assert.equal(recovered.status,"PROFILE_ROLLED_BACK_PAUSED");await x.unchanged();await noOwnership(x);
});

test("profile transition references a large retained history without copying it into the bounded intent",darwin,async t=>{
  const x=await fixture(t),o=profileChange(x);
  await x.stores.host.transact(s=>{s.acceptances.retained.history.push({evidence:"x".repeat(1100000)});return s;});
  const before=await x.snapshot(),result=await changeControlProfile(o,stopped);
  assert.ok((await lstat(result.historyFile)).size<100000);
  await x.unchanged(before);await noOwnership(x);
});
async function noOwnership(x) {
  for (const name of ["observer.lease", "observer-recovery.lease", "cutover-recovery.lease"])
    await assert.rejects(lstat(path.join(x.root, name)), {code: "ENOENT"});
}

async function settledFailure(x, command = "fixture-failed-command") {
  const host = await openControlHost(x.profile.directory, x.profile.config, {observeCommandFailure: async input => {
    const proof = {reservationId: input.reservation.reservationId, bindingSha256: input.reservation.bindingSha256,
      failureSha256: input.failureSha256};
    return {termination: {...proof, state: "STOPPED", processSha256: hash(input.reservation.failure.process),
      evidence: "fixture independent exact stop"},
    effects: {...proof, state: "RECONCILED", scopeSha256: input.scopeSha256,
      evidence: "fixture separate full effects readback"}};
  }});
  const binding = {taskId: "maintenance", commandSha256: sha256(command),
    cwd: x.workspace, executable: process.execPath};
  await host.approveCommand(binding, {reviewer: "reviewer", reviewReceipt: "fixture failure admission",
    dependencies: [], expiresAt: Date.now() + 120000});
  await host.pause(false);
  const claim = await host.control.reserve(await host.control.authorize(binding));
  const at = new Date().toISOString();
  await host.control.captureFailure(claim, {bindingSha256: hash(binding), failure: {
    exitCode: 7, signal: null, reason: "COMMAND_FAILED", commandSha256: binding.commandSha256,
    cwd: binding.cwd, executable: binding.executable, stdoutSha256: sha256(""), stderrSha256: sha256(""),
    stdoutBytes: 0, stderrBytes: 0, process: {launchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", pid: 12345,
      groupId: null, startedAt: at, closedAt: at, launchExecutable: binding.executable, launchArgsSha256: sha256("args")}}});
  await host.pause(true);
  await host.reconcileCommand({reservationId: claim.reservationId, owner: "owner", evidence: "fixture owner reconciliation",
    expectedJournalDigest: (await x.stores.host.read()).digest});
  return {host, binding, id: claim.reservationId};
}

test("cutover preserves host-reconciled failure as spent history, never completed or replayable", darwin, async t => {
  const x = await fixture(t), failure = await settledFailure(x), secondFailure = await settledFailure(x, "second-failure"),
    before = await x.snapshot();
  const result = await switchControlRuntime(x.options, stopped);
  assert.equal(result.status, "RUNTIME_SWITCHED_PAUSED");
  await x.unchanged(before); await noOwnership(x);
  const retained = (await failure.host.snapshot()).reservations[failure.id];
  assert.equal(retained.status, "FAILED_RECONCILED"); assert.equal(retained.resultSha256, undefined);
  assert.equal((await failure.host.snapshot()).reservations[secondFailure.id].status, "FAILED_RECONCILED");
  await assert.rejects(failure.host.control.authorize(failure.binding), /COMMAND_NOT_APPROVED/);
  await assert.rejects(failure.host.control.observe(retained, {outcome: "COMPLETED", bindingSha256: failure.id,
    resultSha256: sha256("forged-success")}), /FAILED_COMMAND_NOT_COMPLETED/);
  const rollback = await switchControlRuntime({...x.options, expectedOldDigest: x.second.digest,
    packageRoot: x.first.root, expectedDigest: x.first.digest}, stopped);
  assert.equal(rollback.status, "RUNTIME_SWITCHED_PAUSED");
  await x.unchanged(before); await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
});

for (const [name, corrupt] of [
  ["missing receipt", r => {delete r.reconciliation;}],
  ["foreign reservation", r => {r.reservationId = sha256("foreign");}],
  ["foreign owner", r => {r.reconciliation.owner = "executor";}],
  ["foreign termination", r => {r.reconciliation.observation.termination.bindingSha256 = sha256("foreign");}],
  ["foreign effects", r => {r.reconciliation.observation.effects.failureSha256 = sha256("foreign");}],
  ["effects still unknown", r => {r.reconciliation.observation.effects.state = "UNKNOWN";}],
  ["invented predecessor", r => {r.reconciliation.previousJournalDigest = sha256("invented");}],
  ["altered receipt evidence", r => {r.reconciliation.evidence = "not the published host receipt";}],
  ["forged success", r => {r.resultSha256 = sha256("success");}],
]) test(`cutover refuses reconciled failure with ${name} without changing custody or journals`, darwin, async t => {
  const x = await fixture(t), failure = await settledFailure(x);
  await x.stores.host.transact(s => {corrupt(s.reservations[failure.id]); return s;});
  const before = await x.snapshot();
  await assert.rejects(switchControlRuntime(x.options, stopped), /ACTION_OUTCOME_UNKNOWN/);
  await x.unchanged(before); await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
});

test("cutover refuses a complete-looking receipt appended without its exact IN_FLIGHT transition", darwin, async t => {
  const x = await fixture(t), failure = await settledFailure(x);
  await x.stores.host.transact(s => {
    s.reservations[failure.id].reconciliation.previousJournalDigest = x.before.host.digest; return s;
  });
  const before = await x.snapshot();
  await assert.rejects(switchControlRuntime(x.options, stopped), /ACTION_OUTCOME_UNKNOWN/);
  await x.unchanged(before); await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
});

const continuationMethod = /    async continueRegistered\(\) \{[\s\S]*?\n    \},\n/;
async function olderInventory(x) {
  // Simulated older inventory, not a claim about any historical release. Build
  // only in this fixture; never rewrite a published or parent-owned package.
  const root = path.join(x.temp, "older-package"); await cp(x.first.root, root, {recursive: true});
  const serviceFile = path.join(root, "scripts/control-service.mjs"), bytes = await readFile(serviceFile, "utf8");
  const moduleImport = 'import {runRegisteredContinuations} from "./control-continuation.mjs";\n';
  assert.ok(bytes.includes(moduleImport)); assert.match(bytes, continuationMethod);
  const older = bytes.replace(moduleImport, "").replace(continuationMethod, "");
  await chmod(serviceFile, 0o600); await writeFile(serviceFile, older); await chmod(serviceFile, 0o400);
  await rm(path.join(root, "scripts/control-continuation.mjs"));
  const receiptFile = path.join(root, "runtime.json"), description = JSON.parse(await readFile(receiptFile, "utf8"));
  delete description.files["scripts/control-continuation.mjs"];
  description.files["scripts/control-service.mjs"] = sha256(older);
  await chmod(receiptFile, 0o600); await writeFile(receiptFile, canonicalJson(description) + "\n");
  await chmod(receiptFile, 0o400);
  const digest = hash(description);
  const runtime = await loadControlRuntime({packageRoot: root, expectedDigest: digest, workspace: x.workspace});
  assert.equal(typeof (await runtime.service.openControlService(x.profile)).continueRegistered, "undefined");
  await x.unchanged();
  return {root, digest};
}

test("intact older inventory remains selectable when continuation is not requested", darwin, async t => {
  const x = await fixture(t), target = await olderInventory(x);
  const result = await switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped);
  assert.equal(result.status, "RUNTIME_SWITCHED_PAUSED"); assert.equal(result.to.digest, target.digest);
  await x.observe(false); await noOwnership(x);
});

test("requested continuation refuses an intact older service and safely retains the old selection", darwin, async t => {
  const x = await fixture(t, {continuation: {mode: "REGISTERED_PREAPPROVED_ONLY", maxActions: 1}});
  const target = await olderInventory(x);
  await assert.rejects(switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.equal(e.cause.message, "CONTROL_CUTOVER_TARGET_CONTINUATION_UNSUPPORTED");
    assert.equal(e.receipt.to.digest, x.first.digest); assert.equal(e.receipt.attempted.digest, target.digest);
    assert.equal(e.receipt.projectReadiness, "NOT_CERTIFIED"); return true;
  });
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  assert.equal((await verifyControlActivation(x.descriptor.descriptorFile)).descriptor.runtime.digest, x.first.digest);
  await x.unchanged(); await noOwnership(x);
});

test("continuation compatibility checks presence without executing the method, including rollback", darwin, async t => {
  const x = await fixture(t, {continuation: {mode: "REGISTERED_PREAPPROVED_ONLY", maxActions: 1}});
  const candidate = path.join(x.temp, "continuation-readback-only"); await cp(x.candidate, candidate, {recursive: true});
  const file = path.join(candidate, "scripts/control-service.mjs"), bytes = await readFile(file, "utf8");
  assert.match(bytes, continuationMethod);
  await writeFile(file, bytes.replace(continuationMethod,
    '    async continueRegistered() {throw Error("fixture continuation must never execute during cutover");},\n'));
  const target = await x.stage(candidate);
  const selected = await switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped);
  assert.equal(selected.status, "RUNTIME_SWITCHED_PAUSED"); assert.equal(selected.to.digest, target.digest);
  await x.unchanged(); await noOwnership(x);
  const restored = await switchControlRuntime({...x.options, expectedOldDigest: target.digest,
    packageRoot: x.first.root, expectedDigest: x.first.digest}, stopped);
  assert.equal(restored.status, "RUNTIME_SWITCHED_PAUSED"); assert.equal(restored.to.digest, x.first.digest);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  await x.unchanged(); await noOwnership(x);
});

test("paused active descriptor switch, actual new observer and explicit rollback preserve all journals", darwin, async t => {
  const x = await fixture(t); await x.observe(false);
  const result = await switchControlRuntime(x.options, stopped);
  assert.equal(result.status, "RUNTIME_SWITCHED_PAUSED"); assert.equal(result.projectReadiness, "NOT_CERTIFIED");
  assert.equal(result.scheduler, "STOPPED_NOT_RESTARTED"); await noOwnership(x); await x.unchanged();
  await assert.rejects(switchControlRuntime(x.options, stopped), /OLD_RUNTIME_CHANGED/);
  assert.equal((await lstat(x.descriptor.descriptorFile)).mode & 0o777, 0o400);
  const verified = await verifyControlActivation(x.descriptor.descriptorFile);
  assert.equal(verified.descriptor.runtime.digest, x.second.digest);
  const receipt = await x.observe(true); assert.equal(receipt.capacity.remaining, 0);
  assert.equal(receipt.ownerCapacity.remaining, 0);
  const rollback = await switchControlRuntime({...x.options, expectedOldDigest: x.second.digest,
    packageRoot: x.first.root, expectedDigest: x.first.digest, evidence: "fixture:explicit runtime rollback"}, stopped);
  assert.equal(rollback.status, "RUNTIME_SWITCHED_PAUSED");
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  await x.observe(false); await noOwnership(x);
});

test("native read-only launchctl absence qualifies disposable stopped scheduler without registration", darwin, async t => {
  const x = await fixture(t);
  assert.equal((await switchControlRuntime(x.options)).status, "RUNTIME_SWITCHED_PAUSED");
  await x.observe(true); await noOwnership(x);
});

test("failure after descriptor publication restores old active descriptor without replay", darwin, async t => {
  const x = await fixture(t); let sawNew = false;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    if (!sawNew && JSON.parse(await readFile(x.descriptor.descriptorFile)).runtime.digest === x.second.digest) {
      sawNew = true;
      throw Error("fixture readiness failure after descriptor switch");
    }
    return missing(plan);
  }}), error => {
    assert.equal(error.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.equal(error.receipt.status, "ROLLED_BACK_PAUSED");
    assert.equal(error.receipt.to.digest, x.first.digest);
    assert.equal(error.receipt.attempted.digest, x.second.digest);
    assert.match(error.cause.message, /fixture readiness failure/); return true;
  });
  assert.equal(sawNew, true); assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  await x.observe(false); await noOwnership(x);
});

test("target import failure is held by durable intent then safely restored", darwin, async t => {
  const x = await fixture(t), bad = path.join(x.temp, "bad"); await cp(x.candidate, bad, {recursive: true});
  const file = path.join(bad, "scripts/control-service.mjs");
  await writeFile(file, "throw Error('fixture bad candidate');\n" + await readFile(file, "utf8"));
  const target = await x.stage(bad);
  await assert.rejects(switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK"); assert.match(e.cause.message, /fixture bad candidate/); return true;
  });
  await x.unchanged(); await noOwnership(x); await x.observe(false);
});

test("target cannot reinterpret retained budget; observer dispatch stays excluded during verification", darwin, async t => {
  const x = await fixture(t), bad = path.join(x.temp, "wrong-budget"); await cp(x.candidate, bad, {recursive: true});
  const file = path.join(bad, "scripts/control-service.mjs"), bytes = await readFile(file, "utf8");
  const anchor = "return {host,review,owner,ownerDelivery,sourceCoverage:";
  assert.ok(bytes.includes(anchor));
  await writeFile(file, bytes.replace(anchor,
    "return {host,review:{...review,capacity:async()=>({used:999,remaining:999})},owner,ownerDelivery,sourceCoverage:"));
  const target = await x.stage(bad);
  await assert.rejects(switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK");
    assert.match(e.cause.message, /TARGET_BUDGET_READBACK_MISMATCH/); return true;
  });
  let calls = 0;
  await switchControlRuntime(x.options, {readSchedule: async plan => {
    if (++calls === 3) {
      const attempted = x.command([path.join(x.first.root, "scripts/control-observer-run.mjs"), x.descriptor.descriptorFile], 1);
      assert.match(attempted.stderr, /RECOVERY_IN_PROGRESS/);
    }
    return missing(plan);
  }});
  await x.unchanged(); await x.observe(true); await noOwnership(x);
});

test("post-publication journal drift stays owned; a live cutover owner cannot be declared stopped", darwin, async t => {
  const x = await fixture(t); let changedOnce = false;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    if (!changedOnce && JSON.parse(await readFile(x.descriptor.descriptorFile)).runtime.digest === x.second.digest) {
      changedOnce = true;
      await x.stores.host.transact(s => {
        s.reservations.lost = {status: "UNKNOWN", evidence: "outside supported leased-writer route"}; return s;
      });
    }
    return missing(plan);
  }}), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_RECONCILIATION_REQUIRED");
    assert.match(e.recoveryError, /ACTION_OUTCOME_UNKNOWN/); return true;
  });
  const inspected = await inspectControlCutover(x.descriptor.descriptorFile), changed = await x.snapshot();
  await assert.rejects(recoverControlCutover({descriptorFile: x.descriptor.descriptorFile,
    expectedIntentKey: inspected.intentKey, actor: "operator", evidence: "unproved stop", noRacingSchedulerOperators: true},
  {...stopped, observeStop: async owner => ({...owner, state: "STOPPED", evidence: "false live-owner stop"})}), /STOP_UNPROVEN/);
  await x.unchanged(changed); await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS/);
  assert.equal(JSON.parse(await readFile(x.descriptor.descriptorFile)).runtime.digest, x.second.digest);
});

for (const [name, id, change, code] of [
  ["human unpaused", "host", s => {s.paused = false;}, /PAUSE_REQUIRED/],
  ["in-flight reservation", "host", s => {s.reservations.lost = {status: "IN_FLIGHT"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["unknown reservation", "host", s => {s.reservations.lost = {status: "UNKNOWN"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["status-only reconciled failure", "host", s => {s.reservations.lost = {status: "FAILED_RECONCILED"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["unknown reviewer", "review", s => {s.runs.spent.state = "UNKNOWN";}, /MODEL_OR_OWNER_OUTCOME_UNKNOWN/],
  ["unknown owner", "owner", s => {s.runs.spent.state = "IN_FLIGHT";}, /MODEL_OR_OWNER_OUTCOME_UNKNOWN/],
  ["changed allocation binding", "review", s => {s.configKey = "b".repeat(64);}, /MODEL_REVIEW_CONFIG_MISMATCH/],
  ["health review lease", "host", s => {s.health.reviewLease = {runId: "active"};}, /REVIEW_NOT_QUIESCENT/],
  ["acceptance review reconciliation", "host", s => {s.acceptances.retained.enrollment = "REVIEW_RECONCILIATION_REQUIRED";}, /REVIEW_NOT_QUIESCENT/],
  ["incompatible schema", "host", s => {s.schema = "control.host.v3";}, /HOST_SCHEMA_OR_CONFIG_MISMATCH/],
]) test(`cutover refuses ${name}, preserves exact state and descriptor`, darwin, async t => {
  const x = await fixture(t); await x.stores[id].transact(s => {change(s); return s;});
  const before = await x.snapshot(); await assert.rejects(switchControlRuntime(x.options, stopped), code);
  await x.unchanged(before); assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes); await noOwnership(x);
});

test("held observer excludes switch; stale digest and changed profile refuse before mutation", darwin, async t => {
  const x = await fixture(t), release = await acquireControlLease(x.root);
  await assert.rejects(switchControlRuntime(x.options, stopped), /LEASE_HELD/); await release();
  await assert.rejects(switchControlRuntime({...x.options, expectedOldDigest: "b".repeat(64)}, stopped), /OLD_RUNTIME_CHANGED/);
  const file = x.descriptor.profileFile; await chmod(file, 0o600);
  await writeFile(file, JSON.stringify({...x.profile, maxReviewsPerTick: 1})); await chmod(file, 0o400);
  await assert.rejects(switchControlRuntime(x.options, stopped), /PROFILE_CHANGED/);
  await noOwnership(x); assert.deepEqual(await x.snapshot(), x.before);
});

test("registered, unknown and foreign scheduler observations never authorize replacement", darwin, async t => {
  const x = await fixture(t);
  const output = plan => `gui/uid/label = {\n path = ${plan.file}\n program = ${plan.args[0]}\n arguments = {\n${plan.args.map(a => `  ${a}`).join("\n")}\n }\n}\n`;
  for (const [readSchedule, code] of [
    [async plan => ({state: "CLOSED", code: 0, output: output(plan)}), /SCHEDULE_STOP_REQUIRED/],
    [async plan => ({state: "CLOSED", code: 0, output: output(plan).replace(plan.args[1], "/foreign.mjs")}), /REGISTRATION_CONFLICT/],
    [async () => ({state: "UNKNOWN", code: null}), /OBSERVATION_UNKNOWN/],
    [async () => ({state: "CLOSED", code: 113, errors: "unrelated error"}), /STOP_UNPROVEN/],
  ]) await assert.rejects(switchControlRuntime(x.options, {readSchedule}), code);
  const plan = await controlSchedulePlan({descriptorFile: x.descriptor.descriptorFile, mode: "SESSION"});
  await writeFile(plan.file, plan.plist, {mode: 0o600});
  await assert.rejects(switchControlRuntime(x.options, stopped), /SCHEDULE_STOP_REQUIRED/);
  assert.equal(await readFile(plan.file, "utf8"), plan.plist);
  await x.unchanged(); await noOwnership(x);
});

test("explicit scheduler-operator exclusion is required before any cutover mutation", darwin, async t => {
  const x = await fixture(t);
  for (const noRacingSchedulerOperators of [undefined, false, "true"])
    await assert.rejects(switchControlRuntime({...x.options, noRacingSchedulerOperators}, stopped), /SCHEDULER_OPERATOR_EXCLUSION_REQUIRED/);
  await x.unchanged(); await noOwnership(x);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
});

test("exact owned plist appearing inside final observation never certifies stopped", darwin, async t => {
  const x = await fixture(t); let newObservations = 0, published;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    if (JSON.parse(await readFile(x.descriptor.descriptorFile)).runtime.digest === x.second.digest && ++newObservations === 2) {
      await writeFile(plan.file, plan.plist, {mode: 0o600, flag: "wx"}); published = plan;
    }
    return missing(plan);
  }}), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_RECONCILIATION_REQUIRED");
    assert.match(e.cause.message, /SCHEDULE_STOP_REQUIRED/);
    assert.match(e.recoveryError, /SCHEDULE_STOP_REQUIRED/); return true;
  });
  assert.equal(await readFile(published.file, "utf8"), published.plist);
  await x.unchanged(); await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS/);
});

test("registration appearing on second readback refuses before descriptor publication", darwin, async t => {
  const x = await fixture(t); let observations = 0;
  await assert.rejects(switchControlRuntime(x.options, {readSchedule: async plan => {
    if (++observations === 2) return {state: "CLOSED", code: 0, output:
      `gui/uid/label = {\n path = ${plan.file}\n program = ${plan.args[0]}\n arguments = {\n${plan.args.map(a => `  ${a}`).join("\n")}\n }\n}\n`};
    return missing(plan);
  }}), /SCHEDULE_STOP_REQUIRED/);
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  await x.unchanged(); await noOwnership(x);
});

for (const [role, reported, code] of [
  ["review", {used: 2, remaining: 999}, /TARGET_BUDGET_READBACK_MISMATCH/],
  ["review", {used: 2, remaining: 0, unknownRuns: 999}, /TARGET_BUDGET_READBACK_MISMATCH/],
  ["ownerDelivery", {used: 2, remaining: 999, unknownRuns: 0}, /TARGET_OWNER_READBACK_MISMATCH/],
  ["ownerDelivery", {used: 2, remaining: 0, unknownRuns: 999}, /TARGET_OWNER_READBACK_MISMATCH/],
]) test(`same used count cannot conceal changed ${role} capacity ${JSON.stringify(reported)}`, darwin, async t => {
  const x = await fixture(t), bad = path.join(x.temp, "changed-capacity"); await cp(x.candidate, bad, {recursive: true});
  const file = path.join(bad, "scripts/control-service.mjs"), bytes = await readFile(file, "utf8");
  const anchor = "return {host,review,owner,ownerDelivery,sourceCoverage:";
  assert.ok(bytes.includes(anchor));
  const fields = role === "review" ?
    `host,review:{...review,capacity:async()=>(${JSON.stringify(reported)})},owner,ownerDelivery` :
    `host,review,owner,ownerDelivery:{...ownerDelivery,capacity:async()=>(${JSON.stringify(reported)})}`;
  await writeFile(file, bytes.replace(anchor, `return {${fields},sourceCoverage:`));
  const target = await x.stage(bad);
  await assert.rejects(switchControlRuntime({...x.options, packageRoot: target.root, expectedDigest: target.digest}, stopped), e => {
    assert.equal(e.message, "CONTROL_CUTOVER_FAILED_ROLLED_BACK"); assert.match(e.cause.message, code);
    assert.equal(e.receipt.to.digest, x.first.digest); return true;
  });
  assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
  await x.unchanged(); await noOwnership(x);
});

test("natural allocation expiry decreases remaining without resetting used or journals", darwin, async t => {
  const x = await fixture(t, {calls: 1, ttlMs: 3000}); let crossed = false;
  await switchControlRuntime(x.options, {readSchedule: async plan => {
    if (!crossed) {
      const pending = await readFile(path.join(x.root, "observer-recovery.lease"), "utf8").catch(e => {
        if (e.code === "ENOENT") return null; throw e;
      });
      if (pending) {
        const intent = JSON.parse(pending);
        assert.equal(intent.capacities.review.remaining, 1); assert.equal(intent.capacities.owner.remaining, 1);
        const wait = Math.max(0, Date.parse(x.profile.review.expiresAt) - Date.now() + 20);
        assert.ok(wait <= 3020); await new Promise(resolve => setTimeout(resolve, wait)); crossed = true;
      }
    }
    return missing(plan);
  }});
  assert.equal(crossed, true);
  const observed = await x.observe(true);
  assert.equal(observed.capacity.used, 1); assert.equal(observed.capacity.remaining, 0);
  assert.equal(observed.ownerCapacity.used, 1); assert.equal(observed.ownerCapacity.remaining, 0);
  await x.unchanged(); await noOwnership(x);
});

async function crash(x, point) {
  const program = `
    import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
    const rename = fs.promises.rename;
    fs.promises.rename = async (...args) => {
      await rename(...args);
      if (args[1] === ${JSON.stringify(x.descriptor.descriptorFile)}) process.exit(31);
    };
    syncBuiltinESMExports();
    const {switchControlRuntime} = await import(${JSON.stringify(new URL("../scripts/control-cutover.mjs", import.meta.url).href)});
    let count=0;
    await switchControlRuntime(${JSON.stringify(x.options)}, {readSchedule:async plan=>{
      count++;
      ${point === "prepared" ? "if(count===3)process.exit(31);" : ""}
      return {state:'CLOSED',code:113,output:'',errors:'Could not find service "'+plan.label+'"'};
    }});
  `;
  x.command(["--input-type=module", "--eval", program], 31);
  const inspected = await inspectControlCutover(x.descriptor.descriptorFile);
  const args = {descriptorFile: x.descriptor.descriptorFile, expectedIntentKey: inspected.intentKey,
    actor: "recovery-operator", evidence: "fixture:actual child exit 31", noRacingSchedulerOperators: true};
  const capabilities = {...stopped, observeStop: async owner => ({...owner, state: "STOPPED", evidence: "supervisor observed child close 31"})};
  return {inspected, args, capabilities};
}
for (const point of ["prepared", "published"])
  test(`actual crashed cutover ${point}: durable exclusive recovery restores old observer`, darwin, async t => {
    const x = await fixture(t), c = await crash(x, point);
    assert.equal(JSON.parse(await readFile(x.descriptor.descriptorFile)).runtime.digest,
      point === "prepared" ? x.first.digest : x.second.digest);
    await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS/);
    await assert.rejects(recoverControlCutover({...c.args, expectedIntentKey: "c".repeat(64)}, c.capabilities), /INTENT_CHANGED/);
    await assert.rejects(recoverControlCutover(c.args, {...c.capabilities, observeStop: async () => ({state: "STOPPED"})}), /STOP_UNPROVEN/);
    const recovered = await recoverControlCutover(c.args, c.capabilities);
    assert.equal(recovered.status, "ROLLED_BACK_PAUSED");
    assert.equal(recovered.to.digest, x.first.digest); assert.equal(recovered.attempted.digest, x.second.digest);
    assert.deepEqual(await readFile(x.descriptor.descriptorFile), x.oldBytes);
    await x.observe(false); await noOwnership(x);
  });

test("crashed cutover never rewinds changed journals or clears an unknown effect", darwin, async t => {
  const x = await fixture(t), c = await crash(x, "published");
  await x.stores.host.transact(s => {s.reservations.lost = {status: "UNKNOWN"}; return s;});
  const changed = await x.snapshot(), selected = await readFile(x.descriptor.descriptorFile);
  await assert.rejects(recoverControlCutover(c.args, c.capabilities), /ACTION_OUTCOME_UNKNOWN/);
  await x.unchanged(changed); assert.deepEqual(await readFile(x.descriptor.descriptorFile), selected);
  await assert.rejects(acquireControlLease(x.root), /RECOVERY_IN_PROGRESS/);
  await lstat(path.join(x.root, "observer.lease"));
});

test("unsupported platforms fail closed for switch, inspect and recovery", {skip: process.platform === "darwin"}, async () => {
  await assert.rejects(switchControlRuntime({}), /HOST_UNSUPPORTED/);
  await assert.rejects(inspectControlCutover("/missing"), /HOST_UNSUPPORTED/);
  await assert.rejects(recoverControlCutover({}), /HOST_UNSUPPORTED/);
});
