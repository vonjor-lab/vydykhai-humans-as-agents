import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, realpath, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {sha256, canonicalJson} from "../scripts/memory-brief.mjs";
import {artifactHash, artifactBytes} from "../scripts/context-run.mjs";
import {openReviewSources, validateReviewSourceScope} from "../scripts/control-review-sources.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openModelReview, validateModelReviewAcquisition, modelReviewPrompt} from "../scripts/control-model-review.mjs";
import {observeRetention, postAcceptKey, assessPostAccept, validProductAcceptance, retentionKinds} from "../scripts/post-accept.mjs";
import {createReturnSync} from "../scripts/vydykhai.mjs";
import {openControlService} from "../scripts/control-service.mjs";
import {openPartitionModelReview} from "../scripts/control-partition-model-review.mjs";
import {reviewPartitions,validateReviewPart} from "../scripts/control-review-partitions.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {nativeProvider,codeItem,answerItem} from "./native-provider-fixture.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";

const hash = value => sha256(canonicalJson(value));
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "control-source-scope-")));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"public"), directory=path.join(root,"host"), journal=path.join(root,"review");
  for(const dir of [workspace,directory,journal])await mkdir(dir,{mode:0o700});
  const put=(file,text)=>writeFile(path.join(workspace,file),text);
  const ref=id=>({path:`${id}.md`,sha256:sha256(id)});
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"synthetic",task:"task-one",
    owner:"owner",executor:"worker",status:"ACCEPTED",acceptedAt:"2026-10-08T00:00:00Z",
    producerReturn:ref("return"),artifact:ref("artifact"),technicalProof:ref("proof"),goal:ref("goal"),
    retention:retentionKinds.map(id=>({id,required:true,expected:ref(id)}))};
  for(const id of ["return","artifact","proof","goal",...retentionKinds])await put(`${id}.md`,id);
  await put("contract.md","accepted contract");await put("other.md","other task");
  const entries=[{id:"contract",path:"contract.md",purpose:"Accepted public contract"},
    {id:"other",path:"other.md",purpose:"Independent discovery"}];
  const sourceFile=path.join(root,"sources.json");
  const registry=()=>writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace,sources:entries}),{mode:0o600});
  await registry();
  const sourceScope={schema:"control.review-source-scope.v1",acceptanceSha256:hash(acceptance),sourceIds:["contract"]};
  const config={workspace,policy:sha256("policy"),owner:"owner",executor:"worker",reviewer:"reviewer",
    evidenceRegistry:sourceFile};
  return {root,workspace,directory,journal,put,acceptance,entries,registry,sourceFile,sourceScope,config};
}

async function partitionFixture(t,{health=false,afterObserve,beforeReview,extraRead=false}={}) {
  const x=await fixture(t);
  if(health){
    x.config.health={scope:"Synthetic lease authentication",intervalMs:60000,maxBranches:1,maxWorktrees:1,
      triggerSourceIds:["contract"],repairTasks:["maintenance"]};
    execFileSync("git",["init","--quiet"],{cwd:x.workspace,stdio:"pipe"});
    execFileSync("git",["-c","user.name=Fixture","-c","user.email=fixture@example.invalid",
      "commit","--quiet","--allow-empty","-m","baseline"],{cwd:x.workspace,stdio:"pipe"});
  }
  const host=await openControlHost(x.directory,x.config,{createReturnSync});await host.initialize();
  if(!health)await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const offer=health?await host.health.claimReview():await host.claimReview("accepted");
  const options={directory:x.journal,controlRoot:x.root,sourceFile:x.sourceFile,reviewer:"reviewer",partitionCount:3,
    maxCalls:3,expiresAt:new Date(Date.now()+60000).toISOString(),
    native:{binary:"/never-dispatch",model:"synthetic",effort:"low",timeoutMs:1000},
    scope:{host:{directory:x.directory,config:x.config}}};
  const dispatched=[];
  const openSingle=async(opts,ids)=>{
    const authentic=await openModelReview({...opts,partitionCount:1});
    const index=reviewPartitions(3).findIndex(part=>canonicalJson(part)===canonicalJson(ids));
    let observation;
    return {
      initialize:authentic.initialize,preflight:authentic.preflight,capacity:authentic.capacity,
      async review(current){
        dispatched.push(index);
        const failure=await beforeReview?.({x,host,index});
        if(failure){observation={state:failure.state};throw Error(failure.reason);}
        const snapshot=await authentic.preflight(current),sources=await openReviewSources(x.sourceFile);
        const reads=await Promise.all(snapshot.rows.map(r=>sources.read({id:r.id})));
        if(extraRead)reads.push(await sources.read({id:"other"}));
        validateModelReviewAcquisition(snapshot,reads,[],snapshot.scope);
        const wireAnswer={schema:"control.review-answer.v2",rowGroups:[{ids:[...ids],status:"NOT_APPLICABLE",
          sourceIds:["contract"],reason:"Scripted protocol fixture, not semantic applicability proof"}],newFindings:[],resolutions:[]};
        const observedAt=new Date().toISOString(),verdict=validateReviewPart(wireAnswer,ids,
          {readbacks:reads,offer:current,reviewer:"reviewer",observedAt});
        observation={state:"STOPPED",runId:current.runId,wireAnswer,verdict,readSources:reads,
          usage:{input_tokens:1,output_tokens:1}};
        return verdict;
      },
      async observe(){await afterObserve?.({x,host,index});return observation??{state:"UNKNOWN"};}
    };
  };
  const review=await openPartitionModelReview(options,openSingle);await review.initialize();
  return {...x,host,offer,options,review,dispatched};
}

