import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import {endpointFixture} from "./control-endpoint-fixture.mjs";
import {inspectControlRuntime,stageControlRuntime} from "../scripts/control-runtime.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {resumeCycle} from "../scripts/resume-control-cycle.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";
async function setup(t,{expiresInMs=60000}={}){
  const x=await endpointFixture(t),out=path.join(x.privateRoot,"qualification"),packages=path.join(x.privateRoot,"packages");
  await mkdir(out,{mode:0o700});await mkdir(packages,{mode:0o700});
  const sourceRoot=fileURLToPath(new URL("..",import.meta.url)),identity=await inspectControlRuntime(sourceRoot);
  const runtime=await stageControlRuntime({sourceRoot,directory:packages,workspace:x.f.root,expectedDigest:identity.digest});
  await x.f.put("action.mjs","import {writeFileSync} from 'node:fs';writeFileSync('continued.json',JSON.stringify({used:['AA','b']}),{flag:'wx'});\n");
  const ref=n=>x.f.put(`${n}.md`,n);
  const a={schema:"work.product-acceptance.v1",id:"consumer",project:"fixture",task:"previous",owner:"owner",executor:"worker",
    status:"ACCEPTED",acceptedAt:new Date().toISOString(),producerReturn:await ref("return"),artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)a.retention.push({id,required:true,expected:await ref(id)});
  await x.host.accept(a);
  await runControlTick(x.host,{review:async offer=>({phase:"POST_ACCEPT",key:offer.key,runId:offer.runId,reviewer:"reviewer",observedAt:new Date().toISOString(),findings:[],
    resultUse:{status:"ALLOW",acceptanceSha256:sha256(canonicalJson(a)),evidence:"fixture:independent-result",findingIds:[]},
    rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"synthetic protocol only"}))})});
  const owner=ownerControl(x.host,"owner");await owner.readVerdict("consumer");
  await owner.respond("consumer",{owner:"owner",action:"CONTINUE",nextAction:"TASK-1",evidence:"fixture:approved"});
  await x.approve();const grant=Object.values((await x.host.snapshot()).grants)[0];
  await x.host.approveCommand(grant.binding,{reviewer:"reviewer",reviewReceipt:"fixture:scoped",dependencies:["consumer"],expiresAt:Date.now()+expiresInMs});
  const save=(name,v)=>writeFile(path.join(out,name),JSON.stringify(v),{mode:0o600});
  await save("freeze.json",{runtime,root:x.privateRoot,workspace:x.f.root,config:x.profile.config});
  await writeFile(path.join(x.privateRoot,"next-worker.json"),JSON.stringify({...x.profile,requests:[{...x.profile.requests[0],id:"continue"}]}),{mode:0o600});
  await save("result.json",{status:"QUALIFICATION_FAILED",runtime:runtime.digest,checks:{failure:"WORKER_ACTION_NOT_COMPLETED"},state:await x.host.snapshot()});
  await save("trace-continue.json",{state:"CLOSED",status:"CLI_EXIT_OK",output:JSON.stringify({type:"turn.completed"})});
  return {...x,out,save};
}
test("zero-model continuation recovery preserves original failure and refuses replay",{skip:process.platform!=="darwin"},async t=>{
  const x=await setup(t,{expiresInMs:200}),before=await readFile(path.join(x.out,"result.json"));
  await delay(300);
  const r=await resumeCycle(x.out,{decisionEvidence:"independent:test-only"});
  assert.equal(r.status,"SCOPED_CYCLE_CLOSED_AFTER_DETERMINISTIC_RECOVERY",r.error);
  assert.equal(r.paidCalls,0);assert.equal(r.originalResultPreserved,true);assert.equal(r.state.acceptances.consumer.enrollment,"CLOSED");
  assert.deepEqual(await readFile(path.join(x.out,"result.json")),before);
  await assert.rejects(resumeCycle(x.out,{decisionEvidence:"independent:test-only"}),/RETAINED_STATE_CHANGED/);
});
test("changed host or any prior tool dispatch prevents recovery",{skip:process.platform!=="darwin"},async t=>{
  for(const mode of ["pause","tool"]){const x=await setup(t);
    if(mode==="pause")await x.host.pause(true);
    else await x.save("trace-continue.json",{state:"CLOSED",status:"CLI_EXIT_OK",output:JSON.stringify({type:"item.completed",item:{type:"mcp_tool_call"}})});
    await assert.rejects(resumeCycle(x.out,{decisionEvidence:"independent:test-only"}),/RETAINED_STATE_CHANGED|PRIOR_ATTEMPT_NOT_PROVEN/);
    await assert.rejects(readFile(path.join(x.f.root,"continued.json")),{code:"ENOENT"});
  }
});
