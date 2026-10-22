import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {endpointFixture,endpointServices} from "./control-endpoint-fixture.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {openReviewSubmission,hasReviewSubmission} from "../scripts/control-review-submission.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {nativeProvider,codeItem} from "./native-provider-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";

async function setup(t) {
  const x=await endpointFixture(t);
  await x.f.put("evidence.md","Protocol fixture only; does not establish project readiness.");
  const sourceFile=path.join(x.privateRoot,"sources.json");
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
    sources:[{id:"evidence",path:"evidence.md",purpose:"Protocol evidence"}]}),{mode:0o600});
  const sources=await openReviewSources(sourceFile),before=await sources.snapshot();
  const offer={runId:randomUUID(),key:sha256("offer"),input:{previousFindings:[]}};
  const file=path.join(x.privateRoot,"submission.json");
  const context={schema:"control.review-submission-context.v1",offer,reviewer:"reviewer",before,
    requiredSourceIds:["evidence"],expiresAt:new Date(Date.now()+60000).toISOString()};
  await writeFile(file,JSON.stringify(context),{mode:0o600});
  const answer={schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"NOT_APPLICABLE",
    reason:"Synthetic transport fixture, not a semantic verdict",sourceIds:["evidence"]}],newFindings:[],resolutions:[]};
  return {...x,sourceFile,sources,file,context,offer,answer};
}
test("submission requires acquisition and exact coverage, persists one immutable answer without a final chat message",async t=>{
  const x=await setup(t),s=await openReviewSubmission(x.file,x.sources,x.sources);
  await assert.rejects(s.submit({answer:x.answer}),/NO_SOURCE_ACQUISITION/);
  await s.read({id:"evidence"});
  const incomplete=structuredClone(x.answer);incomplete.rowGroups[0].ids.pop();
  await assert.rejects(s.submit({answer:incomplete}),/COVERAGE_INVALID/);
  const ack=await s.submit({answer:x.answer});
  const bytes=await readFile(x.file+".receipt.json");assert.equal(ack.receiptSha256,sha256(bytes));
  assert.equal(ack.admission,"HOST_VALIDATION_REQUIRED");
  assert.deepEqual(JSON.parse(bytes).answer,x.answer);
  assert.deepEqual(await s.submit({answer:x.answer}),ack);
  const changed=structuredClone(x.answer);changed.rowGroups[0].reason="Different judgment";
  await assert.rejects(s.submit({answer:changed}),/SUBMISSION_CONFLICT/);
  assert.deepEqual(await readFile(x.file+".receipt.json"),bytes);
});
for(const mode of ["drift","expired","unread-citation"])test(`submission refuses ${mode} without a receipt`,async t=>{
  const x=await setup(t);
  if(mode==="expired")await writeFile(x.file,JSON.stringify({...x.context,expiresAt:new Date(0).toISOString()}));
  const s=await openReviewSubmission(x.file,x.sources,x.sources);await s.read({id:"evidence"});
  if(mode==="drift")await x.f.put("evidence.md","changed");
  if(mode==="unread-citation")x.answer.rowGroups[0].sourceIds=["not-read"];
  await assert.rejects(s.submit({answer:x.answer}),/SOURCE_DRIFT|SUBMISSION_EXPIRED|UNREAD_EVIDENCE/);
  await assert.rejects(readFile(x.file+".receipt.json"),{code:"ENOENT"});
});
test("output observer ignores prose, partial acknowledgments and failed tools",()=>{
  const ack={status:"REVIEW_RECEIVED",receiptSha256:"a".repeat(64)};
  assert.equal(hasReviewSubmission(JSON.stringify(ack)+"\n"),false);
  const event={type:"item.completed",item:{type:"mcp_tool_call",server:"vydykhai_review",tool:"submit_review",
    status:"completed",result:{content:[{type:"text",text:JSON.stringify(ack)}]}}};
  assert.equal(hasReviewSubmission(JSON.stringify(event)),false);
  assert.equal(hasReviewSubmission(JSON.stringify(event)+"\n"),true);
  event.item.result.isError=true;assert.equal(hasReviewSubmission(JSON.stringify(event)+"\n"),false);
});
test("incompatible token-accounted episode is rejected before storage or dispatch",async()=>{
  await assert.rejects(openModelReview({native:{reviewSubmission:true},episodeGroups:[["C01"],["C02"]]}),
    /SUBMISSION_TOKEN_EPISODE_UNSUPPORTED/);
});
test("parent preserves the actual admission error after a durable receipt",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t),dirs={};
  for(const name of ["fault-journal","fault-room","fault-home"]){dirs[name]=path.join(x.privateRoot,name);await mkdir(dirs[name],{mode:0o700});}
  const binary=path.join(x.privateRoot,"fault-cli.mjs"),submissionFile=path.join(dirs["fault-journal"],`submission-${x.offer.runId}.json`);
  // A deterministic transport shim changes a source after the real submission
  // validator has saved its receipt, but before the parent consumes that receipt.
  await writeFile(binary,`#!${process.execPath}
import {writeFile} from 'node:fs/promises';
import {openReviewSources} from ${JSON.stringify(new URL("../scripts/control-review-sources.mjs",import.meta.url).href)};
import {openReviewSubmission} from ${JSON.stringify(new URL("../scripts/control-review-submission.mjs",import.meta.url).href)};
const sources=await openReviewSources(${JSON.stringify(x.sourceFile)});
const s=await openReviewSubmission(${JSON.stringify(submissionFile)},sources,sources);
const value=await s.read({id:'evidence'}),answer=${JSON.stringify(x.answer)};
const ack=await s.submit({answer});
await writeFile(${JSON.stringify(path.join(x.f.root,"evidence.md"))},'changed after receipt');
const call=(id,tool,args,result)=>({type:'item.completed',item:{id,type:'mcp_tool_call',server:'vydykhai_review',tool,arguments:args,status:'completed',result:{content:[{type:'text',text:JSON.stringify(result)}]}}});
for(const e of [{type:'turn.started'},call('r','read_source',{id:'evidence'},value),call('s','submit_review',{answer},ack)])process.stdout.write(JSON.stringify(e)+'\\n');
`,{mode:0o700});
  const review=await openModelReview({directory:dirs["fault-journal"],controlRoot:x.privateRoot,
    reviewer:"reviewer",sourceFile:x.sourceFile,maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),
    scope:{requiredSourceIds:["evidence"]},native:{binary,workspace:dirs["fault-room"],home:dirs["fault-home"],
      model:"scripted",effort:"low",timeoutMs:3000,reviewSubmission:true}});
  await review.initialize();
  await assert.rejects(review.review(x.offer),/MODEL_REVIEW_SOURCE_DRIFT/);
  const observed=await review.observe(x.offer.runId);
  assert.equal(observed.reason,"MODEL_REVIEW_SOURCE_DRIFT");assert.equal(observed.validationError,observed.reason);
  assert.equal(observed.verdict,undefined);assert.ok(observed.submission);
  assert.equal((await review.capacity()).used,1);
});