test("authentic scoped partitions retain one basis through unrelated registry growth and reach final host admission",async t=>{
  const x=await partitionFixture(t,{afterObserve:async({x,index})=>{
    if(index!==0)return;
    x.entries.push({id:"later",path:"later.md",purpose:"Unrelated later task"});
    await x.put("later.md","later");await x.put("other.md","unrelated growth");await x.registry();
  }});
  assert.deepEqual((await x.review.preflight(x.offer)).scope.sourceIds,["contract"]);
  assert.equal((await x.review.capacity()).used,0);
  const verdict=await x.review.review(x.offer);assert.deepEqual(x.dispatched,[0,1,2]);assert.equal(verdict.rows.length,87);
  await x.host.review("accepted",x.offer,verdict);
  assert.deepEqual((await x.host.snapshot()).acceptances.accepted.review.rows,verdict.rows);
  const reopened=await openModelReview(x.options);assert.equal((await reopened.capacity()).used,3);
  assert.deepEqual((await reopened.observe(x.offer.runId)).verdict,verdict);
});

for(const index of [0,2])test(`authentic lease pause after part ${index} refuses later dispatch or final union`,async t=>{
  const x=await partitionFixture(t,{afterObserve:async({host,index:current})=>{if(current===index)await host.pause(true);}});
  await assert.rejects(x.review.review(x.offer),/HOST_OFFER_MISMATCH/);
  assert.equal(x.dispatched.length,index+1);
  const observed=await x.review.observe(x.offer.runId);assert.equal(observed.state,"STOPPED");assert.equal(observed.verdict,undefined);
  assert.equal((await x.review.capacity()).used,3);
});

test("forged initial lease is provably undispatched STOPPED, not UNKNOWN from an initialized child",async t=>{
  const x=await partitionFixture(t),forged={...x.offer,key:sha256("forged")};
  await assert.rejects(x.review.review(forged),/HOST_OFFER_MISMATCH/);
  assert.deepEqual(x.dispatched,[]);
  const observed=await x.review.observe(x.offer.runId);assert.equal(observed.state,"STOPPED");assert.equal(observed.actualDispatches,0);
  assert.equal(observed.verdict,undefined);assert.equal((await x.review.capacity()).used,3);
});

test("authentic partition cannot silently widen accepted source scope",async t=>{
  const x=await partitionFixture(t,{extraRead:true});
  await assert.rejects(x.review.review(x.offer),/EXPANSION_REQUIRED/);
  assert.deepEqual(x.dispatched,[0]);assert.equal((await x.review.observe(x.offer.runId)).verdict,undefined);
});

test("invoked unknown child retains UNKNOWN and blocks all later parts across restart",async t=>{
  const x=await partitionFixture(t,{beforeReview:()=>({state:"UNKNOWN",reason:"SCRIPTED_UNCERTAIN_TRANSPORT"})});
  await assert.rejects(x.review.review(x.offer),/UNCERTAIN_TRANSPORT/);assert.deepEqual(x.dispatched,[0]);
  const row=(await(await openControlStore(x.journal)).read()).state.runs[x.offer.runId];
  assert.equal(row.state,"UNKNOWN");assert.equal(row.verdict,undefined);
  const reopened=await openModelReview(x.options);assert.equal((await reopened.observe(x.offer.runId)).state,"UNKNOWN");
  await assert.rejects(reopened.review(x.offer),/ALREADY_DISPATCHED/);assert.equal((await reopened.capacity()).used,3);
});

test("expired completion window cannot publish an otherwise complete union",async t=>{
  t.mock.timers.enable({apis:["Date"],now:Date.now()});
  const x=await partitionFixture(t,{afterObserve:({index})=>{if(index===2)t.mock.timers.tick(60001);}});
  await assert.rejects(x.review.review(x.offer),/BUDGET_EXHAUSTED/);assert.deepEqual(x.dispatched,[0,1,2]);
  assert.equal((await x.review.observe(x.offer.runId)).verdict,undefined);
});

test("HEALTH partitions authenticate their real current lease and reject forgery, pause and changed lifecycle",async t=>{
  const x=await partitionFixture(t,{health:true});
  assert.equal((await x.review.preflight(x.offer)).rows.length,2);
  for(const mutate of [o=>o.runId=randomUUID(),o=>o.key=sha256("wrong"),o=>o.stateRevision="wrong",
    o=>o.input.previousFindings.push({id:"invented"})]){
    const forged=structuredClone(x.offer);mutate(forged);await assert.rejects(x.review.preflight(forged),/HOST_OFFER_MISMATCH/);
  }
  await x.host.pause(true);await assert.rejects(x.review.preflight(x.offer),/HOST_OFFER_MISMATCH/);
  await x.host.pause(false);await x.host.health.reviewFailure("health",x.offer.runId);
  await assert.rejects(x.review.preflight(x.offer),/HOST_OFFER_MISMATCH/);
  assert.equal((await x.review.capacity()).used,0);assert.deepEqual(x.dispatched,[]);
});

for(const health of [false,true])test(`rebased ${health?"HEALTH":"POST_ACCEPT"} held lease cannot authorize new parts`,async t=>{
  const x=await partitionFixture(t,{health});
  if(health)await x.host.health.reviewFailure("health",x.offer.runId);
  else await x.host.reviewFailure("accepted",x.offer.runId);
  const current=health?await x.host.health.reviewInput():await x.host.reviewInput("accepted");
  const held={...x.offer,...current};
  const before=await x.host.snapshot();
  assert.equal((health?before.health:before.acceptances.accepted).enrollment,"REVIEW_RECONCILIATION_REQUIRED");
  await assert.rejects(x.review.preflight(held),/HOST_OFFER_MISMATCH/);
  assert.equal((await x.review.capacity()).used,0);
  await assert.rejects(x.review.review(held),/HOST_OFFER_MISMATCH/);
  assert.deepEqual(x.dispatched,[]);
  const observation=await x.review.observe(held.runId);
  assert.equal(observation.state,"STOPPED");assert.equal(observation.actualDispatches,0);
  assert.equal(observation.verdict,undefined);
  assert.deepEqual(await x.host.snapshot(),before);
});

