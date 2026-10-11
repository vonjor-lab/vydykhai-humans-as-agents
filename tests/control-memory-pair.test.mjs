import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {pairGraph,stageMemoryPair,runMemoryPair,gradePairRecipe,compilePairRecipe} from "../scripts/qualify-memory-pair.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {reviewCodexConfig} from "../scripts/control-codex-profile.mjs";
import {validateMemoryGraph} from "../scripts/vydykhai.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";
import {openControlHost} from "../scripts/control-host.mjs";

const manifest = JSON.parse(await readFile(new URL("../vydykhai.json",import.meta.url),"utf8"));

test("registered recall is read-only, source-bound, non-authoritative and explicitly enabled only for factual use",async t=>{
  const root = await realpath(await mkdtemp(path.join(tmpdir(),"registered-recall-"))); t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace = path.join(root,"public"); await mkdir(workspace,{mode:0o700});
  await writeFile(path.join(workspace,"memory.md"),pairGraph());
  assert.deepEqual(validateMemoryGraph(pairGraph(),manifest),[]);
  const file = path.join(root,"sources.json");
  await writeFile(file,JSON.stringify({schema:"control.review-sources.v1",workspace,sources:[
    {id:"memory",path:"memory.md",purpose:"Shared graph"},{id:"missing",path:"missing.md",purpose:"Unavailable graph"}]}),{mode:0o600});
  const s = await openReviewSources(file), result = await s.recallMemory({id:"memory",request:"Connect a JSON consumer of the bundle module"});
  assert.equal(result.status,"RECALL_CANDIDATE"); assert.equal(result.items.length,4); assert.equal(result.admission,"NOT_GRANTED");
  assert.equal(result.source.sha256,sha256(pairGraph())); assert.equal(await readFile(path.join(workspace,"memory.md"),"utf8"),pairGraph());
  assert.doesNotMatch(JSON.stringify(result),/candidate\.mjs/);
  assert.equal((await s.recallMemory({id:"missing",request:"Use bundle"})).status,"NEEDS_DISCOVERY");
  await assert.rejects(s.recallMemory({id:"../memory",request:"Use bundle"}),/NOT_REGISTERED/);
  await assert.rejects(s.recallMemory({id:"memory",request:"Use bundle",approval:true}),/REQUEST_INVALID/);
  await writeFile(path.join(workspace,"memory.md"),pairGraph().replace("Declared nodes: 4","Declared nodes: 5"));
  assert.equal((await s.recallMemory({id:"memory",request:"Use bundle"})).code,"MEMORY_GRAPH_INVALID");
  const opts = {workspace,endpointFile:file};
  assert.deepEqual(reviewCodexConfig(opts)["mcp_servers.vydykhai_review"].enabled_tools,["list_sources","read_source"]);
  assert.ok(reviewCodexConfig({...opts,enableMemoryRecall:true})["mcp_servers.vydykhai_review"].enabled_tools.includes("recall_memory"));
});

function scripted(answers) {
  let call = 0;
  return async options => {
    const s = await openReviewSources(options.endpointFile), list = await s.list(), events = [];
    for (const entry of list) {
      const recalled = options.enableMemoryRecall && entry.id === "memory";
      const args = recalled ? {id:entry.id,request:"Connect a JSON consumer of the bundle module"} : {id:entry.id};
      const result = recalled ? await s.recallMemory(args) : await s.read(args);
      events.push({type:"item.completed",item:{type:"mcp_tool_call",server:"vydykhai_review",tool:recalled?"recall_memory":"read_source",
        arguments:args,status:"completed",result:{content:[{type:"text",text:JSON.stringify(result)}]}}});
    }
    events.push({type:"item.completed",item:{type:"agent_message",text:JSON.stringify(answers[call++])}},
      {type:"turn.completed",usage:{input_tokens:0,output_tokens:0}});
    return {status:"CLI_EXIT_OK",output:events.map(e=>JSON.stringify(e)).join("\n"),reason:null};
  };
}

