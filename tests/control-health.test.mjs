import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile,rm,readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {endpointFixture,endpointServices} from "./control-endpoint-fixture.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {ownerControl,compactOwnerVerdict} from "../scripts/control-owner.mjs";
import {controlCheckIds,controlCatalog} from "../scripts/control-catalog.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {openControlService,runControlService} from "../scripts/control-service.mjs";
import {nativeProvider,codeItem,answerItem} from "./native-provider-fixture.mjs";
const hash = v => sha256(canonicalJson(v));
const git = (root,args) => execFileSync("git",args,{cwd:root,stdio:"pipe"});
async function setup(t,services={},healthExtras={}) {
  const x=await endpointFixture(t),directory=path.join(x.privateRoot,"health-state");
  await mkdir(directory,{mode:0o700});
  git(x.f.root,["init","--quiet"]);
  git(x.f.root,["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","commit","--quiet","--allow-empty","-m","baseline"]);
  const sourceFile=path.join(x.privateRoot,"health-sources.json");
  await x.f.put("health-policy.md","bounded synthetic health policy");
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
    sources:[{id:"policy",path:"health-policy.md",purpose:"Health obligations"}]}),{mode:0o600});
  const config={...x.profile.config,evidenceRegistry:sourceFile,health:{scope:"Synthetic inherited-project health",
    intervalMs:604800000,maxBranches:1,maxWorktrees:2,triggerSourceIds:["policy"],repairTasks:["maintenance"],...healthExtras}};
  const host=await openControlHost(directory,config,{...endpointServices,...services});await host.initialize();
  return {...x,directory,sourceFile,config,host,owner:ownerControl(host,config.owner)};
}
const verdict=(x,offer)=>({phase:"HEALTH",key:offer.key,runId:offer.runId,reviewer:x.config.reviewer,
  observedAt:new Date().toISOString(),rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture:scoped-observations"})),findings:[]});
async function review(x,amend=()=>{}) {
  const offer=await x.host.claimReview("@health"),v=verdict(x,offer);amend(v,offer);await x.host.review("@health",offer,v);return v;
}
async function consume(x,v,action="CONTINUE",leases=[]) {
  await x.owner.readVerdict("@health");return x.owner.respond("@health",{owner:x.config.owner,reviewKey:hash(v),action,evidence:"fixture:applied"},leases);
}
function defect() {
  return {id:"unowned-branch",checkId:"C12.03",area:"C12",criterion:controlCatalog.find(g=>g.id==="C12").checks[2].criterion,
    evidence:"fixture:orphan observed",owner:"owner",work:"maintenance",status:"OPEN",attempts:0,
    firstSeen:new Date().toISOString(),reviewAt:new Date(Date.now()+3600000).toISOString(),blocksResume:true};
}
function add(v,f) {v.findings.push(f);Object.assign(v.rows.find(r=>r.id===f.checkId),{status:"FINDING",findingId:f.id,reason:"Unowned work"});}
const leases=f=>[{owner:f.owner,work:f.work,state:"WORKING",evidence:"fixture:owned",checkpoint:"repair",
  reviewAt:f.reviewAt}];

test("interrupted HEALTH resumes the same trusted assignment, not a new retry",async t=>{
  let observed,offer;
  const x=await setup(t,{observeReviewRun:async()=>observed});
  const tick=await runControlTick(x.host,{review:async o=>{offer=o;throw Error('injected stop');}});
  assert.equal(tick.results[0].action,'REVIEW_RECONCILIATION_REQUIRED');
  observed={runId:offer.runId,state:'STOPPED',resumable:true,offerSha256:hash(offer),
    deadline:new Date(Date.now()+60000).toISOString(),evidence:'trusted-transport-fixture'};
  await x.host.pause(true);
  await assert.rejects(x.host.resumeReview('@health',offer),/CONTINUATION_NOT_AVAILABLE/);
  await x.host.pause(false);
  const original=await readFile(path.join(x.f.root,'health-policy.md'));
  await x.f.put('health-policy.md','changed');
  await assert.rejects(x.host.resumeReview('@health',offer),/HEALTH_SOURCE_CHANGED/);
  await x.f.put('health-policy.md',original.toString('utf8'));
  const resumed=await x.host.resumeReview('@health',offer);
  assert.equal(resumed.runId,offer.runId);
  assert.deepEqual({...await x.host.health.reviewInput(),runId:offer.runId},offer);
  await x.host.review('@health',offer,verdict(x,offer));
  assert.equal((await x.host.snapshot()).health.enrollment,'OWNER_DISPOSITION_DUE');
  await assert.rejects(x.host.resumeReview('@health',offer),/CONTINUATION_NOT_AVAILABLE/);
});

async function waitingRepair(t) {
  const x=await setup(t),f=defect(),lease={...leases(f)[0],state:"WAITING",resumeWhen:"replacement input retained"};
  const v=await review(x,v=>add(v,f));await consume(x,v,"REPAIR",[lease]);
  await x.host.pause(true);
  const request={repairOwner:f.owner,work:f.work,expectedLeaseSha256:hash(lease),
    evidence:"fixture:replacement input retained",checkpoint:"fixture:owner acknowledged repair preparation"};
  return {x,f,lease,request};
}
test("repair lease resume preserves obligations and requires a separate repair review",async t=>{
  const {x,f,lease,request}=await waitingRepair(t),before=await x.host.snapshot();
  assert.deepEqual(await x.owner.resumeHealthRepair(request),
    {action:"REPAIR_PREPARED",executionGranted:false,reviewGranted:false});
  const after=await x.host.snapshot(),expected=structuredClone(before);
  const next={...lease,state:"PREPARED",evidence:request.evidence,checkpoint:request.checkpoint};
  expected.health.repairLeases=[next];
  const event=after.health.history.at(-1);
  assert.deepEqual(event.repairLeaseResume,{owner:x.config.owner,previous:lease,next,
    observedAt:event.repairLeaseResume.observedAt,receipt:"COORDINATION_ONLY_NOT_REPAIR_PROOF"});
  assert.ok(Number.isFinite(Date.parse(event.repairLeaseResume.observedAt)));
  expected.health.history.push(event);
  assert.deepEqual(after,expected);
  await assert.rejects(x.owner.requestHealthRepairReview({evidence:"fixture:repair",findingIds:[f.id]}),/HEALTH_REPAIR_NOT_OWNED/);
  await assert.rejects(x.owner.resumeHealthRepair(request),/HEALTH_REPAIR_RESUME_STALE/);
  await x.host.pause(false);
  await x.owner.requestHealthRepairReview({evidence:"fixture:repair",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health");
  assert.equal(offer.input.lifecycle.phase,"REPAIR_VERIFICATION");
  assert.deepEqual(offer.input.lifecycle.requestedRepairFindingIds,[f.id]);
  assert.equal(offer.input.previousFindings[0].status,"OPEN");
});
test("repair lease resume refuses stale authority and in-flight work without mutation",async t=>{
  const {x,request}=await waitingRepair(t);
  const unchanged=async (action,pattern)=>{
    const before=await x.host.snapshot();await assert.rejects(action,pattern);
    assert.deepEqual(await x.host.snapshot(),before);
  };
  await unchanged(()=>x.host.health.resumeRepair({...request,owner:"stranger"}),/HEALTH_REPAIR_RESUME_INVALID/);
  await unchanged(()=>x.owner.resumeHealthRepair({...request,work:"other"}),/HEALTH_REPAIR_RESUME_NOT_OWNED/);
  await unchanged(()=>x.owner.resumeHealthRepair({...request,expectedLeaseSha256:"0".repeat(64)}),/HEALTH_REPAIR_RESUME_STALE/);
  await unchanged(()=>x.owner.resumeHealthRepair({...request,reviewAt:new Date().toISOString()}),/HEALTH_REPAIR_RESUME_INVALID/);
  await x.host.pause(false);
  await unchanged(()=>x.owner.resumeHealthRepair(request),/HEALTH_REPAIR_RESUME_NOT_QUIESCENT/);
  await x.host.pause(true);
  const store=await openControlStore(x.directory),base=await x.host.snapshot();
  for(const patch of [{reviewLease:{runId:"pending"}},{reviewEpisode:{id:"pending"}},
    {repairIds:["pending"]},{enrollment:"REVIEW_RECONCILIATION_REQUIRED"}]) {
    await store.transact(s=>{Object.assign(s.health,patch);return s;});
    await unchanged(()=>x.owner.resumeHealthRepair(request),/HEALTH_REPAIR_RESUME_NOT_QUIESCENT/);
    await store.transact(()=>structuredClone(base));
  }
});
test("repair lease resume cannot authorize retry of a failed repair",async t=>{
  const {x,f,request}=await waitingRepair(t),store=await openControlStore(x.directory);
  await store.transact(s=>{Object.assign(s.health.findings[0],{lastResult:"FAILED",attempts:1});return s;});
  const before=await x.host.snapshot();await x.owner.resumeHealthRepair(request);
  assert.deepEqual((await x.host.snapshot()).health.findings,before.health.findings);
  await x.host.pause(false);
  await assert.rejects(x.owner.requestHealthRepairReview({evidence:"fixture:repair",findingIds:[f.id]}),
    /HEALTH_FAILED_REPAIR_NEEDS_DECISION/);
});

test("review sees stable lifecycle and actual owned repair assignments without treating them as proof",async t=>{
  const x=await setup(t),f=defect();
  const initial=await x.host.claimReview("@health");
  assert.equal(initial.input.lifecycle.phase,"INITIAL_DIAGNOSIS");
  assert.equal(initial.input.lifecycle.previousReview,null);
  assert.deepEqual(initial.input.lifecycle.repairAssignments,[]);
  assert.deepEqual(initial.input.lifecycle.requestedRepairFindingIds,[]);
  assert.equal(initial.input.lifecycle.receipt,"COORDINATION_ONLY_NOT_REPAIR_PROOF");
  const v=verdict(x,initial);add(v,f);await x.host.review("@health",initial,v);
  await consume(x,v,"REPAIR",leases(f));
  await x.owner.requestHealthRepairReview({evidence:"repair claimed, not independently accepted",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health"),life=offer.input.lifecycle;
  assert.equal(life.phase,"REPAIR_VERIFICATION");
  assert.equal(life.previousReview.sha256,hash(v));
  assert.equal(life.ownerDisposition.action,"REPAIR");
  assert.deepEqual(life.repairAssignments,leases(f));
  assert.deepEqual(life.requestedRepairFindingIds,[f.id]);
  assert.equal(offer.input.previousFindings[0].status,"OPEN");
  const stillOpen=verdict(x,offer);add(stillOpen,f);
  await x.host.review("@health",offer,stillOpen);
  const health=(await x.host.snapshot()).health;
  assert.equal(health.findings[0].status,"OPEN");
  assert.equal(health.findings[0].lastResult,"FAILED");
});
test("a changed repair assignment invalidates an already claimed health offer",async t=>{
  const x=await setup(t),offer=await x.host.claimReview("@health");
  const store=await openControlStore(x.directory);
  await store.transact(s=>{s.health.repairLeases=leases(defect());return s;});
  await assert.rejects(x.host.review("@health",offer,verdict(x,offer)),/HEALTH_SOURCE_CHANGED/);
  assert.equal((await x.host.snapshot()).health.review,null);
});
test("health exposes actual protected execution records without copying command contents",async t=>{
  const x=await setup(t),binding={taskId:'maintenance',secretArgument:'DO_NOT_EXPOSE'};
  await x.host.approveCommand(binding,{reviewer:'reviewer',reviewReceipt:'PRIVATE_REVIEW_RECEIPT',dependencies:[],expiresAt:Date.now()+60000});
  const offer=await x.host.claimReview('@health');
  assert.equal(offer.input.execution.coverage,'HOST_REGISTRY_ONLY_NOT_EXTERNAL_TASK_INVENTORY');
  assert.equal(offer.input.execution.approvedCommands.length,1);
  assert.equal(offer.input.execution.approvedCommands[0].taskId,'maintenance');
  assert.equal(offer.input.execution.approvedCommands[0].recordSha256,hash((await x.host.snapshot()).grants[hash(binding)]));
  assert.deepEqual(offer.input.execution.reservations,[]);
  assert.ok(!JSON.stringify(offer.input.execution).includes('DO_NOT_EXPOSE'));
  assert.ok(!JSON.stringify(offer.input.execution).includes('PRIVATE_REVIEW_RECEIPT'));
  await x.host.review('@health',offer,verdict(x,offer));
});
test("execution authority changing during or after review invalidates its health basis",async t=>{
  const x=await setup(t),offer=await x.host.claimReview('@health');
  await x.host.approveCommand({taskId:'maintenance'},{reviewer:'reviewer',reviewReceipt:'fixture:new authority',dependencies:[],expiresAt:Date.now()+60000});
  await assert.rejects(x.host.review('@health',offer,verdict(x,offer)),/HEALTH_SOURCE_CHANGED/);
  assert.equal((await x.host.snapshot()).health.review,null);
  const y=await setup(t),v=await review(y);
  await y.host.approveCommand({taskId:'maintenance'},{reviewer:'reviewer',reviewReceipt:'fixture:new authority',dependencies:[],expiresAt:Date.now()+60000});
  await assert.rejects(consume(y,v),/HEALTH_SOURCE_CHANGED/);
  assert.equal((await y.host.due())[0].action,'REVIEW_DUE');
});
for(const phase of ["review","disposition"])test(`changed grant reviewReceipt invalidates health ${phase} with the same command binding`,async t=>{
  const x=await setup(t),binding={taskId:"maintenance"},expiresAt=Date.now()+60000;
  const approval={reviewer:x.config.reviewer,reviewReceipt:"fixture:original private receipt",dependencies:[],expiresAt};
  await x.host.approveCommand(binding,approval);
  const offer=await x.host.claimReview("@health"),v=verdict(x,offer);
  if(phase==="disposition")await x.host.review("@health",offer,v);
  const before=(await x.host.snapshot()).grants[hash(binding)];
  await x.host.approveCommand(binding,{...approval,reviewReceipt:"fixture:changed private receipt"});
  const after=(await x.host.snapshot()).grants[hash(binding)];
  const {reviewReceipt:oldReceipt,...oldRecord}=before,{reviewReceipt:newReceipt,...newRecord}=after;
  assert.notEqual(oldReceipt,newReceipt);assert.deepEqual(newRecord,oldRecord);
  const reopened=await openControlHost(x.directory,x.config,endpointServices);
  if(phase==="review") {
    await assert.rejects(reopened.review("@health",offer,v),/HEALTH_SOURCE_CHANGED/);
    assert.equal((await reopened.snapshot()).health.review,null);
  } else {
    await assert.rejects(consume({...x,host:reopened,owner:ownerControl(reopened,x.config.owner)},v),/HEALTH_SOURCE_CHANGED/);
    const h=(await reopened.snapshot()).health;
    assert.deepEqual(h.review,v);assert.equal(h.disposition,null);
    assert.equal((await reopened.due())[0].action,"REVIEW_DUE");
  }
});
for(const phase of ["review","disposition"])test(`changed completed reservation result evidence invalidates health ${phase} with the same status`,async t=>{
  const x=await setup(t),binding={taskId:"maintenance"};
  await x.host.approveCommand(binding,{reviewer:x.config.reviewer,reviewReceipt:"fixture:approval",dependencies:[],expiresAt:Date.now()+60000});
  const permit=await x.host.control.authorize(binding),claim=await x.host.control.reserve(permit);
  await x.host.control.observe(claim,{bindingSha256:hash(binding),outcome:"COMPLETED",resultSha256:hash("original result")});
  const offer=await x.host.claimReview("@health"),v=verdict(x,offer);
  if(phase==="disposition")await x.host.review("@health",offer,v);
  const before=(await x.host.snapshot()).reservations[claim.reservationId],store=await openControlStore(x.directory);
  assert.equal(offer.input.execution.reservations[0].recordSha256,hash(before));
  assert.equal(offer.input.execution.reservations[0].resultSha256,undefined);
  await store.transact(s=>{s.reservations[claim.reservationId].resultSha256=hash("changed result");return s;});
  const after=(await x.host.snapshot()).reservations[claim.reservationId];
  const {resultSha256:oldResult,...oldRecord}=before,{resultSha256:newResult,...newRecord}=after;
  assert.equal(after.status,"COMPLETED");assert.notEqual(oldResult,newResult);assert.deepEqual(newRecord,oldRecord);
  const reopened=await openControlHost(x.directory,x.config,endpointServices);
  if(phase==="review") {
    await assert.rejects(reopened.review("@health",offer,v),/HEALTH_SOURCE_CHANGED/);
    assert.equal((await reopened.snapshot()).health.review,null);
  } else {
    await assert.rejects(consume({...x,host:reopened,owner:ownerControl(reopened,x.config.owner)},v),/HEALTH_SOURCE_CHANGED/);
    const h=(await reopened.snapshot()).health;
    assert.deepEqual(h.review,v);assert.equal(h.disposition,null);
    assert.equal((await reopened.due())[0].action,"REVIEW_DUE");
  }
});
test("a reservation acquired during review invalidates the unstarted-execution observation",async t=>{
  const x=await setup(t),binding={taskId:'maintenance'};
  await x.host.approveCommand(binding,{reviewer:'reviewer',reviewReceipt:'fixture:approval',dependencies:[],expiresAt:Date.now()+60000});
  const offer=await x.host.claimReview('@health');
  assert.deepEqual(offer.input.execution.reservations,[]);
  const permit=await x.host.control.authorize(binding);
  assert.equal(permit.decision,'ALLOW');
  await x.host.control.reserve(permit);
  assert.ok(Object.values((await x.host.snapshot()).reservations).some(r=>r.status==='IN_FLIGHT'));
  await assert.rejects(x.host.review('@health',offer,verdict(x,offer)),/HEALTH_SOURCE_CHANGED/);
  assert.equal((await x.host.snapshot()).health.review,null);
});
test("one already reviewed overdue checkpoint cannot endlessly redispatch unchanged nonblocking debt",async t=>{
  const x=await setup(t),f={...defect(),blocksResume:false,reviewAt:new Date(Date.now()-60000).toISOString()};
  const v=await review(x,r=>add(r,f));await consume(x,v,"CONTINUE",leases(f));
  // A newly discovered already-overdue finding was not in the original claim.
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  await consume(x,await review(x,r=>add(r,f)),"CONTINUE",leases(f));
  assert.deepEqual(await x.host.due(),[]);
  const state=await x.host.snapshot();
  assert.equal(state.health.findings[0].reviewAt,f.reviewAt);
  assert.equal(state.health.findings[0].status,"OPEN");
  const store=await openControlStore(x.directory);
  await store.transact(s=>{s.health.findings[0].reviewAt=new Date(Date.parse(f.reviewAt)+1).toISOString();return s;});
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  await store.transact(s=>{s.health.findings[0].reviewAt=f.reviewAt;return s;});
  assert.deepEqual(await x.host.due(),[]);
  await store.transact(s=>{s.health.nextDueAt=Date.now()-1;return s;});
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
});
test("a deadline crossing during inference is not consumed by the earlier claim",async t=>{
  const realNow=Date.now;let clock=realNow();Date.now=()=>clock;t.after(()=>{Date.now=realNow;});
  const x=await setup(t),f={...defect(),blocksResume:false,reviewAt:new Date(Date.now()+1500).toISOString()};
  const store=await openControlStore(x.directory);
  await store.transact(s=>{s.health.findings=[f];return s;});
  const offer=await x.host.claimReview("@health");
  assert.deepEqual((await x.host.snapshot()).health.reviewLease.overdueCheckpoints,[]);
  clock=Date.parse(f.reviewAt)+20;
  const v=verdict(x,offer);add(v,f);await x.host.review("@health",offer,v);
  await consume(x,v,"CONTINUE",leases(f));
  assert.deepEqual((await x.host.snapshot()).health.reviewedCheckpoints,[]);
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
});

test("activation enrolls health with no accepted task; owner readback and next deadline are durable",async t=>{
  const x=await setup(t);assert.deepEqual((await x.host.snapshot()).acceptances,{});
  assert.equal((await x.host.due())[0].id,"@health");
  const binding={taskId:"product"};
  await x.host.approveCommand(binding,{reviewer:"reviewer",reviewReceipt:"fixture:command-proof",dependencies:[],expiresAt:Date.now()+60000});
  await assert.rejects(x.host.control.authorize(binding),/HEALTH_CONTROL_PENDING/);
  await assert.rejects(x.host.health.assertReady("product"),/HEALTH_CONTROL_PENDING/);
  await x.host.health.assertReady("maintenance");
  const v=await review(x);
  await assert.rejects(x.owner.respond("@health",{owner:"owner",reviewKey:hash(v)}),/READBACK_REQUIRED/);
  assert.equal((await consume(x,v)).action,"HEALTH_WINDOW_CONFIRMED");
  assert.equal((await x.host.control.authorize(binding)).decision,"ALLOW");
  const again=await openControlHost(x.directory,x.config,endpointServices);
  assert.deepEqual(await again.due(),[]);await again.health.assertReady("product");
  const store=await openControlStore(x.directory);
  await store.transact(s=>{s.health.nextDueAt=Date.now()-1;return s;});
  assert.equal((await again.due())[0].action,"REVIEW_DUE");
  await again.health.assertReady("product");
  assert.equal((await again.due())[0].action,"REVIEW_DUE");
  const {health,...legacyConfig}=x.config;
  const without=await openControlHost(x.directory,legacyConfig,endpointServices);
  await assert.rejects(without.snapshot(),/CONFIG_MISMATCH/);
});
test("an independently scoped health finding holds its affected task, not unrelated authorized work",async t=>{
  const x=await setup(t),f={...defect(),affectedTasks:["broken-module"]};
  const unrelated={taskId:"unrelated"},affected={taskId:"broken-module"};
  for(const binding of [unrelated,affected])await x.host.approveCommand(binding,
    {reviewer:x.config.reviewer,reviewReceipt:"fixture:scoped-authority",dependencies:[],expiresAt:Date.now()+60000});
  const v=await review(x,r=>add(r,f));
  await assert.rejects(x.host.control.authorize(unrelated),/HEALTH_CONTROL_PENDING/);
  await consume(x,v,"REPAIR",leases(f));
  assert.equal((await x.host.control.authorize(unrelated)).decision,"ALLOW");
  await assert.rejects(x.host.control.authorize(affected),/HEALTH_CONTROL_PENDING/);
  const reopened=await openControlHost(x.directory,x.config,endpointServices);
  await reopened.health.assertReady("unrelated");
  await assert.rejects(reopened.health.assertReady("broken-module"),/HEALTH_CONTROL_PENDING/);
  assert.equal((await reopened.due())[0].action,"REPAIR_DUE");
});
test("unknown health scope remains a global hold and cannot be silently narrowed",async t=>{
  const x=await setup(t),f=defect();
  await consume(x,await review(x,r=>add(r,f)),"REPAIR",leases(f));
  for(const task of ["unrelated","broken-module"])await assert.rejects(x.host.health.assertReady(task),/HEALTH_CONTROL_PENDING/);
  await x.owner.requestHealthRepairReview({evidence:"attempted scope rewrite",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health"),v=verdict(x,offer);add(v,{...f,affectedTasks:["broken-module"]});
  await assert.rejects(x.host.review("@health",offer,v),/HEALTH_FINDINGS_INVALID/);
});
test("an applied repair lease admits its exact repair task without static alias and preserves pause and retry gates",async t=>{
  const x=await setup(t),f={...defect(),work:"repair-unique"};
  const v=await review(x,r=>add(r,f));
  await assert.rejects(x.host.health.assertReady(f.work),/HEALTH_CONTROL_PENDING/);
  await consume(x,v,"REPAIR",leases(f));
  await x.host.health.assertReady(f.work);
  await assert.rejects(x.host.health.assertReady("another-repair"),/HEALTH_CONTROL_PENDING/);
  await x.host.pause(true);
  for(const task of [f.work,"maintenance"])await assert.rejects(x.host.health.assertReady(task),/HEALTH_CONTROL_PENDING/);
  await x.host.pause(false);
  const store=await openControlStore(x.directory);
  await store.transact(s=>{Object.assign(s.health.findings[0],{attempts:1,lastResult:"FAILED"});return s;});
  await assert.rejects(x.host.health.assertReady(f.work),/HEALTH_CONTROL_PENDING/);
  await x.host.health.authorizeRepairRetry({reviewer:x.config.reviewer,findingId:f.id,fromAttempt:1,
    reviewKey:hash((await x.host.snapshot()).health.review),evidence:"fixture:changed cause",decision:"One bounded repair"});
  await x.host.health.assertReady(f.work);
  await store.transact(s=>{s.health.repairLeases=[];return s;});
  await assert.rejects(x.host.health.assertReady(f.work),/HEALTH_CONTROL_PENDING/);
});
test("periodic health stays due through fresh review without blocking known healthy work",async t=>{
  const x=await setup(t);await consume(x,await review(x));
  const store=await openControlStore(x.directory);
  await store.transact(s=>{s.health.nextDueAt=Date.now()-1;return s;});
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  await x.host.health.assertReady("product");
  const offer=await x.host.claimReview("@health");
  await x.host.health.assertReady("product");
  await x.host.review("@health",offer,verdict(x,offer));
  await x.host.health.assertReady("product");
  assert.equal((await x.host.due())[0].action,"OWNER_DISPOSITION_DUE");
});
test("scoped repair cannot fall through on failed retry or absent lease, including a static maintenance alias",async t=>{
  for(const work of ["repair-unique","maintenance"]) {
    const x=await setup(t),f={...defect(),work,affectedTasks:["broken-module"]};
    await consume(x,await review(x,r=>add(r,f)),"REPAIR",leases(f));
    await x.owner.requestHealthRepairReview({evidence:"named repair attempted",findingIds:[f.id]});
    await review(x,r=>add(r,f));
    await consume(x,(await x.host.snapshot()).health.review,"REPAIR",leases(f));
    const binding={taskId:work};
    await x.host.approveCommand(binding,{reviewer:x.config.reviewer,reviewReceipt:"fixture:repair-authority",
      dependencies:[],expiresAt:Date.now()+60000});
    await assert.rejects(x.host.control.authorize(binding),/HEALTH_CONTROL_PENDING/);
    await x.host.health.assertReady("unrelated");
    await x.host.health.authorizeRepairRetry({reviewer:x.config.reviewer,findingId:f.id,
      fromAttempt:1,reviewKey:hash((await x.host.snapshot()).health.review),
      evidence:"fixture:new cause",decision:"One scoped retry"});
    assert.equal((await x.host.control.authorize(binding)).decision,"ALLOW");
    const store=await openControlStore(x.directory);
    await store.transact(s=>{s.health.repairLeases=[];return s;});
    await assert.rejects(x.host.control.authorize(binding),/HEALTH_CONTROL_PENDING/);
    await x.host.health.assertReady("unrelated");
  }
});
test("a shared repair task cannot use a healthy sibling finding to bypass another finding's failed retry",async t=>{
  const x=await setup(t),a={...defect(),affectedTasks:["broken-module"]},b={...a,id:"sibling"};
  await consume(x,await review(x,r=>{add(r,a);r.findings.push(b);}),"REPAIR",leases(a));
  await x.owner.requestHealthRepairReview({evidence:"first named repair",findingIds:[a.id]});
  await review(x,r=>{add(r,a);r.findings.push(b);});
  await consume(x,(await x.host.snapshot()).health.review,"REPAIR",leases(a));
  await assert.rejects(x.host.health.assertReady(a.work),/HEALTH_CONTROL_PENDING/);
  await x.host.health.assertReady("unrelated");
  await x.host.health.authorizeRepairRetry({reviewer:x.config.reviewer,findingId:a.id,fromAttempt:1,
    reviewKey:hash((await x.host.snapshot()).health.review),evidence:"fixture:changed cause",decision:"One exact retry"});
  await x.host.health.assertReady(a.work);
});
test("WAITING repair retains ownership but does not establish executable readiness",async t=>{
  const x=await setup(t),f={...defect(),affectedTasks:["broken-module"]};
  await consume(x,await review(x,r=>add(r,f)),"REPAIR",[{...leases(f)[0],state:"WAITING",resumeWhen:"dependency completed"}]);
  await assert.rejects(x.host.health.assertReady(f.work),/HEALTH_CONTROL_PENDING/);
  await x.host.health.assertReady("unrelated");
});
test("a fresh closure lifts an old affected hold only after its owner applies that verdict",async t=>{
  const x=await setup(t),f={...defect(),affectedTasks:["broken-module"]};
  await consume(x,await review(x,r=>add(r,f)),"REPAIR",leases(f));
  await x.owner.requestHealthRepairReview({evidence:"repair complete",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health"),v=verdict(x,offer);
  v.findings.push({...f,status:"CLOSED",proof:"fixture:actual fixed boundary",reviewedBy:x.config.reviewer,
    checkedKey:offer.key,attempts:1,lastResult:"PASSED"});
  await x.host.review("@health",offer,v);
  await assert.rejects(x.host.health.assertReady("broken-module"),/HEALTH_CONTROL_PENDING/);
  await x.host.health.assertReady("unrelated");
  await consume(x,v);
  await x.host.health.assertReady("broken-module");
});
test("actual branch growth and policy changes trigger consideration without restarting product work",async t=>{
  const x=await setup(t);await consume(x,await review(x));
  git(x.f.root,["branch","unowned-experiment"]);
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  const v=await review(x);await consume(x,v);assert.deepEqual(await x.host.due(),[]);
  await x.f.put("health-policy.md","updated safety policy");
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  assert.equal(git(x.f.root,["branch","--list","unowned-experiment"]).toString().trim(),"unowned-experiment");
});
test("stale pre-consumption observations are refused and reenrolled, not stalled",async t=>{
  const x=await setup(t),v=await review(x);
  await x.f.put("health-policy.md","changed before owner consumption");
  await assert.rejects(consume(x,v),/HEALTH_SOURCE_CHANGED/);
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  await consume(x,await review(x));assert.deepEqual(await x.host.due(),[]);
});
test("pause, exhausted dispatch budget and uncertain review do not erase or repeat health work",async t=>{
  const x=await setup(t,{observeReviewRun:async runId=>({runId,state:"UNKNOWN"})});
  await x.host.pause(true);assert.deepEqual(await x.host.due(),[]);
  await x.host.pause(false);let calls=0;
  const stopped=await runControlTick(x.host,{maxReviews:0,review:()=>{calls++;}});
  assert.equal(stopped.calls,0);assert.equal(calls,0);assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  const offer=await x.host.claimReview("@health");await x.host.reviewFailure("@health",offer.runId);
  await assert.rejects(x.host.reconcileReview("@health",{reviewer:"reviewer",action:"RETRY",evidence:"claimed"}),/OUTCOME_UNKNOWN/);
  const replay=await runControlTick(x.host,{review:()=>{calls++;}});assert.equal(replay.calls,0);assert.equal(calls,0);
});
test("completed invalid cached health verdict remains rejected and reaches only explicit retry authorization",async t=>{
  let observed;
  const x=await setup(t,{observeReviewRun:async()=>observed}),f=defect();
  await consume(x,await review(x,v=>add(v,f)),"REPAIR",leases(f));
  await x.owner.requestHealthRepairReview({evidence:"bounded repair submitted",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health"),invalid=verdict(x,offer);
  observed={runId:offer.runId,state:"STOPPED",evidence:"Completed trace retained; original finding omitted",verdict:invalid};
  await x.host.reviewFailure("@health",offer.runId);
  await assert.rejects(x.host.reconcileReview("@health"),/HEALTH_RETRY_DECISION_REQUIRED/);
  const held=(await x.host.snapshot()).health;
  assert.equal(held.enrollment,"REVIEW_RECONCILIATION_REQUIRED");
  assert.equal(held.reviewLease.runId,offer.runId);assert.deepEqual(held.findings,[f]);
  observed.verdict={...invalid,reviewer:"wrong-reviewer"};
  const retry={reviewer:x.config.reviewer,action:"RETRY",evidence:"Independent completed-invalid diagnosis; new dispatch needs its own budget"};
  await assert.rejects(x.host.reconcileReview("@health",retry),/HEALTH_VERDICT_IDENTITY_INVALID/);
  observed.verdict=invalid;
  assert.deepEqual(await x.host.reconcileReview("@health",retry),{action:"REVIEW_DUE",reused:false});
  const current=(await x.host.snapshot()).health;
  assert.deepEqual(current.findings,[f]);assert.equal(current.reviewLease,null);
  assert.equal(current.history.at(-1).validationFailure,"HEALTH_FINDINGS_INVALID");
  assert.deepEqual(current.history.at(-1).observation.verdict,invalid);
});
test("a failed named health repair retains history and cannot get another attempt by restart",async t=>{
  const x=await setup(t),f=defect();await consume(x,await review(x,v=>add(v,f)),"REPAIR",leases(f));
  await x.owner.requestHealthRepairReview({evidence:"first repair claimed",findingIds:[f.id]});
  await review(x,v=>add(v,f));
  const failed=(await x.host.snapshot()).health;
  assert.equal(failed.findings[0].attempts,1);assert.equal(failed.findings[0].lastResult,"FAILED");
  await consume(x,failed.review,"REPAIR",leases(f));
  await assert.rejects(x.owner.requestHealthRepairReview({evidence:"repeat",findingIds:[f.id]}),/NEEDS_DECISION/);
  await x.host.health.authorizeRepairRetry({reviewer:"reviewer",findingId:f.id,fromAttempt:1,
    reviewKey:hash((await x.host.snapshot()).health.review),evidence:"new bounded hypothesis",decision:"One repair"});
  await x.owner.requestHealthRepairReview({evidence:"independent new repair",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health"),r={id:"policy",status:"AVAILABLE",sha256:sha256(await readFile(path.join(x.f.root,"health-policy.md")))};
  const decoded=decodeReviewAnswer({schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["policy"]}],
    newFindings:[],resolutions:[{id:f.id,sourceIds:["policy"],proof:"fixture:actual repaired custody"}]},
    {readbacks:[r],offer,reviewer:"reviewer",observedAt:new Date().toISOString()});
  const v={...verdict(x,offer),...decoded};await x.host.review("@health",offer,v);await consume(x,v);
  const final=(await x.host.snapshot()).health;
  assert.equal(final.findings[0].attempts,2);assert.equal(final.findings[0].status,"CLOSED");
  assert.equal(final.findings[0].evidence,f.evidence);assert.ok(final.history.length>=4);
});
test("repository or source observation loss cannot masquerade as all-green health",async t=>{
  const x=await setup(t);await rm(path.join(x.f.root,".git"),{recursive:true,force:true});
  const offer=await x.host.claimReview("@health");assert.equal(offer.input.repository.status,"LIMITED");
  await assert.rejects(x.host.review("@health",offer,verdict(x,offer)),/REPOSITORY_UNKNOWN/);
});

test("a second repair request cannot overwrite the first pending attempt",async t=>{
  const x=await setup(t),a=defect(),b={...defect(),id:"second-branch"};
  await consume(x,await review(x,v=>{add(v,a);v.findings.push(b);}),"REPAIR",leases(a));
  await x.owner.requestHealthRepairReview({evidence:"repair A",findingIds:[a.id]});
  await assert.rejects(x.owner.requestHealthRepairReview({evidence:"repair B",findingIds:[b.id]}),/ALREADY_PENDING/);
  assert.deepEqual((await x.host.snapshot()).health.repairIds,[a.id]);
});

for(const cause of ["checkpoint","source","periodic","reset"]) {
  test(`owned blocking repair still gets once-only ${cause} consideration with an idle owner`,async t=>{
    const now=Date.now();t.mock.timers.enable({apis:["Date"],now});
    const x=await setup(t,{},cause==="reset"?{cadence:{mode:"OBSERVED_RESET",observer:"allowance",maxObservationAgeMs:60000}}:{});
    const f=defect();await consume(x,await review(x,v=>add(v,f)),"REPAIR",leases(f));
    if(cause==="checkpoint")t.mock.timers.setTime(Date.parse(f.reviewAt)+1);
    if(cause==="source")await x.f.put("health-policy.md","changed health evidence");
    if(cause==="periodic")t.mock.timers.setTime(now+x.config.health.intervalMs+1);
    if(cause==="reset")await x.host.health.recordResetObservation({observer:"allowance",
      observation:{resetAt:now-100,observedAt:now-200,source:"allowance",evidence:"fixture:reset"}});
    const before=(await x.host.snapshot()).health;
    assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
    let calls=0;
    const transport=async offer=>{calls++;const v=verdict(x,offer);add(v,structuredClone(f));return v;};
    await x.host.pause(true);
    assert.equal((await runControlTick(x.host,{review:transport})).calls,0);
    await x.host.pause(false);
    assert.equal((await runControlTick(x.host,{review:transport,maxReviews:0})).calls,0);
    assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
    const ticks=await Promise.all([runControlTick(x.host,{review:transport}),runControlTick(x.host,{review:transport})]);
    assert.equal(ticks.reduce((n,t)=>n+t.calls,0),1);assert.equal(calls,1);
    const h=(await x.host.snapshot()).health;
    assert.deepEqual(h.findings,[f]);assert.deepEqual(h.repairLeases,before.repairLeases);
    assert.deepEqual(h.history.at(-1).disposition,before.disposition);
    await assert.rejects(x.host.health.assertReady("product"),/HEALTH_CONTROL_PENDING/);
    assert.equal((await runControlTick(x.host,{review:transport})).calls,0);
    await consume(x,h.review,"REPAIR",leases(f));
    const restarted=await openControlHost(x.directory,x.config,endpointServices);
    assert.equal((await runControlTick(restarted,{review:transport})).calls,0);
    assert.equal((await restarted.snapshot()).health.enrollment,"REPAIR_DUE");
    assert.equal((await restarted.snapshot()).health.findings[0].attempts,0);
    assert.equal(calls,1);
  });
}

test("failed nonblocking health repair obtains only one current independent retry without changing risk",async t=>{
  const x=await setup(t),f={...defect(),blocksResume:false};
  await consume(x,await review(x,v=>add(v,f)),"REPAIR",leases(f));
  await x.owner.requestHealthRepairReview({evidence:"fixture:attempt one",findingIds:[f.id]});
  await review(x,v=>add(v,f));
  let h=(await x.host.snapshot()).health;
  await consume(x,h.review,"REPAIR",leases(f));
  const host=await openControlHost(x.directory,x.config,endpointServices);
  assert.equal((await host.snapshot()).health.enrollment,"SETTLED");
  await host.health.assertReady("product");
  const request={owner:x.config.owner,evidence:"fixture:changed attempt",findingIds:[f.id]};
  await assert.rejects(host.health.requestRepairReview(request),/NEEDS_DECISION/);
  const decision={reviewer:x.config.reviewer,findingId:f.id,fromAttempt:1,reviewKey:hash(h.review),
    evidence:"fixture:new hypothesis independently checked",decision:"Try changed repair once"};
  for(const bad of [{reviewer:x.config.owner},{fromAttempt:0},{reviewKey:sha256("stale") }])
    await assert.rejects(host.health.authorizeRepairRetry({...decision,...bad}),/RETRY/);
  const store=await openControlStore(x.directory),original=leases(f);
  for(const bad of [[],[{...original[0],owner:"wrong"}],[{...original[0],state:"WAITING",resumeWhen:"owner returns"}]]) {
    await store.transact(s=>{s.health.repairLeases=bad;return s;});
    await assert.rejects(host.health.authorizeRepairRetry(decision),/RETRY_INVALID/);
  }
  await store.transact(s=>{s.health.repairLeases=original;return s;});
  const decisions=await Promise.allSettled([host.health.authorizeRepairRetry(decision),host.health.authorizeRepairRetry(decision)]);
  assert.equal(decisions.filter(r=>r.status==="fulfilled").length,1);
  await assert.rejects(host.health.authorizeRepairRetry(decision),/RETRY_INVALID/);
  await host.health.requestRepairReview(request);
  await assert.rejects(host.health.requestRepairReview(request),/ALREADY_PENDING/);
  const offer=await host.claimReview("@health"),v=verdict(x,offer);add(v,structuredClone(offer.input.previousFindings[0]));
  await host.review("@health",offer,v);
  h=(await host.snapshot()).health;
  assert.equal(h.findings[0].attempts,2);assert.equal(h.findings[0].blocksResume,false);
  assert.equal(h.findings[0].retryDecisions.length,1);
  await assert.rejects(host.review("@health",offer,v),/SOURCE_CHANGED/);
  await consume(x,h.review,"REPAIR",leases(f));
  await host.health.assertReady("product");
  await assert.rejects(host.health.requestRepairReview(request),/NEEDS_DECISION/);
  await assert.rejects(host.health.authorizeRepairRetry(decision),/RETRY_INVALID/);
});
test("same-count branch replacement is a new custody trigger",async t=>{
  const x=await setup(t);git(x.f.root,["branch","old-experiment"]);await consume(x,await review(x));
  git(x.f.root,["branch","-m","old-experiment","replacement"]);
  assert.equal((await x.host.due())[0]?.action,"REVIEW_DUE");
});
test("ordinary commits do not continuously redispatch health when custody identities are unchanged",async t=>{
  const x=await setup(t);git(x.f.root,["branch","owned-experiment"]);await consume(x,await review(x));
  git(x.f.root,["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","commit","--quiet","--allow-empty","-m","ordinary progress"]);
  assert.deepEqual(await x.host.due(),[]);
});
test("observed reset cadence is durable, visible when unknown, and never refills the model budget",async t=>{
  const x=await setup(t,{}, {cadence:{mode:"OBSERVED_RESET",observer:"allowance-observer",maxObservationAgeMs:86400000}});
  await consume(x,await review(x));
  const missing=await x.host.due();assert.equal(missing[0].action,"CADENCE_OBSERVATION_DUE");
  assert.equal(missing[0].followup.owner,"allowance-observer");
  await x.host.health.assertReady("product");
  let calls=0;await runControlTick(x.host,{review:()=>{calls++;}});assert.equal(calls,0);
  const now=Date.now(),observation={observedAt:now-2000,resetAt:now-1000,source:"fixture:allowance-metadata",evidence:"observed window boundary"};
  await assert.rejects(x.host.health.recordResetObservation({observer:"owner",observation}),/OBSERVER_REQUIRED/);
  await x.host.health.recordResetObservation({observer:"allowance-observer",observation});
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  const offer=await x.host.claimReview("@health");
  await assert.rejects(x.host.health.recordResetObservation({observer:"allowance-observer",observation}),/IN_FLIGHT/);
  const v=verdict(x,offer);await x.host.review("@health",offer,v);await consume(x,v);
  assert.deepEqual(await x.host.due(),[]);
  assert.equal((await x.host.health.cadence()).periodic.status,"COMPLETED");
  const again=await openControlHost(x.directory,x.config,endpointServices);
  assert.deepEqual(await again.due(),[]);
  await x.host.health.recordResetObservation({observer:"allowance-observer",observation:{...observation,observedAt:now,resetAt:now+3600000}});
  assert.equal((await again.health.cadence()).periodic.status,"WAITING");
  git(x.f.root,["branch","new-unowned-branch"]);
  assert.equal((await again.due())[0].action,"REVIEW_DUE");
  await again.pause(true);assert.deepEqual(await again.due(),[]);
  assert.equal((await again.health.cadence()).status,"PAUSED");
});
test("an unregistered dirty file changing bytes invalidates in-flight health evidence",async t=>{
  const x=await setup(t);await x.f.put("dirty.txt","first");
  const offer=await x.host.claimReview("@health");await x.f.put("dirty.txt","other");
  await assert.rejects(x.host.review("@health",offer,verdict(x,offer)),/SOURCE_CHANGED/);
});
test("new reset metadata during pause cannot erase an already due reset",async t=>{
  const x=await setup(t,{}, {cadence:{mode:"OBSERVED_RESET",observer:"allowance",maxObservationAgeMs:86400000}});
  await consume(x,await review(x));const now=Date.now(),resetAt=now-1000;
  await x.host.health.recordResetObservation({observer:"allowance",observation:{resetAt,observedAt:now-2000,source:"allowance",evidence:"R1"}});
  assert.equal((await x.host.due())[0].action,"REVIEW_DUE");
  await x.host.pause(true);
  await x.host.health.recordResetObservation({observer:"allowance",observation:{resetAt:now+3600000,observedAt:now,source:"allowance",evidence:"R2"}});
  await x.host.pause(false);
  const again=await openControlHost(x.directory,x.config,endpointServices);
  assert.equal((await again.due())[0].action,"REVIEW_DUE");
  await again.health.assertReady("product");
  assert.equal((await again.due())[0].action,"REVIEW_DUE");
  await consume(x,await review(x));
  assert.equal((await again.snapshot()).health.completedResetEpoch,resetAt);
  assert.equal((await again.health.cadence()).periodic.status,"WAITING");
});
test("a reset remains attached through blocking repair and observation expiry",async t=>{
  const now=Date.now();t.mock.timers.enable({apis:["Date"],now});
  const x=await setup(t,{}, {cadence:{mode:"OBSERVED_RESET",observer:"allowance",maxObservationAgeMs:1000}});
  await consume(x,await review(x));const resetAt=now-100;
  await x.host.health.recordResetObservation({observer:"allowance",observation:{resetAt,observedAt:now-200,source:"allowance",evidence:"R1"}});
  const f=defect();await consume(x,await review(x,v=>add(v,f)),"REPAIR",leases(f));
  t.mock.timers.setTime(now+2000);
  await x.owner.requestHealthRepairReview({evidence:"bounded custody repair",findingIds:[f.id]});
  const offer=await x.host.claimReview("@health");
  const r={id:"policy",status:"AVAILABLE",sha256:sha256(await readFile(path.join(x.f.root,"health-policy.md")))};
  const decoded=decodeReviewAnswer({schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["policy"]}],
    newFindings:[],resolutions:[{id:f.id,sourceIds:["policy"],proof:"fixture:repaired custody"}]},
    {readbacks:[r],offer,reviewer:"reviewer",observedAt:new Date().toISOString()});
  const v={...verdict(x,offer),...decoded};await x.host.review("@health",offer,v);await consume(x,v);
  assert.equal((await x.host.snapshot()).health.completedResetEpoch,resetAt);
  assert.equal((await x.host.snapshot()).health.pendingResetEpoch,null);
  assert.equal((await x.host.due())[0].action,"CADENCE_OBSERVATION_DUE");
  t.mock.timers.setTime(now+500);
  assert.deepEqual(await x.host.due(),[]);
});
test("reset crossing during an independent review does not mutate its offered state",async t=>{
  const now=Date.now();t.mock.timers.enable({apis:["Date"],now});
  const x=await setup(t,{}, {cadence:{mode:"OBSERVED_RESET",observer:"allowance",maxObservationAgeMs:10000}});
  await x.host.health.recordResetObservation({observer:"allowance",observation:{resetAt:now+1000,observedAt:now,source:"allowance",evidence:"R1"}});
  const offer=await x.host.claimReview("@health"),before=await x.host.snapshot();
  t.mock.timers.setTime(now+2000);
  assert.equal((await x.host.due())[0].action,"REVIEW_IN_FLIGHT");
  assert.deepEqual(await x.host.snapshot(),before);
  await x.host.review("@health",offer,verdict(x,offer));
});

test("compact owner view preserves every finding and criterion while grouping repair ownership",async t=>{
  const x=await setup(t),a=defect(),b={...defect(),id:"second",reviewAt:new Date(Date.now()+1800000).toISOString()};
  await review(x,v=>{add(v,a);v.findings.push(b);});
  await assert.rejects(x.owner.respond("@health",{owner:"owner",action:"REPAIR",evidence:"not read"},leases(b)),/READBACK_REQUIRED/);
  const full=await x.owner.readVerdict("@health"),compact=compactOwnerVerdict(full);
  assert.deepEqual(compact.findings,full.verdict.findings);
  assert.deepEqual(Object.values(compact.criteriaByStatus).flat().sort(),[...controlCheckIds].sort());
  assert.equal(compact.repairGroups.length,1);assert.equal(compact.repairGroups[0].reviewAt,b.reviewAt);
  assert.deepEqual(compact.repairGroups[0].findingIds,[a.id,b.id]);
  assert.equal(compact.reviewKey,hash(full.verdict));
  await assert.rejects(x.owner.respond("@health",{owner:"owner",reviewKey:"0".repeat(64),action:"REPAIR",evidence:"wrong hash"},leases(b)),/READBACK_REQUIRED/);
  await assert.rejects(x.owner.respond("@health",{owner:"owner",action:"REPAIR",evidence:"duplicate leases"},[...leases(b),...leases(b)]),/REPAIR_OWNER_REQUIRED/);
  assert.equal((await x.owner.respond("@health",{owner:"owner",action:"REPAIR",evidence:"host-bound readback"},leases(b))).action,"REPAIR_DUE");
  const saved=(await x.host.snapshot()).health;
  assert.equal(saved.disposition.reviewKey,full.reviewKey);assert.deepEqual(saved.findings,full.verdict.findings);
  await assert.rejects(x.owner.respond("@health",{owner:"owner",action:"REPAIR",evidence:"replay"},leases(b)),/READBACK_REQUIRED/);
});

test("native scheduled health review runs without a product acceptance and shares a retained finite allocation",
 {skip:!process.env.VYDYKHAI_CODEX_BINARY||process.platform!=="darwin",timeout:30000},async t=>{
  const x=await setup(t),dirs={};
  for(const id of ["review-state","home","review-room"]) {dirs[id]=path.join(x.privateRoot,id);await mkdir(dirs[id],{mode:0o700});}
  const provider=await nativeProvider(t,async n=>n===1?codeItem("const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[t.name]({id:'policy'}));"):
    answerItem({schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["policy"]}],newFindings:[],resolutions:[]}));
  const profile={schema:"control.service.v1",directory:x.directory,config:x.config,maxReviewsPerTick:1,timeoutMs:16000,
    review:{directory:dirs["review-state"],controlRoot:x.privateRoot,reviewer:"reviewer",sourceFile:x.sourceFile,maxCalls:1,
      expiresAt:new Date(Date.now()+120000).toISOString(),scope:{kind:"synthetic-protocol-not-semantic-health-proof"},
      native:{binary:process.env.VYDYKHAI_CODEX_BINARY,workspace:dirs["review-room"],home:dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider}}};
  const service=await openControlService(profile);await service.review.initialize();
  const ticks=await runControlService(service,{ticks:2,intervalMs:1});
  assert.deepEqual(ticks.map(r=>r.calls),[1,0]);assert.equal(ticks[1].inbox[0].id,"@health");
  const state=await service.host.snapshot();assert.equal(state.health.review.phase,"HEALTH");assert.deepEqual(state.acceptances,{});
  const read=await service.owner.readVerdict("@health");
  await service.owner.respond("@health",{owner:"owner",action:"CONTINUE",reviewKey:read.reviewKey,evidence:"fixture:current health applied"});
  const reopened=await openControlService(profile);assert.deepEqual(await reopened.host.due(),[]);
  const applied=(await reopened.host.snapshot()).health.disposition;
  git(x.f.root,["branch","another-experiment"]);
  const exhausted=await reopened.tick();assert.equal(exhausted.calls,0);assert.equal(exhausted.inbox[0].action,"REVIEW_DUE");
  assert.equal(provider.requests.length,2);await reopened.host.health.assertReady("product");
  assert.equal((await reopened.host.due())[0].action,"REVIEW_DUE");
  assert.deepEqual((await reopened.host.snapshot()).health.disposition,applied);
});