test("authentic HEALTH partition union reaches current host admission with its independent lease",async t=>{
  const x=await partitionFixture(t,{health:true});
  await x.review.preflight(x.offer);
  const verdict=await x.review.review(x.offer);
  assert.equal(verdict.phase,"HEALTH");assert.equal(verdict.rows.length,87);
  await x.host.health.review("health",x.offer,verdict);
  const state=await x.host.snapshot();
  assert.deepEqual(state.health.review,verdict);
  assert.equal(state.health.reviewLease,null);
  assert.deepEqual(x.dispatched,[0,1,2]);assert.equal((await x.review.capacity()).used,3);
});

for(const phase of ["POST_ACCEPT","HEALTH"])test(`installed CLI admits authentic ${phase} parts without paid inference`,
  {skip:!process.env.VYDYKHAI_CODEX_BINARY||process.platform!=="darwin",timeout:60000},async t=>{
    const x=await fixture(t);
    if(phase==="HEALTH"){
      x.config.health={scope:"Native protocol fixture",intervalMs:60000,maxBranches:1,maxWorktrees:1,
        triggerSourceIds:["contract"],repairTasks:["maintenance"]};
      execFileSync("git",["init","--quiet"],{cwd:x.workspace,stdio:"pipe"});
      execFileSync("git",["-c","user.name=Fixture","-c","user.email=fixture@example.invalid",
        "commit","--quiet","--allow-empty","-m","baseline"],{cwd:x.workspace,stdio:"pipe"});
    }
    const host=await openControlHost(x.directory,x.config,{createReturnSync});await host.initialize();
    if(phase==="POST_ACCEPT")await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
    const offer=phase==="HEALTH"?await host.health.claimReview():await host.claimReview("accepted");
    const ids=offer.input.sourceEvidence.rows.map(r=>r.id),parts=reviewPartitions(3);
    const provider=await nativeProvider(t,async n=>n%2===1?
      codeItem("const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));"+
        `for(const id of ${JSON.stringify(ids)})text(await tools[t.name]({id}));`,`read_${n}`):
      answerItem({schema:"control.review-answer.v2",rowGroups:[{ids:[...parts[n/2-1]],status:"PASS",sourceIds:ids}],
        newFindings:[],resolutions:[]}));
    const room=path.join(x.root,"room"),home=path.join(x.root,"home");
    for(const dir of [room,home])await mkdir(dir,{mode:0o700});
    const options={directory:x.journal,controlRoot:x.root,sourceFile:x.sourceFile,reviewer:"reviewer",partitionCount:3,
      maxCalls:3,expiresAt:new Date(Date.now()+90000).toISOString(),scope:{host:{directory:x.directory,config:x.config},requiredSourceIds:ids},
      native:{binary:process.env.VYDYKHAI_CODEX_BINARY,workspace:room,home,model:"gpt-6.1-sol",effort:"low",
        timeoutMs:15000,provider:provider.provider}};
    const review=await openModelReview(options);await review.initialize();
    await review.preflight(offer);assert.equal(provider.requests.length,0);
    const verdict=await review.review(offer);
    assert.equal(verdict.rows.length,87);assert.equal(verdict.phase,phase);
    if(phase==="HEALTH")await host.health.review("health",offer,verdict);
    else await host.review("accepted",offer,verdict);
    assert.equal(provider.requests.length,6);assert.equal((await review.capacity()).used,3);
    const reopened=await openModelReview(options);
    assert.deepEqual((await reopened.observe(offer.runId)).verdict,verdict);
    await assert.rejects(reopened.review(offer),/ALREADY_DISPATCHED/);
    assert.equal(provider.requests.length,6);
  });

test("service binds partition scope to its real host before any dispatch and keeps the aggregate deadline",async t=>{
  const x=await fixture(t),profile={schema:"control.service.v1",directory:x.directory,config:x.config,
    timeoutMs:4000,maxReviewsPerTick:1,review:{directory:x.journal,controlRoot:x.root,sourceFile:x.sourceFile,
      reviewer:"reviewer",partitionCount:3,native:{binary:"/never-dispatch",model:"synthetic",effort:"low",timeoutMs:1000},
      maxCalls:3,expiresAt:"2099-01-01T00:00:00Z",scope:{kind:"protocol-test"}}};
  const service=await openControlService(profile);await service.host.initialize();await service.review.initialize();
  await service.host.accept(x.acceptance,{reviewSourceIds:["contract"]});const offer=await service.host.claimReview("accepted");
  assert.deepEqual((await service.review.preflight(offer)).scope.sourceIds,["contract"]);
  await assert.rejects(openControlService({...profile,review:{...profile.review,
    scope:{host:{directory:x.journal,config:x.config}}}}),/REVIEW_HOST_MISMATCH/);
  await assert.rejects(openControlService({...profile,timeoutMs:3999}),/CONFIG_INVALID/);
  assert.equal((await service.review.capacity()).used,0);
});

test("reproduction: legacy whole registry invalidates both unrelated and relevant changes",async t=>{
  const x=await fixture(t), sources=await openReviewSources(x.sourceFile);
  const key=async()=>postAcceptKey({acceptance:x.acceptance,observation:[],previousFindings:[],policy:x.config.policy,
    sourceEvidence:await sources.snapshot()});
  const before=await key();await x.put("other.md","unrelated growth");assert.notEqual(await key(),before);
  const unrelated=await key();await x.put("contract.md","material change");assert.notEqual(await key(),unrelated);
});

