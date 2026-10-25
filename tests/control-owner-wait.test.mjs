import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm,realpath} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {openControlStore} from "../scripts/control-store.mjs";
import {ownerWait} from "../scripts/control-owner-wait.mjs";
async function fixture(t,{maxTurns=4,timeoutMs=10000}={}){
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),"owner-wait-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const dir=path.join(root,"delivery");await mkdir(dir,{mode:0o700});const store=await openControlStore(dir);
  await store.initialize({calls:0,runs:{}});
  const file=path.join(root,"result.json"),receipt=path.join(root,"observer.json");let paused=false,control={status:"PENDING"};
  const config={schema:"control.owner-wait.v1",maxTurns,events:{role:{kind:"FILE",file,timeoutMs},
    control:{kind:"CONTROL",id:"accepted",timeoutMs},quiet:{kind:"OBSERVATION",file:receipt,timeoutMs}}};
  const services={store,read:()=>store.read(),host:{snapshot:async()=>({paused})},observeControl:async()=>control,expiresAt:new Date(Date.now()+60000).toISOString()};
  const wait=ownerWait(config,services),sessionId=randomUUID();
  const stop=run=>wait.stopped({runId:run.runId,sessionId,code:0,usage:{input_tokens:10}});
  return {wait,store,config,services,file,receipt,sessionId,stop,pause:v=>paused=v,control:v=>control=v};
}
const quietReceipt={schema:"control.observer-readback.v1",stage:"COMPLETED",status:"ONE_TICK_OBSERVED",
  paused:false,calls:0,ownerDelivery:{status:"QUIET",calls:0},ownerCapacity:{unknownRuns:0},
  unknownRuns:0,unknownActions:0,inboxCount:0,actions:{},notificationRoute:"QUIET"};
