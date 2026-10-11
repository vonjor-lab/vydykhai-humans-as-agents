import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,realpath,mkdir,cp,readFile,writeFile,rm,lstat} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {openControlHost} from "../scripts/control-host.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {runContextTransition} from "../scripts/context-run.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {endpointServices} from "./control-endpoint-fixture.mjs";
import {hash} from "./context-fixture.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {openPartitionModelReview} from "../scripts/control-partition-model-review.mjs";
import {validateReviewPart} from "../scripts/control-review-partitions.mjs";

const repository=new URL("../",import.meta.url).pathname;
async function setup(t) {
  const root=await realpath(await mkdtemp(path.join(tmpdir(),"health-domain-")));
  const privateRoot=await realpath(await mkdtemp(path.join(tmpdir(),"health-domain-private-")));
  t.after(()=>Promise.all([rm(root,{recursive:true,force:true}),rm(privateRoot,{recursive:true,force:true})]));
  await cp(path.join(repository,"examples/context-preparation"),root,{recursive:true});
  const json=async name=>JSON.parse(await readFile(path.join(root,name),"utf8"));
  const put=(name,v)=>writeFile(path.join(root,name),typeof v==="string"?v:JSON.stringify(v));
  const cli=(...args)=>JSON.parse(execFileSync(process.execPath,[path.join(repository,"scripts/vydykhai.mjs"),...args],{cwd:root,encoding:"utf8"}));
  const pkg=await json("package-modular.json");
  // No semantic claims are made by this zero-model fixture approval.
  await put("action.mjs","import {appendFileSync} from 'node:fs'; appendFileSync('candidate.mjs', '\\n// confined B bytes\\n');\n");
  await put("package.json",pkg);
  assert.equal(cli("context-prepare","plan","--input","package.json","--output","prepared").status,"PLAN_READY");
  assert.equal(cli("context-prepare","confirm","--output","prepared","--owner",pkg.owner,"--decision","approved").status,"PREPARED");
  cli("context-prepare","read","--output","prepared","--worker",pkg.task.worker);
  await put("worker-evidence.txt","Fixture worker acquired the scoped module packet; no semantic model trial.");
  assert.equal(cli("context-prepare","ack","--output","prepared","--worker",pkg.task.worker,"--evidence","worker-evidence.txt").status,"ACKNOWLEDGED");
  const request=await json("prepared/resume.json"),task=await json(request.task.path);
  const ready=await runContextTransition({...request,operation:"preflight"},endpointServices);
  assert.equal(ready.status,"READY",JSON.stringify(ready));
  const confined={schema:"control.confined-command.v1",writeFiles:["candidate.mjs"],
    module:task.module,plan:{path:task.packageApproval.plan,sha256:(await json(task.packageApproval.approval)).planSha256},
    approval:{path:task.packageApproval.approval,sha256:hashBytes(await readFile(path.join(root,task.packageApproval.approval)))}};
  const binding={operation:"resume",taskId:task.id,taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,
    sourceDigest:ready.coverageBasis.sourceDigest,dependencyDigest:ready.coverageBasis.dependencyDigest,
    commandSha256:hash(task.action),cwd:root,executable:await realpath(task.action.executable),kind:"dependent",confined};
  const git=args=>execFileSync("git",args,{cwd:root,stdio:"pipe"});
  git(["init","--quiet"]);git(["add","."]);
  git(["-c","user.name=Fixture","-c","user.email=f@example.invalid","commit","--quiet","-m","baseline"]);
  await put("candidate.mjs",(await readFile(path.join(root,"candidate.mjs"),"utf8"))+"\n// already dirty B\n");
  const directory=path.join(privateRoot,"state");await mkdir(directory,{mode:0o700});
  const sourceFile=path.join(privateRoot,"sources.json");
  const sources=[{id:"task",path:request.task.path},{id:"module",path:task.module.path},
    {id:"plan",path:task.packageApproval.plan},{id:"approval",path:task.packageApproval.approval},
    {id:"contract",path:"module-contract.md"}].map(r=>({...r,purpose:"Actual pinned authority and independent domain evidence"}));
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:root,sources}),{mode:0o600});
  const config={workspace:root,policy:hash("fixture policy"),owner:"owner",reviewer:"reviewer",executor:"worker",
    evidenceRegistry:sourceFile,health:{scope:"Registered authority and retained obligations",intervalMs:60000,
      maxBranches:2,maxWorktrees:2,triggerSourceIds:["contract"],repairTasks:[]}};
  const host=await openControlHost(directory,config,endpointServices);await host.initialize();
  const owner=ownerControl(host,config.owner),store=await openControlStore(directory);
  await host.approveCommand(binding,{reviewer:config.reviewer,reviewReceipt:"fixture independently reviewed command",
    dependencies:[],expiresAt:Date.now()+300000,executionRequest:request});
  const registry=await openReviewSources(sourceFile);
  const answer=async (offer,domain=false)=>{
    const readbacks=await Promise.all(sources.map(s=>registry.read({id:s.id})));
    const raw={schema:"control.review-answer.v2",rowGroups:[{ids:controlCheckIds,status:"PASS",sourceIds:sources.map(s=>s.id)}],
      newFindings:[],resolutions:[],...(domain?{healthDomain:{sourceIds:sources.map(s=>s.id),evidence:"Fixture reviewer acquired packet, contract and approval: only B bytes may change; all registered dependencies remain current."}}:{})};
    return {phase:"HEALTH",key:offer.key,runId:offer.runId,reviewer:config.reviewer,observedAt:new Date().toISOString(),
      ...decodeReviewAnswer(raw,{readbacks,offer,reviewer:config.reviewer,observedAt:new Date().toISOString()})};
  };
  const consume=async v=>{await owner.readVerdict("@health");return owner.respond("@health",{owner:config.owner,reviewKey:hash(v),action:"CONTINUE",evidence:"Fixture owner read and applied independent verdict"});};
  return {root,privateRoot,directory,sourceFile,host,owner,store,request,confined,binding,config,answer,consume,put};
}
import {sha256 as hashBytes} from "../scripts/memory-brief.mjs";