test("trusted acceptance scope isolates growth while preserving broad independent discovery and material drift",async t=>{
  const x=await fixture(t), host=await openControlHost(x.directory,x.config,{createReturnSync});
  await host.initialize();await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const before=await host.reviewInput("accepted");
  assert.deepEqual(before.input.sourceEvidence.rows.map(r=>r.id),["contract"]);
  before.input.sourceEvidence.scope.sourceIds.push("other");
  assert.deepEqual((await host.reviewInput("accepted")).input.sourceEvidence.scope.sourceIds,["contract"]);
  await x.put("other.md","unrelated growth");
  x.entries.push({id:"later",path:"later.md",purpose:"Later task"});await x.put("later.md","later");await x.registry();
  assert.equal((await host.reviewInput("accepted")).key,before.key);
  const broad=await openReviewSources(x.sourceFile);
  assert.equal((await broad.list()).length,3);assert.equal((await broad.read({id:"later"})).text,"later");
  await x.put("contract.md","material change");assert.notEqual((await host.reviewInput("accepted")).key,before.key);
  await rm(path.join(x.workspace,"contract.md"));
  assert.equal((await host.reviewInput("accepted")).input.sourceEvidence.rows[0].status,"MISSING");
  x.entries.splice(0,1);await x.registry();await assert.rejects(host.reviewInput("accepted"),/SCOPE_UNREGISTERED/);
});

test("acceptance validates scope and exact reuse; legacy omission remains conservative",async t=>{
  const x=await fixture(t);
  for(const scope of [null,{...x.sourceScope,schema:"unknown"},{...x.sourceScope,sourceIds:[]},
    {...x.sourceScope,sourceIds:["contract","contract"]},{...x.sourceScope,acceptanceSha256:sha256("different acceptance")}])
    assert.throws(()=>validateReviewSourceScope(scope,x.acceptance),/SCOPE_INVALID/);
  const host=await openControlHost(x.directory,x.config,{createReturnSync});await host.initialize();
  for(const ids of [null,[],["contract","contract"],["undeclared"]])
    await assert.rejects(host.accept(x.acceptance,{reviewSourceIds:ids}),/SCOPE_INVALID|SCOPE_UNREGISTERED/);
  x.entries.push({id:"missing",path:"missing.md",purpose:"Required but absent"});await x.registry();
  await assert.rejects(host.accept(x.acceptance,{reviewSourceIds:["missing"]}),/SCOPE_MISSING/);
  assert.deepEqual((await host.snapshot()).acceptances,{});
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const original=await host.snapshot();
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});assert.deepEqual(await host.snapshot(),original);
  for(const ids of [undefined,["other"],["contract","other"]])
    await assert.rejects(host.accept(x.acceptance,{reviewSourceIds:ids}),/ACCEPTANCE_ID_CONFLICT/);
  const pair={...x.acceptance,id:"pair",task:"pair-task"};
  await host.accept(pair,{reviewSourceIds:["contract","other"]});
  await assert.rejects(host.accept(pair,{reviewSourceIds:["other","contract"]}),/ACCEPTANCE_ID_CONFLICT/);
  const legacy={...x.acceptance,id:"legacy",task:"legacy-task"};await host.accept(legacy);
  assert.equal((await host.reviewInput("legacy")).input.sourceEvidence.scope,undefined);
  const old=(await host.reviewInput("legacy")).key;await x.put("other.md","unrelated growth");
  assert.notEqual((await host.reviewInput("legacy")).key,old);
  await assert.rejects(host.accept(legacy,{reviewSourceIds:["contract"]}),/ACCEPTANCE_ID_CONFLICT/);
  const sources=await openReviewSources(x.sourceFile), snapshot=await sources.snapshot(x.sourceScope);
  const base={acceptance:x.acceptance,policy:x.config.policy,previousFindings:[],observation:await observeRetention(x.workspace,x.acceptance)};
  assert.equal(assessPostAccept({...base,sourceEvidence:snapshot}).action,"POST_ACCEPT_REVIEW_DUE");
  for(const evidence of [{...snapshot,rows:[],digest:hash([])},{...snapshot,scope:{...x.sourceScope,schema:"unknown"}},
    {...snapshot,digest:sha256("wrong")},{...snapshot,scope:{...x.sourceScope,acceptanceSha256:sha256("wrong")}}])
    assert.equal(assessPostAccept({...base,sourceEvidence:evidence}).action,"RECONCILE_INPUT");
});

test("existing exact marker API retains meaning across unrelated appends, rejects relevant change and ambiguous selection",async t=>{
  const x=await fixture(t), body="<!-- accepted:start -->\nretained meaning\n<!-- accepted:end -->";
  const selected={path:"memory.md",sha256:sha256(body),startMarker:"<!-- accepted:start -->",endMarker:"<!-- accepted:end -->"};
  x.acceptance.retention[0].expected=selected;
  assert.equal(validProductAcceptance(x.acceptance),true);
  await x.put("memory.md",body);assert.equal((await observeRetention(x.workspace,x.acceptance))[0].status,"MATCH");
  await x.put("memory.md",body+"\nunrelated later task");assert.equal((await observeRetention(x.workspace,x.acceptance))[0].status,"MATCH");
  await x.put("memory.md",body.replace("retained meaning","changed meaning"));assert.equal((await observeRetention(x.workspace,x.acceptance))[0].status,"MISMATCH");
  await x.put("memory.md",body+body);await assert.rejects(observeRetention(x.workspace,x.acceptance),/SELECTOR_INVALID/);
  await x.put("memory.md","selector removed");await assert.rejects(observeRetention(x.workspace,x.acceptance),/SELECTOR_INVALID/);
  assert.equal(artifactHash(selected,Buffer.from(body)),selected.sha256);
  assert.equal(validProductAcceptance({...x.acceptance,goal:{...x.acceptance.goal,startMarker:"half-selector"}}),false);
});

