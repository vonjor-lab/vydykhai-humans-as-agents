import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,realpath,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
import {gradeProspectiveReadback,validateProspectiveDependencyDecision,prospectiveEnvironment,observeProspectiveCommand} from "../scripts/prospective-cycle-preparation.mjs";
const hash=v=>sha256(canonicalJson(v));
test("prospective worker understanding binds the actual task, capsule and observed environment without authority",()=>{
  const request={task:{sha256:"a".repeat(64)},capsule:{sha256:"b".repeat(64)}},environment={
    schema:"qualification.prospective-environment.v1",observedAt:new Date().toISOString(),phase:"BEFORE_PROTECTED_ACTION",
    actor:"CONTROLLED_LAUNCH_ADAPTER_PREFLIGHT",output:"ABSENT_CREATE_ONCE",taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,
    commandSha256:"c".repeat(64),scriptSha256:"d".repeat(64),workspace:"/fixture",executable:"/node",home:"/control/home",
    effectiveEnv:{HOME:"/control/home",CODEX_HOME:"EXTERNAL_AUTH_REFERENCE",PATH:"/usr/local/bin:/usr/bin:/bin"},
    authHomeReference:"EXISTING_EXTERNAL_AUTH_DIRECTORY_CHECKED_NO_SECRET_READ",checks:"PATH_IDENTITY_ACCESS_AND_SELECTED_PROFILE_ONLY"};
  const value={worker:"worker-1",taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,
    environmentSha256:hash(environment),executionAuthorized:false,entrypoint:"buildBundle",revision:"bundle-r2",preprocess:"none",format:"json",
    producerEdits:[],rejected:["keep-last"],idea:{id:"CSV",disposition:"ASK_OWNER_NOT_IMPLEMENT"},
    duplicatePolicy:"case-insensitive-reject",idPolicy:"preserve-exact",labelPolicy:"trim",orderPolicy:"codepoint",
    stopConditions:["STALE_BINDING","PERMISSION_MISSING","PRODUCER_CHANGE","DUPLICATE_ID"]};
  const expected={request,worker:"worker-1",environment};assert.deepEqual(gradeProspectiveReadback(value,expected),[]);
  for(const [key,bad]of Object.entries({worker:"other",taskSha256:"old",capsuleSha256:"old",environmentSha256:"old",
    executionAuthorized:true,duplicatePolicy:"keep-last",stopConditions:[]}))
    assert.ok(gradeProspectiveReadback({...value,[key]:bad},expected).length,key);
  assert.ok(gradeProspectiveReadback(value,{...expected,environment:{observedAt:"later"}}).includes("environmentSha256"));
  for(const bad of [{},{...environment,observedAt:"2000-01-01"},{...environment,phase:"AFTER_PROTECTED_ACTION"},
    {...environment,taskSha256:"old"},{...environment,effectiveEnv:{}}])
    assert.ok(gradeProspectiveReadback({...value,environmentSha256:hash(bad)},{...expected,environment:bad}).includes("environmentReceipt"));
  const stopConditions=Object.fromEntries(value.stopConditions.map(id=>[id,"Stop and retain the unresolved boundary"]));
  assert.deepEqual(gradeProspectiveReadback({...value,stopConditions},expected),[]);
  for(const bad of [{...stopConditions,STALE_BINDING:""},{...stopConditions,PERMISSION_MISSING:null},"DUPLICATE_ID",{}])
    assert.ok(gradeProspectiveReadback({...value,stopConditions:bad},expected).some(e=>e.startsWith("stop:")));
});
test("protected command proof names the actual executable and checks opaque producer bytes without authority",async t=>{
  const workspace=await mkdtemp(path.join(await realpath(os.tmpdir()),"prospective-command-"));
  t.after(()=>rm(workspace,{recursive:true,force:true}));
  await writeFile(path.join(workspace,"consumer.mjs"),"// consumer\n");
  const bytes="// opaque producer\n";await writeFile(path.join(workspace,"producer.mjs"),bytes);
  const options={workspace,action:{executable:process.execPath,args:["consumer.mjs"],cwd:"."},producerRef:{path:"producer.mjs",sha256:sha256(bytes)}};
  const proof=await observeProspectiveCommand(options);
  assert.equal(proof.executable.configured,process.execPath);assert.equal(proof.executable.resolved,await realpath(process.execPath));
  assert.equal(proof.executable.access,"X_OK");assert.equal(proof.producer.sha256,options.producerRef.sha256);
  assert.equal(proof.producer.context,"OPAQUE_BYTES_HASH_ONLY");assert.equal(proof.executionAuthorized,false);
  await assert.rejects(observeProspectiveCommand({...options,producerRef:{...options.producerRef,path:"../outside"}}),/PROOF_INVALID/);
  await assert.rejects(observeProspectiveCommand({...options,producerRef:{...options.producerRef,sha256:"0".repeat(64)}}),/PRODUCER_CHANGED/);
  await writeFile(path.join(workspace,"producer.mjs"),"changed");
  await assert.rejects(observeProspectiveCommand(options),/PRODUCER_CHANGED/);
});
test("new qualification cannot self-exempt from old dependency holds or refund historical proof",()=>{
  const priorState={acceptances:{consumer:{findings:[{id:"historical",status:"OPEN"},{id:"resolved",status:"CLOSED"}]}}};
  const expected={manifestSha256:"a".repeat(64),priorStateHash:hash(priorState),sourceDigest:"c".repeat(64),
    priorState,reviewer:"independent",owner:"owner",executor:"worker"};
  const decision={schema:"qualification.prospective-dependency-decision.v1",reviewer:"independent",decision:"INDEPENDENT_NEW_CONSUMPTION_ONLY",
    ...expected,findingDispositions:[{id:"historical",disposition:"RETAIN_OLD_HOLD_NO_DEPENDENCE",reason:"No use of the old consumer result"}],
    historicalClosure:false,oldConsumerDependency:false,executionGranted:false};
  assert.equal(validateProspectiveDependencyDecision(decision,expected),true);
  for(const patch of [{historicalClosure:true},{oldConsumerDependency:true},{executionGranted:true},{reviewer:""},
    {reviewer:"owner"},{findingDispositions:[]},{findingDispositions:[...decision.findingDispositions,...decision.findingDispositions]},
    {manifestSha256:"old"},{priorStateHash:"old"},{sourceDigest:"old"}])
    assert.throws(()=>validateProspectiveDependencyDecision({...decision,...patch},expected),/INDEPENDENT_DEPENDENCY/);
  const incomplete={acceptances:{consumer:{findings:[...priorState.acceptances.consumer.findings,{id:"unexamined",status:"OPEN"}]}}};
  assert.throws(()=>validateProspectiveDependencyDecision({...decision,priorStateHash:hash(incomplete)},
    {...expected,priorState:incomplete,priorStateHash:hash(incomplete)}),/INDEPENDENT_DEPENDENCY/);
  for(const id of ["manifestSha256","priorStateHash","sourceDigest"])
    for(const bad of [undefined,"","malformed"])
      assert.throws(()=>validateProspectiveDependencyDecision({...decision,[id]:bad},{...expected,[id]:bad}),/INDEPENDENT_DEPENDENCY/);
  assert.throws(()=>validateProspectiveDependencyDecision({...decision,reviewer:"worker"},{...expected,reviewer:"worker"}),/INDEPENDENT_DEPENDENCY/);
});
test("prospective environment observes exact selected paths before output exists and grants no sandbox or action",async t=>{
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),"prospective-env-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"workspace"),home=path.join(root,"home"),authHome=path.join(root,"auth");
  for(const p of [workspace,home,authHome])await mkdir(p,{mode:0o700});
  await writeFile(path.join(workspace,"consumer.mjs"),"// Closed-public consumer fixture\n",{flag:"wx",mode:0o600});
  const options={workspace,home,authHome,endpointParent:root,binary:process.execPath,
    request:{task:{sha256:"a".repeat(64)},capsule:{sha256:"b".repeat(64)}},
    action:{executable:process.execPath,args:["consumer.mjs"],cwd:"."}};
  const receipt=await prospectiveEnvironment(options);
  assert.equal(receipt.phase,"BEFORE_PROTECTED_ACTION");assert.equal(receipt.output,"ABSENT_CREATE_ONCE");
  assert.equal(receipt.actor,"CONTROLLED_LAUNCH_ADAPTER_PREFLIGHT");
  assert.match(receipt.limits.join(" "),/Not an OS sandbox/);assert.match(receipt.limits.join(" "),/grants no execution/);
  await assert.rejects(prospectiveEnvironment({...options,home:workspace}),/HOME_UNSAFE/);
  await assert.rejects(prospectiveEnvironment({...options,action:{...options.action,args:["../consumer.mjs"]}}),/ACTION_UNSAFE/);
  await writeFile(path.join(workspace,"consumer-output.json"),"retained",{flag:"wx"});
  await assert.rejects(prospectiveEnvironment(options),/OUTPUT_ALREADY_EXISTS/);
});
