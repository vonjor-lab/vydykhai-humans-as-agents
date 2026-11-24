import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { evaluateWorkRouting, evaluateProductionContinuation, readProductionContinuation,
  evaluateLeaseActivity, readLeaseActivityScope } from "../scripts/vydykhai.mjs";

const route = (changes = {}) => ({boundary:"work-routing",work:"task",revision:"brief",
  orchestrator:"manager",actor:"manager",purpose:"Choose the next useful outcome",
  source:"accepted-return@revision",expectedOutput:"Decision and next owner",
  operation:"decide",evidenceNeed:"ready",...changes});

for (const operation of ["decide","coordinate","publish-state"]) test(`ready ${operation} stays in control context`, () => {
  const r = evaluateWorkRouting(route({operation}));
  assert.equal(r.status,"PASS"); assert.equal(r.route,"CONTROL_CONTEXT");
  assert.equal(r.executionProven,false); assert.equal(r.replayAuthorized,false);
  assert.equal(r.assurance,"DECLARED_EVIDENCE_ONLY");
});

test("named fact allows direct lookup, but an expanding search needs focused work", () => {
  const r = route({operation:"lookup",evidenceNeed:"named-fact",question:"Which accepted revision?",
    stopWhen:"Source cannot answer or a survey is needed; retain findings and route remainder"});
  assert.equal(evaluateWorkRouting(r).status,"PASS");
  delete r.stopWhen;
  assert.equal(evaluateWorkRouting(r).status,"UNVERIFIED");
  r.evidenceNeed="investigation";r.operation="investigate";
  assert.equal(evaluateWorkRouting(r).route,"FOCUSED_CONTEXT");
  assert.equal(evaluateWorkRouting(r).status,"MISMATCH");
});

for (const operation of ["investigate","implement","verify"]) test(`${operation} needs an executor even with ready inputs`, () => {
  const r = route({operation});
  assert.equal(evaluateWorkRouting(r).status,"MISMATCH");
  r.actor="existing-owner";
  assert.equal(evaluateWorkRouting(r).status,"PASS");
  assert.equal(evaluateWorkRouting(r).executionProven,false);
});

test("a management label cannot hide a declared need for investigation", () => {
  for (const purpose of ["Read-only inventory", "Review many documents", "Visual acceptance", "Find missing module facts"]) {
    assert.equal(evaluateWorkRouting(route({purpose,evidenceNeed:"investigation"})).status,"MISMATCH");
  }
});

test("missing, malformed and stale route fields fail without granting authority", () => {
  for (const v of [null,{},route({source:""}),route({operation:"shell"}),route({evidenceNeed:"probably-ready"}),
    route({operation:"lookup"}),route({evidenceNeed:"named-fact"}),
    route({actor:"worker",operation:"lookup",evidenceNeed:"investigation"})]) {
    assert.equal(evaluateWorkRouting(v).status,"UNVERIFIED");
  }
  for (const field of ["work","revision","actor","orchestrator"]) {
    assert.equal(evaluateWorkRouting(route(),{[field]:"other"}).status,"MISMATCH");
    assert.equal(evaluateWorkRouting(route(),{[field]:undefined}).status,"MISMATCH");
  }
});