test("all bound sources must be acquired exactly; additional acquired evidence is never silently discarded",async t=>{
  const x=await fixture(t), sources=await openReviewSources(x.sourceFile), before=await sources.snapshot(x.sourceScope);
  const acquired=await sources.read({id:"contract"});
  validateModelReviewAcquisition(before,[acquired],x.sourceScope.sourceIds,x.sourceScope);
  assert.throws(()=>validateModelReviewAcquisition(before,[],x.sourceScope.sourceIds,x.sourceScope),/NO_SOURCE_ACQUISITION/);
  assert.throws(()=>validateModelReviewAcquisition(before,[acquired],["contract","other"],x.sourceScope),/REQUIRED_SOURCE_UNREAD/);
  for(const patch of [{text:"tampered"},{sha256:sha256("transient")},{purpose:"changed metadata"},{status:"MISSING"}])
    assert.throws(()=>validateModelReviewAcquisition(before,[{...acquired,...patch}],x.sourceScope.sourceIds,x.sourceScope),/SOURCE_DRIFT/);
  const additional=await sources.read({id:"other"});
  assert.throws(()=>validateModelReviewAcquisition(before,[acquired,additional],[],x.sourceScope),/EXPANSION_REQUIRED/);
});

test("one service config/store accepts two ordinary results and authenticates each scoped episode without dispatch",async t=>{
  const x=await fixture(t), profile={schema:"control.service.v1",directory:x.directory,config:x.config,
    timeoutMs:2000,maxReviewsPerTick:1,review:{directory:x.journal,controlRoot:x.root,reviewer:"reviewer",sourceFile:x.sourceFile,
      native:{binary:"/never-dispatch",model:"synthetic",effort:"low",timeoutMs:1000},maxCalls:2,expiresAt:"2099-01-01T00:00:00Z",
      scope:{kind:"deterministic"}}};
  const service=await openControlService(profile);await service.host.initialize();await service.review.initialize();
  await service.host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const old=(await service.host.reviewInput("accepted")).key;
  const second=structuredClone(x.acceptance);second.id="accepted-two";second.task="task-two";
  for(const key of ["producerReturn","artifact","technicalProof","goal"]) {
    const text=`second ${key}`;second[key]={path:`second-${key}.md`,sha256:sha256(text)};await x.put(second[key].path,text);
  }
  for(const item of second.retention) {
    const text=`second ${item.id}`;item.expected={path:`second-${item.id}.md`,sha256:sha256(text)};await x.put(item.expected.path,text);
  }
  x.entries.push({id:"second",path:"second-contract.md",purpose:"Second accepted result"});
  await x.put("second-contract.md","second contract");await x.put("other.md","unrelated growth");await x.registry();
  await service.host.accept(second,{reviewSourceIds:["second"]});
  assert.equal((await service.host.reviewInput("accepted")).key,old);
  assert.deepEqual((await service.host.due()).map(row=>row.id),["accepted","accepted-two"]);
  const firstOffer=await service.host.claimReview("accepted"), secondOffer=await service.host.claimReview("accepted-two");
  assert.deepEqual((await service.review.preflight(firstOffer)).scope.sourceIds,["contract"]);
  assert.deepEqual((await service.review.preflight(secondOffer)).scope.sourceIds,["second"]);
  assert.equal((await service.review.capacity()).used,0);
  const reopened=await openControlService(profile);
  assert.equal((await reopened.review.capacity()).remaining,2);
  assert.deepEqual((await reopened.review.preflight(secondOffer)).scope.sourceIds,["second"]);
  for(const mutate of [offer=>offer.runId=randomUUID(),offer=>offer.key=sha256("wrong"),
    offer=>offer.stateRevision=sha256("wrong"),offer=>offer.input.acceptance.task="wrong",
    offer=>offer.input.sourceEvidence.scope.sourceIds=["other"],offer=>delete offer.input.sourceEvidence.scope]) {
    const forged=structuredClone(firstOffer);mutate(forged);
    await assert.rejects(service.review.preflight(forged),/HOST_OFFER_MISMATCH/);
  }
  const unboundDir=path.join(x.root,"unbound-review");await mkdir(unboundDir,{mode:0o700});
  const unbound=await openModelReview({...profile.review,directory:unboundDir,scope:{kind:"legacy"}});await unbound.initialize();
  await assert.rejects(unbound.preflight(firstOffer),/HOST_BINDING_REQUIRED/);
  const requiredDir=path.join(x.root,"required-review");await mkdir(requiredDir,{mode:0o700});
  const required=await openModelReview({...profile.review,directory:requiredDir,
    scope:{...profile.review.scope,host:{directory:x.directory,config:x.config},requiredSourceIds:["other"]}});await required.initialize();
  await assert.rejects(required.preflight(firstOffer),/REQUIRED_SOURCES_INVALID/);
  await x.put("contract.md","relevant change");await assert.rejects(service.review.preflight(firstOffer),/HOST_OFFER_MISMATCH/);
  assert.notEqual((await service.host.reviewInput("accepted")).key,old);
  assert.deepEqual((await service.review.preflight(secondOffer)).scope.sourceIds,["second"]);
  await rm(path.join(x.workspace,"second-contract.md"));
  await assert.rejects(service.review.preflight(secondOffer),/HOST_OFFER_MISMATCH/);
  assert.equal((await service.review.capacity()).used,0);
  const partitionDir=path.join(x.root,"partition-review");await mkdir(partitionDir,{mode:0o700});
  const partition=await openModelReview({...profile.review,directory:partitionDir,partitionCount:2,
    scope:{...profile.review.scope,host:{directory:x.directory,config:x.config}}});await partition.initialize();
  await assert.rejects(partition.preflight(firstOffer),/HOST_OFFER_MISMATCH/);
  assert.equal((await partition.capacity()).used,0);
  await assert.rejects(openModelReview({...profile.review,scope:{sourceScope:x.sourceScope}}),/STATIC_SOURCE_SCOPE_UNSUPPORTED/);
  await assert.rejects(openControlService({...profile,review:{...profile.review,
    scope:{...profile.review.scope,host:{directory:x.journal,config:x.config}}}}),/REVIEW_HOST_MISMATCH/);
});

