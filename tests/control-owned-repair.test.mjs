import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,symlink,rm,realpath,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {gradeCurrentReadback,inventoryCycleRoot,stageRepairCycle} from "../scripts/repair-control-cycle.mjs";
import {validateRepairAllocation,gradeRetainedRepairRecall,validateReadbackRecoveryEvidence,validReadbackSemanticDecision} from "../scripts/run-repair-control-cycle.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
import {validateRepairRegistry,replaceRepairRegistry,recordRepairCall,validateRepairSourceExtension} from "../scripts/repair-cycle-publication.mjs";
import {cycleOracle} from "../scripts/qualify-control-cycle.mjs";

const answer=()=>({...cycleOracle.recipe,producerEdits:[],rejected:["keep-last"],idea:{id:"CSV",disposition:"ASK_OWNER_NOT_IMPLEMENT"},
  temporalScope:"CURRENT_ONLY_NOT_HISTORICAL",worker:"worker",duplicatePolicy:"case-insensitive-reject",idPolicy:"preserve-exact",
  labelPolicy:"trim",orderPolicy:"codepoint",actionPolicy:"NO_ACTION_AUTHORIZED",
  stopConditions:["DUPLICATE_ID","OWNER_GATE","CONTROL_HOLD","UNPROVEN_ENVIRONMENT"]});