for(const replacement of ["args","executable","cwd"])test(`genuine confined launch rejects substituted ${replacement} before spawning`,{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t);
  await x.owner.proposeHealthDomain({grantId:hash(x.binding),sourceIds:["task","module","plan","approval","contract"]});
  const bootstrap=await x.host.claimReview("@health"),v=await x.answer(bootstrap,true);
  await x.host.review("@health",bootstrap,v);await x.consume(v);
  await x.store.transact(s=>{s.health.nextDueAt=0;return s;});
  const offer=await x.host.claimReview("@health"),before=await readFile(path.join(x.root,"candidate.mjs"));
  const genuine=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
  const changes={args:["-e","require('node:fs').appendFileSync('candidate.mjs','unapproved alternate')"],
    executable:await realpath("/usr/bin/true"),cwd:path.join(x.root,".git")};
  const sandboxLaunch=spec=>genuine({...spec,[replacement]:changes[replacement]});
  const result=await runControlledContextTransition(x.request,{...endpointServices,control:x.host.control,sandboxLaunch,confinedCommand:x.confined});
  assert.equal(result.status,"BLOCKED");assert.equal(result.code,"CONTROL_OUTCOME_RECONCILIATION_REQUIRED");
  assert.equal(result.stats.commands,0);assert.deepEqual(await readFile(path.join(x.root,"candidate.mjs")),before);
  assert.equal((await x.host.snapshot()).reservations[hash(x.binding)].status,"IN_FLIGHT");
  await assert.rejects(x.host.health.admitReview(offer),/HEALTH_/);
});

