import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,realpath,rm,access} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {appendProspectiveSources,prospectiveAcknowledgmentPacket,validateProspectiveAckDelta,publishProspectiveCheckpoint,requireProspectiveSnapshot} from "../scripts/run-prospective-cycle.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
import {requireCycleReads} from "../scripts/qualify-control-cycle.mjs";
test("prospective publication reopens registry; appended acquisition is validated and new-source drift is visible",async t=>{
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),"prospective-publication-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"workspace");await mkdir(workspace,{mode:0o700});
  await writeFile(path.join(workspace,"old.json"),"{}");await writeFile(path.join(workspace,"new.json"),"{\"actual\":true}");
  const file=path.join(root,"sources.json");
  await writeFile(file,JSON.stringify({schema:"control.review-sources.v1",workspace,sources:[{id:"old",path:"old.json",purpose:"original"}]}),{mode:0o600});
  const old=await openReviewSources(file);
  const appended=await appendProspectiveSources(file,[{id:"new",path:"new.json",purpose:"actual newly published"}]);
  assert.equal((await old.snapshot()).rows.length,1);assert.equal(appended.rows.length,2);
  const read=await(await openReviewSources(file)).read({id:"new"});
  const result={output:JSON.stringify({type:"item.completed",item:{type:"mcp_tool_call",server:"vydykhai_review",tool:"read_source",status:"completed",
    result:{content:[{type:"text",text:JSON.stringify(read)}]}}})+"\n"};
  assert.doesNotThrow(()=>requireCycleReads(result,["new"],appended));
  await writeFile(path.join(workspace,"new.json"),"{\"changed\":true}");
  const changed=await(await openReviewSources(file)).snapshot();assert.notEqual(changed.digest,appended.digest);
  assert.throws(()=>requireCycleReads(result,["new"],changed),/NOT_ACQUIRED/);
});
test("ACK delta permits only exact packet replacement and three actual evidence additions",()=>{
  const row=id=>({id,path:`${id}.json`,purpose:id,status:"AVAILABLE",sha256:"a".repeat(64)});
  const before={rows:[row("execution-packet"),row("contract")]};
  const after={rows:[{...before.rows[0],sha256:"b".repeat(64)},before.rows[1],
    ...["actual-worker-readback","actual-readback-record","actual-readiness-environment"].map(row)]};
  assert.doesNotThrow(()=>validateProspectiveAckDelta(before,after,"b".repeat(64)));
  for(const mutate of [v=>v.rows[1].sha256="c".repeat(64),v=>v.rows[0].purpose="substituted",
    v=>v.rows.push(row("extra")),v=>v.rows.pop(),v=>v.rows[2].status="MISSING"]){
    const changed=structuredClone(after);mutate(changed);
    assert.throws(()=>validateProspectiveAckDelta(before,changed,"b".repeat(64)));
  }
  assert.throws(()=>validateProspectiveAckDelta(before,after,"c".repeat(64)));
});
test("accepted worker acquisition snapshot cannot be rebased onto changed preparation or environment",()=>{
  const rows=["contract","actual-preparation","actual-environment"].map(id=>({id,sha256:"a".repeat(64),status:"AVAILABLE"}));
  const basis={rows,digest:sha256(canonicalJson(rows)),bytes:100};
  assert.doesNotThrow(()=>requireProspectiveSnapshot(structuredClone(basis),basis));
  for(const id of ["actual-preparation","actual-environment"]){
    const changed=structuredClone(basis);changed.rows.find(r=>r.id===id).sha256="b".repeat(64);
    changed.digest=sha256(canonicalJson(changed.rows));
    assert.throws(()=>requireProspectiveSnapshot(changed,basis),/SOURCE_DRIFT_BEFORE_READ/);
  }
});
test("read-only checkpoint is not published when final host or parent validation fails",async t=>{
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),"prospective-checkpoint-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"workspace"),journal=path.join(root,"journal"),host=path.join(root,"host");
  for(const dir of [workspace,journal,host])await mkdir(dir,{mode:0o700});
  await writeFile(path.join(workspace,"source.json"),"{}");
  const registryFile=path.join(root,"sources.json");
  await writeFile(registryFile,JSON.stringify({schema:"control.review-sources.v1",workspace,
    sources:[{id:"source",path:"source.json",purpose:"parent proof"}]}),{mode:0o600});
  const state={paused:false},name="0000000001.json";
  await writeFile(path.join(journal,name),JSON.stringify({state}));
  const p={root,parentEvidence:{refs:[],journalRoot:journal,journalNames:[name],stateHash:sha256(canonicalJson(state)),
    registryFile,sourceDigest:(await(await openReviewSources(registryFile)).snapshot()).digest}};
  const file=path.join(root,"checkpoint.json"),checkpoint={status:"SUCCESS"};
  await writeFile(path.join(host,"unexpected.json"),"{}");
  await assert.rejects(publishProspectiveCheckpoint(p,file,checkpoint),/MUTATED_HOST/);
  await assert.rejects(access(file),{code:"ENOENT"});
  await rm(path.join(host,"unexpected.json"));
  await writeFile(path.join(journal,name),JSON.stringify({state:{paused:true}}));
  await assert.rejects(publishProspectiveCheckpoint(p,file,checkpoint),/PARENT_STATE_CHANGED/);
  await assert.rejects(access(file),{code:"ENOENT"});
  await writeFile(path.join(journal,name),JSON.stringify({state}));
  await publishProspectiveCheckpoint(p,file,checkpoint);await access(file);
});
test("actual ACK publication retires pending acknowledgment, not readiness or synthetic history",()=>{
  const packet={acknowledgment:"PENDING_ACTUAL_WORKER",readiness:"NOT_ESTABLISHED",preparation:[{operation:"confirm",status:"PREPARED"}],
    semanticApproval:"NOT_ESTABLISHED",request:{operation:"resume",readback:null}};
  const request={operation:"resume",readback:{path:"actual-readback.json",sha256:"a".repeat(64)}};
  const args={request,worker:"worker-1",evidence:{path:"actual-worker.json",sha256:"b".repeat(64)},environment:{path:"env.json",sha256:"c".repeat(64)}};
  const updated=prospectiveAcknowledgmentPacket(packet,args);
  assert.equal(updated.acknowledgment.status,"ACTUAL_WORKER_ACKNOWLEDGED");assert.deepEqual(updated.acknowledgment.evidence,request.readback);
  assert.equal(updated.readiness,"NOT_ESTABLISHED");assert.equal(updated.semanticApproval,"NOT_ESTABLISHED");
  assert.deepEqual(updated.preparation,packet.preparation);assert.equal(updated.actualWorkerApplication.executionAuthorized,false);
  assert.equal(packet.acknowledgment,"PENDING_ACTUAL_WORKER");
  assert.throws(()=>prospectiveAcknowledgmentPacket(packet,{...args,request:{operation:"resume",readback:null}}),/ACK_PUBLICATION/);
});
