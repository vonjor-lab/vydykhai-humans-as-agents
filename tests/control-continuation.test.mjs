import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {endpointFixture,endpointServices} from "./control-endpoint-fixture.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {runRegisteredContinuations} from "../scripts/control-continuation.mjs";
const options={mode:"REGISTERED_PREAPPROVED_ONLY",maxActions:1};
async function setup(t,{auto=true,expiresInMs=60000,actionBody}={}) {
  const x=await endpointFixture(t);
  if(actionBody)await x.f.put("action.mjs",actionBody);
  const ref=n=>x.f.put(`${n}.md`,n);
  const a={schema:"work.product-acceptance.v1",id:"consumer",project:"fixture",task:"prior",owner:"owner",executor:"worker",
    status:"ACCEPTED",acceptedAt:new Date().toISOString(),producerReturn:await ref("return"),artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)a.retention.push({id,required:true,expected:await ref(id)});
  await x.host.accept(a);
  await runControlTick(x.host,{review:async offer=>({phase:"POST_ACCEPT",key:offer.key,runId:offer.runId,reviewer:"reviewer",observedAt:new Date().toISOString(),findings:[],
    rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture-only protocol"}))})});
  const owner=ownerControl(x.host,"owner");await owner.readVerdict("consumer");
  await owner.respond("consumer",{owner:"owner",action:"CONTINUE",nextAction:"TASK-1",evidence:"fixture:approved"});
  await x.approve();const grant=Object.values((await x.host.snapshot()).grants)[0];
  const approval={reviewer:"reviewer",reviewReceipt:"fixture:explicit-execution",dependencies:["consumer"],expiresAt:Date.now()+expiresInMs,
    ...(auto?{executionRequest:{...x.f.request,operation:"resume"}}:{})};
  await x.host.approveCommand(grant.binding,approval);
  const tick=()=>runRegisteredContinuations(options,{host:x.host,workspace:x.f.root,controlRoot:x.privateRoot,services:endpointServices});
  return {...x,grant,approval,tick};
}
test("explicit stored continuation executes once under sandbox and closes without a model",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t),r=await x.tick();
  assert.equal(r.calls,1);assert.equal(r.results[0].action,"CLOSED_AFTER_OBSERVED_CONTINUATION");
  assert.equal(await readFile(path.join(x.f.root,"actions.log"),"utf8"),"called\n");
  const before=await x.host.snapshot();assert.equal(before.acceptances.consumer.enrollment,"CLOSED");
  assert.equal((await x.tick()).calls,0);assert.deepEqual(await x.host.snapshot(),before);
});
test("ordinary grants never opt in; pause, expired scope and request mismatch cannot manufacture authority",{skip:process.platform!=="darwin"},async t=>{
  for(const mode of ["ordinary","pause","expired"]){
    const x=await setup(t,{auto:mode!=="ordinary",expiresInMs:mode==="expired"?100:60000});
    if(mode==="pause")await x.host.pause(true);if(mode==="expired")await delay(150);
    assert.equal((await x.tick()).calls,0);
    await assert.rejects(readFile(path.join(x.f.root,"actions.log")),{code:"ENOENT"});
    await assert.rejects(x.host.approveCommand(x.grant.binding,{...x.approval,expiresAt:Date.now()+60000,
      executionRequest:{...x.f.request,operation:"resume",workspace:"/different"}}),/CONTINUATION_REQUEST_INVALID/);
  }
});
test("unknown command effect stays held on repeated observer ticks",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t,{actionBody:"import{appendFileSync}from'node:fs';appendFileSync('actions.log','once\\n');appendFileSync('task.json',' ');\n"});
  const result=await x.tick();assert.equal(result.calls,1);assert.equal(result.results[0].action,"CONTINUATION_NOT_COMPLETED");
  assert.equal(Object.values((await x.host.snapshot()).reservations)[0].status,"IN_FLIGHT");
  assert.equal((await x.tick()).calls,0);assert.equal(await readFile(path.join(x.f.root,"actions.log"),"utf8"),"once\n");
  await assert.rejects(x.host.close("consumer"),/CONTROL_NOT_COMPLETE/);
});
test("private execution request cannot select a second approved binding",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t),wrong={...x.grant.binding,commandSha256:"0".repeat(64)};
  await x.host.approveCommand(x.grant.binding,{...x.approval,executionRequest:undefined});
  await x.host.approveCommand(wrong,x.approval);
  const result=await x.tick();assert.equal(result.calls,1);assert.equal(result.results[0].action,"CONTINUATION_NOT_COMPLETED");
  assert.equal(Object.keys((await x.host.snapshot()).reservations).length,0);
  await assert.rejects(readFile(path.join(x.f.root,"actions.log")),{code:"ENOENT"});
});
