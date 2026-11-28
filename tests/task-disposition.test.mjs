import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { evaluateTaskDisposition, evaluateWorkRouting } from "../scripts/task-continuity.mjs";
import { runContextTransition } from "../scripts/context-run.mjs";
import { fixture } from "./context-fixture.mjs";
import { assignment } from "./assignment-fixture.mjs";
import { evaluateProductionContinuation, readProductionContinuation } from "../scripts/vydykhai.mjs";
const receipt = () => { const r = {boundary:"task-disposition",work:"task",owner:"owner",revision:"revision",
  candidate:"candidate",plan:"plan",authority:"authority",ledger:"ledger",action:"execute",
  pause:"CLEARED",effects:"RECONCILED",authors:["worker"],maxAttempts:3,maxEscalations:1,attempts:[],
  budget:{unit:"tokens",limit:1000,spent:10,reserved:0,next:100,reviewReserve:100},
  next:{hypothesis:"changed",check:"check",reason:"facts",escalated:false},
  review:{required:true,triggers:["no-progress"],basis:"source",dispatch:"dispatch",
    verdict:{id:"verdict",reviewer:"reviewer",evidence:"originals",work:"task",revision:"revision",
      candidate:"candidate",plan:"plan",ledger:"ledger",decision:"CORRECT",gap:"missing dependency",check:"check"},
    application:{verdict:"verdict",owner:"owner",evidence:"applied"}}};
  r.assignment=assignment(r); return r; };

const unsuccessful = id => ({id,hypothesis:"different-"+id,evidence:"original-"+id,outcome:"failed",escalated:false});

const preparationRoute = r => ({boundary:"work-routing",work:r.work,revision:r.revision,
  orchestrator:"manager",actor:r.owner,operation:"lookup",evidenceNeed:"named-fact",
  purpose:"Recover the accepted dependency version",source:"release-index",
  expectedOutput:"Version and original locator",question:"Which version was accepted?",
  stopWhen:"The accepted entry is found or the index cannot answer",
  preparation:{gap:"fact",readOnly:true,affectedOperation:"verify dependency",
    retained:"existing candidate",parent:{work:r.work,revision:r.revision,owner:r.owner,
      authority:r.authority,evidence:"accepted lease",sources:["release-index"]}}});
const factualDelta = {fact:"Version 2 is accepted",source:"release-index",locator:"release-index.md:12"};
const enrollPreparation = r => {
  const lookup=preparationRoute(r);
  r.routingRequired=true;
  r.routing={...lookup,operation:"implement",evidenceNeed:"ready",purpose:"Complete the assignment"};
  delete r.routing.preparation;
  r.assignment.preparationSources=["release-index"];
  r.assignment.preparationEvidence=lookup;
  return lookup;
};

test("scoped preparation stays with the parent worker and a sourced delta unblocks the existing route", () => {
  const r=receipt(), evidence=enrollPreparation(r);
  r.review={required:false,triggers:[],basis:"ordinary execution"};
  const lookup=evaluateWorkRouting(evidence);
  assert.equal(lookup.route,"WORKER_PREPARATION");
  assert.equal(lookup.status,"PASS");
  assert.equal(lookup.executionProven,false);
  assert.equal(lookup.replayAuthorized,false);
  assert.match(evaluateTaskDisposition(r).reason,/complete the scoped lookup/);
  evidence.preparation.delta=factualDelta;
  const result=evaluateTaskDisposition(r);
  assert.equal(result.status,"PASS");
  assert.equal(result.productAccepted,false);
});

