import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,readdir} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {stageCycle,stageCycleRepair,runCycle,cycleOracle} from "../scripts/qualify-control-cycle.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {runContextTransition} from "../scripts/context-run.mjs";
import {createReturnSync} from "../scripts/vydykhai.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";

test("terminal canary is separately frozen, unhinted and finitely allocated before any model",async t=>{
  const base=await realpath(await mkdtemp(path.join(tmpdir(),"control-terminal-cycle-")));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const output=path.join(base,"trial"),authHome=path.join(base,"auth");await mkdir(authHome,{mode:0o700});
  await stageCycle({output,binary:"/usr/bin/false",authHome,terminal:true});
  const setup=JSON.parse(await readFile(path.join(output,"freeze.json")));
  t.after(()=>rm(setup.workspace,{recursive:true,force:true}));
  assert.equal(setup.terminal,true);assert.equal(setup.budget.maxCalls,7);assert.equal(setup.budget.retries,0);
  assert.equal(setup.budget.secondsPerCall,120);
  assert.doesNotMatch(await readFile(path.join(setup.workspace,"goal.md"),"utf8"),/buildBundle|bundle-r2|CSV|keep-last/);
  const registry=JSON.parse(await readFile(setup.registryFile));
  assert.ok(registry.sources.some(r=>r.id==="terminal-disposition"&&r.path==="terminal-disposition.md"));
  assert.ok(!registry.sources.some(r=>r.path==="candidate.mjs"));
  assert.ok(!(await readdir(output)).some(name=>/^(allocation|trace)-/.test(name)));
  await writeFile(path.join(output,"freeze.json"),JSON.stringify({...setup,budget:{...setup.budget,maxCalls:99}}));
  await assert.rejects(runCycle(output),/QUALIFICATION_ALLOCATION_CHANGED/);
  assert.ok(!(await readdir(output)).some(name=>/^(allocation|trace)-/.test(name)));
  await assert.rejects(stageCycle({output:path.join(base,"invalid"),binary:"/usr/bin/false",authHome,terminal:"yes"}),/QUALIFICATION_TERMINAL_MODE_INVALID/);
});

test("changed frozen public sources refuse before the first inference allocation",async t=>{
  const base=await realpath(await mkdtemp(path.join(tmpdir(),"control-cycle-frozen-")));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const output=path.join(base,"trial"),authHome=path.join(base,"auth");await mkdir(authHome,{mode:0o700});
  await stageCycle({output,binary:"/usr/bin/false",authHome});
  const setup=JSON.parse(await readFile(path.join(output,"freeze.json")));
  t.after(()=>rm(setup.workspace,{recursive:true,force:true}));
  await writeFile(path.join(setup.workspace,"contract.md"),"Changed after freeze");
  await assert.rejects(runCycle(output),/QUALIFICATION_SOURCE_CHANGED_BEFORE_DISPATCH/);
  assert.ok(!(await readdir(output)).some(name=>/^(allocation|trace)-/.test(name)));
  assert.deepEqual(await readdir(path.join(setup.root,"host")),[]);
});

