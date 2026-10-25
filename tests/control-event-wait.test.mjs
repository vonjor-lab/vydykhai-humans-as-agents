import test from "node:test";
import assert from "node:assert/strict";
import {waitControlEvent} from "../scripts/control-service.mjs";

function fixture() {
  const state={paused:false,health:{enrollment:"REVIEW_IN_FLIGHT",findings:[]},acceptances:{}};
  let ticks=0;
  return {state,service:{host:{snapshot:async()=>structuredClone(state)},tick:async()=>{ticks++;throw Error("MUST_NOT_TICK");}},ticks:()=>ticks};
}
test("one passive wait spans intermediate changes and returns applied outcome, not polling turns",async()=>{
  const x=fixture();
  setTimeout(()=>{x.state.health.enrollment="OWNER_DISPOSITION_DUE";},20);
  setTimeout(()=>{x.state.health.enrollment="SETTLED";x.state.health.disposition={action:"CONTINUE"};},300);
  assert.equal((await waitControlEvent(x.service,{waitMs:1000})).status,"APPLIED");
  assert.equal(x.ticks(),0);
});
test("wait expiry and cancelled wait never abort, reset or redispatch work",async()=>{
  const x=fixture(),before=structuredClone(x.state);
  const first=await waitControlEvent(x.service,{waitMs:1});
  assert.equal(first.status,"PENDING");assert.equal(first.executionInterrupted,false);
  const c=new AbortController();c.abort();
  assert.equal((await waitControlEvent(x.service,{waitMs:1000,signal:c.signal})).reason,"WAIT_CANCELLED");
  assert.deepEqual(x.state,before);assert.equal(x.ticks(),0);
});
test("pause and blocking verdict return to the owner without generating a response",async()=>{
  const x=fixture();x.state.paused=true;
  assert.equal((await waitControlEvent(x.service,{waitMs:0})).status,"PAUSED");
  x.state.paused=false;x.state.health.enrollment="OWNER_DISPOSITION_DUE";x.state.health.findings=[{id:"bad",status:"OPEN"}];
  assert.equal((await waitControlEvent(x.service,{waitMs:0})).status,"OWNER_ATTENTION_REQUIRED");
  assert.equal(x.state.health.disposition,undefined);
});
test("product application is returned only after current host assessment",async()=>{
  const x=fixture();x.state.acceptances.a={enrollment:"CLOSED",findings:[],review:{resultUse:{status:"ALLOW"}},disposition:{action:"DONE"}};
  x.service.host.assess=async()=>({action:"REVIEW_DUE"});
  assert.equal((await waitControlEvent(x.service,{id:"a",waitMs:0})).status,"OWNER_ATTENTION_REQUIRED");
  x.service.host.assess=async()=>({action:"CONTROL_DONE_CONFIRMED"});
  assert.equal((await waitControlEvent(x.service,{id:"a",waitMs:0})).status,"APPLIED");
});
