import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,realpath,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {openControlService} from "../scripts/control-service.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";

async function fixture(t) {
  const root=await realpath(await mkdtemp(path.join(tmpdir(),"review-binding-")));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"public"),directory=path.join(root,"host"),reviewDirectory=path.join(root,"review");
  for(const dir of [workspace,directory,reviewDirectory])await mkdir(dir,{mode:0o700});
  await writeFile(path.join(workspace,"policy.md"),"synthetic policy");
  const sourceFile=path.join(root,"sources.json");
  const registry={schema:"control.review-sources.v1",workspace,
    sources:[{id:"policy",path:"policy.md",purpose:"Current policy"}]};
  await writeFile(sourceFile,JSON.stringify(registry),{mode:0o600});
  const config={workspace,policy:sha256("policy"),owner:"owner",executor:"worker",reviewer:"reviewer",evidenceRegistry:sourceFile};
  const review={directory:reviewDirectory,controlRoot:root,reviewer:"reviewer",sourceFile,maxCalls:3,
    expiresAt:"2099-01-01T00:00:00Z",scope:{kind:"binding-fixture"},
    native:{binary:"/never-dispatch",model:"synthetic",effort:"low",timeoutMs:1000}};
  const legacy=await openModelReview(review);await legacy.initialize();
  const store=await openControlStore(reviewDirectory);
  const run={runId:"historical-fixture",state:"STOPPED",reason:"recorded synthetic bookkeeping, not a native call"};
  await store.transact(s=>{s.calls=1;s.runs[run.runId]=run;return s;});
  const before=(await store.read()).state;
  const profile={schema:"control.service.v1",directory,config,review,timeoutMs:2000,maxReviewsPerTick:1};
  const service=await openControlService(profile);await service.host.initialize();
  return {root,registry,sourceFile,profile,service,store,before,run};
}

test("legacy unbound journal transitions only by owned safe binding without budget or history reset",async t=>{
  const x=await fixture(t),s=await x.service.review.bindingStatus();
  assert.equal(s.status,"OWNER_BINDING_REQUIRED");assert.equal(s.used,1);
  await assert.rejects(x.service.review.capacity(),/CONFIG_MISMATCH/);
  const decision={owner:"owner",evidence:"fixture:approved binding transition",expectedConfigKey:s.configKey};
  await assert.rejects(x.service.review.bindHost(decision),/SAFE_BOUNDARY_REQUIRED/);
  await x.service.host.pause(true);
  await assert.rejects(x.service.review.bindHost({...decision,owner:"worker"}),/DECISION_REQUIRED/);
  await assert.rejects(x.service.review.bindHost({...decision,expectedConfigKey:sha256("other")}),/DECISION_REQUIRED/);
  const result=await x.service.review.bindHost(decision),after=(await x.store.read()).state;
  assert.equal(result.budgetReset,false);assert.equal(result.used,1);assert.equal(result.paused,true);
  assert.deepEqual(after.runs,x.before.runs);assert.equal(after.calls,x.before.calls);
  assert.equal(after.bindingHistory.length,1);assert.equal(after.bindingHistory[0].previousConfigKey,s.configKey);
  assert.equal(after.bindingHistory[0].runsSha256,sha256(canonicalJson(x.before.runs)));
  assert.equal((await x.service.review.capacity()).remaining,2);
  const reopened=await openControlService(x.profile);
  assert.equal((await reopened.review.bindingStatus()).status,"CURRENT");
  assert.equal((await reopened.review.capacity()).used,1);assert.equal((await reopened.host.snapshot()).paused,true);
  await assert.rejects(x.service.review.bindHost(decision),/CONFIG_MISMATCH/);
});

test("uncertain review or effect prevents binding and preserves its exact journal",async t=>{
  const x=await fixture(t);await x.service.host.pause(true);
  const decision={owner:"owner",evidence:"fixture:approved binding",expectedConfigKey:x.before.configKey};
  for(const state of ["IN_FLIGHT","UNKNOWN"]) {
    await x.store.transact(s=>{s.runs[x.run.runId].state=state;return s;});
    const before=(await x.store.read()).state;
    await assert.rejects(x.service.review.bindHost(decision),/OUTCOME_UNKNOWN/);
    assert.deepEqual((await x.store.read()).state,before);
  }
  await x.store.transact(s=>{s.runs[x.run.runId].state="STOPPED";return s;});
  const hostStore=await openControlStore(x.profile.directory);
  await hostStore.transact(s=>{s.reservations.pending={status:"IN_FLIGHT"};return s;});
  await assert.rejects(x.service.review.bindHost(decision),/SAFE_BOUNDARY_REQUIRED/);
  assert.equal((await x.store.read()).state.configKey,x.before.configKey);
});

test("binding refuses to guess an unverifiable original registry or change the approved budget",async t=>{
  const x=await fixture(t);await x.service.host.pause(true);
  await writeFile(x.sourceFile,JSON.stringify({...x.registry,sources:[{...x.registry.sources[0],purpose:"changed"}]}),{mode:0o600});
  const changed=await openControlService(x.profile);
  await assert.rejects(changed.review.bindingStatus(),/CONFIG_MISMATCH/);
  await assert.rejects(changed.review.bindHost({owner:"owner",evidence:"fixture:do not guess",expectedConfigKey:x.before.configKey}),/DECISION_REQUIRED/);
  const increased=await openControlService({...x.profile,review:{...x.profile.review,maxCalls:4}});
  await assert.rejects(increased.review.bindingStatus(),/CONFIG_MISMATCH/);
  assert.deepEqual((await x.store.read()).state,x.before);
});