test("actual confined completed B write admits immutable HEALTH and current owner disposition",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t);
  await x.owner.proposeHealthDomain({grantId:hash(x.binding),sourceIds:["task","module","plan","approval","contract"]});
  const approvalOffer=await x.host.claimReview("@health"),approval=await x.answer(approvalOffer,true);
  await x.host.review("@health",approvalOffer,approval);await x.consume(approval);
  await x.store.transact(s=>{s.health.nextDueAt=0;return s;});
  const offer=await x.host.claimReview("@health"),historical=structuredClone(offer);
  const before=await lstat(path.join(x.root,"candidate.mjs"));
  const sandboxLaunch=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
  const result=await runControlledContextTransition(x.request,{...endpointServices,control:x.host.control,sandboxLaunch,confinedCommand:x.confined});
  assert.equal(result.status,"ACTION_COMPLETED",JSON.stringify(result));
  const after=await lstat(path.join(x.root,"candidate.mjs"));assert.equal(after.ino,before.ino);
  assert.match(await readFile(path.join(x.root,"candidate.mjs"),"utf8"),/confined B bytes/);
  assert.equal(JSON.stringify(result).includes("launchId"),false);
  const retained=(await x.host.snapshot()).reservations[hash(x.binding)];
  assert.equal(retained.status,"COMPLETED");assert.ok(retained.effects.process.closedAt);
  assert.equal(retained.effects.before.protectedSha256,retained.effects.after.protectedSha256);
  assert.notEqual(retained.effects.before.fileSha256,retained.effects.after.fileSha256);
  assert.deepEqual(await x.host.health.admitReview(offer),historical);
  assert.deepEqual(await x.host.health.reviewInput(),historical);
  const reviewers=[];
  for(const partitionCount of [1,4]) {
    const directory=path.join(x.privateRoot,`model-preflight-${partitionCount}`);await mkdir(directory,{mode:0o700});
    const reviewer=await openModelReview({directory,controlRoot:x.privateRoot,reviewer:x.config.reviewer,
      sourceFile:x.sourceFile,native:{},maxCalls:4,partitionCount,expiresAt:new Date(Date.now()+60000).toISOString(),
      scope:{host:{directory:x.directory,config:x.config}}});
    await reviewer.initialize();
    assert.deepEqual(await reviewer.preflight(offer),offer.input.sourceEvidence);
    assert.equal((await reviewer.capacity()).used,0);reviewers.push(reviewer);
  }
  const saved=await x.store.read();
  const denyMutation=async (name,change)=>{
    await x.store.transact(s=>{change(s);return s;});
    await assert.rejects(x.host.health.admitReview(offer),/HEALTH_/);t.diagnostic(`denied ${name}`);
    for(const reviewer of reviewers)await assert.rejects(reviewer.preflight(offer),/MODEL_REVIEW_HOST_OFFER_MISMATCH/);
    await x.store.transact(()=>structuredClone(saved.state));
  };
  await denyMutation("missing effects",s=>delete s.reservations[hash(x.binding)].effects);
  await denyMutation("changed result",s=>s.reservations[hash(x.binding)].resultSha256="0".repeat(64));
  await denyMutation("changed receipt",s=>s.grants[hash(x.binding)].reviewReceipt="different");
  await denyMutation("failed/unknown outcome",s=>s.reservations[hash(x.binding)].status="FAILED_RECONCILED");
  await denyMutation("pause",s=>s.paused=true);
  await denyMutation("finding drift",s=>s.health.findings.push({id:"unscoped-global",status:"OPEN",blocksResume:true}));
  await denyMutation("expired authority",s=>s.grants[hash(x.binding)].expiresAt=1);
  await denyMutation("changed private process close evidence",s=>s.reservations[hash(x.binding)].effects.process.closedAt=new Date().toISOString());
  await denyMutation("other authorized grant",s=>s.grants.other={...s.grants[hash(x.binding)],id:"other"});
  const v=await x.answer(offer);await x.host.review("@health",offer,v);
  const ownerDue=await x.store.read();
  assert.equal((await x.consume(v)).action,"HEALTH_WINDOW_CONFIRMED");
  assert.equal((await x.host.snapshot()).health.review.key,historical.key);
  assert.deepEqual((await x.host.snapshot()).health.review.rows,v.rows);
  assert.equal((await x.host.snapshot()).health.domain,undefined);
  assert.ok((await x.host.snapshot()).health.history.some(r=>r.completedDomain));
  await x.store.transact(s=>{s.health.nextDueAt=0;return s;});
  const next=await x.host.claimReview("@health");
  assert.equal((await x.host.snapshot()).health.reviewLease.captured,undefined);
  assert.equal(next.input.execution.reservations[0].recordSha256,hash((await x.host.snapshot()).reservations[hash(x.binding)]));
  await x.store.transact(()=>structuredClone(ownerDue.state));
  await x.put("module-contract.md",(await readFile(path.join(x.root,"module-contract.md"),"utf8"))+"drift");
  await assert.rejects(x.consume(v),/HEALTH_/);
  await x.put("module-contract.md",(await readFile(path.join(x.root,"module-contract.md"),"utf8")).replace(/drift$/,""));
  // Metadata drift is also protected: do not restore through writes and then claim the old snapshot current.
  await assert.rejects(x.consume(v),/HEALTH_/);
  t.diagnostic("Relevant source restoration does not erase independently observed identity drift");
});