test("scripted pair exercises actual protected I/O and retained knowledge without being mislabeled native",{skip:process.platform !== "darwin"},async t=>{
  const parent = await realpath(await mkdtemp(path.join(tmpdir(),"memory-pair-local-"))); t.after(()=>rm(parent,{recursive:true,force:true}));
  const output = path.join(parent,"case");
  const staged = await stageMemoryPair({output,binary:process.execPath,authHome:parent});
  t.after(()=>rm(staged.workspace,{recursive:true,force:true}));
  const graph = pairGraph();
  const meaning = Object.fromEntries(["decision","rejection","success","commitment"].map((key,i)=>[key,
    graph.split(`### MEM-${i} - ${key}`)[1].split("- Apply: ")[1].split("\n- Avoid:")[0]]));
  const commitment = graph.split("### MEM-3 - commitment")[1];
  meaning.commitmentOwner = commitment.match(/^- Owner gate: (.*)$/m)[1];
  meaning.commitmentTrigger = commitment.match(/^- Recall when: (.*)$/m)[1];
  meaning.commitmentReturn = commitment.match(/^- Return \/ close when: (.*)$/m)[1];
  const incomplete = {...meaning}; delete incomplete.commitmentOwner;
  assert.throws(()=>pairGraph(incomplete),/MODEL_DELTA_INCOMPLETE/,"formatter must not silently restore lost owner semantics");
  const prepared = {entrypoint:"buildBundle",revision:"bundle-r2",preprocess:"none",format:"json",producerEdits:[],rejected:["keep-last"],
    deferred:{id:"CSV",action:"ASK_OWNER_NOT_IMPLEMENT"},meaning};
  assert.deepEqual(gradePairRecipe(prepared),[]);
  assert.deepEqual(gradePairRecipe({...prepared,rejected:[],deferred:{id:"MEM-3",action:"Ask module-owner about CSV; do not implement"}}),[],
    "source meaning belongs to independent judgment, not undisclosed enum spellings");
  assert.deepEqual(gradePairRecipe({...prepared,format:"JSON"}),[],"public JSON semantics must not depend on unspecified letter case");
  const descriptor = {...prepared,preprocess:[],format:"bundle/v1"};
  assert.deepEqual(gradePairRecipe(descriptor),[]);
  assert.deepEqual(compilePairRecipe(descriptor),{...prepared,preprocess:"none",format:"json"});
  assert.deepEqual(descriptor.preprocess,[],"compiler does not mutate the native proposal");
  for (const patch of [{preprocess:["lowercase"]},{preprocess:"lowercase"},{format:"xml"},{format:"bundle/v2"},{revision:"bundle-r1"}])
    assert.throws(()=>compilePairRecipe({...prepared,...patch}),/PUBLIC_WIRING_INVALID/);
  const checks = {decisions:[{id:"one",decision:"REPAIR",problems:["Missing owner commitment"]},{id:"two",decision:"APPROVE",problems:[]}]};
  const result = await runMemoryPair(output,{runWorker:scripted([prepared,checks,{decision:"ACCEPT",problems:[]},prepared,
    {decision:"APPROVE",problems:[]},{decision:"ACCEPT",problems:[]}])});
  assert.equal(result.status,"SCRIPTED_PAIR_ONLY",JSON.stringify({failure:result.failure,results:result.results}));
  assert.equal(result.nativeModelEvidence,false); assert.equal(result.runs.length,6);
  assert.equal(result.producerPreserved,true); assert.equal(result.results.a.output.entries[0].id,"AA");
  assert.equal(result.results.b.output.entries[0].id,"Z");
  assert.equal(Object.values(result.host.reservations).filter(r=>r.status === "COMPLETED").length,2);
  assert.equal(result.host.paused,true); assert.equal(result.release,"NO_RELEASE");
  const next = result.receipts.find(r=>r.name === "prepare-b");
  assert.ok(!next.sources.rows.some(r=>r.id === "original"));
  assert.ok(next.sources.rows.some(r=>r.id === "input" && r.path === "input-b.json"));
  assert.ok(result.receipts.find(r=>r.name === "readiness-b").sources.rows.some(r=>r.id === "input"));
  assert.ok((await readFile(path.join(staged.workspace,"memory.md"),"utf8")).includes("Watermark: accepted-a"));
  const blockedOutput = path.join(parent,"contradictory-readiness");
  const blockedStage = await stageMemoryPair({output:blockedOutput,binary:process.execPath,authHome:parent});
  t.after(()=>rm(blockedStage.workspace,{recursive:true,force:true}));
  const contradictory = {decisions:[checks.decisions[0],{id:"two",decision:"APPROVE",problems:["Owner gate contradicts original"]}]};
  const blocked = await runMemoryPair(blockedOutput,{runWorker:scripted([prepared,contradictory])});
  assert.equal(blocked.failure,"INDEPENDENT_DIFFERENTIAL_READINESS_FAILED");
  assert.equal(blocked.runs.length,2); assert.equal(blocked.results.a,undefined);
  assert.equal(Object.values(blocked.host.reservations).length,0,"unresolved readiness must prevent execution");
  const approve = async out => ({traceSha256:sha256(await readFile(path.join(out,"prepare-a-trace.json"))),
    harnessSha256:sha256(await readFile(new URL("../scripts/qualify-memory-pair.mjs",import.meta.url)))});
  await assert.rejects(runMemoryPair(blockedOutput,{runWorker:scripted([]),resumePreparation:true,
    continuationApproval:await approve(blockedOutput)}),/NOT_RECOVERABLE/);

  // Synthetic stopped checkpoint for the old undisclosed-enum failure; never native evidence.
  const seed = async name => {
    const out = path.join(parent,name), stage = await stageMemoryPair({output:out,binary:process.execPath,authHome:parent});
    t.after(()=>rm(stage.workspace,{recursive:true,force:true}));
    const setup = JSON.parse(await readFile(path.join(out,"setup.json"),"utf8"));
    const sourceFile = path.join(out,"prepare-a-sources.json");
    await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:stage.workspace,
      sources:["goal","contract","original","map","memory","input"].map(id=>({id,path:id === "input" ? "input-a.json" : `${id}.md`,
        purpose:id === "memory" ? "Shared graph of current meaning and routes" : "Public project evidence"}))}),{mode:0o600});
    const sourceSnapshot = await (await openReviewSources(sourceFile)).snapshot();
    const allocation = JSON.parse(await readFile(path.join(output,"prepare-a-allocation.json"),"utf8"));
    await writeFile(path.join(out,"prepare-a-allocation.json"),JSON.stringify({...allocation,sourceSnapshot,
      runtime:setup.runtime.digest,native:setup.native}),{mode:0o600});
    await writeFile(path.join(out,"prepare-a-trace.json"),JSON.stringify(await scripted([prepared])({
      endpointFile:sourceFile,enableMemoryRecall:true})),{mode:0o600});
    const host = await openControlHost(path.join(out,"host"),setup.config,{}); await host.initialize(); await host.pause(true);
    await writeFile(path.join(out,"result.json"),JSON.stringify({status:"FAILED",failure:"FIRST_MEANING_NOT_APPLIED",
      nativeModelEvidence:false,runs:[{name:"prepare-a",status:"CLI_EXIT_OK",seconds:1}],results:{},
      host:await host.snapshot(),runtime:setup.runtime.digest,producerPreserved:true}),{mode:0o600});
    return {out,workspace:stage.workspace};
  };
  const saved = await seed("retained-preparation"), before = await readFile(path.join(saved.out,"result.json"),"utf8");
  await assert.rejects(runMemoryPair(saved.out,{resumePreparation:true,runWorker:scripted([])}),/APPROVAL_REQUIRED/);
  const continuationApproval = await approve(saved.out);
  await assert.rejects(runMemoryPair(saved.out,{resumePreparation:true,runWorker:scripted([]),
    continuationApproval:{...continuationApproval,harnessSha256:"0".repeat(64)}}),/HARNESS_CHANGED/);
  let launches = 0; const remaining = scripted([checks,{decision:"ACCEPT",problems:[]},prepared,
    {decision:"APPROVE",problems:[]},{decision:"ACCEPT",problems:[]}]);
  const continued = await runMemoryPair(saved.out,{resumePreparation:true,continuationApproval,
    runWorker:options=>{launches++;return remaining(options);}});
  assert.equal(continued.status,"SCRIPTED_PAIR_ONLY",continued.failure); assert.equal(launches,5);
  assert.equal(continued.runs.length,6); assert.equal(continued.nativeModelEvidence,false);
  assert.equal(await readFile(path.join(saved.out,"result.json"),"utf8"),before,"failure history is immutable");
  await assert.rejects(runMemoryPair(saved.out,{resumePreparation:true,continuationApproval,runWorker:scripted([])}),/EEXIST/);
  const stale = await seed("stale-preparation"); await writeFile(path.join(stale.workspace,"goal.md"),"changed task");
  let staleLaunches = 0;
  const refused = await runMemoryPair(stale.out,{resumePreparation:true,continuationApproval:await approve(stale.out),
    runWorker:()=>{staleLaunches++;throw Error("must not dispatch");}});
  assert.equal(refused.failure,"QUALIFICATION_RETAINED_SOURCES_CHANGED"); assert.equal(staleLaunches,0);
  assert.equal(Object.values(refused.host.reservations).length,0); assert.equal(refused.host.paused,true);
  const tampered = await seed("tampered-trace"), pin = await approve(tampered.out);
  const tracePath = path.join(tampered.out,"prepare-a-trace.json");
  await writeFile(tracePath,(await readFile(tracePath,"utf8")).replace("buildBundle","fakeEntry"));
  await assert.rejects(runMemoryPair(tampered.out,{resumePreparation:true,continuationApproval:pin,
    runWorker:()=>{throw Error("must not dispatch");}}),/RETAINED_TRACE_CHANGED/);

  const secondOut = path.join(parent,"second-checkpoint");
  const secondStage = await stageMemoryPair({output:secondOut,binary:process.execPath,authHome:parent});
  t.after(()=>rm(secondStage.workspace,{recursive:true,force:true}));
  const stopped = await runMemoryPair(secondOut,{runWorker:scripted([prepared,checks,{decision:"ACCEPT",problems:[]},
    {...prepared,format:"INVALID"}])});
  assert.equal(stopped.failure,"RETAINED_MEANING_NOT_APPLIED");
  // Explicitly synthetic legacy checkpoint: good scripted trace under the old case-sensitive grader.
  const traceB = path.join(secondOut,"prepare-b-trace.json");
  await writeFile(traceB,(await readFile(traceB,"utf8")).replace(/INVALID/g,"JSON"));
  const secondSnapshot = JSON.parse(await readFile(path.join(secondStage.workspace,"accepted.md"),"utf8"));
  assert.equal(secondSnapshot.post.decision,"ACCEPT","completed POST must be published before new preparation");
  await writeFile(path.join(secondOut,"continued-result.json"),JSON.stringify(stopped),{mode:0o600});
  let secondCalls = 0; const finalCalls = scripted([{decision:"APPROVE",problems:[]},{decision:"ACCEPT",problems:[]}]);
  const finished = await runMemoryPair(secondOut,{resumePreparation:true,continueSecond:true,
    continuationApproval:await approveSecond(secondOut),runWorker:options=>{secondCalls++;return finalCalls(options);}});
  assert.equal(finished.status,"SCRIPTED_PAIR_ONLY",finished.failure); assert.equal(secondCalls,2);
  assert.equal(finished.runs.length,6); assert.equal(finished.results.a.outputSha256,stopped.results.a.outputSha256);
  assert.equal(Object.values(finished.host.reservations).length,2,"A is retained, never executed again");
  assert.equal(finished.results.b.output.entries[0].id,"Z");
  assert.equal(JSON.parse(await readFile(path.join(secondStage.workspace,"accepted.md"),"utf8")).post.b.decision,"ACCEPT");
  const repairOut = path.join(parent,"changed-evidence-b");
  const repairStage = await stageMemoryPair({output:repairOut,binary:process.execPath,authHome:parent});
  t.after(()=>rm(repairStage.workspace,{recursive:true,force:true}));
  const rejected = await runMemoryPair(repairOut,{runWorker:scripted([prepared,checks,{decision:"ACCEPT",problems:[]},prepared,
    {decision:"REPAIR",problems:["Synthetic legacy pre-execution phase ambiguity"]}])});
  assert.equal(rejected.failure,"SECOND_READINESS_REJECTED"); assert.equal(rejected.runs.length,5);
  const stoppedBytes = JSON.stringify(rejected);
  await writeFile(path.join(repairOut,"finished-result.json"),stoppedBytes,{mode:0o600});
  const repairApproval = {traceSha256:sha256(stoppedBytes),harnessSha256:sha256(await readFile(new URL("../scripts/qualify-memory-pair.mjs",import.meta.url)))};
  let repairCalls = 0; const corrected = scripted([prepared,{decision:"APPROVE",problems:[]},{decision:"ACCEPT",problems:[]}]);
  const repaired = await runMemoryPair(repairOut,{resumePreparation:true,repairSecond:true,continuationApproval:repairApproval,
    runWorker:options=>{repairCalls++;return corrected(options);}});
  assert.equal(repaired.status,"SCRIPTED_PAIR_ONLY",repaired.failure); assert.equal(repairCalls,3);
  assert.equal(repaired.runs.length,8,"five previously spent calls remain charged separately from new three-call window");
  assert.ok(repaired.limits.some(s=>s.includes("five previous calls")));
  assert.equal(JSON.parse(await readFile(path.join(repairOut,"repair-prepare-b-allocation.json"),"utf8")).native.maxCalls,3);
  assert.equal(repaired.results.a.outputSha256,rejected.results.a.outputSha256);
  assert.equal(Object.values(repaired.host.reservations).length,2);
  assert.equal(await readFile(path.join(repairOut,"finished-result.json"),"utf8"),stoppedBytes);
  await assert.rejects(runMemoryPair(repairOut,{resumePreparation:true,repairSecond:true,continuationApproval:repairApproval,
    runWorker:scripted([])}),/EEXIST/);

  const finishOut = path.join(parent,"compiled-wire-checkpoint");
  const finishStage = await stageMemoryPair({output:finishOut,binary:process.execPath,authHome:parent});
  t.after(()=>rm(finishStage.workspace,{recursive:true,force:true}));
  const initialStop = await runMemoryPair(finishOut,{runWorker:scripted([prepared,checks,{decision:"ACCEPT",problems:[]},prepared,
    {decision:"REPAIR",problems:["Synthetic pre-execution phase ambiguity"]}])});
  await writeFile(path.join(finishOut,"finished-result.json"),JSON.stringify(initialStop),{mode:0o600});
  const repairStop = await runMemoryPair(finishOut,{resumePreparation:true,repairSecond:true,
    continuationApproval:{traceSha256:sha256(await readFile(path.join(finishOut,"finished-result.json"))),harnessSha256:repairApproval.harnessSha256},
    runWorker:scripted([{...prepared,format:"INVALID"}])});
  assert.equal(repairStop.runs.length,6); assert.equal(repairStop.failure,"RETAINED_MEANING_NOT_APPLIED");
  // Synthetic legacy grader checkpoint only; never alter a native trace to make it pass.
  const repairedTrace = path.join(finishOut,"repair-prepare-b-trace.json");
  await writeFile(repairedTrace,(await readFile(repairedTrace,"utf8")).replace(/INVALID/g,"bundle/v1"));
  const checkpoint = await readFile(path.join(finishOut,"repaired-result.json"));
  const finishApproval = {traceSha256:sha256(await readFile(repairedTrace)),harnessSha256:repairApproval.harnessSha256,
    checkpointSha256:sha256(checkpoint)};
  await assert.rejects(runMemoryPair(finishOut,{resumePreparation:true,finishRepair:true,continuationApproval:{...finishApproval,checkpointSha256:"0".repeat(64)},runWorker:scripted([])}),/CHECKPOINT_CHANGED/);
  let remainingCalls = 0; const remainingPair = scripted([{decision:"APPROVE",problems:[]},{decision:"ACCEPT",problems:[]}]);
  const compiledPair = await runMemoryPair(finishOut,{resumePreparation:true,finishRepair:true,continuationApproval:finishApproval,
    runWorker:opts=>{remainingCalls++;return remainingPair(opts);}});
  assert.equal(compiledPair.status,"SCRIPTED_PAIR_ONLY",compiledPair.failure); assert.equal(remainingCalls,2);
  assert.equal(compiledPair.runs.length,8); assert.equal(Object.values(compiledPair.host.reservations).length,2);
  assert.equal(compiledPair.results.a.outputSha256,initialStop.results.a.outputSha256);
  assert.deepEqual(await readFile(path.join(finishOut,"repaired-result.json")),checkpoint);
  const wire = JSON.parse(await readFile(path.join(finishStage.workspace,"wire.md"),"utf8"));
  assert.equal(wire.compiledPacket.format,"json"); assert.equal(wire.rawPacketSha256,sha256(canonicalJson({...prepared,format:"bundle/v1"})));
  assert.ok(compiledPair.receipts.find(r=>r.name === "repair-readiness-b").sources.rows.some(r=>r.id === "wire"));
  await assert.rejects(runMemoryPair(finishOut,{resumePreparation:true,finishRepair:true,continuationApproval:finishApproval,runWorker:scripted([])}),/EEXIST/);
});

async function approveSecond(out) {
  return {traceSha256:sha256(await readFile(path.join(out,"prepare-b-trace.json"))),
    harnessSha256:sha256(await readFile(new URL("../scripts/qualify-memory-pair.mjs",import.meta.url)))};
}
