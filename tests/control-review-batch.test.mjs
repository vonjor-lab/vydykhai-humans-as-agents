import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {openReviewSources,reviewSourceRequests,reviewSourceReadbacks} from "../scripts/control-review-sources.mjs";
import {openReviewSubmission} from "../scripts/control-review-submission.mjs";
import {openWindowReader} from "../scripts/control-review-acquisition.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {sha256} from "../scripts/memory-brief.mjs";

async function fixture(t){
  const root=await realpath(await mkdtemp(path.join(os.tmpdir(),"review-batch-")));t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"workspace"),privateRoot=path.join(root,"private");
  await mkdir(workspace,{mode:0o700});await mkdir(privateRoot,{mode:0o700});
  const entries=["decision","correction","missing"].map(id=>({id,path:id+".md",purpose:"Protocol source"}));
  for(const id of ["decision","correction"])await writeFile(path.join(workspace,id+".md"),id+" original bytes\n");
  const registry=path.join(privateRoot,"sources.json");
  await writeFile(registry,JSON.stringify({schema:"control.review-sources.v1",workspace,sources:entries}),{mode:0o600});
  const sources=await openReviewSources(registry),before=await sources.snapshot();
  const context={schema:"control.review-submission-context.v1",offer:{runId:"batch",key:sha256("batch"),input:{previousFindings:[]}},
    reviewer:"reviewer",before,requiredSourceIds:["decision","correction"],retainAcquisition:true,expiresAt:new Date(Date.now()+60000).toISOString()};
  const file=path.join(privateRoot,"submission.json");await writeFile(file,JSON.stringify(context),{mode:0o600});
  const answer={schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"NOT_APPLICABLE",
    reason:"Protocol fixture, not semantic evidence",sourceIds:["decision","correction"]}],newFindings:[],resolutions:[]};
  return {workspace,sources,file,answer};
}
test("batch returns exact independently readable originals, order, hashes and missing source",async t=>{
  const x=await fixture(t),args={ids:["correction","missing","decision"]},value=await x.sources.read(args);
  const rows=reviewSourceReadbacks(args,value);
  for(let i=0;i<args.ids.length;i++)assert.deepEqual(rows[i],await x.sources.read({id:args.ids[i]}));
  assert.equal(rows[1].status,"MISSING");assert.equal(rows[1].text,undefined);
  assert.equal(rows[0].sha256,sha256(rows[0].text));
});
test("invalid batch arguments and forged reply shape never hide or invent acquisitions",()=>{
  for(const args of [{ids:[]},{ids:["x","x"]},{ids:[null]},{ids:Array(1)},{ids:[" "]},
    {ids:Array.from({length:33},(_,i)=>String(i))},{id:"x",ids:["x"]},{ids:["x"],offset:0}])
    assert.throws(()=>reviewSourceRequests(args),/REQUEST_INVALID/);
  for(const value of [{schema:"wrong",sources:[{id:"x"}]},{schema:"control.review-source-batch.v1",sources:[]},
    {schema:"control.review-source-batch.v1",sources:[{id:"other"}]},
    {schema:"control.review-source-batch.v1",sources:[{id:"x"}],hidden:"extra"}])
    assert.throws(()=>reviewSourceReadbacks({ids:["x"]},value),/BATCH_INVALID/);
});
test("one durable batch survives same-assignment restart; new assignment does not inherit reads",async t=>{
  const x=await fixture(t),s=await openReviewSubmission(x.file,x.sources,x.sources);
  await s.read({ids:["decision","correction"]});
  const resumed=await openReviewSubmission(x.file,x.sources,x.sources),ack=await resumed.submit({answer:x.answer});
  assert.equal(ack.status,"REVIEW_RECEIVED");
  const file=x.file+"-fresh";await writeFile(file,await readFile(x.file),{mode:0o600});
  const fresh=await openReviewSubmission(file,x.sources,x.sources);
  await assert.rejects(fresh.submit({answer:x.answer}),/NO_SOURCE_ACQUISITION/);
});
test("unregistered or oversized batch records no partial invisible acquisitions",async t=>{
  const x=await fixture(t),s=await openReviewSubmission(x.file,x.sources,x.sources);
  await assert.rejects(s.read({ids:["decision","unregistered"]}),/NOT_REGISTERED/);
  await assert.rejects(s.submit({answer:x.answer}),/NO_SOURCE_ACQUISITION/);
  for(const id of ["decision","correction"])await writeFile(path.join(x.workspace,id+".md"),"x".repeat(128*1024));
  await assert.rejects(s.read({ids:["decision","correction"]}),/BATCH_CAPACITY/);
  await assert.rejects(s.submit({answer:x.answer}),/NO_SOURCE_ACQUISITION/);
});
test("batch cannot hide source drift, missing required read, or unread citation",async t=>{
  const x=await fixture(t),s=await openReviewSubmission(x.file,x.sources,x.sources);
  await s.read({ids:["decision"]});await assert.rejects(s.submit({answer:x.answer}),/REQUIRED_SOURCE_UNREAD/);
  await s.read({ids:["correction"]});
  const unread=structuredClone(x.answer);unread.rowGroups[0].sourceIds[1]="missing";
  await assert.rejects(s.submit({answer:unread}),/UNREAD_EVIDENCE/);
  await writeFile(path.join(x.workspace,"correction.md"),"changed");
  await assert.rejects(s.submit({answer:x.answer}),/SOURCE_DRIFT/);
});
test("bounded-window policy is not bypassed by batch arguments",async t=>{
  const x=await fixture(t),reader=openWindowReader(x.sources,{maxBytes:1024,maxChars:16});
  await assert.rejects(reader.read({ids:["decision","correction"]}));
});