test("HEALTH prompt allows evidenced affectedTasks without narrowing unknown or authority failures",()=>{
  const prompt=modelReviewPrompt({phase:"HEALTH"},{});
  assert.match(prompt,/affectedTasks\?/);assert.match(prompt,/Absent means global\/unknown scope/);
  assert.match(prompt,/Never narrow host-wide authority or safety failures/);
  assert.match(prompt,/Do not emit affectedTasks for POST_ACCEPT/);
});

test("preinitial additive evidence reaches claimed review without replacing acceptance or inventing attempts",async t=>{
  const x=await fixture(t), services={createReturnSync};
  const host=await openControlHost(x.directory,x.config,services);await host.initialize();
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const before=await host.reviewInput("accepted"), original=(await host.snapshot()).acceptances.accepted;
  const request={owner:"owner",currentScopeSha256:hash(x.sourceScope),sourceIds:["contract","other"],
    evidence:"Owner binds newly available review evidence before any model call"};
  await host.recordSourceScopeExpansion("accepted",request);
  const saved=(await host.snapshot()).acceptances.accepted;
  assert.deepEqual(saved.acceptance,original.acceptance);assert.deepEqual(saved.reviewSourceScope,original.reviewSourceScope);
  assert.equal(saved.reviewAttempts,undefined);assert.equal(saved.reviewLease,null);assert.equal(saved.review,null);
  assert.equal(saved.reviewSourceScopeRevisions[0].phase,"BEFORE_FIRST_REVIEW");
  assert.equal(saved.reviewSourceScopeRevisions[0].stoppedRunId,undefined);
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/CAS_MISMATCH/);
  const reopened=await openControlHost(x.directory,x.config,services), offer=await reopened.claimReview("accepted");
  assert.notEqual(offer.key,before.key);
  assert.deepEqual(offer.input.sourceEvidence.scope.sourceIds,["contract","other"]);
  const adapter=await openModelReview({directory:x.journal,controlRoot:x.root,reviewer:"reviewer",sourceFile:x.sourceFile,
    requiredSourceIds:["contract","other"],native:{binary:"/never-dispatch",model:"synthetic",effort:"low"},
    maxCalls:1,expiresAt:"2099-01-01T00:00:00Z",scope:{host:{directory:x.directory,config:x.config}}});
  await adapter.initialize();assert.equal((await adapter.preflight(offer)).rows.length,2);
  const sources=await openReviewSources(x.sourceFile), reads=await Promise.all(["contract","other"].map(id=>sources.read({id})));
  validateModelReviewAcquisition(offer.input.sourceEvidence,reads,[],offer.input.sourceEvidence.scope);
  assert.throws(()=>validateModelReviewAcquisition(offer.input.sourceEvidence,[reads[0]],[],offer.input.sourceEvidence.scope),/REQUIRED_SOURCE_UNREAD/);
  const verdict={phase:"POST_ACCEPT",key:offer.key,reviewer:"reviewer",runId:offer.runId,observedAt:new Date().toISOString(),
    resultUse:{status:"ALLOW",acceptanceSha256:hash(x.acceptance),evidence:"Synthetic protocol test, not semantic proof",findingIds:[]},
    findings:[],rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:`fixture:${id}`}))};
  await reopened.review("accepted",offer,verdict);
  await reopened.disposition("accepted",{owner:"owner",reviewKey:hash(verdict),action:"CONTINUE",
    nextAction:"next-task",evidence:"Synthetic owner consumed the source-bound review"});
  assert.equal((await reopened.assess("accepted")).action,"VERIFY_CONTINUATION");
  assert.equal((await adapter.capacity()).used,0);
  const final=await openControlHost(x.directory,x.config,services);
  assert.equal((await final.reviewInput("accepted")).input.sourceScopeRevision.phase,"BEFORE_FIRST_REVIEW");
  await assert.rejects(final.recordSourceScopeExpansion("accepted",{...request,
    currentScopeSha256:hash(offer.input.sourceEvidence.scope),sourceIds:["contract","other","later"]}),/STOPPED_RECONCILIATION_REQUIRED/);
});

