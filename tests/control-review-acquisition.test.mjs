import test from "node:test";
import assert from "node:assert/strict";
import {sha256} from "../scripts/memory-brief.mjs";
import {sourceWindow, openWindowReader, completeWindowSources, validateWindowAcquisition, validateReviewAcquisition} from "../scripts/control-review-acquisition.mjs";
import {validateModelReviewAcquisition} from "../scripts/control-model-review.mjs";
import {reviewCodexConfig} from "../scripts/control-codex-profile.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";

const policy={maxBytes:1024,maxChars:256};
const source=(text,id="original")=>({id,path:`${id}.md`,purpose:"Exact original",status:"AVAILABLE",sha256:sha256(text),text});
const snapshot=s=>{const {text,...row}=s;return {rows:[row]};};
function acquire(s,requests,p=policy) {
  let used=0;
  const calls=requests.map(args=>{const value=sourceWindow(s,args,p,used);if(value.window)used=value.window.afterBytes;return {args,value};});
  const originals=new Map([[s.id,s]]),readbacks=calls.map(c=>c.value).filter(r=>r.status!=="NEEDS_DISCOVERY");
  readbacks.push(...completeWindowSources(readbacks,originals));
  return {calls,originals,readbacks,policy:p};
}
test("exact Unicode windows bind original hash, slice hash and code-point range",()=>{
  const s=source("A\u{1f642}\u0411C"),r=sourceWindow(s,{id:s.id,offset:1,length:2},policy);
  assert.equal(r.text,"\u{1f642}\u0411");assert.equal(r.window.sourceSha256,s.sha256);
  assert.equal(r.sha256,sha256(r.text));assert.notEqual(r.id,s.id);
  assert.equal(r.window.length,2);assert.equal(r.window.afterBytes,6);
});
test("partial acquisition cannot satisfy a required whole source",()=>{
  const s=source("x".repeat(400)),a=acquire(s,[{id:s.id}]);
  assert.throws(()=>validateModelReviewAcquisition(snapshot(s),a.readbacks,[s.id],undefined,a),/REQUIRED_SOURCE_UNREAD/);
});
test("complete contiguous windows establish whole acquisition without invented bytes",()=>{
  const s=source("x".repeat(400)),a=acquire(s,[{id:s.id},{id:s.id,offset:256}]);
  assert.doesNotThrow(()=>validateModelReviewAcquisition(snapshot(s),a.readbacks,[s.id],undefined,a));
  assert.equal(a.readbacks.at(-1).sha256,s.sha256);assert.equal(a.readbacks.at(-1).text,s.text);
});
test("a gap remains incomplete even if the final window reaches EOF",()=>{
  const s=source("x".repeat(400)),a=acquire(s,[{id:s.id,length:100},{id:s.id,offset:200}]);
  assert.equal(completeWindowSources(a.readbacks,a.originals).length,0);
});
test("source hash drift and forged window text are rejected",()=>{
  const s=source("exact"),a=acquire(s,[{id:s.id}]);
  a.calls[0].value.text="wrong";
  assert.throws(()=>validateWindowAcquisition(snapshot(s),a.calls,a.originals,policy),/WINDOW_READBACK_INVALID/);
  const b=acquire(s,[{id:s.id}]);b.originals.set(s.id,source("new"));
  assert.throws(()=>validateWindowAcquisition(snapshot(s),b.calls,b.originals,policy),/SOURCE_DRIFT/);
});
test("global byte budget is explicit NEEDS_DISCOVERY, never missing or acquired proof",()=>{
  const s=source("x".repeat(1200)),a=acquire(s,[0,256,512,768,1024].map(offset=>({id:s.id,offset})));
  const limit=a.calls.at(-1).value;
  assert.equal(limit.status,"NEEDS_DISCOVERY");assert.equal(limit.sourceSha256,s.sha256);
  assert.equal(a.readbacks.some(r=>r.status==="NEEDS_DISCOVERY"),false);
  assert.deepEqual(validateWindowAcquisition(snapshot(s),a.calls,a.originals,policy),{usedBytes:1024,limitReached:true});
  assert.throws(()=>validateModelReviewAcquisition(snapshot(s),a.readbacks,[s.id],undefined,a),/REQUIRED_SOURCE_UNREAD/);
});
test("small full sources retain the original id and require no fake coverage",()=>{
  const s=source("small"),a=acquire(s,[{id:s.id}]);
  assert.equal(a.readbacks[0].id,s.id);
  assert.doesNotThrow(()=>validateModelReviewAcquisition(snapshot(s),a.readbacks,[s.id],undefined,a));
});
test("window aliases never bypass acceptance-bound source scope",()=>{
  const s=source("x".repeat(400)),a=acquire(s,[{id:s.id}]);
  const scope={schema:"control.review-source-scope.v1",acceptanceSha256:"a".repeat(64),sourceIds:["other"]};
  assert.throws(()=>validateModelReviewAcquisition(snapshot(s),a.readbacks,[],scope,a),/SCOPE_EXPANSION_REQUIRED/);
});
test("persisted slice citations retain a recoverable original id, hash and range",()=>{
  const s=source("x".repeat(400)),r=sourceWindow(s,{id:s.id},policy);
  const answer=decodeReviewAnswer({schema:"control.review-answer.v2",rowGroups:[{ids:["C01.01"],status:"PASS",sourceIds:[r.id]}],
    newFindings:[],resolutions:[]},{readbacks:[r],offer:{key:"a".repeat(64),input:{previousFindings:[]}},reviewer:"reviewer",observedAt:new Date().toISOString()});
  assert.ok(answer.rows[0].evidence.includes(`#original=${s.id}:${s.sha256};range=0+256`));
});
test("malformed policy, range and over-budget counter are rejected",()=>{
  assert.throws(()=>validateReviewAcquisition({...policy,ignoreLimits:true}),/POLICY_INVALID/);
  for(const args of [{id:"original",offset:-1},{id:"original",length:257},{id:"original",offset:"0"},{id:"original",path:"escape"}])
    assert.throws(()=>sourceWindow(source("abc"),args,policy),/ARGUMENTS_INVALID/);
  assert.throws(()=>sourceWindow(source("abc"),{id:"original"},policy,1025),/CONTEXT_INVALID/);
});
test("concurrent source acquisition charges each result exactly once",async()=>{
  const s=source("x".repeat(400)),reader=openWindowReader({read:async()=>s},policy);
  const rows=await Promise.all([reader.read({id:s.id}),reader.read({id:s.id,offset:256})]);
  assert.equal(rows[0].window.beforeBytes,0);assert.equal(rows[1].window.beforeBytes,256);
  assert.equal(rows[1].window.afterBytes,400);
});
test("missing originals remain real MISSING, not a budget refusal",()=>{
  const s={id:"absent",path:"absent.md",purpose:"Original",status:"MISSING"};
  assert.deepEqual(sourceWindow(s,{id:s.id},policy),s);
});
test("bounded transport is opt-in and disables memory-recall budget bypass",()=>{
  const options={workspace:"/tmp/room",endpointFile:"/tmp/sources.json"};
  assert.equal(reviewCodexConfig(options)["mcp_servers.vydykhai_review"].args.length,2);
  assert.equal(JSON.parse(reviewCodexConfig({...options,reviewAcquisition:policy})["mcp_servers.vydykhai_review"].args[2]).maxBytes,1024);
  assert.throws(()=>reviewCodexConfig({...options,reviewAcquisition:policy,enableMemoryRecall:true}),/RECALL_WINDOW_UNSUPPORTED/);
});
