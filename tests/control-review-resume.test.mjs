import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {endpointFixture} from "./control-endpoint-fixture.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {openReviewSubmission} from "../scripts/control-review-submission.mjs";
import {openWindowReader} from "../scripts/control-review-acquisition.mjs";

async function setup(t, interruption = "complete") {
  const x=await endpointFixture(t);
  for(const n of ["journal","home","room"])await mkdir(path.join(x.privateRoot,n),{mode:0o700});
  await x.f.put("evidence.md","Protocol-only fixture. No project readiness or product authorization.");
  const sourceFile=path.join(x.privateRoot,"sources.json");
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
    sources:[{id:"evidence",path:"evidence.md",purpose:"Protocol fixture"}]}),{mode:0o600});
  const offer={runId:randomUUID(),key:sha256("assignment"),phase:"HEALTH",input:{previousFindings:[]}};
  const submission=path.join(x.privateRoot,"journal",`submission-${offer.runId}.json`);
  const threadId=randomUUID(),binary=path.join(x.privateRoot,"cli.mjs");
  const answer={schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"NOT_APPLICABLE",
    sourceIds:["evidence"],reason:"Protocol fixture only, not a health judgment"}],newFindings:[],resolutions:[]};
  await writeFile(binary,`#!${process.execPath}
import {writeFile} from 'node:fs/promises';
import {openReviewSources} from ${JSON.stringify(new URL("../scripts/control-review-sources.mjs",import.meta.url).href)};
import {openReviewSubmission} from ${JSON.stringify(new URL("../scripts/control-review-submission.mjs",import.meta.url).href)};
const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const call=(tool,args,result)=>emit({type:'item.completed',item:{id:'item_0',type:'mcp_tool_call',server:'vydykhai_review',tool,arguments:args,status:'completed',result:{content:[{type:'text',text:JSON.stringify(result)}]}}});
const sources=await openReviewSources(${JSON.stringify(sourceFile)});
const s=await openReviewSubmission(${JSON.stringify(submission)},sources,sources);
emit({type:'thread.started',thread_id:${JSON.stringify(threadId)}});emit({type:'turn.started'});
if(!process.argv.includes('resume')) {
 if(${JSON.stringify(interruption)}==='pending-tool')emit({type:'item.started',item:{id:'item_0',type:'mcp_tool_call',server:'vydykhai_review',tool:'read_source',arguments:{id:'evidence'},status:'in_progress'}});
 else {const value=await s.read({id:'evidence'});call('read_source',{id:'evidence'},value);}
 if(${JSON.stringify(interruption)}==='truncated-json')process.stdout.write('{"type":');
 await writeFile(${JSON.stringify(path.join(x.privateRoot,"read-done"))},'persisted');
 await new Promise(()=>setInterval(()=>{},1000));
} else {
 if(!process.argv.includes(${JSON.stringify(threadId)}))throw Error('WRONG_SESSION');
 const answer=${JSON.stringify(answer)},ack=await s.submit({answer});call('submit_review',{answer},ack);
}
`,{mode:0o700});
  const options={directory:path.join(x.privateRoot,"journal"),controlRoot:x.privateRoot,reviewer:"reviewer",
    sourceFile,maxCalls:2,expiresAt:new Date(Date.now()+60000).toISOString(),scope:{requiredSourceIds:["evidence"]},
    native:{binary,workspace:path.join(x.privateRoot,"room"),home:path.join(x.privateRoot,"home"),
      model:"protocol-fixture",effort:"low",timeoutMs:10000,reviewSubmission:true,reviewContinuation:true,reviewTotalTimeoutMs:60000}};
  const review=await openModelReview(options);await review.initialize();
  return {...x,offer,options,review,submission,threadId};
}
async function interruptAfterRead(x, resumable = true) {
  const controller=new AbortController();
  const pending=x.review.review(x.offer,{signal:controller.signal});
  const deadline=Date.now()+5000;
  while(Date.now()<deadline) {
    try {await readFile(path.join(x.privateRoot,"read-done"));break;}catch{}
    await new Promise(r=>setTimeout(r,10));
  }
  controller.abort();await assert.rejects(pending,/CANCELLED/);
  const stopped=await x.review.observe(x.offer.runId);
  assert.equal(stopped.resumable,resumable);assert.equal(stopped.verdict,undefined);
  assert.equal(stopped.usage,null);assert.equal(stopped.threadId,x.threadId);
  return stopped;
}
test("interrupted independent review resumes acquired evidence, preserves spend and refuses replay",async t=>{
  const x=await setup(t),first=await interruptAfterRead(x);
  const review=await openModelReview(x.options); // Controller restart, not a new assignment.
  const verdict=await review.review(x.offer,{resume:true});
  assert.equal(verdict.rows.length,87);
  const last=await review.observe(x.offer.runId);
  assert.equal(last.threadId,first.threadId);assert.equal(last.history.length,1);
  assert.equal(last.history[0].trace.sha256,first.trace.sha256);
  assert.equal(last.resumable,false);assert.equal(last.usage,null);
  assert.equal((await review.capacity()).used,2);
  const traces=await Promise.all([first.trace,last.trace].map(async r=>JSON.parse(await readFile(path.join(x.options.directory,r.file))).output));
  assert.equal(traces.join('').match(/"tool":"read_source"/g).length,1);
  await assert.rejects(review.review(x.offer,{resume:true}),/NOT_RESUMABLE/);
  assert.equal((await review.capacity()).used,2);
});
test("source or assignment drift blocks continuation before spending",async t=>{
  const x=await setup(t);await interruptAfterRead(x);
  await assert.rejects(x.review.review({...x.offer,key:sha256('different')},{resume:true}),/NOT_RESUMABLE/);
  await x.f.put("evidence.md","Changed source");
  await assert.rejects(x.review.review(x.offer,{resume:true}),/SOURCE_DRIFT/);
  assert.equal((await x.review.capacity()).used,1);
});
for(const interruption of ["pending-tool","truncated-json"])test(`${interruption} refuses impossible continuation without spending`,async t=>{
  const x=await setup(t,interruption),stopped=await interruptAfterRead(x,false);
  assert.ok(stopped.continuationError);
  const reopened=await openModelReview(x.options);
  await assert.rejects(reopened.review(x.offer,{resume:true}),/NOT_RESUMABLE/);
  assert.equal((await reopened.capacity()).used,1);
});
test("retained trace tampering blocks continuation before spending",async t=>{
  const x=await setup(t),stopped=await interruptAfterRead(x);
  await writeFile(path.join(x.options.directory,stopped.trace.file),'{}');
  await assert.rejects(x.review.review(x.offer,{resume:true}),/TRACE_CHANGED/);
  assert.equal((await x.review.capacity()).used,1);
});
test("concurrent dispatch is rejected without a second paid allocation",async t=>{
  const x=await setup(t),controller=new AbortController();
  const first=x.review.review(x.offer,{signal:controller.signal});
  await new Promise(r=>setTimeout(r,50));
  await assert.rejects(x.review.review(x.offer),/ALREADY_DISPATCHED/);
  controller.abort();await assert.rejects(first,/CANCELLED/);
  assert.equal((await x.review.capacity()).used,1);
});
test("acquisition budget survives MCP restart without rereading saved bytes",async t=>{
  const x=await setup(t),sources=await openReviewSources(x.options.sourceFile);
  await x.f.put("evidence.md","x".repeat(1400));
  const before=await sources.snapshot(),policy={maxBytes:1024,maxChars:600};
  await writeFile(x.submission,JSON.stringify({schema:"control.review-submission-context.v1",offer:x.offer,
    reviewer:"reviewer",before,requiredSourceIds:["evidence"],retainAcquisition:true,
    expiresAt:new Date(Date.now()+60000).toISOString()}),{mode:0o600});
  let server=await openReviewSubmission(x.submission,sources,openWindowReader(sources,policy),policy);
  assert.equal((await server.read({id:"evidence",offset:0,length:600})).window.afterBytes,600);
  server=await openReviewSubmission(x.submission,sources,openWindowReader(sources,policy),policy);
  const next=await server.read({id:"evidence",offset:600,length:600});
  assert.equal(next.status,"NEEDS_DISCOVERY");assert.equal(next.beforeBytes,600);
});