test("preinitial expansion retains owner, pause, availability, additive and CAS checks",async t=>{
  const x=await fixture(t),host=await openControlHost(x.directory,x.config,{createReturnSync});await host.initialize();
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const request={owner:"owner",currentScopeSha256:hash(x.sourceScope),sourceIds:["contract","other"],evidence:"Owned preparation"};
  await host.pause(true);await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  await host.pause(false);
  for(const [patch,error] of [[{owner:"worker"},/OWNER_INVALID/],[{evidence:""},/OWNER_INVALID/],
    [{currentScopeSha256:sha256("stale")},/CAS_MISMATCH/],[{sourceIds:["other"]},/ADDITIVE_REQUIRED/],
    [{sourceIds:["contract"]},/ADDITIVE_REQUIRED/],[{sourceIds:["contract","other","other"]},/SCOPE_INVALID/],
    [{sourceIds:["contract","undeclared"]},/SCOPE_UNREGISTERED/]])
    await assert.rejects(host.recordSourceScopeExpansion("accepted",{...request,...patch}),error);
  x.entries.push({id:"missing",path:"missing.md",purpose:"Not yet materialized"});await x.registry();
  await assert.rejects(host.recordSourceScopeExpansion("accepted",{...request,sourceIds:["contract","missing"]}),/SCOPE_MISSING/);
  const store=await openControlStore(x.directory),baseline=(await host.snapshot()).acceptances.accepted;
  for(const patch of [{reviewEpisode:{id:"existing"}},{reviewEpisodeHistory:[{}]},
    {reviewAttempts:[{observation:{state:"UNKNOWN"}}]},{repairHistory:[{}]},{repairRequest:{}},
    {disposition:{action:"REPAIR"}},{review:{observedAt:new Date().toISOString()}},{reviewLease:{runId:"claimed"}}]){
    await store.transact(s=>{s.acceptances.accepted={...structuredClone(baseline),...patch};return s;});
    await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  }
  await store.transact(s=>{s.acceptances.accepted=baseline;
    s.reservations.pending={status:"IN_FLIGHT",dependencies:["accepted"]};return s;});
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
});

test("stopped reconciled discovery expands the existing scope additively under the same host and transport config",async t=>{
  const x=await fixture(t), observations=new Map();
  const services={createReturnSync,observeReviewRun:async runId=>observations.get(runId)??{runId,state:"UNKNOWN"}};
  const host=await openControlHost(x.directory,x.config,services);await host.initialize();
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  const adapter=await openModelReview({directory:x.journal,controlRoot:x.root,reviewer:"reviewer",sourceFile:x.sourceFile,
    native:{binary:"/never-dispatch",model:"synthetic",effort:"low"},maxCalls:2,expiresAt:"2099-01-01T00:00:00Z",
    scope:{host:{directory:x.directory,config:x.config}}});await adapter.initialize();
  const offer=await host.claimReview("accepted"), original=(await host.snapshot()).acceptances.accepted;
  const sources=await openReviewSources(x.sourceFile), reads=await Promise.all(["contract","other"].map(id=>sources.read({id})));
  assert.throws(()=>validateModelReviewAcquisition(offer.input.sourceEvidence,reads,[],offer.input.sourceEvidence.scope),/EXPANSION_REQUIRED/);
  const request={owner:"owner",currentScopeSha256:hash(offer.input.sourceEvidence.scope),sourceIds:["contract","other"],
    evidence:"Synthetic independent discovery of an applicable dependency"};
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  await host.reviewFailure("accepted",offer.runId);
  await assert.rejects(host.reconcileReview("accepted",{reviewer:"reviewer",action:"RETRY",evidence:"Bounded rebrief"}),/OUTCOME_UNKNOWN/);
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  observations.set(offer.runId,{runId:offer.runId,state:"STOPPED",evidence:"Synthetic trusted stopped observation",
    reason:"MODEL_REVIEW_SOURCE_SCOPE_EXPANSION_REQUIRED",readSources:reads});
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  await host.reconcileReview("accepted",{reviewer:"reviewer",action:"RETRY",evidence:"Independent stopped-run rebrief decision"});
  const history=structuredClone((await host.snapshot()).acceptances.accepted.reviewAttempts);
  await host.pause(true);
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/STOPPED_RECONCILIATION_REQUIRED/);
  await host.pause(false);
  for(const [patch,error] of [[{owner:"worker"},/OWNER_INVALID/],[{evidence:""},/OWNER_INVALID/],
    [{currentScopeSha256:sha256("stale")},/CAS_MISMATCH/],[{sourceIds:["other"]},/ADDITIVE_REQUIRED/],
    [{sourceIds:["contract"]},/ADDITIVE_REQUIRED/],[{sourceIds:["contract","other","other"]},/SCOPE_INVALID/],
    [{sourceIds:["contract","undeclared"]},/SCOPE_UNREGISTERED/]])
    await assert.rejects(host.recordSourceScopeExpansion("accepted",{...request,...patch}),error);
  x.entries.push({id:"missing",path:"missing.md",purpose:"Missing discovered evidence"});await x.registry();
  await assert.rejects(host.recordSourceScopeExpansion("accepted",{...request,sourceIds:["contract","missing"]}),/SCOPE_MISSING/);
  await host.recordSourceScopeExpansion("accepted",request);
  const saved=(await host.snapshot()).acceptances.accepted;
  assert.deepEqual(saved.acceptance,original.acceptance);assert.deepEqual(saved.reviewSourceScope,original.reviewSourceScope);
  assert.deepEqual(saved.reviewAttempts,history);assert.equal(saved.reviewSourceScopeRevisions.length,1);
  assert.equal(saved.enrollment,"REVIEW_DUE");assert.equal(saved.reviewLease,null);
  await host.accept(x.acceptance,{reviewSourceIds:["contract"]});
  await assert.rejects(host.recordSourceScopeExpansion("accepted",request),/CAS_MISMATCH/);
  await assert.rejects(adapter.preflight(offer),/HOST_OFFER_MISMATCH/);
  await assert.rejects(host.review("accepted",offer,{reviewer:"reviewer",runId:offer.runId}),/REVIEW_SOURCE_CHANGED/);
  const reopened=await openControlHost(x.directory,x.config,services), fresh=await reopened.claimReview("accepted");
  assert.notEqual(fresh.key,offer.key);
  assert.deepEqual(fresh.input.sourceEvidence.scope.sourceIds,["contract","other"]);
  assert.equal(fresh.input.sourceScopeRevision.evidence,request.evidence);
  const before=await adapter.preflight(fresh);
  validateModelReviewAcquisition(before,reads,[],before.scope);
  assert.throws(()=>validateModelReviewAcquisition(before,[reads[0]],[],before.scope),/REQUIRED_SOURCE_UNREAD/);
  assert.equal((await adapter.capacity()).used,0);
  await assert.rejects(reopened.recordSourceScopeExpansion("accepted",{...request,currentScopeSha256:hash(before.scope),
    sourceIds:["contract","other","missing"]}),/STOPPED_RECONCILIATION_REQUIRED/);
});