test("existing Action Receipt CLI refuses wrong actor and accepts a declared focused route", async t => {
  const root=await mkdtemp(path.join(tmpdir(),"work-routing-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const input=path.join(root,"receipt.json");
  const cli=fileURLToPath(new URL("../scripts/vydykhai.mjs",import.meta.url));
  for (const [actor,code] of [["manager",2],["worker",0]]) {
    await writeFile(input,JSON.stringify(route({operation:"investigate",actor})));
    const result=spawnSync(process.execPath,[cli,"action-receipt","--input",input],{encoding:"utf8",timeout:10000});
    assert.equal(result.status,code,result.stderr);
    assert.equal(JSON.parse(result.stdout).executionProven,false);
  }
});

test("existing continuation and lease observations bind routing to actual owner and manager", () => {
  const next={schemaVersion:1,id:"next",work:"task",owner:"worker",state:"WORKING",action:"inspect",evidence:"brief"};
  const state='Orchestrator health: HEALTHY | Context: manager | Profile: accepted\n## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n| task | WORKING | worker |\n## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n<!-- vydykhai:project-state:end -->';
  const common={work:"task",revision:"brief",checkpoint:"saved",humanEvent:"human",contextEpoch:"epoch"};
  const now=Date.now();
  const activity={schemaVersion:1,observedAt:new Date(now).toISOString(),
    continuationKey:readProductionContinuation(state).key,leaseKey:readLeaseActivityScope(state).key,
    orchestrator:{context:"manager",status:"IDLE",evidence:"native-manager"},
    owner:{context:"worker",status:"ACTIVE",turnId:"turn",evidence:"native-worker",routingRequired:true,
      taskIdentity:{schemaVersion:1,current:{...common,owner:"worker",evidence:"current"},
        seen:{...common,turnId:"turn",evidence:"readback"},failedRestorations:[]}}};
  const assess=()=>evaluateProductionContinuation(state,activity,{now});
  assert.equal(assess().nextAction,"RECONCILE_ROUTING");
  activity.owner.routing=route({actor:"worker",operation:"investigate"});
  assert.equal(assess().coverage,"COVERED");
  activity.owner.spawnProfileRequired=true;
  assert.equal(assess().nextAction,"RECONCILE_ROUTING");
  activity.owner.routing.spawnProfile={source:"accepted-matrix:r3/routine",model:"test-model",effort:"low"};
  assert.equal(assess().nextAction,"RECONCILE_ROUTING");
  const observed={work:"task",revision:"brief",actor:"worker",turnId:"turn",model:"test-model",effort:"low",evidence:"native-turn"};
  activity.owner.nativeProfile=observed;
  assert.equal(assess().coverage,"COVERED");
  for(const key of Object.keys(observed)){
    activity.owner.nativeProfile={...observed,[key]:key==="evidence"?"":"other"};
    assert.equal(assess().nextAction,"RECONCILE_ROUTING",key);
  }
  activity.owner.nativeProfile=observed;
  activity.owner.routingRequired="true";
  assert.equal(assess().nextAction,"RECONCILE_ROUTING");
  activity.owner.routingRequired=true;
  for (const field of ["work","revision","actor","orchestrator"]) {
    const saved=activity.owner.routing[field];activity.owner.routing[field]="other";
    assert.equal(assess().nextAction,"RECONCILE_ROUTING",field);
    activity.owner.routing[field]=saved;
  }
  activity.leases=[{work:"task",...structuredClone(activity.owner)}];
  activity.leases[0].routing=Object.fromEntries(Object.entries(activity.leases[0].routing).reverse());
  assert.equal(evaluateLeaseActivity(state,activity,{now}).coverage,"COVERED");
  activity.leases[0].routing.expectedOutput="different assignment";
  assert.equal(evaluateLeaseActivity(state,activity,{now}).coverage,"LIMITED");
  delete activity.leases[0].routing;delete activity.owner;
  assert.equal(evaluateLeaseActivity(state,activity,{now}).coverage,"LIMITED");
  activity.owner=activity.leases[0];
  activity.owner.status="IDLE";activity.owner.terminal={turnId:"turn",status:"RESULT",evidence:"durable-return"};
  assert.equal(assess().nextAction,"RECONCILE_RESULT","routing cannot lose an already produced result");
});

test("Codex spawn compiles accepted worker profile only; omitted selection cannot inherit the manager",async t=>{
  const root=await mkdtemp(path.join(tmpdir(),"spawn-profile-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const input=path.join(root,"route.json");
  const cli=fileURLToPath(new URL("../scripts/vydykhai.mjs",import.meta.url));
  const profile={source:"approved-matrix:execution",model:"example-worker",effort:"low"};
  const receipt=path.join(root,"accepted.json"), high={...profile,effort:"high",source:"accepted-visual-exception"};
  const assignment={work:"task",revision:"brief",actor:"worker",spawnProfile:profile};
  const launch=(p)=>spawnSync(process.execPath,[cli,"action-receipt","--worker-spawn","--input",input,...(p?["--receipt",p]:[])],{encoding:"utf8"});
  for(const [actor,p,ok] of [["worker",profile,true],["worker",high,true],
    ["worker",undefined,false],["worker",{...profile,effort:""},false],["worker",{...profile,source:""},false],["manager",profile,false]]){
    await writeFile(input,JSON.stringify(route({actor,spawnProfile:p})));
    await writeFile(receipt,JSON.stringify({...assignment,spawnProfile:p===high?high:profile}));
    const r=launch(receipt);
    assert.equal(r.status,ok?0:2,r.stderr);
    const out=JSON.parse(r.stdout);
    assert.deepEqual(out.spawnArgs,ok?{model:p.model,reasoning_effort:p.effort,fork_context:false}:undefined);
    assert.equal(out.executionProven,false);
  }
  await writeFile(input,JSON.stringify(route({actor:"worker",spawnProfile:profile})));
  for(const invalid of [null,input]) assert.equal(launch(invalid).status,2);
  for(const delta of [{revision:"old"},{work:"other"},{actor:"manager"},{spawnProfile:high},
    {spawnProfile:{...profile,source:"unapproved"}}]){
    await writeFile(receipt,JSON.stringify({...assignment,...delta}));
    assert.equal(launch(receipt).status,2);
  }
});