test("domain approval cannot be supplied without acquired current source handles",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t);
  await x.owner.proposeHealthDomain({grantId:hash(x.binding),sourceIds:["task","module","plan","approval","contract"]});
  const offer=await x.host.claimReview("@health");
  assert.throws(()=>decodeReviewAnswer({schema:"control.review-answer.v2",rowGroups:[],newFindings:[],resolutions:[],
    healthDomain:{sourceIds:["task"],evidence:"opaque owner assertion"}},{readbacks:[],offer,reviewer:"reviewer",observedAt:new Date().toISOString()}),/MODEL_REVIEW_/);
});

async function settleLegacy(x) {
  const offer=await x.host.claimReview("@health"),v=await x.answer(offer);
  await x.host.review("@health",offer,v);await x.consume(v);
  await x.store.transact(s=>{s.health.nextDueAt=0;return s;});
}
test("legacy HEALTH refuses the same actual completed confined write without domain approval",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t);await settleLegacy(x);
  const offer=await x.host.claimReview("@health");
  assert.equal((await x.host.snapshot()).health.reviewLease.captured,undefined);
  const sandboxLaunch=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
  const result=await runControlledContextTransition(x.request,{...endpointServices,control:x.host.control,sandboxLaunch,confinedCommand:x.confined});
  assert.equal(result.status,"ACTION_COMPLETED",JSON.stringify(result));
  assert.ok((await x.host.snapshot()).reservations[hash(x.binding)].effects);
  await assert.rejects(x.host.health.admitReview(offer),/HEALTH_SOURCE_CHANGED/);
  await assert.rejects(x.host.review("@health",offer,await x.answer(offer)),/HEALTH_SOURCE_CHANGED/);
});

for(const mode of ["missing","workspace","modified-policy","invalid-rights","forged-effects"])
  test(`confined SDK denies ${mode} with real protected reservation`,{skip:process.platform!=="darwin"},async t=>{
    const x=await setup(t);await settleLegacy(x);
    const before=await readFile(path.join(x.root,"candidate.mjs"));
    if(mode==="forged-effects") {
      const grant=await x.host.control.authorize(x.binding),claim=await x.host.control.reserve(grant);
      await assert.rejects(x.host.control.observe(claim,{bindingSha256:claim.bindingSha256,outcome:"COMPLETED",
        resultSha256:hash("invented completed output"),effects:{state:"owner says done"}}),/ACTION_EFFECTS_NOT_CALLER_SUPPLIED/);
      await assert.rejects(x.host.control.observe(claim,{bindingSha256:claim.bindingSha256,outcome:"COMPLETED",
        resultSha256:hash("invented completed output")}),/ACTION_EFFECTS_REQUIRED/);
    } else {
      let sandboxLaunch;
      if(mode==="workspace")sandboxLaunch=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot});
      if(mode==="modified-policy") {
        const genuine=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
        sandboxLaunch=spec=>{const launch=genuine(spec);launch.args[1]="(version 1) (allow default)";return launch;};
      }
      const confinedCommand=structuredClone(x.confined);
      if(mode==="invalid-rights")confinedCommand.module.sha256="0".repeat(64);
      const result=await runControlledContextTransition(x.request,{...endpointServices,control:x.host.control,sandboxLaunch,confinedCommand});
      assert.equal(result.status,"BLOCKED",JSON.stringify(result));
      assert.equal(result.code,mode==="invalid-rights"?"COMMAND_RIGHTS_REQUIRED":"CONTROL_OUTCOME_RECONCILIATION_REQUIRED");
    }
    assert.deepEqual(await readFile(path.join(x.root,"candidate.mjs")),before);
    const row=(await x.host.snapshot()).reservations[hash(x.binding)];
    if(mode==="invalid-rights")assert.equal(row,undefined);
    else {assert.equal(row.status,"IN_FLIGHT");assert.equal(row.effects,undefined);}
  });

