import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { evaluateTaskDisposition } from "../scripts/task-continuity.mjs";
import { runContextTransition } from "../scripts/context-run.mjs";
import { fixture } from "./context-fixture.mjs";
import { evaluateProductionContinuation, readProductionContinuation } from "../scripts/vydykhai.mjs";
const receipt = () => ({boundary:"task-disposition",work:"task",owner:"owner",revision:"revision",
  candidate:"candidate",plan:"plan",authority:"authority",ledger:"ledger",action:"execute",
  pause:"CLEARED",effects:"RECONCILED",authors:["worker"],maxAttempts:3,maxEscalations:1,attempts:[],
  budget:{unit:"tokens",limit:1000,spent:10,reserved:0,next:100,reviewReserve:100},
  next:{hypothesis:"changed",check:"check",reason:"facts",escalated:false},
  review:{required:true,triggers:["no-progress"],basis:"source",dispatch:"dispatch",
    verdict:{id:"verdict",reviewer:"reviewer",evidence:"originals",work:"task",revision:"revision",
      candidate:"candidate",plan:"plan",ledger:"ledger",decision:"CORRECT",gap:"missing dependency",check:"check"},
    application:{verdict:"verdict",owner:"owner",evidence:"applied"}}});
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
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  r.effects="UNKNOWN"; assert.equal(evaluateTaskDisposition(r).status,"OUTCOME_UNKNOWN");
  r.action="halt"; delete r.review;
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
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
test("enrolled reference runner refuses absent verdict before actual command and allows bounded correction", async t => {
  const f=await fixture(t); await f.prepare();
  const r=receipt(); r.work=f.task.id; r.owner=f.task.owner; r.revision=f.request.task.sha256;
  Object.assign(r.review.verdict,{work:r.work,revision:r.revision}); r.review.application.owner=r.owner;
  const request={...f.request,operation:"resume"};
  const services={dispositionRequired:true,readTaskDisposition:async()=>r};
  const saved=r.review.verdict; delete r.review.verdict;
  const held=await runContextTransition(request,services);
  assert.equal(held.code,"TASK_DISPOSITION_HELD"); assert.equal(held.stats.commands,0);
  await assert.rejects(readFile(path.join(f.root,"actions.log")),{code:"ENOENT"});
  r.review.verdict=saved;
  const done=await runContextTransition(request,services);
  assert.equal(done.status,"ACTION_COMPLETED",JSON.stringify(done));
  assert.equal(done.stats.dependentCommands,1);
  r.budget.spent=r.budget.limit;
  const stopped=await runContextTransition(request,services);
  assert.equal(stopped.code,"TASK_DISPOSITION_HELD"); assert.equal(stopped.stats.commands,0);
});
test("activity cannot treat stale revision or delivered consultation as execution clearance", () => {
  const r=receipt();
  const next={schemaVersion:1,id:"next",work:"task",owner:"owner",state:"WORKING",action:"correct",evidence:"source"};
  const state='Orchestrator health: HEALTHY | Context: manager | Profile: low\n## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n| task | WORKING | owner |\n## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n<!-- vydykhai:project-state:end -->';
  const common={work:"task",revision:"revision",checkpoint:"saved",humanEvent:"event",contextEpoch:"epoch"};
  const now=Date.now();
  const activity={schemaVersion:1,continuationKey:readProductionContinuation(state).key,observedAt:new Date(now).toISOString(),
    orchestrator:{context:"manager",status:"IDLE",evidence:"native"},
    owner:{context:"owner",status:"ACTIVE",turnId:"turn",evidence:"native",dispositionRequired:true,disposition:r,
      taskIdentity:{schemaVersion:1,current:{...common,owner:"owner",evidence:"current"},
        seen:{...common,turnId:"turn",evidence:"readback"},failedRestorations:[]}}};
  assert.equal(evaluateProductionContinuation(state,activity,{now}).coverage,"COVERED");
  activity.owner.taskIdentity.current.revision=activity.owner.taskIdentity.seen.revision="new";
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_DISPOSITION");
  activity.owner.taskIdentity.current.revision=activity.owner.taskIdentity.seen.revision="revision";
  r.action="handoff"; r.review.verdict.decision="CONSULT"; r.review.verdict.reason="scope";
  r.handoff={retained:"artifact",alternatives:"options",decisionNeeded:"scope",resumeWhen:"decision",delivered:"receipt"};
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_DISPOSITION");
});
