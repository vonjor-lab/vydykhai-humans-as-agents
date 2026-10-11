import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, cp, readFile, writeFile, chmod, rm, realpath, lstat, symlink, readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {activateControl, acquireControlLease, verifyControlActivation} from "../scripts/control-activation.mjs";
import {runControlObserver} from "../scripts/control-observer-run.mjs";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlChild} from "../scripts/control-child.mjs";
import {inspectControlRecovery, recoverStoppedControlObserver} from "../scripts/control-recovery.mjs";
import {openControlNotification} from "../scripts/control-notification.mjs";
import {nativeProvider,codeItem,answerItem} from "./native-provider-fixture.mjs";
import {controlCatalog,controlCheckIds} from "../scripts/control-catalog.mjs";
import {fixture as contextFixture,hash} from "./context-fixture.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {execFileSync} from "node:child_process";

const source = fileURLToPath(new URL("..", import.meta.url));
const darwin = {skip: process.platform !== "darwin"};
async function fixture(t, extra = {}, existingWorkspace = null) {
  const temp = await realpath(await mkdtemp(path.join(os.tmpdir(), "activation-test-")));
  t.after(() => rm(temp, {recursive: true, force: true}));
  const workspace = existingWorkspace ?? path.join(temp, "workspace"), root = path.join(temp, "private"),
    candidate = path.join(temp, "candidate"), packages = path.join(temp, "packages");
  for(const dir of [workspace, root, candidate, packages]) await mkdir(dir, {mode: 0o700, recursive:true});
  const snapshot = await inspectControlRuntime(source);
  for(const name of [...Object.keys(snapshot.description.files), "scripts/control-activation.mjs", "scripts/control-observer-run.mjs"]) {
    await mkdir(path.dirname(path.join(candidate, name)), {recursive: true, mode: 0o700});
    await cp(path.join(source, name), path.join(candidate, name));
  }
  // Parent owns the real runtime list. Qualify the new entry points in this copy.
  const manifestFile = path.join(candidate, "vydykhai.json"), manifest = JSON.parse(await readFile(manifestFile));
  manifest.managedPaths.push("scripts/control-activation.mjs", "scripts/control-observer-run.mjs");
  await writeFile(manifestFile, JSON.stringify(manifest));
  const {digest} = await inspectControlRuntime(candidate);
  const installed = await stageControlRuntime({sourceRoot: candidate, directory: packages, workspace, expectedDigest: digest});
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "policy", path: "policy.md", purpose: "Synthetic obligations"}]}), {mode: 0o600});
  await writeFile(path.join(workspace, "policy.md"), "Disposable fixture only");
  const profile = {schema: "control.service.v1", directory: path.join(root, "host"),
    config: {workspace, policy: "a".repeat(64), owner: "owner", executor: "executor", reviewer: "reviewer",
      evidenceRegistry: sourceFile, health: {scope: "Disposable health", intervalMs: 60000,
        maxBranches: 1, maxWorktrees: 1, triggerSourceIds: ["policy"], repairTasks: []}},
    review: {directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      native: {workspace: path.join(root, "review-room"), home: path.join(root, "home"), binary: "/never-launch-model",
        model: "no-inference", effort: "low", timeoutMs: 1000}, maxCalls: 2,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), scope: {kind: "fixture"}},
    timeoutMs: 3000, maxReviewsPerTick: 0, ...extra};
  const options = {sourceRoot: installed.root, root, expectedDigest: digest, profile};
  const activate = () => activateControl(options);
  const runtime = await loadControlRuntime({packageRoot: installed.root, expectedDigest: digest, workspace});
  const service = () => runtime.service.openControlService(profile);
  return {temp, root, workspace, installed, profile, options, activate, service};
}
test("installed observer executes only an explicit continuation grant and closes once without inference",darwin,async t=>{
  const f=await contextFixture(t),prepared=await f.prepare();
  const x=await fixture(t,{continuation:{mode:"REGISTERED_PREAPPROVED_ONLY",maxActions:1}},f.root);
  execFileSync("git",["init","--quiet"],{cwd:f.root});
  execFileSync("git",["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","commit","--quiet","--allow-empty","-m","baseline"],{cwd:f.root});
  const ref=n=>f.put(`${n}.md`,n);
  const accepted={schema:"work.product-acceptance.v1",id:"consumer",project:"fixture",task:"prior",owner:"owner",executor:"executor",
    status:"ACCEPTED",acceptedAt:new Date().toISOString(),producerReturn:await ref("return"),artifact:await ref("artifact"),
    technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)accepted.retention.push({id,required:true,expected:await ref(id)});
  const descriptor=await x.activate(),service=await x.service();
  await service.host.accept(accepted);
  for(const id of ["@health","consumer"]){
    const offer=await service.host.claimReview(id),verdict={phase:id==="@health"?"HEALTH":"POST_ACCEPT",key:offer.key,
      runId:offer.runId,reviewer:"reviewer",observedAt:new Date().toISOString(),findings:[],
      rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture-only protocol, not semantic proof"}))};
    await service.host.review(id,offer,verdict);await service.owner.readVerdict(id);
    await service.owner.respond(id,{owner:"owner",action:"CONTINUE",reviewKey:hash(verdict),nextAction:"TASK-1",evidence:"fixture:approved"});
  }
  const binding={operation:"resume",taskId:f.task.id,taskSha256:f.request.task.sha256,capsuleSha256:f.request.capsule.sha256,
    sourceDigest:prepared.coverageBasis.sourceDigest,dependencyDigest:prepared.coverageBasis.dependencyDigest,
    commandSha256:hash(f.task.action),cwd:f.root,executable:await realpath(process.execPath),kind:"dependent"};
  await service.host.approveCommand(binding,{reviewer:"reviewer",reviewReceipt:"fixture:explicit exact command",
    dependencies:["consumer"],expiresAt:Date.now()+60000,executionRequest:{...f.request,operation:"resume"}});
  const budget=await service.review.capacity();
  const schedule=await import(pathToFileURL(path.join(x.installed.root,"scripts/control-schedule.mjs")).href);
  const scheduleOptions={descriptorFile:descriptor.descriptorFile,mode:"SESSION",intervalSeconds:3600,initialTimeoutMs:20000};
  const startup=await schedule.startControlSchedule(scheduleOptions);
  try {
  assert.equal(startup.initialObservation.continuation.calls,1);
  assert.match(startup.initialObservation.invocationId,/^[a-f0-9-]{36}$/);
  assert.equal(startup.schedule.initialObservation,"NOT_PERFORMED");
  for(let i=0;i<2;i++){
    const child=i===0?null:await runControlChild({executable:process.execPath,
      args:[path.join(x.installed.root,"scripts/control-observer-run.mjs"),descriptor.descriptorFile],cwd:x.root,
      env:{PATH:"/usr/local/bin:/usr/bin:/bin"},input:"",timeoutMs:15000,maxBytes:32768});
    if(child)assert.equal(child.code,0,child.errors);
    const receipt=i===0?startup.initialObservation:JSON.parse(child.output);
    assert.equal(receipt.calls,0);assert.equal(receipt.continuation.calls,i===0?1:0);
    assert.equal(receipt.unknownActions,0);assert.equal(receipt.projectReadiness,"NOT_CERTIFIED");
  }
  assert.equal(await readFile(path.join(f.root,"actions.log"),"utf8"),"called\n");
  assert.equal((await service.host.snapshot()).acceptances.consumer.enrollment,"CLOSED");
  assert.deepEqual(await service.review.capacity(),budget);
  } finally {await schedule.unregisterControlSchedule(scheduleOptions);}
});
for(const consume of [true,false])test(`installed startup delegates owner once; application=${consume}; pending work stays owned`,
 {skip:process.platform!=="darwin"||!process.env.VYDYKHAI_CODEX_BINARY,timeout:30000},async t=>{
  const x=await fixture(t);
  const provider=await nativeProvider(t,n=>n===1&&consume?codeItem(`
    const ts=ALL_TOOLS.filter(t=>t.name.includes('vydykhai_owner'));
    const call=async(name,args)=>{const r=await tools[ts.find(t=>t.name.endsWith(name)).name](args);text(r);return JSON.parse(r.content.find(c=>c.type==='text').text);};
    const notices=await call('read_notices',{});
    for(const n of notices)await call('acknowledge_notice',{id:n.notice.id,deliveryToken:n.deliveryToken});
    const verdict=await call('read_verdict',{id:'@health'});
    await call('respond',{id:'@health',decision:{action:'REPAIR',evidence:'fixture:actual bounded delegation'},
      repairLeases:verdict.repairGroups.map(g=>({owner:g.owner,work:g.work,reviewAt:g.reviewAt,
        state:'PREPARED',evidence:'fixture:assignment',checkpoint:'independent readback'}))});
  `):answerItem("Recorded; not repaired"));
  x.profile.notifications={directory:path.join(x.root,"notifications"),transportActor:"control-owner-transport"};
  x.profile.ownerDelivery={directory:path.join(x.root,"owner-delivery"),maxCalls:1,
    expiresAt:new Date(Date.now()+60000).toISOString(),
    delegation:{mode:"NATIVE_CONTROL_DISPOSITION",owner:"owner",authorizedBy:"owner",
      evidence:"fixture:scoped explicit authorization",nextAction:"next"},
    native:{binary:process.env.VYDYKHAI_CODEX_BINARY,workspace:path.join(x.root,"owner-room"),home:path.join(x.root,"owner-home"),
      model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider}};
  const descriptor=await x.activate(),service=await x.service(),offer=await service.host.claimReview("@health");
  const finding={id:"unknown-repository",checkId:"C12.01",area:"C12",criterion:controlCatalog.find(g=>g.id==="C12").checks[0].criterion,
    evidence:"fixture:repo absent",owner:"owner",work:"maintenance",status:"OPEN",attempts:0,blocksResume:true,
    firstSeen:new Date().toISOString(),reviewAt:new Date(Date.now()+3600000).toISOString()};
  await service.host.review("@health",offer,{phase:"HEALTH",key:offer.key,runId:offer.runId,reviewer:"reviewer",
    observedAt:new Date().toISOString(),findings:[finding],rows:controlCheckIds.map(id=>id==="C12.01"?
      {id,status:"FINDING",findingId:finding.id,reason:"Missing repo",evidence:"fixture"}:{id,status:"PASS",evidence:"fixture"})});
  const schedule=await import(pathToFileURL(path.join(x.installed.root,"scripts/control-schedule.mjs")).href);
  const scheduleOptions={descriptorFile:descriptor.descriptorFile,mode:"SESSION",intervalSeconds:3600,initialTimeoutMs:25000};
  const startup=await schedule.startControlSchedule(scheduleOptions);
  try {
  const receipt=startup.initialObservation;
  assert.equal(receipt.ownerDelivery.status,consume?"DISPOSITION_OBSERVED":"OWNER_ATTENTION_REQUIRED");
  assert.equal(startup.schedule.initialObservation,"NOT_PERFORMED");
  const h=(await service.host.snapshot()).health;
  if(consume)assert.equal(h.enrollment,"REPAIR_DUE");
  assert.equal(h.findings[0].status,"OPEN");assert.equal(h.repairLeases.length,consume?1:0);
  if(!consume) {
    const notices=await openControlNotification({...x.profile.notifications,owner:"owner"});
    assert.equal((await notices.snapshot()).pendingOwnerApplication,1);
  }
  await assert.rejects(service.host.health.assertReady("next"),/HEALTH_CONTROL_PENDING/);
  const calls=provider.requests.length;
  const repeated=await runControlObserver(descriptor.descriptorFile);
  assert.equal(repeated.ownerDelivery.calls,0);assert.equal(provider.requests.length,calls);
  assert.equal((await service.ownerDelivery.capacity()).used,1);
  await service.host.pause(true);
  assert.equal((await runControlObserver(descriptor.descriptorFile)).ownerDelivery.status,"PAUSED");
  assert.equal(provider.requests.length,calls);
  } finally {await schedule.unregisterControlSchedule(scheduleOptions);}
});
test("activation twice preserves pause, unknown outcomes and original finite allocation", darwin, async t => {
  const x = await fixture(t), first = await x.activate(), service = await x.service();
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.runtime) && Object.isFrozen(first.controlRoot));
  assert.equal((await lstat(first.descriptorFile)).mode & 0o777, 0o400);
  await service.host.pause(true);
  const hostStore = await openControlStore(x.profile.directory), reviewStore = await openControlStore(x.profile.review.directory);
  await hostStore.transact(s => {s.reservations.unresolved = {status: "IN_FLIGHT"}; return s;});
  await reviewStore.transact(s => {s.calls = 2; s.runs.unresolved = {state: "UNKNOWN"}; return s;});
  const before = [await hostStore.read(), await reviewStore.read()];
  assert.deepEqual(await x.activate(), first);
  assert.deepEqual([await hostStore.read(), await reviewStore.read()], before);
  assert.deepEqual(await service.review.capacity(), {remaining: 0, used: 2});
  await assert.rejects(activateControl({...x.options, profile: {...x.profile,
    review: {...x.profile.review, maxCalls: 3}}}), /ACTIVATION_CONFLICT/);
  assert.deepEqual(await reviewStore.read(), before[1]);
});
test("automatic allowance observation preserves budget and defers during pause or independent review",darwin,async t=>{
  const x=await fixture(t);
  x.profile.config.health.cadence={mode:"OBSERVED_RESET",observer:"host-metadata",maxObservationAgeMs:86400000};
  x.profile.allowance={binary:x.profile.review.native.binary,authHome:x.profile.review.native.home,
    limitId:"codex",windowDurationMins:10080,refreshMs:3600000,timeoutMs:1000};
  await x.activate();const service=await x.service();
  const budget=await service.review.capacity();
  const first=await service.tick();assert.equal(first.allowance.status,"UNKNOWN");
  assert.equal((await service.host.snapshot()).health.resetObservation,undefined);
  assert.deepEqual(await service.review.capacity(),budget);
  await service.host.pause(true);
  assert.equal((await service.tick()).allowance.status,"DEFERRED");
  await service.host.pause(false);
  await service.host.claimReview("@health");
  assert.equal((await service.tick()).allowance.status,"DEFERRED");
  assert.deepEqual(await service.review.capacity(),budget);
});
test("automatic allowance reader cannot borrow a different identity or nonexistent cadence",darwin,async t=>{
  const x=await fixture(t);
  x.profile.allowance={binary:x.profile.review.native.binary,authHome:x.profile.review.native.home,
    limitId:"codex",windowDurationMins:10080,refreshMs:3600000};
  await assert.rejects(x.activate(),/ALLOWANCE_CONFIG_INVALID/);
  const y=await fixture(t);
  y.profile.config.health.cadence={mode:"OBSERVED_RESET",observer:"host-metadata",maxObservationAgeMs:86400000};
  y.profile.allowance={...x.profile.allowance,authHome:"/another-identity"};
  await assert.rejects(y.activate(),/ALLOWANCE_IDENTITY_INVALID/);
});
for(const initialized of ["host", "review"]) test(`partial ${initialized} initialization recovers only missing journal`, darwin, async t => {
  const x = await fixture(t);
  for(const dir of [x.profile.directory, x.profile.review.directory, x.profile.review.native.home,
    x.profile.review.native.workspace]) await mkdir(dir, {mode: 0o700});
  const service = await x.service();
  await service[initialized].initialize();
  if(initialized === "host") await service.host.pause(true);
  else await (await openControlStore(x.profile.review.directory)).transact(s => {s.calls = 1; return s;});
  const dir = initialized === "host" ? x.profile.directory : x.profile.review.directory;
  const before = await (await openControlStore(dir)).read();
  await x.activate();
  assert.deepEqual(await (await openControlStore(dir)).read(), before);
  await service.host.snapshot(); await service.review.capacity();
});
test("installed activation never replenishes a deleted review journal", darwin, async t => {
  const x = await fixture(t); await x.activate();
  await rm(path.join(x.profile.review.directory, "0000000000.json"));
  await assert.rejects(x.activate(), /JOURNAL_MISSING/);
  assert.equal(await (await openControlStore(x.profile.review.directory)).read(), null);
});
test("profile and runtime tampering refuse observation before journal mutation", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate();
  const hostBefore = await (await openControlStore(x.profile.directory)).read();
  await chmod(descriptor.profileFile, 0o600);
  await writeFile(descriptor.profileFile, JSON.stringify({...x.profile, maxReviewsPerTick: 1}));
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /PROFILE_CHANGED/);
  await writeFile(descriptor.profileFile, JSON.stringify(x.profile));
  await chmod(descriptor.profileFile, 0o400);
  const runtimeFile = path.join(x.installed.root, "scripts/control-service.mjs");
  await chmod(runtimeFile, 0o600); await writeFile(runtimeFile, "throw Error('must not import');");
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /FILE_MISMATCH/);
  assert.deepEqual(await (await openControlStore(x.profile.directory)).read(), hostBefore);
});
test("exclusive and crashed leases are never stolen or time-cleared", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate();
  const release = await acquireControlLease(x.root);
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /LEASE_HELD_RECONCILIATION_REQUIRED/);
  const child = await runControlChild({executable: process.execPath,
    args: [path.join(x.installed.root, "scripts/control-observer-run.mjs"), descriptor.descriptorFile],
    cwd: x.root, env: {}, input: "", timeoutMs: 10000, maxBytes: 32768});
  assert.equal(child.state, "CLOSED"); assert.equal(child.code, 1);
  assert.match(child.errors, /LEASE_HELD_RECONCILIATION_REQUIRED/);
  await assert.rejects(x.activate(), /LEASE_HELD_RECONCILIATION_REQUIRED/);
  await release();
  const stale = path.join(x.root, "observer.lease");
  await writeFile(stale, JSON.stringify({pid: 99999999, startedAt: "1970-01-01", token: "crashed"}), {mode: 0o600});
  const before = await readFile(stale, "utf8");
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /LEASE_HELD/);
  assert.equal(await readFile(stale, "utf8"), before);
});
for(const mode of ["zero-review-budget", "paused"]) test(`actual copied observer CLI: ${mode}, no inference, restart keeps allocation`, darwin, async t => {
  const x = await fixture(t, {maxReviewsPerTick: 1}), descriptor = await x.activate();
  const service = await x.service();
  if(mode === "paused") await service.host.pause(true);
  else await (await openControlStore(x.profile.review.directory)).transact(s => {s.calls = 2; return s;});
  const reviewBefore = await (await openControlStore(x.profile.review.directory)).read();
  for(let i = 0; i < 2; i++) {
    const result = await runControlChild({executable: process.execPath,
      args: [path.join(x.installed.root, "scripts/control-observer-run.mjs"), descriptor.descriptorFile],
      cwd: x.root, env: {PATH: "/usr/bin:/bin"}, input: "", timeoutMs: 10000, maxBytes: 32768});
    assert.equal(result.state, "CLOSED"); assert.equal(result.code, 0, result.errors);
    const receipt = JSON.parse(result.output);
    assert.equal(receipt.calls, 0); assert.equal(receipt.projectReadiness, "NOT_CERTIFIED");
    assert.equal(receipt.paused, mode === "paused");
    assert.deepEqual(JSON.parse(await readFile(path.join(x.root, "observer-latest.json"))), receipt);
    assert.ok((await lstat(path.join(x.root, "observer-latest.json"))).size < 16384);
  }
  assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(), reviewBefore);
});
test("unknown review readback retains exclusive ownership without replay", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate();
  await (await openControlStore(x.profile.review.directory)).transact(s => {
    s.calls = 1; s.runs.lost = {state: "UNKNOWN"}; return s;
  });
  const schedule=await import(pathToFileURL(path.join(x.installed.root,"scripts/control-schedule.mjs")).href);
  const options={descriptorFile:descriptor.descriptorFile,mode:"SESSION",intervalSeconds:3600,initialTimeoutMs:10000};
  await assert.rejects(schedule.startControlSchedule(options),/INITIAL_RECEIPT_UNVERIFIED/);
  const receipt=JSON.parse(await readFile(path.join(x.root,"observer-latest.json")));
  assert.equal(receipt.status, "UNKNOWN_RECONCILIATION_REQUIRED"); assert.equal(receipt.capacity.used, 1);
  const lease=await readFile(path.join(x.root,"observer.lease"),"utf8");
  await assert.rejects(schedule.startControlSchedule(options), /INITIAL_LEASE_HELD/);
  assert.equal(await readFile(path.join(x.root,"observer.lease"),"utf8"),lease);
  await assert.rejects(lstat((await schedule.controlSchedulePlan(options)).file),{code:"ENOENT"});
});
test("workspace, registry, journal and symlink boundaries fail closed", darwin, async t => {
  const x = await fixture(t);
  await assert.rejects(activateControl({...x.options, profile: {...x.profile,
    directory: path.join(x.workspace, "host")}}), /JOURNAL_BOUNDARY/);
  const local = path.join(x.workspace, "private"); await mkdir(local, {mode: 0o700});
  await assert.rejects(activateControl({...x.options, root: local,
    profile: {...x.profile, review: {...x.profile.review, controlRoot: local}}}), /WORKSPACE_BOUNDARY/);
  await assert.rejects(activateControl({...x.options, profile: {...x.profile,
    config: {...x.profile.config, health: null}}}), /PROFILE_INVALID/);
  await assert.rejects(activateControl({...x.options, profile: {...x.profile,
    config: {...x.profile.config, evidenceRegistry: path.join(x.workspace, "sources.json")}}}), /PROFILE_INVALID/);
  await symlink(x.workspace, x.profile.directory);
  await assert.rejects(x.activate(), /DIRECTORY_UNSAFE/);
});
test("private empty reviewer room and explicit external auth remain independent", darwin, async t => {
  const x = await fixture(t), authHome = path.join(x.temp, "operator-auth");
  await mkdir(authHome, {mode: 0o755});
  await writeFile(path.join(authHome, "auth.json"), "synthetic-no-credentials", {mode: 0o600});
  x.profile.review.native.authHome = authHome;
  const descriptor = await x.activate();
  const verified = await verifyControlActivation(descriptor.descriptorFile);
  assert.equal(verified.profile.review.native.authHome, authHome);
  assert.equal(verified.profile.review.native.workspace, path.join(x.root, "review-room"));
  assert.deepEqual(await readdir(verified.profile.review.native.workspace), []);
  assert.equal(await readFile(path.join(authHome, "auth.json"), "utf8"), "synthetic-no-credentials");
  await chmod(path.join(authHome,"auth.json"),0o644);
  await assert.rejects(verifyControlActivation(descriptor.descriptorFile),/AUTH_FILE_UNSAFE/);
  await chmod(path.join(authHome,"auth.json"),0o600);
  await chmod(authHome,0o777);
  await assert.rejects(verifyControlActivation(descriptor.descriptorFile),/AUTH_DIRECTORY_UNSAFE/);
  await chmod(authHome,0o755);
  await assert.rejects(activateControl({...x.options, root: x.root, profile: {...x.profile,
    review: {...x.profile.review, native: {...x.profile.review.native, workspace: x.workspace}}}}), /CONFLICT/);
  const y = await fixture(t);
  y.profile.review.native.workspace = y.workspace;
  await assert.rejects(y.activate(), /REVIEW_ROOM_BOUNDARY/);
  y.profile.review.native.workspace = y.profile.review.directory;
  await assert.rejects(y.activate(), /REVIEW_ROOM_BOUNDARY/);
});
test("directory identity tamper refuses entry; post-entry failures keep owned receipt and lease", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate();
  const saved = JSON.parse(await readFile(descriptor.descriptorFile));
  await chmod(descriptor.descriptorFile, 0o600);
  await writeFile(descriptor.descriptorFile, JSON.stringify({...saved, controlRoot: {...saved.controlRoot, ino: "0"}}));
  await chmod(descriptor.descriptorFile, 0o400);
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /DESCRIPTOR_INVALID/);
  await chmod(descriptor.descriptorFile, 0o600); await writeFile(descriptor.descriptorFile, JSON.stringify(saved));
  await chmod(descriptor.descriptorFile, 0o400);
  await rm(path.join(x.profile.review.directory, "0000000000.json"));
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /MODEL_REVIEW_CONFIG_MISMATCH/);
  const receipt = JSON.parse(await readFile(path.join(x.root, "observer-latest.json")));
  assert.equal(receipt.status, "UNKNOWN_RECONCILIATION_REQUIRED"); assert.equal(receipt.owner, "owner");
  await assert.rejects(runControlObserver(descriptor.descriptorFile), /LEASE_HELD/);
});
test("unsupported platforms refuse activation and observation", {skip: process.platform === "darwin"}, async () => {
  await assert.rejects(activateControl({}), /HOST_UNSUPPORTED/);
  await assert.rejects(verifyControlActivation("/missing/activation.json"), /HOST_UNSUPPORTED/);
});
test("actual crashed observer: stopped proof releases only lease, not pause/budget or findings", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate(), service = await x.service();
  await service.host.pause(true);
  const child = await runControlChild({executable:process.execPath,args:["--input-type=module","-e",
    `import {acquireControlLease} from ${JSON.stringify(new URL("../scripts/control-activation.mjs",import.meta.url).href)};
     await acquireControlLease(${JSON.stringify(x.root)}); process.exit(17);`],
    cwd:x.root,env:{},input:"",timeoutMs:10000,maxBytes:32768});
  assert.equal(child.state,"CLOSED"); assert.equal(child.code,17);
  const before = await inspectControlRecovery(descriptor.descriptorFile);
  const args = {descriptorFile:descriptor.descriptorFile,expectedKey:before.key,actor:"operator",evidence:"actual child close 17",
    observeStop:async lease=>({...lease,state:"STOPPED",evidence:"independent supervisor observed child close 17"})};
  await assert.rejects(recoverStoppedControlObserver({...args,observeStop:async()=>({state:"STOPPED"})}),/STOP_UNPROVEN/);
  assert.equal((await recoverStoppedControlObserver(args)).status,"OBSERVER_RELEASED");
  const host = await (await openControlStore(x.profile.directory)).read();
  const review = await (await openControlStore(x.profile.review.directory)).read();
  assert.equal(host.digest,before.host.digest); assert.equal(review.digest,before.review.digest);
  const receipt = await runControlObserver(descriptor.descriptorFile);
  assert.equal(receipt.calls,0); assert.equal(receipt.paused,true);
  const recovery = await (await openControlStore(path.join(x.root,"observer-recovery"))).read();
  assert.equal(recovery.state.events.length,1); assert.equal(recovery.state.events[0].automaticRetry,false);
});
test("recovery rejects active supervisor, stale snapshot and unresolved effects", darwin, async t => {
  const x = await fixture(t), descriptor = await x.activate(), release = await acquireControlLease(x.root);
  const before = await inspectControlRecovery(descriptor.descriptorFile);
  const args = {descriptorFile:descriptor.descriptorFile,expectedKey:before.key,actor:"operator",evidence:"attempt",
    observeStop:async lease=>({...lease,state:"STOPPED",evidence:"claim alone is insufficient"})};
  await assert.rejects(recoverStoppedControlObserver(args),/STOP_UNPROVEN/);
  await (await openControlStore(x.profile.review.directory)).transact(s=>{s.calls=1;s.runs.lost={state:"UNKNOWN"};return s;});
  await assert.rejects(recoverStoppedControlObserver(args),/STATE_CHANGED/);
  args.expectedKey=(await inspectControlRecovery(descriptor.descriptorFile)).key;
  await assert.rejects(recoverStoppedControlObserver(args),/OUTCOME_UNKNOWN/);
  await (await openControlStore(x.profile.review.directory)).transact(s=>{s.runs.lost.state="STOPPED";return s;});
  await (await openControlStore(x.profile.directory)).transact(s=>{s.reservations.lost={status:"IN_FLIGHT"};return s;});
  args.expectedKey=(await inspectControlRecovery(descriptor.descriptorFile)).key;
  await assert.rejects(recoverStoppedControlObserver(args),/OUTCOME_UNKNOWN/);
  await release();
});
test("recovery marker prevents any new observer dispatch",darwin,async t=>{
  const x=await fixture(t),descriptor=await x.activate();
  await writeFile(path.join(x.root,"observer-recovery.lease"),"interrupted recovery",{mode:0o600});
  await assert.rejects(runControlObserver(descriptor.descriptorFile),/RECOVERY_IN_PROGRESS/);
});
test("activated observer queues one durable notice across identical wakeups; deletion is not reset",darwin,async t=>{
  const x=await fixture(t);
  x.profile.notifications={directory:path.join(x.root,"notifications"),transportActor:"control-owner-transport"};
  const descriptor=await x.activate();
  const notifications=await openControlNotification({...x.profile.notifications,owner:"owner"});
  for(let i=0;i<2;i++)await runControlObserver(descriptor.descriptorFile);
  const before=await notifications.snapshot();
  assert.equal(before.state.notices.length,1);assert.equal(before.pendingDelivery,1);
  assert.equal(before.state.notices[0].body.actionable[0].action,"REVIEW_DUE");
  await x.activate();assert.deepEqual(await notifications.snapshot(),before);
  const service=await x.service();await service.host.pause(true);
  await runControlObserver(descriptor.descriptorFile);
  assert.deepEqual(await notifications.snapshot(),before);
  await rm(path.join(x.profile.review.directory,"0000000000.json"));
  await assert.rejects(runControlObserver(descriptor.descriptorFile),/MODEL_REVIEW_CONFIG_MISMATCH/);
  assert.deepEqual(await notifications.snapshot(),before);
  await rm(path.join(x.profile.notifications.directory,"0000000000.json"));
  await assert.rejects(notifications.snapshot(),/HISTORY_GAP/);
});