test("ordinary installed kit loads doctor but missing private confinement fails closed",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t);
  execFileSync(process.execPath,[path.join(repository,"scripts/vydykhai.mjs"),"install",x.root],{stdio:"pipe"});
  const installedCli=path.join(x.root,"scripts/vydykhai.mjs");
  const doctor=JSON.parse(execFileSync(process.execPath,[installedCli,"doctor",x.root,"--offline","--json"],{encoding:"utf8"}));
  assert.equal(doctor.ok,true);
  await assert.rejects(readFile(path.join(x.root,"scripts/local-control-sandbox.mjs")),{code:"ENOENT"});
  await settleLegacy(x);
  const {runContextTransition:installedRun}=await import(pathToFileURL(path.join(x.root,"scripts/context-run.mjs")));
  const before=await readFile(path.join(x.root,"candidate.mjs"));
  const sandboxLaunch=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
  const result=await installedRun(x.request,{...endpointServices,confinedCommand:x.confined,sandboxLaunch,
    dispatch:async(binding,invoke)=>{
      const grant=await x.host.control.authorize(binding);await x.host.control.reserve(grant);
      return invoke();
    }});
  assert.equal(result.status,"BLOCKED");assert.equal(result.stats.commands,0);
  assert.deepEqual(await readFile(path.join(x.root,"candidate.mjs")),before);
  const row=(await x.host.snapshot()).reservations[hash(x.binding)];
  assert.equal(row.status,"IN_FLIGHT");assert.equal(row.effects,undefined);
});

for(const finalDrift of [false,true])test(`scripted multipart HEALTH uses actual shared admission through final merge; final drift=${finalDrift}`,
  {skip:process.platform!=="darwin"},async t=>{
    const x=await setup(t);
    await x.owner.proposeHealthDomain({grantId:hash(x.binding),sourceIds:["task","module","plan","approval","contract"]});
    const bootstrap=await x.host.claimReview("@health"),approval=await x.answer(bootstrap,true);
    await x.host.review("@health",bootstrap,approval);await x.consume(approval);
    await x.store.transact(s=>{s.health.nextDueAt=0;return s;});
    const offer=await x.host.claimReview("@health"),directory=path.join(x.privateRoot,"multipart");
    await mkdir(directory,{mode:0o700});
    let index=0,processes=0;
    const options={directory,controlRoot:x.privateRoot,sourceFile:x.sourceFile,reviewer:x.config.reviewer,native:{},
      maxCalls:4,partitionCount:4,expiresAt:new Date(Date.now()+120000).toISOString(),scope:{host:{directory:x.directory,config:x.config}}};
    const parent=await openPartitionModelReview(options,async(childOptions,ids)=>{
      const actual=await openModelReview(childOptions),part=index++;let observation;
      return {...actual,async review(current){
        await actual.preflight(current);
        if(part===1) {
          const sandboxLaunch=await localControlSandbox({workspace:x.root,controlRoot:x.privateRoot,writeFiles:x.confined.writeFiles});
          const result=await runControlledContextTransition(x.request,{...endpointServices,control:x.host.control,sandboxLaunch,confinedCommand:x.confined});
          assert.equal(result.status,"ACTION_COMPLETED",JSON.stringify(result));processes++;
        }
        const sources=await openReviewSources(x.sourceFile),entries=await sources.list();
        const readSources=await Promise.all(entries.map(r=>sources.read({id:r.id})));
        const wireAnswer={schema:"control.review-answer.v2",rowGroups:[{ids,status:"PASS",sourceIds:entries.map(r=>r.id)}],newFindings:[],resolutions:[]};
        const observedAt=new Date().toISOString();
        const decoded=validateReviewPart(wireAnswer,ids,{readbacks:readSources,offer:current,reviewer:x.config.reviewer,observedAt});
        await actual.preflight(current);
        observation={state:"STOPPED",runId:current.runId,wireAnswer,readSources,verdict:decoded};
        assert.equal((await actual.capacity()).used,0);
      },async observe(){
        if(finalDrift&&part===3)await x.host.pause(true);
        return observation;
      }};
    });
    await parent.initialize();
    if(finalDrift) {
      await assert.rejects(parent.review(offer),/MODEL_REVIEW_HOST_OFFER_MISMATCH/);
      assert.equal((await parent.observe(offer.runId)).verdict,undefined);
      assert.equal((await x.host.snapshot()).health.review.key,bootstrap.key);
    } else {
      const v=await parent.review(offer);
      assert.equal(v.key,offer.key);assert.equal(v.rows.length,87);
      await x.host.review("@health",offer,v);assert.equal((await x.consume(v)).action,"HEALTH_WINDOW_CONFIRMED");
    }
    assert.equal(processes,1);
    t.diagnostic("Scripted acquired child judgments, actual multipart/current admission and one confined process; zero native/model runner calls.");
  });