test("durable waiting survives reopen; unchanged observations perform no writes or model calls",async t=>{
  const x=await fixture(t),run=await x.wait.begin();
  await x.wait.park({eventId:"role",checkpoint:"Judge the retained Return"});await x.stop(run);
  const before=await x.store.read();
  const reopened=ownerWait(x.config,x.services);
  for(let i=0;i<4;i++)assert.deepEqual(await reopened.observe(),{status:"WAITING",calls:0});
  assert.deepEqual(await x.store.read(),before);
  await writeFile(x.file,JSON.stringify({code:0,result:"actual"}),{mode:0o600});
  assert.equal((await reopened.observe()).status,"EVENT_RECORDED");
  const next=await reopened.begin();assert.equal(next.sessionId,x.sessionId);
  assert.equal(next.trigger.proof.kind,"FILE");
  await assert.rejects(reopened.begin(),/ACTIVE_OR_DONE/);
  await reopened.complete();await x.stop(next);assert.equal((await reopened.snapshot()).done,true);
  assert.equal((await x.store.read()).state.calls,0);
});
test("an event arriving before native exit cannot launch a concurrent owner",async t=>{
  const x=await fixture(t),run=await x.wait.begin();await x.wait.park({eventId:"control",checkpoint:"Read current verdict"});
  x.control({status:"APPLIED"});assert.equal((await x.wait.observe()).status,"UNCHANGED");
  await assert.rejects(x.wait.begin(),/ACTIVE_OR_DONE/);await x.stop(run);
  await x.wait.observe();assert.equal((await x.wait.begin()).sessionId,x.sessionId);
});
test('event-driven native exit immediately observes an already completed Return, without a timer',async t=>{
  const x=await fixture(t);x.config.eventDriven=true;
  const wait=ownerWait(x.config,x.services),turn=await wait.begin();
  await wait.park({eventId:'role',checkpoint:'Read existing Return'});
  await writeFile(x.file,JSON.stringify({code:0}),{mode:0o600});
  assert.equal((await wait.observe()).status,'UNCHANGED');
  await wait.stopped({runId:turn.runId,sessionId:x.sessionId,code:0});
  assert.equal((await wait.snapshot()).waiting.state,'READY');
  assert.equal((await wait.begin()).sessionId,x.sessionId);
  assert.equal((await x.store.read()).state.calls,0);
});
test("negative result wakes the same owner for judgment, never authorizes work",async t=>{
  const x=await fixture(t),run=await x.wait.begin();await x.wait.park({eventId:"control",checkpoint:"Handle independent result"});await x.stop(run);
  x.control({status:"OWNER_ATTENTION_REQUIRED",resultUse:"REJECT"});await x.wait.observe();
  assert.equal((await x.wait.begin()).trigger.proof.resultUse,"REJECT");
});
test("pause and expiry cannot be bypassed by ready or replayed events",async t=>{
  const x=await fixture(t),run=await x.wait.begin();await x.wait.park({eventId:"control",checkpoint:"wait"});await x.stop(run);
  x.control({status:"APPLIED"});x.pause(true);assert.equal((await x.wait.observe()).status,"PAUSED_OR_EXPIRED");
  await assert.rejects(x.wait.begin(),/PAUSED_OR_EXPIRED/);x.pause(false);
  const expired=ownerWait(x.config,{...x.services,expiresAt:new Date(0).toISOString()});
  assert.equal((await expired.observe()).status,"PAUSED_OR_EXPIRED");await assert.rejects(expired.begin(),/PAUSED_OR_EXPIRED/);
});
test("missing checkpoint retains actual exit and cost without resuming or completing work",async t=>{
  const x=await fixture(t),run=await x.wait.begin();
  await assert.rejects(x.stop(run),/CHECKPOINT_MISSING/);
  const s=await x.wait.snapshot();
  assert.equal(s.active,null);assert.equal(s.done,false);
  assert.equal(s.turns[0].state,"CHECKPOINT_MISSING");
  assert.equal(s.turns[0].receipt.usage.input_tokens,10);
  await assert.rejects(x.wait.begin(),/EVENT_NOT_READY/);
  await assert.rejects(x.stop(run),/CHECKPOINT_MISSING/);
  assert.deepEqual(await x.wait.snapshot(),s);
  assert.equal((await x.wait.observe()).calls,0);
});
test("unknown exit never resumes or refills turns",async t=>{
  const x=await fixture(t),run=await x.wait.begin();
  await x.wait.park({eventId:"role",checkpoint:"wait"});
  await x.wait.stopped({runId:run.runId,sessionId:x.sessionId,code:null,reason:"lost"});
  await assert.rejects(x.wait.begin(),/ACTIVE_OR_DONE/);
  assert.equal((await x.wait.snapshot()).turns.length,1);
  await assert.rejects(x.stop(run),/RECEIPT_CHANGED/);
});
test("same native exit receipt is idempotent; a new session cannot replace the owner",async t=>{
  const x=await fixture(t),run=await x.wait.begin();await x.wait.park({eventId:"control",checkpoint:"wait"});await x.stop(run);await x.stop(run);
  x.control({status:"APPLIED"});await x.wait.observe();const next=await x.wait.begin();await x.wait.complete();
  await assert.rejects(x.wait.stopped({runId:next.runId,sessionId:randomUUID(),code:0}),/SESSION_CHANGED/);
  await x.stop(next);
});
test("quiet requires a new completed zero-model receipt after parking",async t=>{
  const x=await fixture(t),run=await x.wait.begin();
  const write=v=>writeFile(x.receipt,JSON.stringify(v),{mode:0o600});
  const old={...quietReceipt,at:1};
  await write(old);await x.wait.park({eventId:"quiet",checkpoint:"Finish after quiet"});await x.stop(run);
  assert.equal((await x.wait.observe()).status,"WAITING");
  await write({...old,at:2,calls:1});assert.equal((await x.wait.observe()).status,"WAITING");
  await write({...old,at:3});assert.equal((await x.wait.observe()).status,"EVENT_RECORDED");
  assert.equal((await x.wait.begin()).trigger.proof.status,"EVENT_AVAILABLE");
});
for(const [name,delta]of Object.entries({unknownAction:{unknownActions:1},unknownReview:{unknownRuns:1},
  unknownOwner:{ownerCapacity:{unknownRuns:1}},pendingInbox:{inboxCount:1},pendingAction:{actions:{REVIEW_DUE:1}},
  ownerAttention:{ownerDelivery:{calls:0,status:"HOST_ATTENTION_REQUIRED"}},
  failed:{stage:"FAILED",status:"UNKNOWN_RECONCILIATION_REQUIRED"}}))
  test(`quiet ${name} wakes attention, never a quiet-success event`,async t=>{
    const x=await fixture(t),turn=await x.wait.begin();
    await x.wait.park({eventId:"quiet",checkpoint:"Complete only on genuinely quiet evidence"});await x.stop(turn);
    const value={...quietReceipt,...delta};await writeFile(x.receipt,JSON.stringify(value),{mode:0o600});
    assert.equal((await x.wait.observe()).status,"EVENT_RECORDED");
    const next=await x.wait.begin();assert.equal(next.sessionId,x.sessionId);
    assert.equal(next.trigger.proof.status,"OWNER_ATTENTION_REQUIRED");
    assert.equal(next.trigger.proof.executionInterrupted,false);assert.deepEqual(next.trigger.proof.receipt,value);
    assert.equal((await x.store.read()).state.calls,0);
  });
test("zero-model command activity is not a quiet interval and does not cancel work",async t=>{
  const x=await fixture(t),turn=await x.wait.begin();
  await x.wait.park({eventId:"quiet",checkpoint:"Wait for quiet"});await x.stop(turn);
  await writeFile(x.receipt,JSON.stringify({...quietReceipt,
    continuation:{calls:1,results:[{status:"ACTION_COMPLETED"}]}}),{mode:0o600});
  assert.equal((await x.wait.observe()).status,"WAITING");
  assert.equal((await x.wait.snapshot()).active,null);
});
test("observation deadline wakes attention without cancelling work or granting a retry",async t=>{
  const x=await fixture(t,{timeoutMs:1,maxTurns:1}),run=await x.wait.begin();
  await x.wait.park({eventId:"role",checkpoint:"Observe existing work"});await x.stop(run);
  await new Promise(r=>setTimeout(r,5));await x.wait.observe();
  const s=await x.wait.snapshot();assert.equal(s.waiting.proof.reason,"EVENT_DEADLINE");assert.equal(s.waiting.proof.executionInterrupted,false);
  await assert.rejects(x.wait.begin(),/BUDGET_EXHAUSTED/);assert.equal((await x.wait.snapshot()).turns.length,1);
});
