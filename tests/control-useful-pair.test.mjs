import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,mkdir,readdir,rm,realpath} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {usefulPairAllocation,usefulPairPhases,usefulPairProfile,prepareUsefulPairTask,runUsefulPair,compileUsefulRecipe} from "../scripts/qualify-useful-pair.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {usefulNative} from "../scripts/useful-pair-native.mjs";
import {prepareUsefulRepair} from "../scripts/useful-pair-repair.mjs";

test("fresh finite allocation is seventeen single attempts, full single-part review and no repair exemption", () => {
  const allocation = usefulPairAllocation(), setup = {output:"/fixture",binary:"/node",authHome:"/auth",registryFile:"/sources",
    allocation,task:{owner:"adapter"},config:{executor:"adapter",reviewer:"reviewer",health:{repairTasks:[]}}};
  assert.equal(allocation.maxCalls,17); assert.equal(new Set(usefulPairPhases).size,17);
  assert.equal(allocation.refundedCalls,0); assert.equal(allocation.priorCallsReused,0); assert.equal(allocation.retries,0);
  const p = usefulPairProfile(setup,"/fixture/review",0);
  assert.equal(p.review.partitionCount,1); assert.equal(p.review.maxCalls,1); assert.equal(p.timeoutMs,181000);
  assert.equal(p.review.episodeGroups,undefined); assert.equal(p.review.scope.requiredSourceIdsAreWhitelist,false);
  for (const n of [0,300000,Infinity]) assert.throws(() => usefulPairAllocation(n),/TIMEOUT_INVALID/);
  assert.throws(() => usefulPairProfile({...setup,config:{...setup.config,executor:"other"}},"/review"),/IDENTITY/);
});

async function scratch(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(),"useful-pair-pure-")));
  t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,"dependencies.json"),JSON.stringify({dependencies:[]}));
  await writeFile(path.join(root,"input-a.json"),JSON.stringify([{id:"Z",label:" z "}]));
  return {workspace:root,config:{executor:"adapter"},task:{owner:"adapter",action:{executable:"/node",args:[]}}};
}
const recipe = {entrypoint:"buildBundle",revision:"bundle-r2",preprocess:[],format:"bundle/v1",producerEdits:[]};
test("exact public signature compiles to its symbol without interpreting arbitrary expressions",()=>{
  const raw={...recipe,entrypoint:"buildBundle(input)"};
  assert.equal(compileUsefulRecipe(raw).entrypoint,"buildBundle");assert.equal(raw.entrypoint,"buildBundle(input)");
  for(const entrypoint of ["buildBundle(input.slice(1))","buildBundle(other)"," buildBundle(input) "])
    assert.throws(()=>compileUsefulRecipe({...recipe,entrypoint}),/PUBLIC_WIRING_INVALID/);
});

test("scripted preparation creates honest acquired-byte adapter ACK before PRE, never executes", async t => {
  const setup = await scratch(t); let calls = 0;
  const result = await prepareUsefulPairTask(setup,"a",recipe,{async runContextTransition(request) {
    calls++; assert.equal(request.operation,"prepare"); assert.equal(request.readback,null);
    return {status:"PREPARED",capsule:{syntheticUnitTestOnly:true}};
  }});
  assert.equal(calls,1); assert.equal(result.readiness,"PENDING"); assert.equal(result.executionAuthorized,false);
  const ack = JSON.parse(await readFile(path.join(setup.workspace,result.evidenceRef.path)));
  assert.equal(ack.acquired.length,5); assert.equal(ack.independentReadiness,"PENDING");
  assert.deepEqual(ack.acquired.find(r=>r.path===result.task.dependencies),result.dependenciesRef);
  for (const ref of ack.acquired) assert.equal(sha256(await readFile(path.join(setup.workspace,ref.path))),ref.sha256);
  assert.equal((await readdir(setup.workspace)).includes("useful-output-a.json"),false);
  await assert.rejects(prepareUsefulPairTask(setup,"a",recipe,{}),/EEXIST/);
});

test("changed input during preparation cannot become an acknowledged current input", async t => {
  const setup = await scratch(t);
  await assert.rejects(prepareUsefulPairTask(setup,"a",recipe,{async runContextTransition() {
    await writeFile(path.join(setup.workspace,"input-a.json"),"[]");
    return {status:"PREPARED",capsule:{syntheticUnitTestOnly:true}};
  }}),/ACQUISITION_CHANGED/);
  assert.equal((await readdir(setup.workspace)).some(n => n.includes("readback") || n.includes("adapter-ack")),false);
});

