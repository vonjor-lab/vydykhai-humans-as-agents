import test from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {sha256} from "../scripts/memory-brief.mjs";

// Replace only native transport; exercise the real callback, sources, wire and retained journal.
let supplied,dispatches;
globalThis.__reviewTraceTransport=async options=>{
  assert.equal(options.role,"review");dispatches++;return structuredClone(supplied);
};
const workerUrl=new URL("../scripts/control-worker-run.mjs",import.meta.url).href;
const hooks=registerHooks({load(url,context,next){
  return url===workerUrl?{format:"module",shortCircuit:true,
    source:"export async function runControlledWorker(options){return globalThis.__reviewTraceTransport(options);}"}:next(url,context);
}});
const {openModelReview,modelReviewPrompt}=await import("../scripts/control-model-review.mjs");
hooks.deregister();

test("unscoped prompt distinguishes the full source snapshot from minimum acquisition and part assignment",()=>{
  const sourceEvidence={rows:[{id:"required"},{id:"repair-owner-map"},{id:"consumer-contract"}],digest:sha256("snapshot")};
  for(const input of [{previousFindings:[]},{previousFindings:[],sourceEvidence}]) {
    const prompt=modelReviewPrompt({phase:"POST_ACCEPT",input},{requiredSourceIds:["required"]},["C15.04"]);
    assert.match(prompt,/UNSCOPED acquisition is active/);
    assert.match(prompt,/requiredSourceIds is the minimum required acquisition, never a source whitelist/);
    assert.match(prompt,/Assigned catalog ids restrict judgments, not which permitted sources may be read/);
    assert.match(prompt,/All registered sources in the current source snapshot are permitted for read_source/);
    assert.match(prompt,/absence from requiredSourceIds does not require trusted scope expansion/);
    assert.match(prompt,/minimum list does not require reading every registered source/);
    assert.match(prompt,/Unregistered sources and changed source bytes are not admitted/);
    assert.match(prompt,/Existing\/previous findings means only offer\.input\.previousFindings for this offer/);
    assert.match(prompt,/An empty previousFindings array provides no inherited finding IDs/);
    assert.match(prompt,/Findings mentioned in sources from other acceptances are evidence, not inherited authority/);
    assert.match(prompt,/emit a complete newFindings record with a new current ID and reference that ID/);
    assert.match(prompt,/Do not close or alter another acceptance's history/);
    assert.doesNotMatch(prompt,/SCOPED acquisition is active: host|Acquire every bound source/);
  }
});

test("scoped prompt preserves bound acquisition and trusted expansion without treating required IDs as a whitelist",()=>{
  const offer={phase:"POST_ACCEPT",input:{previousFindings:[],sourceEvidence:{scope:{
    schema:"control.review-source-scope.v1",acceptanceSha256:sha256("acceptance"),sourceIds:["required","bound-extra"]}}}};
  const prompt=modelReviewPrompt(offer,{requiredSourceIds:["required"]},["C15.04"]);
  assert.match(prompt,/SCOPED acquisition is active: host input.sourceEvidence.scope/);
  assert.match(prompt,/requiredSourceIds is the minimum required acquisition, never a source whitelist/);
  assert.match(prompt,/Acquire every bound source/);
  assert.match(prompt,/outside scope.sourceIds requires explicit trusted scope expansion before a verdict can be accepted/);
  assert.match(prompt,/it cannot be silently dropped/);
  assert.match(prompt,/does not establish semantic completeness of dependency selection or global coverage/);
  assert.doesNotMatch(prompt,/UNSCOPED acquisition is active|All registered sources in the current source snapshot are permitted/);
});

test("HEALTH prompt uses unscoped registered acquisition rather than a POST_ACCEPT dependency restriction",()=>{
  const prompt=modelReviewPrompt({phase:"HEALTH",input:{previousFindings:[],sourceEvidence:{rows:[]}}},
    {requiredSourceIds:["ledger"]});
  assert.match(prompt,/UNSCOPED acquisition is active/);
  assert.match(prompt,/requiredSourceIds is the minimum required acquisition, never a source whitelist/);
  assert.doesNotMatch(prompt,/SCOPED acquisition is active: host|Acquire every bound source/);
});

async function fixture(t) {
  const root=await realpath(await mkdtemp(path.join(tmpdir(),"review-acquisition-")));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"public"),directory=path.join(root,"review");
  for(const dir of [workspace,directory])await mkdir(dir,{mode:0o700});
  const registry=[{id:"ledger",path:"ledger.md",purpose:"Synthetic public ledger"},
    {id:"other",path:"other.md",purpose:"Synthetic other source"}];
  for(const row of registry)await writeFile(path.join(workspace,row.path),row.id);
  const sourceFile=path.join(root,"sources.json");
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace,sources:registry}),{mode:0o600});
  const sources=await openReviewSources(sourceFile),readback=await sources.read({id:"ledger"}),other=await sources.read({id:"other"});
  const config={directory,controlRoot:root,reviewer:"independent",sourceFile,
    native:{model:"synthetic-transport-only",effort:"low"},maxCalls:1,
    expiresAt:new Date(Date.now()+60000).toISOString(),scope:{requiredSourceIds:["ledger"]}};
  const review=await openModelReview(config);await review.initialize();
  const offer={runId:randomUUID(),key:sha256("offer"),input:{previousFindings:[]}};
  const answer={schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],
    status:"NOT_APPLICABLE",sourceIds:["ledger"],reason:"Synthetic transport only; no semantic qualification"}],
    newFindings:[],resolutions:[]};
  const judgment={type:"item.completed",item:{id:"answer",type:"agent_message",text:JSON.stringify(answer)}};
  const call=(type="item.completed",args={id:"ledger"},value=readback)=>({type,item:{id:"read-1",type:"mcp_tool_call",
    server:"vydykhai_review",tool:"read_source",arguments:args,status:type==="item.completed"?"completed":"in_progress",
    ...(value?{result:{content:[{type:"text",text:JSON.stringify(value)}]}}:{})}});
  return {directory,review,config,offer,readback,other,judgment,call};
}