test("registered short selection remains bounded inside a larger accepted artifact",async t=>{
  const x=await fixture(t), body="<!-- part:start -->\nAccepted meaning\n<!-- part:end -->";
  x.entries.push({id:"selected",path:"large.md",purpose:"Accepted selected record",startMarker:"<!-- part:start -->",endMarker:"<!-- part:end -->"});
  await x.registry(); await x.put("large.md","x".repeat(160*1024)+body+"y".repeat(160*1024));
  const sources=await openReviewSources(x.sourceFile), read=await sources.read({id:"selected"});
  assert.equal(read.text,body);assert.equal(read.sha256,sha256(body));
  assert.equal((await sources.snapshot({schema:"control.review-source-scope.v1",acceptanceSha256:hash(x.acceptance),sourceIds:["selected"]})).bytes,Buffer.byteLength(body));
  await x.put("large.md",body+body+"x".repeat(160*1024));
  await assert.rejects(sources.read({id:"selected"}),/SELECTOR_INVALID/);
  await x.put("large.md","<!-- part:start -->"+"x".repeat(129*1024)+"<!-- part:end -->");
  await assert.rejects(sources.read({id:"selected"}),/SOURCE_CAPACITY/);
  await x.put("large.md",body+"x".repeat(2*1024*1024));
  await assert.rejects(sources.read({id:"selected"}),/SOURCE_CAPACITY/);
  delete x.entries.at(-1).startMarker;delete x.entries.at(-1).endMarker;await x.registry();
  await x.put("large.md","x".repeat(129*1024));
  await assert.rejects((await openReviewSources(x.sourceFile)).read({id:"selected"}),/SOURCE_CAPACITY/);
});

for(const kind of ["memory","map"])test(`combined ${kind} retention/source/host key preserves exact selected bytes across outside growth`,async t=>{
  const x=await fixture(t), body=`<!-- ${kind}:start -->\nAccepted ${kind} meaning\n<!-- ${kind}:end -->`;
  const selected={path:`${kind}.md`,sha256:sha256(body),startMarker:`<!-- ${kind}:start -->`,endMarker:`<!-- ${kind}:end -->`};
  x.acceptance.retention.find(r=>r.id===kind).expected=selected;
  x.entries.push({id:kind,path:selected.path,purpose:"Accepted semantic record",startMarker:selected.startMarker,endMarker:selected.endMarker});
  await x.put(selected.path,body);await x.registry();
  const host=await openControlHost(x.directory,x.config,{createReturnSync});await host.initialize();
  await host.accept(x.acceptance,{reviewSourceIds:[kind]});const offer=await host.claimReview("accepted");
  const sources=await openReviewSources(x.sourceFile), acquired=await sources.read({id:kind});
  assert.equal(acquired.text,body);assert.equal(acquired.sha256,selected.sha256);
  validateModelReviewAcquisition(offer.input.sourceEvidence,[acquired],[],offer.input.sourceEvidence.scope);
  await x.put(selected.path,`Unrelated prefix\n${body}\nUnrelated next-task append`);
  const outside=await host.reviewInput("accepted");
  assert.equal(outside.key,offer.key);assert.deepEqual(outside.input.observation,offer.input.observation);
  assert.deepEqual(outside.input.sourceEvidence,offer.input.sourceEvidence);
  await x.put(selected.path,body.replace("Accepted","Changed"));
  assert.notEqual((await host.reviewInput("accepted")).key,offer.key);
  assert.equal((await host.reviewInput("accepted")).input.observation.find(r=>r.id===kind).status,"MISMATCH");
  await assert.rejects(host.review("accepted",offer,{reviewer:"reviewer",runId:offer.runId}),/REVIEW_SOURCE_CHANGED/);
  for(const bytes of [body+body,body.replace(selected.endMarker,""),"no markers"]){
    await x.put(selected.path,bytes);await assert.rejects(host.reviewInput("accepted"),/SELECTOR_INVALID/);
    await assert.rejects((await openReviewSources(x.sourceFile)).read({id:kind}),/SELECTOR_INVALID/);
  }
  await x.put(selected.path,body);
  const entry=x.entries.at(-1);entry.startMarker=`${kind}:start`;await x.registry();
  assert.notEqual((await host.reviewInput("accepted")).key,offer.key);
  const drift=await (await openReviewSources(x.sourceFile)).read({id:kind});
  assert.throws(()=>validateModelReviewAcquisition(offer.input.sourceEvidence,[drift],[],offer.input.sourceEvidence.scope),/SOURCE_DRIFT/);
  entry.startMarker=selected.startMarker;entry.purpose="Changed selector rationale";await x.registry();
  assert.notEqual((await host.reviewInput("accepted")).key,offer.key);
  await assert.rejects(host.review("accepted",offer,{reviewer:"reviewer",runId:offer.runId}),/REVIEW_SOURCE_CHANGED/);
  delete entry.endMarker;await x.registry();await assert.rejects(openReviewSources(x.sourceFile),/SELECTOR_INVALID/);
  const raw=Buffer.concat([Buffer.from([0xff]),Buffer.from(body),Buffer.from([0xfe])]);
  assert.deepEqual(artifactBytes(selected,raw),Buffer.from(body));assert.equal(artifactHash(selected,raw),selected.sha256);
});