test("unapproved driver refuses before starting host, native allocation or effects", async t => {
  const setup = await scratch(t), root = setup.workspace;
  await mkdir(path.join(root,"host"));
  await writeFile(path.join(root,"useful-setup.json"),JSON.stringify({schema:"qualification.useful-pair.v1",status:"REVIEW_REQUIRED"}));
  const before = await readdir(root);
  await assert.rejects(runUsefulPair(root),/INDEPENDENT_APPROVAL_REQUIRED/);
  assert.deepEqual(await readdir(root),before); assert.deepEqual(await readdir(path.join(root,"host")),[]);
});

const ownerControlReceipt={acceptanceIds:["useful-b"],digest:"a".repeat(64),observedAt:"2026-10-09T00:00:00Z"};
const ownerEvent=(tool,value,extra={})=>({type:"item.completed",item:{type:"mcp_tool_call",server:"vydykhai_owner",
  tool,status:"completed",result:{content:[{type:"text",text:JSON.stringify(value)}]},...extra}});
async function scriptedOwner(t,events) {
  const root=await realpath(await mkdtemp(path.join(os.tmpdir(),"useful-owner-unit-")));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const setup={output:root,runtime:{digest:"unit-only"},config:{owner:"owner"},
    allocation:{...usefulPairAllocation(),maxCalls:1,phaseOrder:["owner-unit"]}};
  const calls=[],snapshotCalls=[],state={health:{enrollment:"SETTLED"},acceptances:{"useful-b":{enrollment:"CLOSED"}}};
  const run={status:"CLI_EXIT_OK",output:[...events,{type:"turn.completed",usage:{input_tokens:1}}].map(e=>JSON.stringify(e)).join("\n")};
  const native=await usefulNative(setup,{worker:{async runControlledWorker(request){calls.push(request);return run;}}});
  const host={async preparationStatus(){return ownerControlReceipt;},async snapshot(){snapshotCalls.push(true);return state;}};
  return {root,native,host,calls,snapshotCalls,state,run};
}

test("scripted owner prose-only return reports missing respond, retains expense and never applies a fallback",async t=>{
  const f=await scriptedOwner(t,[ownerEvent("read_control",ownerControlReceipt),
    {type:"item.completed",item:{type:"agent_message",text:'{"action":"DONE"}'}}]);
  await assert.rejects(f.native.owner("owner-unit","useful-b",f.host),/USEFUL_OWNER_RESPONSE_MISSING/);
  assert.equal(f.calls.length,1);assert.equal(f.native.runs.length,1);assert.equal(f.snapshotCalls.length,0);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.root,"owner-unit-trace.json"))),f.run);
  assert.equal((await readdir(f.root)).includes("owner-unit-host.json"),false);
});

test("scripted refused owner response is not application or a current-control diagnostic",async t=>{
  for(const extra of [{result:{isError:true,content:[]}},{error:{message:"transport refusal"}}])await t.test(JSON.stringify(extra),async t=>{
    const f=await scriptedOwner(t,[ownerEvent("respond",{},extra)]);
    await assert.rejects(f.native.owner("owner-unit","useful-b",f.host),/USEFUL_OWNER_NOT_APPLIED/);
    assert.equal(f.calls.length,1);assert.equal(f.snapshotCalls.length,0);
  });
});

test("scripted successful owner response still requires exact current control before respond",async t=>{
  for(const events of [[ownerEvent("respond",{}),ownerEvent("read_control",ownerControlReceipt)],
    [ownerEvent("read_control",{...ownerControlReceipt,digest:"b".repeat(64)}),ownerEvent("respond",{})]])await t.test("invalid control ordering or digest",async t=>{
    const f=await scriptedOwner(t,events);
    await assert.rejects(f.native.owner("owner-unit","useful-b",f.host),/OWNER_CURRENT_CONTROL_NOT_ACQUIRED/);
    assert.equal(f.calls.length,1);assert.equal(f.snapshotCalls.length,0);
  });
});