test("current readback does not certify past understanding, mutation or a missing stop condition",()=>{
  assert.deepEqual(gradeCurrentReadback(answer()),[]);
  for(const [key,value] of Object.entries({temporalScope:"HISTORICAL_PROVEN",worker:"worker-1",duplicatePolicy:"keep-last",
    idPolicy:"lowercase",labelPolicy:"unchanged",orderPolicy:"locale",actionPolicy:"EXECUTE",stopConditions:["DUPLICATE_ID"]})) {
    assert.ok(gradeCurrentReadback({...answer(),[key]:value}).includes(key),key);
  }
  assert.ok(gradeCurrentReadback(null).length);
});
test("bounded inventory hashes regular bytes, retains ownership and refuses symlinks",async()=>{
  const root=await realpath(await mkdtemp(path.join(os.tmpdir(),"owned-repair-")));
  try {
    await mkdir(path.join(root,"nested"));await writeFile(path.join(root,"nested/a.txt"),"retained");
    const row=await inventoryCycleRoot(root);assert.equal(row.rows.length,2);
    assert.ok(row.rows.every(r=>r.owner==="maintainer"&&r.disposition==="RETAIN"));
    assert.match(row.rows.find(r=>r.kind==="file").sha256,/^[a-f0-9]{64}$/);
    await symlink(path.join(root,"nested/a.txt"),path.join(root,"link"));
    await assert.rejects(inventoryCycleRoot(root),/REPAIR_INVENTORY_UNSAFE/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("repair allocation retains sixteen prior attempts and refuses budget/retry/model substitutions",()=>{
  const f={schema:"qualification.owned-repair-cycle.v1",priorRuns:Array(16).fill({}),allocation:{model:"gpt-6.1-sol",effort:"low",secondsPerCall:120,
    maxNewCalls:11,retries:0,calls:{currentReadback:1,postRepair:8,owner:1,retainedNext:1},priorAttempts:16,maxCumulativeAttempts:27,
      usage:"Review max2500000 observed input+output tokens, checked between calls; inside-turn ceiling not guaranteed"},
    profile:{maxReviewsPerTick:1,timeoutMs:122000,review:{maxCalls:8,episodeMaxDurationMs:3600000,episodeMaxUsageTokens:2500000,
      native:{model:"gpt-6.1-sol",effort:"low",timeoutMs:120000},episodeGroups:[["C20"],["C01","C02","C04","C15"],
        ["C05","C06","C07","C09","C19"],["C03","C11","C21","C26"],["C12","C18","C24"],
        ["C14","C16","C17","C25"],["C10","C22","C23","C28"],["C08","C13","C27"]]}}};
  assert.doesNotThrow(()=>validateRepairAllocation(f));
  for(const [key,value] of Object.entries({priorAttempts:0,retries:1,maxNewCalls:12,maxCumulativeAttempts:28,effort:"high"}))
    assert.throws(()=>validateRepairAllocation({...f,allocation:{...f.allocation,[key]:value}}),/REPAIR_ALLOCATION_CHANGED/);
  assert.throws(()=>validateRepairAllocation({...f,priorRuns:[]}),/REPAIR_ALLOCATION_CHANGED/);
  for(const [key,value] of Object.entries({model:"gpt-6-astra",effort:"high",timeoutMs:240000})) {
    const changed=structuredClone(f);changed.profile.review.native[key]=value;
    assert.throws(()=>validateRepairAllocation(changed),/REPAIR_DISPATCH_PROFILE_CHANGED/);
  }
  for(const key of ["maxCalls","episodeMaxDurationMs","episodeMaxUsageTokens"]) {
    const changed=structuredClone(f);changed.profile.review[key]++;assert.throws(()=>validateRepairAllocation(changed),/REPAIR_DISPATCH_PROFILE_CHANGED/);
  }
  const changed=structuredClone(f);changed.profile.maxReviewsPerTick=2;assert.throws(()=>validateRepairAllocation(changed),/REPAIR_DISPATCH_PROFILE_CHANGED/);
});
test("stage rejects implicit/relative fixture paths before mutation",async()=>{
  await assert.rejects(stageRepairCycle({previous:"relative",output:"also-relative"}),/REPAIR_PATHS_REQUIRED/);
});
test("retained recall must apply exact input policies and fresh CLOSED control",()=>{
  const current={enrollment:"CLOSED",assessedAction:"CONTROL_DONE_CONFIRMED"},value={...answer(),current:{...current,executionAuthorized:false}};
  assert.deepEqual(gradeRetainedRepairRecall(value,current),[]);
  assert.ok(gradeRetainedRepairRecall({...value,idPolicy:"lowercase"},current).includes("idPolicy"));
  assert.ok(gradeRetainedRepairRecall({...value,current:{...value.current,enrollment:"PENDING"}},current).includes("currentControl"));
  assert.ok(gradeRetainedRepairRecall(value,{...current,assessedAction:"REVIEW_DUE"}).includes("currentControl"));
});
test("a trace publication failure cannot erase an already spent call or its usage",async()=>{
  const runs=[],result={status:"CLI_EXIT_OK",output:JSON.stringify({type:"turn.completed",usage:{input_tokens:17,output_tokens:3}})};
  await assert.rejects(recordRepairCall({runs,name:"readback",result,seconds:2,saveTrace:async()=>{throw Error("EEXIST");}}),/REPAIR_TRACE_PUBLICATION_FAILED/);
  assert.equal(runs.length,1);assert.deepEqual(runs[0].usage,{input_tokens:17,output_tokens:3});assert.equal(runs[0].tracePublication,"FAILED");
});
test("registry count/byte limits, stale input and publication lock preserve original bytes",async()=>{
  assert.throws(()=>validateRepairRegistry({sources:Array.from({length:501},(_,i)=>({id:String(i)}))}),/REPAIR_REGISTRY_CAPACITY/);
  assert.throws(()=>validateRepairRegistry({sources:[{id:"a",purpose:"x".repeat(1024*1024)}]}),/REPAIR_REGISTRY_CAPACITY/);
  const root=await realpath(await mkdtemp(path.join(os.tmpdir(),"repair-registry-"))),file=path.join(root,"sources.json"),old=Buffer.from('{"sources":[{"id":"a"}]}');
  try {
    await writeFile(file,old);await assert.rejects(replaceRepairRegistry(file,Buffer.from("stale"),{sources:[{id:"b"}]}),/REPAIR_PRIOR_SOURCES_CHANGED/);
    assert.deepEqual(await readFile(file),old);await writeFile(`${file}.repair-lock`,"prior lock");
    await assert.rejects(replaceRepairRegistry(file,old,{sources:[{id:"b"}]}),{code:"EEXIST"});assert.deepEqual(await readFile(file),old);
    await rm(`${file}.repair-lock`);await replaceRepairRegistry(file,old,{sources:[{id:"b"}]});assert.deepEqual(JSON.parse(await readFile(file)),{sources:[{id:"b"}]});
  }finally{await rm(root,{recursive:true,force:true});}
});
test("source extension cannot absorb an existing byte change or silently narrow or enlarge scope",()=>{
  const before={rows:[{id:"old",status:"AVAILABLE",sha256:"a"}]},extra={id:"new",status:"AVAILABLE",sha256:"b"};
  assert.doesNotThrow(()=>validateRepairSourceExtension(before,{rows:[...before.rows,extra]},["new"]));
  for(const rows of [[{...before.rows[0],sha256:"changed"},extra],[extra],[...before.rows,extra,{id:"unapproved"}],
    [...before.rows,{...extra,status:"MISSING"}]])
    assert.throws(()=>validateRepairSourceExtension(before,{rows},["new"]),/REPAIR_EXISTING_SOURCE_CHANGED/);
});
test("semantic recovery binds the exact completed answer and failed report without refunds",()=>{
  const hash=v=>sha256(canonicalJson(v)),trace=Buffer.from("retained raw trace"),state={paused:false},old={sources:{digest:"sources"},runtime:{digest:"runtime"}},
    result={failure:"REPAIR_CURRENT_READBACK_WRONG",runs:Array(17).fill({status:"SPENT"}),state},
    decision={schema:"qualification.readback-semantic-decision.v1",reviewer:"Aquinas-Astra-Low",decision:"ACCEPT_CURRENT_READBACK",temporalScope:"CURRENT_ONLY_NOT_HISTORICAL",
      traceSha256:sha256(trace),freezeSha256:sha256(canonicalJson(old)+"\n"),failedResultSha256:sha256(canonicalJson(result)+"\n"),
      evidence:Array(5).fill({subject:"Meaning",finding:"Independent exact source-backed meaning review",sources:["source:contract"]}),
      authority:{hostClosure:false,executionAuthorized:false,releaseReady:false,catalogCoverageWaived:false,historicalQualificationRecovered:false}},
    f={priorRuns:result.runs,sources:old.sources,runtime:old.runtime,stateHash:hash(state),recovery:{freezeSha256:hash(old),resultSha256:hash(result),
      traceSha256:sha256(trace),decisionSha256:hash(decision)}};
  assert.doesNotThrow(()=>validateReadbackRecoveryEvidence(f,{old,result,trace,decision}));
  assert.equal(validReadbackSemanticDecision(decision),true);
  assert.equal(validReadbackSemanticDecision({...decision,reviewer:"unrelated"}),false);
  for(const key of Object.keys(decision.authority))
    assert.equal(validReadbackSemanticDecision({...decision,authority:{...decision.authority,[key]:true}}),false,key);
  for(const values of [{old,result,trace:Buffer.from("substituted"),decision},{old,result:{...result,runs:result.runs.slice(1)},trace,decision},
    {old,result,trace,decision:{...decision,decision:"REJECT"}},{old,result,trace,decision:{...decision,reviewer:"unrelated"}},
    {old:{...old,runtime:{digest:"other"}},result,trace,decision}])
    assert.throws(()=>validateReadbackRecoveryEvidence(f,values),/REPAIR_RECOVERY_NOT_BOUND/);
});