test("material gaps and mismatched custody or source cannot use worker preparation", () => {
  const r=receipt(); enrollPreparation(r);
  for (const gap of ["boundary","contract","conflict","safety","authority"]) {
    const route=preparationRoute(r); route.preparation.gap=gap;
    const out=evaluateWorkRouting(route);
    assert.equal(out.status,"HELD",gap);
    assert.equal(out.route,"OWNER_DECISION",gap);
  }
  for (const mutate of [p=>p.parent.work="other",p=>p.parent.owner="helper",
    p=>p.parent.revision="old",p=>p.parent.authority="old",p=>p.parent.sources=["private"],
    p=>p.readOnly=false,p=>p.delta={...factualDelta,source:"private"},p=>delete p.delta.locator]) {
    const evidence=r.assignment.preparationEvidence=preparationRoute(r);
    evidence.preparation.delta={...factualDelta};
    mutate(evidence.preparation);
    assert.notEqual(evaluateTaskDisposition(r).status,"PASS",mutate.toString());
  }
  const evidence=r.assignment.preparationEvidence=preparationRoute(r);
  evidence.source="private";
  evidence.preparation.parent.sources=["private"];
  evidence.preparation.delta={...factualDelta,source:"private"};
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  delete r.assignment.preparationSources;
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
});

test("preparation cannot reset no-progress history or act as final independent acceptance", () => {
  const r=receipt(), evidence=enrollPreparation(r);
  evidence.preparation.delta=factualDelta;
  r.attempts=[unsuccessful("one"),unsuccessful("two")];
  assert.match(evaluateTaskDisposition(r).reason,/outcome stagnation/);
  r.next.reframe=reframeFor(r);
  delete r.review.dispatch;
  assert.match(evaluateTaskDisposition(r).reason,/independent verdict/);
});

const reframeFor = r => ({evidence:"existing-brief/reframe",outcome:"remaining DOD",preserved:"accepted candidate",
  change:"repair the consumer boundary, not another producer rewrite",attemptIds:r.attempts.filter(a=>a.outcome==="failed").map(a=>a.id),check:r.next.check});

test("operational repair: different failures without outcome progress need one existing-brief reframe", () => {
  const r=receipt();r.attempts=[unsuccessful("one"),unsuccessful("two")];
  const out=evaluateTaskDisposition(r);
  assert.equal(out.status,"UNVERIFIED");assert.match(out.reason,/outcome stagnation/);
  r.next.reframe=reframeFor(r);
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
});

test("operational repair: reframe cannot omit a failure or change its discriminating check", () => {
  const r=receipt();r.attempts=[unsuccessful("one"),unsuccessful("two")];r.next.reframe=reframeFor(r);
  r.next.reframe.attemptIds=["two"];
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  r.next.reframe=reframeFor(r);r.next.reframe.check="another-check";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
});

test("operational repair: a verified DOD criterion is progress, not whole-product acceptance", () => {
  const r=receipt();r.attempts=[unsuccessful("one"),{...unsuccessful("two"),progressEvidence:"accepted-DOD-criterion-saved-and-reopened"}];
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
  r.attempts[1].progressEvidence="";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
});

test("operational repair: a success label alone cannot erase unresolved outcome stagnation", () => {
  const r=receipt();r.maxAttempts=4;
  r.attempts=[unsuccessful("one"),{...unsuccessful("local"),outcome:"succeeded"},unsuccessful("two")];
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
});