const start={type:"turn.started"},end={type:"turn.completed",usage:{input_tokens:10,output_tokens:5}};
const warning={type:"item.completed",item:{id:"warning",type:"error",
  message:"Under-development features enabled: skip_host_skill_discovery. Synthetic pre-turn diagnostic."}};
const emptyResult={content:[{type:"text",text:'{"resources":[]}'}],structured_content:null};
const discovery=(type="item.completed",result=emptyResult)=>({type,item:{id:"discovery-1",type:"mcp_tool_call",
  server:"codex",tool:"list_mcp_resources",arguments:{},status:type==="item.completed"?"completed":"in_progress",
  ...(result?{result:structuredClone(result)}:{})}});
const cases=[
  ["completed-only read",x=>[start,x.call(),x.judgment,end]],
  ["coherent lifecycle",x=>[start,x.call("item.started",{id:"ledger"},null),
    x.call("item.updated",{id:"ledger"},null),x.call(),x.judgment,end]],
  ["coherent result update",x=>[start,x.call("item.started",{id:"ledger"},null),x.call("item.updated"),x.call(),x.judgment,end]],
  ["source index and read",x=>{const index=x.call();index.item={...index.item,id:"index",tool:"list_sources",arguments:{},
    result:{content:[{type:"text",text:JSON.stringify([{id:"ledger"},{id:"other"}])}]}};
    return [start,index,x.call(),x.judgment,end];}],
  ["observed non-effect pre-turn warning",x=>[warning,start,x.call(),x.judgment,end]],
  ["read after judgment",x=>[start,x.judgment,x.call("item.started",{id:"ledger"},null),x.call(),end],"SOURCE_AFTER_JUDGMENT"],
  ["crossed arguments",x=>[start,x.call("item.started",{id:"other"},null),
    x.call("item.updated",{id:"ledger"},null),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["crossed server",x=>{const event=x.call("item.started",{id:"ledger"},null);event.item.server="other";
    return [start,event,x.call(),x.judgment,end];},"SOURCE_TOOL_INVALID"],
  ["crossed tool",x=>{const event=x.call("item.started",{},null);event.item.tool="list_sources";
    return [start,event,x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["contradictory result update",x=>[start,x.call("item.started",{id:"ledger"},null),
    x.call("item.updated",{id:"ledger"},{...x.readback,text:"contradictory"}),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["completed status regresses",x=>{const event=x.call("item.updated");event.item.status="completed";
    return [start,x.call("item.started",{id:"ledger"},null),event,x.call("item.updated"),x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["incomplete call",x=>[start,x.call(),{...x.call("item.started",{id:"other"},null),
    item:{...x.call("item.started",{id:"other"},null).item,id:"unfinished"}},x.judgment,end],"SOURCE_LIFECYCLE_INCOMPLETE"],
  ["orphan update",x=>[start,x.call("item.updated",{id:"ledger"},null),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["duplicate completion",x=>[start,x.call(),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["argument/result mismatch",x=>[start,x.call("item.completed",{id:"other"}),x.judgment,end],/REVIEW_SOURCE_BATCH_INVALID/],
  ["failed tool",x=>{const event=x.call();event.item.error={message:"private tool error"};return [start,event,x.judgment,end];},"SOURCE_TOOL_FAILED"],
  ["failed result update",x=>{const event=x.call("item.updated");event.item.result.isError=true;
    return [start,x.call("item.started",{id:"ledger"},null),event,x.call(),x.judgment,end];},"SOURCE_TOOL_FAILED"],
  ["forbidden tool",x=>{const event=x.call();event.item.tool="execute_registered";return [start,event,x.judgment,end];},"SOURCE_TOOL_INVALID"],
  ["arbitrary pre-turn error",x=>[{...warning,item:{...warning.item,message:"Transport failed"}},start,x.call(),x.judgment,end],"ITEM_INVALID"],
  ["warning after turn started",x=>[start,warning,x.call(),x.judgment,end],"ITEM_INVALID"],
  ["warning carrying tool fields",x=>[{...warning,item:{...warning.item,server:"vydykhai_review"}},start,x.call(),x.judgment,end],"ITEM_INVALID"],
  ["duplicate judgments",x=>[start,x.call(),x.judgment,x.judgment,end],"JUDGMENT_INVALID"],
  ["multiple turns",x=>[start,start,x.call(),x.judgment,end],"INCOMPLETE"],
  ["missing turn start",x=>[x.call(),x.judgment,end],"INCOMPLETE"],
  ["failed turn",x=>[start,x.call(),x.judgment,{type:"turn.failed",error:{message:"private failure"}},end],"INCOMPLETE"],
  ["crossed thread",x=>[start,{type:"thread.started",thread_id:"other"},x.call(),x.judgment,end],"CROSSED_THREAD"],
  ["post-terminal read",x=>[start,x.call(),x.judgment,end,x.call()],"INCOMPLETE"],
  ["missing call id",x=>{const event=x.call();delete event.item.id;return [start,event,x.judgment,end];},"ITEM_INVALID"],
  ["empty discovery original callback gap",x=>[start,x.call(),discovery("item.started",null),discovery(),x.judgment,end]],
  ["empty discovery completed-only",x=>[start,discovery(),x.call(),x.judgment,end]],
  ["empty discovery coherent update",x=>[start,discovery("item.started",null),discovery("item.updated"),
    discovery(),x.call(),x.judgment,end]],
  ["empty discovery after judgment",x=>[start,x.call(),x.judgment,discovery(),end],"SOURCE_AFTER_JUDGMENT"],
  ["empty discovery before turn",x=>[discovery(),start,x.call(),x.judgment,end],"ITEM_INVALID"],
  ["empty discovery orphan update",x=>[start,discovery("item.updated"),discovery(),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery incomplete",x=>[start,discovery("item.started",null),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INCOMPLETE"],
  ["empty discovery duplicate completion",x=>[start,discovery(),discovery(),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery duplicate start",x=>[start,discovery("item.started",null),discovery("item.started",null),
    discovery(),x.call(),x.judgment,end],"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery reader ID collision",x=>{const event=discovery();event.item.id="read-1";
    return [start,x.call("item.started",{id:"ledger"},null),event,x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery changed ID",x=>{const event=discovery();event.item.id="changed";
    return [start,discovery("item.started",null),event,x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INCOMPLETE"],
  ["empty discovery argument drift",x=>{const event=discovery("item.updated");event.item.arguments={server:"codex"};
    return [start,discovery("item.started",null),event,discovery(),x.call(),x.judgment,end];},"SOURCE_ARGUMENTS_INVALID"],
  ["empty discovery server drift",x=>{const event=discovery();event.item.server="vydykhai_review";event.item.tool="list_sources";
    return [start,discovery("item.started",null),event,x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery unknown tool",x=>{const event=discovery();event.item.tool="read_resource";
    return [start,event,x.call(),x.judgment,end];},"SOURCE_TOOL_INVALID"],
  ["empty discovery effect tool",x=>{const event=discovery();event.item.tool="execute_registered";
    return [start,event,x.call(),x.judgment,end];},"SOURCE_TOOL_INVALID"],
  ["empty discovery wrong reader",x=>{const event=discovery();event.item.server="other";
    return [start,event,x.call(),x.judgment,end];},"SOURCE_TOOL_INVALID"],
  ["empty discovery status regression",x=>{const event=discovery("item.updated");event.item.status="completed";
    return [start,discovery("item.started",null),event,discovery("item.updated"),discovery(),x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery tool error",x=>{const event=discovery();event.item.error={message:"failed"};
    return [start,event,x.call(),x.judgment,end];},"SOURCE_TOOL_FAILED"],
  ["empty discovery contradictory result",x=>{const result=structuredClone(emptyResult);result.content[0].text='{"resources":[{"uri":"public:x"}]}';
    return [start,discovery("item.started",null),discovery("item.updated",result),discovery(),x.call(),x.judgment,end];},"SOURCE_LIFECYCLE_INVALID"],
  ["empty discovery cannot replace acquisition",x=>[start,discovery(),x.judgment,end],"NO_SOURCE_ACQUISITION"],
  ["empty discovery cannot replace required source",x=>[start,discovery(),x.call("item.completed",{id:"other"},x.other),x.judgment,end],"REQUIRED_SOURCE_UNREAD"],
  ["empty discovery cannot support citation",x=>{const judgment=structuredClone(x.judgment),answer=JSON.parse(judgment.item.text);
    answer.rowGroups[0].sourceIds=["discovery-1"];judgment.item.text=JSON.stringify(answer);
    return [start,discovery(),x.call(),judgment,end];},"UNREAD_EVIDENCE"],
];
for(const [name,change,error="EMPTY_DISCOVERY_INVALID"] of [
  ["pretty JSON whitespace",r=>{r.content[0].text=' \t\r\n{\n "resources" \t: [ \r\n ]\n}\r\n\t ';},null],
  ["original duplicate resource keys",r=>{r.content[0].text='{"resources":[{"uri":"public:synthetic"}],"resources":[]}';}],
  ["escaped duplicate resource key",r=>{r.content[0].text='{"resources":[{"uri":"public:synthetic"}],"\\u0072esources":[]}';}],
  ["escaped empty resource key",r=>{r.content[0].text='{"\\u0072esources":[]}';}],
  ["non-JSON trailing whitespace",r=>{r.content[0].text='{"resources":[]}\u2028';},/JSON/],
  ["nonempty resources",r=>{r.content[0].text='{"resources":[{"uri":"public:x"}]}';}],
  ["extra JSON metadata",r=>{r.content[0].text='{"resources":[],"metadata":{}}';}],
  ["wrong JSON shape",r=>{r.content[0].text='{}';}],
  ["structured content not null",r=>{r.structured_content={};}],
  ["missing structured content",r=>{delete r.structured_content;}],
  ["extra result metadata",r=>{r.metadata={};}],
  ["unobserved isError false",r=>{r.isError=false;}],
  ["failed isError true",r=>{r.isError=true;},"SOURCE_TOOL_FAILED"],
  ["extra block metadata",r=>{r.content[0].metadata={};}],
  ["extra image block",r=>{r.content.push({type:"image",data:"AA==",mimeType:"image/png"});},"SOURCE_READBACK_INVALID"],
  ["image instead of text",r=>{r.content=[{type:"image",data:"AA==",mimeType:"image/png"}];},"SOURCE_READBACK_INVALID"],
])cases.push([`empty discovery ${name}`,x=>{const result=structuredClone(emptyResult);change(result);
  return [start,discovery("item.completed",result),x.call(),x.judgment,end];},error]);
for(const [name,eventsFor,error] of cases)test(`actual REVIEW callback ${name}`,async t=>{
  const x=await fixture(t),events=eventsFor(x);
  supplied={state:"CLOSED",code:0,reason:null,signal:null,status:"CLI_EXIT_OK",errors:"",
    output:events.map(e=>JSON.stringify(e)).join("\n")+"\n"};dispatches=0;
  if(error)await assert.rejects(x.review.review(x.offer),error instanceof RegExp?error:new RegExp(`MODEL_REVIEW_${error}`));
  else assert.equal((await x.review.review(x.offer)).rows.length,87);
  const retained=await x.review.observe(x.offer.runId);
  assert.equal(retained.state,"STOPPED");assert.equal(!!retained.verdict,!error);
  if(error)assert.equal(retained.candidate,undefined);
  else assert.deepEqual(retained.readSources.map(r=>r.id),["ledger"]);
  const trace=await readFile(path.join(x.directory,retained.trace.file));
  assert.equal(sha256(trace),retained.trace.sha256);
  assert.equal(JSON.parse(trace).output,supplied.output);
  assert.equal((await x.review.capacity()).used,1);assert.equal(dispatches,1);
  const reopened=await openModelReview(x.config);
  assert.deepEqual(await reopened.observe(x.offer.runId),retained);
  await assert.rejects(x.review.review(x.offer),/ALREADY_DISPATCHED/);
  assert.equal(dispatches,1);
});