const binary=process.env.VYDYKHAI_CODEX_BINARY;
for(const mode of ["valid","windowed","incomplete"])test(`actual CLI durable POST ${mode}: no final text or automatic retry`,{skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
  const x=await setup(t),dirs={};
  for(const name of ["journal","room","home","accepted-state"]){dirs[name]=path.join(x.privateRoot,name);await mkdir(dirs[name],{mode:0o700});}
  const config={...x.profile.config,evidenceRegistry:x.sourceFile};
  let host=await openControlHost(dirs["accepted-state"],config,endpointServices);await host.initialize();
  const ref=async name=>x.f.put(name+".md",name);
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"synthetic",task:"test-only",
    owner:"owner",executor:"worker",status:"ACCEPTED",acceptedAt:new Date().toISOString(),
    producerReturn:await ref("return"),artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)acceptance.retention.push({id,required:true,expected:await ref(id)});
  await host.accept(acceptance);
  x.answer.rowGroups=[{ids:["C20.02"],status:"PASS",sourceIds:["evidence"]},
    {...x.answer.rowGroups[0],ids:controlCheckIds.filter(id=>id!=="C20.02")}];
  x.answer.resultUse={status:"ALLOW",sourceIds:["evidence"],evidence:"Scripted positive result-use decision",findingIds:[]};
  if(mode==="incomplete")x.answer.rowGroups[1].ids.pop();
  const length=Array.from(await readFile(path.join(x.f.root,"evidence.md"),"utf8")).length;
  const provider=await nativeProvider(t,async n=>{
    if(n===1)return codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.endsWith('read_source'));"+
      (mode==="windowed"?`for(let offset=0;offset<${length};offset+=16)text(await tools[a.name]({id:'evidence',offset}));`:
        "text(await tools[a.name]({id:'evidence'}));"),"read");
    if(n===2)return codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.endsWith('submit_review'));"+
      `text(await tools[a.name]({answer:${JSON.stringify(x.answer)}}));`,"submit");
    // Deliberately never supply a final conversational response. No inference.
    return new Promise(()=>{});
  });
  const options={directory:dirs.journal,controlRoot:x.privateRoot,reviewer:"reviewer",sourceFile:x.sourceFile,
    maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),
    scope:{host:{directory:dirs["accepted-state"],config},requiredSourceIds:["evidence"]},
    native:{binary,workspace:dirs.room,home:dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,
      reviewSubmission:true,provider:provider.provider,
      ...(mode==="windowed"?{reviewAcquisition:{maxBytes:1024,maxChars:16}}:{})}};
  let review=await openModelReview(options);await review.initialize();let error;
  const tick=await runControlTick(host,{timeoutMs:20000,review:async(...args)=>{
    try{return await review.review(...args);}catch(e){error=e.message;throw e;}
  }});
  if(mode==="incomplete") {
    assert.equal(error,"MODEL_REVIEW_PART_COVERAGE_INVALID");
    const state=await host.snapshot(),stopped=await review.observe(state.acceptances.accepted.reviewLease.runId);
    assert.equal(stopped.state,"STOPPED");assert.equal(stopped.verdict,undefined);
    assert.equal(stopped.transportReason,"RESULT_REJECTED");assert.equal(stopped.validationError,error);
    assert.equal(state.acceptances.accepted.review,null);assert.deepEqual(state.grants,{});
    assert.equal((await runControlTick(host,{review:async()=>{throw Error("must not repeat");}})).calls,0);
    return;
  }
  if(error) {
    const failed=await review.observe((await host.snapshot()).acceptances.accepted.reviewLease.runId);
    const trace=JSON.parse(await readFile(path.join(dirs.journal,failed.trace.file),"utf8"));
    t.diagnostic(JSON.stringify({error,requests:provider.requests.length,errors:trace.errors,
      output:trace.output.slice(-14000)}));
  }
  assert.equal(tick.results[0].action,"OWNER_DISPOSITION_DUE",error);
  const state=await host.snapshot(),runId=state.acceptances.accepted.review.runId;
  const observed=await review.observe(runId);
  assert.equal(observed.completion,"DURABLE_SUBMISSION");assert.equal(observed.reason,null);
  assert.equal(observed.usage,null);assert.equal(observed.usageUnknown,true);
  const trace=JSON.parse(await readFile(path.join(dirs.journal,observed.trace.file),"utf8"));
  assert.ok(trace.timing.elapsedMs<15000);assert.doesNotMatch(trace.output,/"type":"turn.completed"/);
  assert.equal(observed.verdict.rows.length,87);assert.equal((await review.capacity()).used,1);
  review=await openModelReview(options);host=await openControlHost(dirs["accepted-state"],config,endpointServices);
  assert.deepEqual((await review.observe(runId)).verdict,observed.verdict);
  const owner=ownerControl(host,"owner"),inbox=await owner.inbox();await owner.readVerdict("accepted");
  await owner.respond("accepted",{owner:"owner",reviewKey:inbox[0].reviewKey,action:"CONTINUE",
    nextAction:x.f.task.id,evidence:"Scripted owner application; no product readiness claim"});
  const quiet=await runControlTick(host,{review:async()=>{throw Error("must not repeat");}});
  assert.equal(quiet.calls,0);assert.deepEqual((await host.snapshot()).grants,{});
  t.diagnostic("Real CLI + MCP + receipt + host admission + owner read/application + restart + quiet tick; scripted model, no inference or project changes.");
});