test("operational repair: reframe neither clears unknown effects nor renews the task allowance", () => {
  const r=receipt();r.attempts=[unsuccessful("one"),unsuccessful("two")];r.next.reframe=reframeFor(r);
  r.effects="UNKNOWN";
  assert.equal(evaluateTaskDisposition(r).status,"OUTCOME_UNKNOWN");
  r.effects="RECONCILED";r.budget.spent=950;
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
});
test("disposition needs current independent verdict and its application, not dispatch", () => {
  assert.equal(evaluateTaskDisposition(receipt()).status,"PASS");
  for (const mutate of [r=>delete r.review.verdict, r=>delete r.review.application,
    r=>r.review.verdict.plan="old",r=>r.review.verdict.reviewer="worker",
    r=>r.review.required=false,r=>r.review.verdict.check="other"]) {
    const r=receipt(); mutate(r); assert.notEqual(evaluateTaskDisposition(r).status,"PASS");
  }
});
test("review cannot refill budget, repeat a failed approach or upgrade an environment failure", () => {
  const r=receipt(); r.budget.spent=900;
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  r.budget.spent=10; r.attempts=[{id:"one",hypothesis:"changed",evidence:"failed",outcome:"failed",escalated:false}];
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  r.next.hypothesis="different"; r.next.escalated=true; r.cause="environment";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  r.cause="capability"; assert.equal(evaluateTaskDisposition(r).status,"PASS");
  r.maxAttempts=1; assert.equal(evaluateTaskDisposition(r).status,"HELD");
  r.owner="fresh-chat"; assert.notEqual(evaluateTaskDisposition(r).status,"PASS");
});
test("pause and unknown effects hold; hard halt needs no reviewer", () => {
  const r=receipt(); r.pause="ACTIVE";
  r.assignment.directions[0].kind="PAUSE";
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  r.effects="UNKNOWN"; assert.equal(evaluateTaskDisposition(r).status,"OUTCOME_UNKNOWN");
  r.action="halt"; delete r.review;
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
});
test("unknown attempt retains reconciliation precedence over missing route", () => {
  const r=receipt();r.routingRequired=true;
  r.attempts=[{id:"unknown",hypothesis:"hypothesis",evidence:"partial",outcome:"unknown",escalated:false}];
  assert.equal(evaluateTaskDisposition(r).status,"OUTCOME_UNKNOWN");
});
test("delivered consultation is not product acceptance; success needs product proof", () => {
  const r=receipt(); r.action="handoff"; r.review.verdict.decision="CONSULT"; r.review.verdict.reason="scope decision";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  r.handoff={retained:"artifact",alternatives:"options",decisionNeeded:"scope",resumeWhen:"decision",delivered:"receipt"};
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
  r.action="accept"; r.review.verdict.decision="ACCEPT";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  r.acceptanceEvidence="actual DOD"; assert.equal(evaluateTaskDisposition(r).productAccepted,true);
});
test("enrolled preparation survives actual execution and required independent acceptance", async t => {
  const f=await fixture(t); await f.prepare();
  const r=receipt(); r.work=f.task.id; r.owner=f.task.owner; r.revision=f.request.task.sha256;
  r.assignment=assignment(r);
  Object.assign(r.review.verdict,{work:r.work,revision:r.revision}); r.review.application.owner=r.owner;
  const request={...f.request,operation:"resume"};
  const evidence=enrollPreparation(r);
  evidence.preparation.delta=factualDelta;
  const services={dispositionRequired:true,routingRequired:true,readTaskDisposition:async()=>r,
    orchestrator:r.routing.orchestrator,readWorkRouting:async()=>r.routing};
  const saved=r.review.verdict; delete r.review.verdict;
  const held=await runContextTransition(request,services);
  assert.equal(held.code,"TASK_DISPOSITION_HELD"); assert.equal(held.stats.commands,0);
  await assert.rejects(readFile(path.join(f.root,"actions.log")),{code:"ENOENT"});
  r.review.verdict=saved;
  delete evidence.preparation.delta;
  const pending=await runContextTransition(request,services);
  assert.equal(pending.code,"TASK_DISPOSITION_HELD");
  assert.equal(pending.stats.commands,0);
  evidence.preparation.delta=factualDelta;
  const done=await runContextTransition(request,services);
  assert.equal(done.status,"ACTION_COMPLETED",JSON.stringify(done));
  assert.equal(done.stats.dependentCommands,1);
  r.budget.spent=r.budget.limit;
  const stopped=await runContextTransition(request,services);
  assert.equal(stopped.code,"TASK_DISPOSITION_HELD"); assert.equal(stopped.stats.commands,0);
  r.action="accept";
  r.routing={...r.routing,operation:"verify",purpose:"Verify the whole candidate"};
  assert.equal(await readFile(path.join(f.root,"actions.log"),"utf8"),"called\n");
  r.acceptanceEvidence="actions.log:1";
  r.review.triggers=["acceptance"];
  delete r.review.verdict;
  assert.match(evaluateTaskDisposition(r).reason,/independent verdict/);
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
  r.review.verdict={...saved,id:"final-verdict",decision:"ACCEPT"};
  r.review.application={...r.review.application,verdict:"final-verdict"};
  assert.equal(evaluateTaskDisposition({...r,routing:evidence}).productAccepted,false);
  assert.equal(evaluateTaskDisposition({...r,routing:undefined}).productAccepted,false);
  assert.equal(evaluateTaskDisposition(r).productAccepted,true);
});
test("activity cannot treat stale revision or delivered consultation as execution clearance", () => {
  const r=receipt();
  const next={schemaVersion:1,id:"next",work:"task",owner:"owner",state:"WORKING",action:"correct",evidence:"source"};
  const state='Orchestrator health: HEALTHY | Context: manager | Profile: low\n## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n| task | WORKING | owner |\n## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n<!-- vydykhai:project-state:end -->';
  const common={work:"task",revision:"revision",checkpoint:"saved",humanEvent:"authority",contextEpoch:"epoch"};
  const now=Date.now();
  const activity={schemaVersion:1,continuationKey:readProductionContinuation(state).key,observedAt:new Date(now).toISOString(),
    orchestrator:{context:"manager",status:"IDLE",evidence:"native"},
    owner:{context:"owner",status:"ACTIVE",turnId:"turn",evidence:"native",dispositionRequired:true,disposition:r,
      taskIdentity:{schemaVersion:1,current:{...common,owner:"owner",evidence:"current"},
        seen:{...common,turnId:"turn",evidence:"readback"},failedRestorations:[]}}};
  assert.equal(evaluateProductionContinuation(state,activity,{now}).coverage,"COVERED");
  activity.owner.taskIdentity.current.contextEpoch="restored-epoch";
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_DISPOSITION");
  activity.owner.taskIdentity.current.contextEpoch="epoch";
  activity.owner.taskIdentity.current.revision=activity.owner.taskIdentity.seen.revision="new";
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_DISPOSITION");
  activity.owner.taskIdentity.current.revision=activity.owner.taskIdentity.seen.revision="revision";
  r.action="handoff"; r.review.verdict.decision="CONSULT"; r.review.verdict.reason="scope";
  r.handoff={retained:"artifact",alternatives:"options",decisionNeeded:"scope",resumeWhen:"decision",delivered:"receipt"};
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_DISPOSITION");
});
test("terminal result and blocker survive missing route without bypassing old disposition checks", () => {
  const r=receipt();r.routingRequired=true;
  const next={schemaVersion:1,id:"next",work:r.work,owner:r.owner,state:"WORKING",action:"inspect",evidence:"brief"};
  const state='Orchestrator health: HEALTHY | Context: manager | Profile: low\n## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n| task | WORKING | owner |\n## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n<!-- vydykhai:project-state:end -->';
  const common={work:r.work,revision:r.revision,checkpoint:"saved",humanEvent:r.authority,contextEpoch:r.assignment.contextEpoch};
  const now=Date.now();
  const activity={schemaVersion:1,continuationKey:readProductionContinuation(state).key,observedAt:new Date(now).toISOString(),
    orchestrator:{context:"manager",status:"IDLE",evidence:"native"},
    owner:{context:r.owner,status:"IDLE",turnId:"turn",evidence:"native",dispositionRequired:true,disposition:r,
      terminal:{turnId:"turn",status:"RESULT",evidence:"outbox-result"},
      taskIdentity:{schemaVersion:1,current:{...common,owner:r.owner,evidence:"current"},
        seen:{...common,turnId:"turn",evidence:"readback"},failedRestorations:[]}}};
  const assess=()=>evaluateProductionContinuation(state,activity,{now});
  assert.equal(assess().nextAction,"RECONCILE_RESULT");
  activity.owner.terminal={turnId:"turn",status:"BLOCKED",evidence:"outbox-blocker",resumeWhen:"access restored"};
  assert.equal(assess().nextAction,"RESOLVE_BLOCKER");
  r.effects="UNKNOWN";
  assert.equal(assess().nextAction,"RECONCILE_DISPOSITION");
  assert.equal(evaluateTaskDisposition(r).replayAuthorized,false);
});
test("existing runner applies enrolled routing before commands, without another controller", async t => {
  const f=await fixture(t);await f.prepare();
  const r=receipt();Object.assign(r,{work:f.task.id,owner:f.task.owner,revision:f.request.task.sha256,routingRequired:true});
  r.assignment=assignment(r);Object.assign(r.review.verdict,{work:r.work,revision:r.revision});r.review.application.owner=r.owner;
  const services={dispositionRequired:true,readTaskDisposition:async()=>r};
  const request={...f.request,operation:"resume"};
  let result=await runContextTransition(request,services);
  assert.equal(result.code,"TASK_DISPOSITION_HELD");assert.equal(result.stats.commands,0);
  r.routing={boundary:"work-routing",work:r.work,revision:r.revision,orchestrator:r.owner,actor:r.owner,
    purpose:"Obtain missing facts",source:"saved sources",expectedOutput:"Evidence and limits",
    operation:"investigate",evidenceNeed:"investigation"};
  result=await runContextTransition(request,services);
  assert.equal(result.code,"TASK_DISPOSITION_HELD");assert.equal(result.stats.commands,0);
  await assert.rejects(readFile(path.join(f.root,"actions.log")),{code:"ENOENT"});
  r.routing.orchestrator="separate-manager";
  result=await runContextTransition(request,services);
  assert.equal(result.code,"WORK_ROUTING_UNAVAILABLE");assert.equal(result.stats.commands,0);
  services.routingRequired=true;services.orchestrator="separate-manager";
  const accepted=structuredClone(r.routing);services.readWorkRouting=async()=>accepted;
  r.routing.expectedOutput="different work";
  result=await runContextTransition(request,services);
  assert.equal(result.code,"WORK_ROUTING_BINDING_MISMATCH");assert.equal(result.stats.commands,0);
  r.routing.expectedOutput=accepted.expectedOutput;
  result=await runContextTransition(request,services);
  assert.equal(result.status,"ACTION_COMPLETED",JSON.stringify(result));
  assert.equal(result.stats.dependentCommands,1);
});
test("runner verification cannot execute in manager under a control label or spoofed root", async t => {
  const f=await fixture(t);await f.prepare();
  const r=receipt();Object.assign(r,{work:f.task.id,owner:f.task.owner,revision:f.request.task.sha256});
  r.assignment=assignment(r);Object.assign(r.review.verdict,{work:r.work,revision:r.revision});r.review.application.owner=r.owner;
  const accepted={boundary:"work-routing",work:r.work,revision:r.revision,actor:r.owner,orchestrator:r.owner,
    purpose:"Accept",source:"saved",expectedOutput:"acceptance",operation:"decide",evidenceNeed:"ready"};
  r.routing=structuredClone(accepted);
  const services={routingRequired:true,orchestrator:r.owner,readTaskDisposition:async()=>r,readWorkRouting:async()=>accepted};
  const request={...f.request,operation:"accept"};
  let result=await runContextTransition(request,services);
  assert.equal(result.code,"WORK_ROUTING_HELD");assert.equal(result.stats.commands,0);
  accepted.orchestrator=r.routing.orchestrator="fake-manager";
  result=await runContextTransition(request,services);
  assert.equal(result.code,"WORK_ROUTING_HELD");assert.equal(result.stats.commands,0);
  await assert.rejects(readFile(path.join(f.root,"verifications.log")),{code:"ENOENT"});
});