test("packet repair preserves the rejected native evidence and recompiles one current consumer",async t=>{
  const base=await realpath(await mkdtemp(path.join(tmpdir(),"control-cycle-repair-")));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const output=path.join(base,"original"),repaired=path.join(base,"repair"),authHome=path.join(base,"auth");
  await mkdir(authHome,{mode:0o700});await stageCycle({output,binary:"/usr/bin/false",authHome,terminal:true});
  const freezeBytes=await readFile(path.join(output,"freeze.json")),setup=JSON.parse(freezeBytes);
  t.after(()=>rm(setup.workspace,{recursive:true,force:true}));
  const host=await openControlHost(path.join(setup.root,"host"),setup.config,{});await host.initialize();
  const publicSources=await openReviewSources(setup.registryFile);
  const acquired=[];
  for(const id of cycleOracle.requiredRecall) acquired.push({type:"item.completed",item:{type:"mcp_tool_call",
    server:"vydykhai_review",tool:"read_source",status:"completed",result:{content:[{type:"text",text:JSON.stringify(await publicSources.read({id}))}]}}});
  const recipe={...cycleOracle.recipe,producerEdits:[],rejected:["keep-last"],idea:{id:"CSV",disposition:"ASK_OWNER_NOT_IMPLEMENT"}};
  const trace=answer=>({status:"CLI_EXIT_OK",output:[...acquired,{type:"item.completed",item:{type:"agent_message",text:JSON.stringify(answer)}},
    {type:"turn.completed"}].map(e=>JSON.stringify(e)).join("\n")+"\n"});
  const put=(dir,name,value)=>writeFile(path.join(dir,name),canonicalJson(value)+"\n");
  await put(setup.workspace,"recipe.json",recipe);await put(setup.workspace,"recipe.md",recipe);
  await put(output,"trace-prepare.json",trace(recipe));
  await put(output,"trace-precheck.json",trace({decision:"REPAIR",problems:["stale source bindings"]}));
  const failed={status:"QUALIFICATION_FAILED",checks:{failure:"INDEPENDENT_PREPARATION_REJECTED"},state:await host.snapshot(),
    runs:[{name:"prepare",status:"CLI_EXIT_OK"},{name:"precheck",status:"CLI_EXIT_OK"}]};
  await put(output,"result.json",failed);
  const staged=await stageCycleRepair({previous:output,output:repaired});assert.equal(staged.modelsLaunched,0);
  const next=JSON.parse(await readFile(path.join(repaired,"freeze.json")));
  assert.equal(next.budget.maxCalls,8);assert.deepEqual(next.continuation.priorRuns,failed.runs);
  assert.deepEqual(await readFile(path.join(output,"freeze.json")),freezeBytes);
  assert.deepEqual(await host.snapshot(),failed.state);
  assert.equal((await runContextTransition({...next.request,operation:"preflight"})).status,"READY");
  const packet=JSON.parse(await readFile(path.join(setup.workspace,"execution-packet.md")));
  assert.equal(packet.task.memory.publicBoundary,"consumeBundle");
  assert.ok(packet.current.classifications.record.records.flatMap(c=>c.assertions).some(a=>a.id==="S4:1"&&a.disposition==="superseded"));
  const snapshot=await (await openReviewSources(next.registryFile)).snapshot();
  for(const id of ["source-ledger","source-routing","public-action","consumer-input"])
    assert.equal(snapshot.rows.find(r=>r.id===id)?.status,"AVAILABLE",id);
  await put(output,"trace-precheck.json",trace({decision:"APPROVE",problems:[]}));
  await assert.rejects(runCycle(repaired),/QUALIFICATION_PRIOR_EVIDENCE_CHANGED/);
  assert.ok(!(await readdir(repaired)).some(name=>/^allocation-/.test(name)));
});

test("combined experiment adapter really executes public result and retained cases before continuation",async t=>{
  const base=await realpath(await mkdtemp(path.join(tmpdir(),"control-cycle-adapter-")));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const output=path.join(base,"trial"),authHome=path.join(base,"auth");await mkdir(authHome,{mode:0o700});
  await stageCycle({output,binary:process.execPath,authHome});
  const setup=JSON.parse(await readFile(path.join(output,"freeze.json")));
  t.after(()=>rm(setup.workspace,{recursive:true,force:true}));
  const put=async(name,value)=>{const bytes=canonicalJson(value)+"\n";await writeFile(path.join(setup.workspace,name),bytes);return {path:name,sha256:sha256(bytes)};};
  await put("recipe.json",cycleOracle.recipe);
  assert.equal((await runContextTransition(setup.request)).status,"ACTION_COMPLETED");
  assert.deepEqual(JSON.parse(await readFile(path.join(setup.workspace,"consumer-output.json"))),cycleOracle.retainedOutput);
  const accepted=await runContextTransition({...setup.request,operation:"accept"},{createReturnSync});
  assert.equal(accepted.status,"VERIFIED",JSON.stringify(accepted));
  assert.deepEqual(accepted.receipt.observations.map(x=>x.id),["B1","B2","N1"]);
  assert.deepEqual(accepted.receipt.observations.at(-1).observed,{error:"DUPLICATE_ID"});
  const next=JSON.parse(await readFile(path.join(setup.workspace,"task.json")));
  next.action={...next.action,args:["continuation.mjs"]};
  await writeFile(path.join(setup.workspace,"continuation.mjs"),"process.stdout.write('continued');\n");
  const task=await put("next-task.json",next);
  const req={...setup.request,operation:"prepare",task,capsule:null,readback:null};
  const prep=await runContextTransition(req);assert.equal(prep.status,"PREPARED",JSON.stringify(prep));
  const capsule=await put("next-capsule.json",prep.capsule);
  const readback=await put("next-readback.json",{schema:"context.readback.v1",worker:next.owner,taskSha256:task.sha256,
    capsuleSha256:capsule.sha256,capability:"retained-progress-v1",evidenceRef:await put("acceptance.md",{accepted:true})});
  assert.equal((await runContextTransition({...req,operation:"resume",capsule,readback})).status,"ACTION_COMPLETED");
});
