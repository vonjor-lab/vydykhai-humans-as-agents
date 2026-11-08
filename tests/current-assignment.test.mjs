import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCurrentAssignment, evaluateTaskDisposition } from "../scripts/task-continuity.mjs";
import { runContextTransition } from "../scripts/context-run.mjs";
import { fixture } from "./context-fixture.mjs";
import { assignment } from "./assignment-fixture.mjs";

function receipt() {
  const r={boundary:"task-disposition",work:"task",owner:"owner",revision:"revision",
    authority:"resume",candidate:"candidate",plan:"plan",ledger:"retained-ledger",action:"execute",
    pause:"CLEARED",effects:"RECONCILED",authors:["worker"],maxAttempts:2,maxEscalations:1,attempts:[],
    budget:{unit:"commands",limit:4,spent:0,reserved:0,next:1,reviewReserve:1},
    next:{hypothesis:"current",check:"output",reason:"saved input",escalated:false},
    review:{required:false,triggers:[],basis:"isolated local correction; final acceptance separately reviewed"}};
  r.assignment=assignment(r);
  r.assignment.directions.unshift({id:"old-pause",source:"original-pause",orderSource:"source-thread",
    sequence:1,work:r.work,kind:"PAUSE",supersedes:null});
  r.assignment.directions[1].supersedes="old-pause";
  r.assignment.directions[1].kind="RESUME";
  return r;
}

test("replayed pause is not a new command; original ordering and scoped supersession are required",()=>{
  const r=receipt(); assert.equal(evaluateCurrentAssignment(r).status,"PASS");
  r.pause="ACTIVE"; assert.equal(evaluateCurrentAssignment(r).status,"UNVERIFIED");
  r.pause="CLEARED"; r.assignment.readback.humanEvent="old-pause";
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
  for(const mutate of [a=>a.directions.reverse(),a=>a.directions[1].work="other-task",
    a=>a.directions[1].supersedes=null,a=>a.directions[1].orderSource="arrival-order",
    a=>a.directions[1].sequence=1,a=>a.readback.contextEpoch="pre-compaction"]) {
    const v=receipt();mutate(v.assignment);assert.equal(evaluateCurrentAssignment(v).status,"UNVERIFIED");
  }
});

test("initial authorization and anchored suffix preserve history without a fabricated resume",()=>{
  const r=receipt();r.assignment=assignment(r);
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  r.assignment.predecessor={id:"original-64",source:"archive/64",orderSource:"source-thread",sequence:64,work:r.work};
  Object.assign(r.assignment.directions[0],{kind:"RESUME",sequence:65,supersedes:"original-64"});
  assert.equal(evaluateTaskDisposition(r).status,"PASS");
  for(const mutate of [a=>delete a.predecessor,a=>a.predecessor.work="other",
    a=>a.predecessor.sequence=66,a=>a.predecessor.source="",a=>a.directions[0].kind="AUTHORIZE"]) {
    const v=structuredClone(r);mutate(v.assignment);
    assert.equal(evaluateTaskDisposition(v).status,"UNVERIFIED");
  }
});

test("ready owner work cannot be handed off as a final answer; acceptance needs all obligations",()=>{
  const r=receipt();r.action="handoff";
  r.assignment.obligations=[{id:"apply-return",owner:r.owner,state:"READY",evidence:"received"}];
  assert.match(evaluateTaskDisposition(r).reason,/ready owner work/);
  r.action="accept";assert.match(evaluateTaskDisposition(r).reason,/obligations open/);
  r.assignment.obligations[0].state="WAITING";
  assert.equal(evaluateCurrentAssignment(r).status,"UNVERIFIED");
  r.assignment.obligations[0].resumeWhen="external decision";
  assert.equal(evaluateCurrentAssignment(r).status,"UNVERIFIED");
  r.assignment.obligations[0].state="DONE";
  assert.equal(evaluateCurrentAssignment(r).status,"PASS");
  r.review={required:true,triggers:["acceptance"],basis:"DOD"};
  assert.equal(evaluateTaskDisposition(r).status,"UNVERIFIED");
});

test("isolated existing runner restores current assignment, executes once, then respects new pause",async t=>{
  const f=await fixture(t);await f.prepare();
  const r=receipt();r.work=f.task.id;r.owner=f.task.owner;r.revision=f.request.task.sha256;
  r.assignment=assignment(r);r.assignment.readback.humanEvent="restored-old-pause";
  const services={dispositionRequired:true,readTaskDisposition:async()=>structuredClone(r)};
  const request={...f.request,operation:"resume"};
  const stale=await runContextTransition(request,services);
  assert.equal(stale.code,"TASK_DISPOSITION_HELD");assert.equal(stale.stats.commands,0);
  // Test adapter supplies an actual current readback, not a fabricated human resume.
  r.assignment.readback.humanEvent=r.authority;
  const continued=await runContextTransition(request,services);
  assert.equal(continued.status,"ACTION_COMPLETED",JSON.stringify(continued));
  assert.equal(continued.stats.dependentCommands,1);
  r.budget.spent=1;
  const previous=r.authority;r.authority="new-pause";r.pause="ACTIVE";
  r.assignment.directions.push({id:r.authority,source:"new-human-pause",orderSource:"source-thread",
    sequence:3,work:r.work,kind:"PAUSE",supersedes:previous});
  r.assignment.humanEvent=r.assignment.readback.humanEvent=r.authority;
  const stopped=await runContextTransition(request,services);
  assert.equal(stopped.code,"TASK_DISPOSITION_HELD");assert.equal(stopped.stats.commands,0);
  assert.equal(r.budget.spent,1);assert.equal(r.ledger,"retained-ledger");
  r.action="halt";delete r.assignment;delete r.review;
  assert.equal(evaluateTaskDisposition(r).status,"HELD");
  assert.equal(evaluateTaskDisposition(r).productAccepted,false);
});