test("scripted owner prompt requires actual schema-bound application and leases for nonblocking debt",async t=>{
  for(const [id,nextAction] of [["useful-b",null],["useful-b","USEFUL-NEXT"],["@health",null]])await t.test(`${id}:${nextAction}`,async t=>{
    const f=await scriptedOwner(t,[ownerEvent("read_control",ownerControlReceipt),ownerEvent("respond",{action:"OBSERVED"})]);
    const result=await f.native.owner("owner-unit",id,f.host,nextAction),prompt=f.calls[0].prompt;
    assert.match(prompt,/actually call vydykhai_owner\.respond once/);
    assert.match(prompt,/final JSON or prose decision is NOT application/);
    assert.match(prompt,/\{id,decision,repairLeases\}/);
    assert.match(prompt,/INCLUDING nonblocking existing debt for HEALTH CONTINUE and terminal DONE/);
    assert.match(prompt,/reviewAt no later than the group's earliest reviewAt/);
    assert.match(prompt,/WAITING also requires resumeWhen/);
    assert.match(prompt,/no second respond or fallback/);
    if(id==="@health")assert.match(prompt,/HEALTH CONTINUE.*omit nextAction and recordSha256/);
    else if(nextAction)assert.match(prompt,/CONTINUE with nextAction USEFUL-NEXT/);
    else assert.match(prompt,/current read_verdict contains terminalDisposition\.action DONE; copy its exact terminalDisposition\.recordSha256/);
    assert.deepEqual(result,id==="@health"?f.state.health:f.state.acceptances[id]);
    assert.equal(f.calls.length,1);assert.equal(f.snapshotCalls.length,1);
  });
});

async function repairScratch(t) {
  const setup=await scratch(t),root=setup.workspace,expected="Accepted public map.\n",before=expected+"Conflicting override.\n";
  const moduleBytes=JSON.stringify({implementationFiles:["candidate.mjs"]});
  await writeFile(path.join(root,"module.json"),moduleBytes);
  await writeFile(path.join(root,"current-map.md"),before);
  await writeFile(path.join(root,"accepted-map.md"),expected);
  setup.task={...setup.task,module:{path:"module.json",sha256:sha256(moduleBytes)},dependencies:"dependencies.json",
    candidateFiles:["candidate.mjs"],sourceSet:"source-set.json",scope:["bundle"],action:{executable:process.execPath,args:[],cwd:"."}};
  return {setup,expected,before,acceptedMap:{path:"accepted-map.md",sha256:sha256(expected)}};
}

test("repair preparation creates plan and dependency payload before Context and acquires both without execution",async t=>{
  const {setup,expected,before,acceptedMap}=await repairScratch(t);let calls=0;
  const packet=await prepareUsefulRepair(setup,{async runContextTransition(request){
    calls++;assert.equal(request.operation,"prepare");assert.equal(request.integrationPlan,null);assert.equal(request.readback,null);
    const task=JSON.parse(await readFile(path.join(setup.workspace,request.task.path)));
    const deps=JSON.parse(await readFile(path.join(setup.workspace,task.dependencies)));
    const planEntry=deps.dependencies.find(d=>d.id==="useful-repair-plan");
    assert.deepEqual(planEntry,{id:"useful-repair-plan",path:"repair-plan.json",scope:["bundle"]});
    const plan=JSON.parse(await readFile(path.join(setup.workspace,planEntry.path)));
    assert.deepEqual(plan.acceptedMap,acceptedMap);assert.equal(plan.expectedSha256,sha256(expected));
    assert.equal(plan.beforeSha256,sha256(before));assert.equal(plan.executionAuthorized,false);
    return {status:"PREPARED",capsule:{syntheticUnitTestOnly:true},coverageBasis:{sourceDigest:"s",dependencyDigest:"d"}};
  }},"current-map.md",expected,acceptedMap);
  assert.equal(calls,1);assert.equal(packet.executionAuthorized,false);
  const ack=JSON.parse(await readFile(path.join(setup.workspace,packet.evidenceRef.path)));
  for(const ref of [packet.planRef,packet.dependenciesRef])assert.deepEqual(ack.acquired.find(r=>r.path===ref.path),ref);
  for(const ref of ack.acquired)assert.equal(sha256(await readFile(path.join(setup.workspace,ref.path))),ref.sha256);
  assert.equal(ack.readiness,"PENDING_INDEPENDENT_PRE");assert.equal(ack.executionAuthorized,false);
  assert.equal(await readFile(path.join(setup.workspace,"current-map.md"),"utf8"),before);
  assert.equal(await readFile(path.join(setup.workspace,acceptedMap.path),"utf8"),expected);
});

test("repair accepted-map hash or replacement mismatch stops before Context or generated action",async t=>{
  for(const mismatch of ["hash","replacement"])await t.test(mismatch,async t=>{
    const {setup,expected,before,acceptedMap}=await repairScratch(t);let calls=0;
    const files=await readdir(setup.workspace);
    await assert.rejects(prepareUsefulRepair(setup,{async runContextTransition(){calls++;}},"current-map.md",
      mismatch==="replacement"?"Other map":expected,mismatch==="hash"?{...acceptedMap,sha256:"0".repeat(64)}:acceptedMap),/USEFUL_REPAIR_ACCEPTED_MAP_CHANGED/);
    assert.equal(calls,0);assert.deepEqual(await readdir(setup.workspace),files);
    assert.equal(await readFile(path.join(setup.workspace,"current-map.md"),"utf8"),before);
  });
});
