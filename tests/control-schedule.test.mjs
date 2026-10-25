import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,realpath,rm,lstat,cp,symlink} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import {activateControl,acquireControlLease} from "../scripts/control-activation.mjs";
import {inspectControlRuntime,stageControlRuntime,loadControlRuntime} from "../scripts/control-runtime.mjs";
import {controlSchedulePlan,registerControlSchedule,startControlSchedule,unregisterControlSchedule,matchesControlRegistration,
  startScheduledControl,waitControlObservation,requestScheduledObservation} from "../scripts/control-schedule.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlChild} from "../scripts/control-child.mjs";
import {sha256} from "../scripts/memory-brief.mjs";

const source=fileURLToPath(new URL("..",import.meta.url));
const darwin={skip:process.platform!=="darwin"};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(mode="SESSION",holdAfterTick=false,entryFailure=false,delayBeforeTick=0) {
  const temp=await realpath(await mkdtemp(path.join(os.tmpdir(),"schedule-test-")));
  const workspace=path.join(temp,"workspace"),root=path.join(temp,"control"),packages=path.join(temp,"packages");
  for(const d of [workspace,root,packages])await mkdir(d,{mode:0o700});
  let sourceRoot=source;
  if(holdAfterTick||entryFailure||delayBeforeTick) {
    sourceRoot=path.join(temp,"delayed-source");
    for(const name of Object.keys((await inspectControlRuntime(source)).description.files)) {
      await mkdir(path.dirname(path.join(sourceRoot,name)),{recursive:true});
      await cp(path.join(source,name),path.join(sourceRoot,name));
    }
    const file=path.join(sourceRoot,"scripts/control-observer-run.mjs");
    let observer=await readFile(file,"utf8");
    if(delayBeforeTick)observer=observer.replace("const result = await service.tick();",
      `await new Promise(resolve=>setTimeout(resolve,${delayBeforeTick})); const result = await service.tick();`);
    if(entryFailure) {
      assert.ok(observer.includes("const result = await service.tick();"));
      observer=observer.replace("const result = await service.tick();","throw Error('INJECTED_POST_ENTRY_FAILURE');");
    }
    if(holdAfterTick)observer+=`\nif(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
      process.on('SIGTERM',()=>setTimeout(()=>process.exit(0),${holdAfterTick===true?750:holdAfterTick}));
      setTimeout(()=>{},30000);
      const fd=await open(path.join(path.dirname(process.argv[2]),'post-tick-held'),'wx',0o600);
      await fd.close();
    }\n`;
    await writeFile(file,observer);
  }
  const {digest}=await inspectControlRuntime(sourceRoot);
  const installed=await stageControlRuntime({sourceRoot,directory:packages,workspace,expectedDigest:digest});
  const sourceFile=path.join(root,"sources.json");
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace,
    sources:[{id:"policy",path:"policy.md",purpose:"Synthetic obligations"}]}),{mode:0o600});
  await writeFile(path.join(workspace,"policy.md"),"Disposable schedule test");
  const profile={schema:"control.service.v1",directory:path.join(root,"host"),
    config:{workspace,policy:"a".repeat(64),owner:"owner",executor:"executor",reviewer:"reviewer",evidenceRegistry:sourceFile,
      health:{scope:"Disposable health",intervalMs:60000,maxBranches:1,maxWorktrees:1,triggerSourceIds:["policy"],repairTasks:[]}},
    review:{directory:path.join(root,"review"),controlRoot:root,reviewer:"reviewer",sourceFile,maxCalls:1,
      expiresAt:new Date(Date.now()+3600000).toISOString(),scope:{kind:"fixture"},
      native:{workspace:path.join(root,"room"),home:path.join(root,"home"),binary:"/never-launch-model",model:"no-inference",effort:"low",timeoutMs:1000}},
    timeoutMs:3000,maxReviewsPerTick:0};
  const descriptor=await activateControl({sourceRoot:installed.root,root,expectedDigest:digest,profile});
  const runtime=await loadControlRuntime({packageRoot:installed.root,expectedDigest:digest,workspace});
  const service=await runtime.service.openControlService(profile);
  await service.host.pause(true);
  return {temp,root,profile,service,options:{descriptorFile:descriptor.descriptorFile,intervalSeconds:3600,mode}};
}
test("scheduler-owned work outlives receipt wait without abort or redispatch",darwin,async()=>{
  const x=await fixture("SESSION",false,false,1000);
  x.options.intervalSeconds=60;
  let registered=false;
  try {
    const started=await startScheduledControl(x.options);registered=true;
    assert.equal(started.status,"REGISTERED_AWAITING_TICK");
    const pending=await waitControlObservation({descriptorFile:x.options.descriptorFile,waitMs:0});
    assert.equal(pending.status,"PENDING");
    assert.equal(pending.executionInterrupted,false);
    const reused=await startScheduledControl(x.options);
    assert.equal(reused.schedule.reused,true);
    const finished=await waitControlObservation({descriptorFile:x.options.descriptorFile,waitMs:90000});
    assert.equal(finished.status,"OBSERVED");
    assert.equal(finished.receipt.calls,0);
    const next=await waitControlObservation({descriptorFile:x.options.descriptorFile,
      afterReceiptSha256:finished.receiptSha256,waitMs:0});
    assert.equal(next.status,"PENDING");
  } finally {
    if(registered)await stop(x.options);
    await rm(x.temp,{recursive:true,force:true});
  }
});
test('persisted events wake the same schedule promptly; pause and active work survive',darwin,async()=>{
  const x=await fixture('SESSION',false,false,1000);let registered=false;
  try {
    await registerControlSchedule(x.options);registered=true;
    assert.equal((await requestScheduledObservation(x.options)).status,'PAUSED');
    await x.service.host.pause(false);
    const started=Date.now();
    assert.equal((await requestScheduledObservation(x.options,{directory:x.profile.directory,config:x.profile.config})).status,'WAKE_REQUESTED');
    const pending=await waitControlObservation({descriptorFile:x.options.descriptorFile,waitMs:20});
    assert.equal(pending.status,'PENDING');
    await requestScheduledObservation(x.options);
    const done=await waitControlObservation({descriptorFile:x.options.descriptorFile,waitMs:10000});
    assert.equal(done.status,'OBSERVED');assert.equal(done.receipt.calls,0);
    assert.ok(Date.now()-started<15000);
    assert.equal((await requestScheduledObservation(x.options,{directory:'/wrong',config:x.profile.config})).reason,'CONTROL_EVENT_HOST_MISMATCH');
    await x.service.host.pause(true);
  } finally {if(registered)await stop(x.options);await rm(x.temp,{recursive:true,force:true});}
});
async function stop(options) {
  const observations = [], root = path.dirname(options.descriptorFile);
  for(let i=0;i<100;i++) {
    try {return await unregisterControlSchedule(options);} catch(e) {
      if(!/RUNNING_WAIT_FOR_CHECKPOINT|LEASE_HELD_RECONCILIATION_REQUIRED/.test(e.message))throw e;
      if(i%20===0 || i===99) {
        const result=await runControlChild({executable:"/bin/launchctl",
          args:["print",`gui/${process.getuid()}/com.vydykhai.control.${sha256(root).slice(0,24)}`],
          cwd:"/",env:{PATH:"/usr/bin:/bin"},input:"",timeoutMs:5000,maxBytes:32768});
        const lease=await readFile(path.join(root,"observer.lease"),"utf8").catch(error=>error.code);
        observations.push({attempt:i,error:e.message,lease,
          process:result.output.match(/^\s*(?:state|pid|runs|last exit code) = .+$/gm),
          observedAt:new Date().toISOString()});
      }
      await sleep(100);
    }
  }
  throw Error(`TEST_SCHEDULE_STILL_RUNNING_STATE_RETAINED:${JSON.stringify({root,observations})}`);
}
test("passive wait observes final failure after an intermediate receipt with the same invocation",darwin,async()=>{
  const x=await fixture(),plan=await controlSchedulePlan(x.options);
  try {
    const file=path.join(x.root,"observer-latest.json"),receipt={schema:"control.observer-readback.v1",
      descriptorHash:plan.descriptorHash,invocationId:"00000000-0000-0000-0000-000000000001",
      stage:"IN_PROGRESS",status:"ONE_TICK_OBSERVED"};
    await writeFile(file,JSON.stringify(receipt),{mode:0o600});
    assert.equal((await waitControlObservation({...x.options,waitMs:0})).status,"PENDING");
    Object.assign(receipt,{stage:"FAILED",status:"UNKNOWN_RECONCILIATION_REQUIRED"});
    await writeFile(file,JSON.stringify(receipt));
    const observed=await waitControlObservation({...x.options,waitMs:0});
    assert.equal(observed.status,"OBSERVED");
    assert.equal(observed.receipt.status,"UNKNOWN_RECONCILIATION_REQUIRED");
    assert.equal((await waitControlObservation({...x.options,afterReceiptSha256:observed.receiptSha256,waitMs:0})).status,"PENDING");
  } finally {await rm(x.temp,{recursive:true,force:true});}
});
async function registerAtCheckpoint(options) {
  for(let i=0;i<100;i++){
    try{return await registerControlSchedule(options);}catch(e){
      if(!/LEASE_HELD_RECONCILIATION_REQUIRED/.test(e.message))throw e;
      await sleep(100);
    }
  }
  throw Error("TEST_REGISTRATION_CHECKPOINT_NOT_REACHED");
}
for(const mode of ["SESSION","LOGIN"])test(`actual ${mode} startup observes once before periodic registration and preserves pause/budget`,
 {skip:process.platform!=="darwin" || mode==="LOGIN" && !process.env.VYDYKHAI_QUALIFY_LOGIN_SCHEDULE},async(t)=>{
  const x=await fixture(mode);let registered=false;
  try {
    const before=await (await openControlStore(x.profile.review.directory)).read();
    const plan=await controlSchedulePlan(x.options);
    assert.match(plan.plist,/<key>StartInterval<\/key><integer>3600<\/integer>/);
    assert.match(plan.plist,/<key>RunAtLoad<\/key><false\/>/);
    const startup=await startControlSchedule({...x.options,initialTimeoutMs:20000});
    const first=startup.schedule;registered=true;
    assert.equal(startup.status,"INITIAL_OBSERVED_PERIODIC_REGISTERED");
    assert.equal(first.initialObservation,"NOT_PERFORMED");
    assert.equal(first.status,"REGISTERED");assert.equal(first.readiness,"NOT_CERTIFIED");
    assert.equal((await lstat(first.file)).mode&0o777,0o600);
    let receipt;const observations=[],wakeStarted=performance.now();
    for(let i=0;i<100;i++) {
      try {receipt=JSON.parse(await readFile(path.join(x.root,"observer-latest.json")));break;}
      catch(e) {
        if(e.code!=="ENOENT")throw e;
        if(i%20===0||i===99) {
          const seen=await nativeCtl(["print",first.target]);
          observations.push({attempt:i,elapsedMs:Math.round(performance.now()-wakeStarted),code:seen.code,
            state:seen.output.match(/^\s*(?:state|pid|runs|last exit code|last terminating signal|reason|spawn type) = .+$/gm),
            lease:await readFile(path.join(x.root,"observer.lease"),"utf8").catch(error=>error.code),
            ...(i===99?{print:seen.output,errors:seen.errors}:{})});
        }
        await sleep(100);
      }
    }
    t.diagnostic(JSON.stringify({mode,root:x.root,receiptPresent:!!receipt,observations}));
    assert.ok(receipt,"startup must actually run the selected observer before scheduling");
    assert.equal(receipt.status,"ONE_TICK_OBSERVED");assert.equal(receipt.paused,true);
    assert.equal(receipt.calls,0);assert.equal(receipt.projectReadiness,"NOT_CERTIFIED");
    assert.deepEqual(receipt,startup.initialObservation);
    assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(),before);
    // The receipt is durable before the observer releases its dispatch lease.
    assert.equal((await registerAtCheckpoint(x.options)).reused,true);
    assert.deepEqual(JSON.parse(await readFile(path.join(x.root,"observer-latest.json"))),receipt);
    await rm(x.profile.review.sourceFile);
    const removed=await stop(x.options);registered=false;
    assert.equal(removed.state,"PRESERVED");
    assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(),before);
    assert.equal((await x.service.host.snapshot()).paused,true);
    await assert.rejects(lstat(first.file),{code:"ENOENT"});
  } finally {
    if(registered)await stop(x.options);
    await rm(x.temp,{recursive:true,force:true});
  }
});
test("registered argv identity is exact, not a substring in diagnostic output",()=>{
  const plan={file:"/private/owned.plist",args:["/usr/local/bin/node","/private/run.mjs","/private/activation.json"]};
  const output=args=>`gui/501/label = {\n path = ${plan.file}\n program = ${plan.args[0]}\n arguments = {\n${args.map(a=>"  "+a).join("\n")}\n }\n}\n`;
  assert.equal(matchesControlRegistration(output(plan.args),plan),true);
  assert.equal(matchesControlRegistration(output([...plan.args.slice(0,2),plan.args[2]+".old"]),plan),false);
  assert.equal(matchesControlRegistration(output([...plan.args,"--foreign"]),plan),false);
  assert.equal(matchesControlRegistration(output(plan.args).replace(plan.file,"/private/foreign.plist"),plan),false);
});
test("registration cannot race an owned observer or cutover lease",darwin,async()=>{
  const x=await fixture();
  try{
    const plan=await controlSchedulePlan(x.options),release=await acquireControlLease(x.root);
    try{
      await assert.rejects(registerControlSchedule(x.options),/LEASE_HELD/);
      await assert.rejects(lstat(plan.file),{code:"ENOENT"});
    }finally{await release();}
  }finally{await rm(x.temp,{recursive:true,force:true});}
});
async function nativeCtl(args) {
  return runControlChild({executable:"/bin/launchctl",args,cwd:"/",env:{PATH:"/usr/bin:/bin"},
    input:"",timeoutMs:5000,maxBytes:32768});
}
async function waitFile(file, target = null) {
  for(let i=0;i<100;i++) {
    try {await lstat(file);return;} catch(e) {if(e.code!=="ENOENT")throw e;await sleep(100);}
  }
  const root = path.dirname(file), observed = target ? await nativeCtl(["print",target]) : null;
  const evidence = {};
  for (const name of ["observer.lease","observer-latest.json","observer-error.log","observer-output.log"])
    evidence[name] = await readFile(path.join(root,name),"utf8").catch(e=>e.code);
  assert.fail(`Missing disposable checkpoint: ${JSON.stringify({file,target,observed,evidence})}`);
}
test("owned removal can stop an idle post-tick PID, but never crosses a retained dispatch lease",darwin,async()=>{
  const x=await fixture("SESSION",true);let plan;
  try {
    plan=await registerControlSchedule(x.options);
    assert.equal((await nativeCtl(["kickstart",plan.target])).code,0);
    await waitFile(path.join(x.root,"post-tick-held"),plan.target);
    const before=await (await openControlStore(x.profile.directory)).read();
    const reviewBefore=await (await openControlStore(x.profile.review.directory)).read();
    const observed=await nativeCtl(["print",plan.target]);
    assert.match(observed.output,/^\s*pid = \d+/m);
    const release=await acquireControlLease(x.root);
    try {
      await assert.rejects(unregisterControlSchedule(x.options),/LEASE_HELD_RECONCILIATION_REQUIRED/);
      assert.equal((await nativeCtl(["print",plan.target])).code,0);
      await lstat(plan.file);
    } finally {await release();}
    assert.equal((await unregisterControlSchedule(x.options)).status,"UNREGISTERED");
    assert.equal((await nativeCtl(["print",plan.target])).code,113);
    assert.deepEqual(await (await openControlStore(x.profile.directory)).read(),before);
    assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(),reviewBefore);
    assert.equal(JSON.parse(await readFile(path.join(x.root,"observer-latest.json"))).calls,0);
  } finally {
    // Only this synthetic, paused, no-model process can remain after a failed test.
    if(plan)await nativeCtl(["bootout",plan.target]);
    await rm(x.temp,{recursive:true,force:true});
  }
});
test("old RunAtLoad plist requires explicit owned removal, not silent reuse or overwrite",darwin,async()=>{
  const x=await fixture();let plan;
  try {
    plan=await controlSchedulePlan(x.options);
    const legacy=plan.plist.replace("<key>RunAtLoad</key><false/>","<key>RunAtLoad</key><true/>");
    const conflicting=legacy.replace("<integer>3600</integer>","<integer>3601</integer>");
    await writeFile(plan.file,conflicting,{mode:0o600});
    await assert.rejects(unregisterControlSchedule(x.options),/FILE_CONFLICT/);
    assert.equal(await readFile(plan.file,"utf8"),conflicting);
    await writeFile(plan.file,legacy,{mode:0o600});
    await assert.rejects(registerControlSchedule(x.options),/FILE_CONFLICT/);
    assert.equal((await nativeCtl(["bootstrap",plan.domain,plan.file])).code,0);
    await waitFile(path.join(x.root,"observer-latest.json"));
    const before=await (await openControlStore(x.profile.directory)).read();
    const removed=await stop(x.options);
    assert.equal(removed.status,"UNREGISTERED");
    assert.deepEqual(await (await openControlStore(x.profile.directory)).read(),before);
    await assert.rejects(lstat(plan.file),{code:"ENOENT"});
  } finally {
    if(plan)await nativeCtl(["bootout",plan.target]);
    await rm(x.temp,{recursive:true,force:true});
  }
});
for(const stage of ["before","after"])test(`unknown ${stage} bootout stops without repeating effects and preserves the appropriate lease`,darwin,async(t)=>{
  const x=await fixture();let plan,intercepted;
  try {
    plan=await registerControlSchedule(x.options);
    // Unknown print handling needs an owned registration, not observer startup.
    // The separate post-tick PID test covers live-process removal and held leases.
    const registered=await nativeCtl(["print",plan.target]);
    assert.equal(registered.code,0);
    assert.equal(matchesControlRegistration(registered.output,plan),true);
    assert.match(registered.output,/^\s*runs = 0$/m);
    assert.doesNotMatch(registered.output,/^\s*pid = \d+/m);
    await assert.rejects(lstat(path.join(x.root,"observer-latest.json")),{code:"ENOENT"});
    const before=await (await openControlStore(x.profile.directory)).read();
    const reviewBefore=await (await openControlStore(x.profile.review.directory)).read();
    const spawn=childProcess.spawn;let bootouts=0,prints=0;
    intercepted=t.mock.method(childProcess,"spawn",(executable,args,options)=>{
      if(executable==="/bin/launchctl") {
        if(args[0]==="bootout")bootouts++;
        if(args[0]==="print") {
          prints++;
          if(stage==="before"||bootouts>0)
            return spawn(process.execPath,["-e","process.stderr.write('injected readback failure');process.exitCode=5"],options);
        }
      }
      return spawn(executable,args,options);
    });
    syncBuiltinESMExports();
    await assert.rejects(unregisterControlSchedule(x.options),error=>{
      assert.match(error.message,/REGISTRATION_UNKNOWN|REGISTRATION_UNVERIFIED/);
      assert.equal(error.observation.leaseRetained,stage==="after");
      return true;
    });
    if(stage==="after") {
      const lease=await readFile(path.join(x.root,"observer.lease"),"utf8");
      await assert.rejects(unregisterControlSchedule(x.options),/LEASE_HELD_RECONCILIATION_REQUIRED/);
      assert.equal(await readFile(path.join(x.root,"observer.lease"),"utf8"),lease);
    } else await assert.rejects(lstat(path.join(x.root,"observer.lease")),{code:"ENOENT"});
    assert.equal(bootouts,stage==="after"?1:0);
    assert.equal(prints,stage==="after"?2:1);
    assert.equal(await readFile(plan.file,"utf8"),plan.plist);
    assert.deepEqual(await (await openControlStore(x.profile.directory)).read(),before);
    assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(),reviewBefore);
    await assert.rejects(lstat(path.join(x.root,"observer-latest.json")),{code:"ENOENT"});
    t.diagnostic(JSON.stringify({stage,root:x.root,bootouts,prints,observerStarted:false,
      leaseRetained:stage==="after",hostAndReviewUnchanged:true}));
  } finally {
    intercepted?.mock.restore();syncBuiltinESMExports();
    if(plan) {
      const remaining=await nativeCtl(["print",plan.target]);
      if(remaining.code===0) {
        assert.equal(matchesControlRegistration(remaining.output,plan),true,"cleanup only owns this exact synthetic job");
        assert.equal((await nativeCtl(["bootout",plan.target])).code,0);
      } else {
        assert.equal(remaining.code,113);
        assert.ok(remaining.errors.includes(`Could not find service "${plan.label}"`));
      }
      const absent=await nativeCtl(["print",plan.target]);
      assert.equal(absent.code,113);
      assert.ok(absent.errors.includes(`Could not find service "${plan.label}"`));
      t.diagnostic(JSON.stringify({cleanup:"OWNED_JOB_ABSENT",target:plan.target,root:x.root}));
    }
    await rm(x.temp,{recursive:true,force:true});
  }
});
test("schedule rejects FIFO and symlink plists before reading, without retaining a registration lease",darwin,async()=>{
  const x=await fixture();
  try {
    const plan=await controlSchedulePlan(x.options);
    const fifo=await runControlChild({executable:"/usr/bin/mkfifo",args:["-m","600",plan.file],cwd:"/",
      env:{PATH:"/usr/bin:/bin"},input:"",timeoutMs:5000,maxBytes:32768});
    assert.equal(fifo.code,0);
    const module=new URL("../scripts/control-schedule.mjs",import.meta.url).href;
    const check=`import {registerControlSchedule,unregisterControlSchedule} from ${JSON.stringify(module)};
      for(const fn of [registerControlSchedule,unregisterControlSchedule]) {
        try {await fn(${JSON.stringify(x.options)}); throw Error('UNEXPECTED_ACCEPT');}
        catch(e) {if(e.message!=='CONTROL_SCHEDULE_FILE_CONFLICT')throw e; console.log(e.message);}
      }`;
    for(const kind of ["FIFO","SYMLINK"]) {
      if(kind==="SYMLINK") {
        await rm(plan.file);
        await symlink(path.join(x.temp,"nonexistent-target"),plan.file);
      }
      const result=await runControlChild({executable:process.execPath,args:["--input-type=module","-e",check],cwd:"/",
        env:{PATH:"/usr/bin:/bin"},input:"",timeoutMs:5000,maxBytes:32768});
      assert.equal(result.state,"CLOSED",JSON.stringify(result));
      assert.equal(result.reason,null,JSON.stringify(result));
      assert.equal(result.code,0,JSON.stringify(result));
      assert.equal(result.output.match(/CONTROL_SCHEDULE_FILE_CONFLICT/g)?.length,2);
      const s=await lstat(plan.file);
      assert.ok(kind==="FIFO"?s.isFIFO():s.isSymbolicLink());
      await assert.rejects(lstat(path.join(x.root,"observer.lease")),{code:"ENOENT"});
    }
  } finally {await rm(x.temp,{recursive:true,force:true});}
});
test("schedule refuses a conflicting file before registering and enforces finite cadence",darwin,async()=>{
  const x=await fixture();
  try {
    await assert.rejects(controlSchedulePlan({...x.options,intervalSeconds:1}),/CONFIG_INVALID/);
    const plan=await controlSchedulePlan(x.options);
    await writeFile(plan.file,"foreign",{mode:0o600});
    await assert.rejects(registerControlSchedule(x.options),/FILE_CONFLICT/);
    assert.equal(await readFile(plan.file,"utf8"),"foreign");
  } finally {await rm(x.temp,{recursive:true,force:true});}
});

for(const failure of ["exit","timeout","receipt"])test(`startup ${failure} failure never registers a timer or repeats observation`,darwin,async(t)=>{
  const x=await fixture();let intercepted;
  try {
    const plan=await controlSchedulePlan(x.options),before=await (await openControlStore(x.profile.directory)).read();
    const spawn=childProcess.spawn;let observers=0,bootstraps=0;
    intercepted=t.mock.method(childProcess,"spawn",(executable,args,options)=>{
      if(executable==="/bin/launchctl"&&args[0]==="bootstrap")bootstraps++;
      if(args[0]===plan.args[1]) {
        observers++;
        const code=failure==="exit"?"process.exitCode=7":failure==="timeout"?"setTimeout(()=>{},30000)":"console.log('not-json')";
        return spawn(process.execPath,["-e",code],options);
      }
      return spawn(executable,args,options);
    });
    syncBuiltinESMExports();
    await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs:failure==="timeout"?100:5000}),/INITIAL_OUTCOME_UNVERIFIED|INITIAL_RECEIPT_INVALID/);
    assert.equal(observers,1);assert.equal(bootstraps,0);
    await assert.rejects(lstat(plan.file),{code:"ENOENT"});
    assert.equal((await nativeCtl(["print",plan.target])).code,113);
    assert.deepEqual(await (await openControlStore(x.profile.directory)).read(),before);
  } finally {intercepted?.mock.restore();syncBuiltinESMExports();await rm(x.temp,{recursive:true,force:true});}
});

test("startup requires a bounded allocation and a stopped scheduler",darwin,async()=>{
  const x=await fixture();let registered=false;
  try {
    for(const initialTimeoutMs of [undefined,0,300001])
      await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs}),/INITIAL_BUDGET_REQUIRED/);
    await registerControlSchedule(x.options);registered=true;
    await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs:5000}),/INITIAL_REQUIRES_UNREGISTERED/);
    await assert.rejects(lstat(path.join(x.root,"observer-latest.json")),{code:"ENOENT"});
  } finally {if(registered)await stop(x.options);await rm(x.temp,{recursive:true,force:true});}
});

test("startup refuses replay of an old matching durable receipt",darwin,async(t)=>{
  const x=await fixture();let registered=false,intercepted;
  try {
    const first=await startControlSchedule({...x.options,initialTimeoutMs:10000});registered=true;
    const old=await readFile(path.join(x.root,"observer-latest.json"),"utf8");
    await stop(x.options);registered=false;
    const spawn=childProcess.spawn;
    intercepted=t.mock.method(childProcess,"spawn",(executable,args,options)=>args[0]===first.schedule.args[1]?
      spawn(process.execPath,["-e",`process.stdout.write(${JSON.stringify(old)})`],options):spawn(executable,args,options));
    syncBuiltinESMExports();
    await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs:10000}),/INITIAL_RECEIPT_UNVERIFIED/);
    assert.equal(await readFile(path.join(x.root,"observer-latest.json"),"utf8"),old);
    await assert.rejects(lstat(first.schedule.file),{code:"ENOENT"});
  } finally {
    intercepted?.mock.restore();syncBuiltinESMExports();
    if(registered)await stop(x.options);
    await rm(x.temp,{recursive:true,force:true});
  }
});

test("actual startup post-entry failure retains its UNKNOWN receipt and lease with no timer",darwin,async()=>{
  const x=await fixture("SESSION",false,true);
  try {
    const plan=await controlSchedulePlan(x.options);
    const before=await (await openControlStore(x.profile.directory)).read();
    await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs:10000}),/INITIAL_OUTCOME_UNVERIFIED/);
    const receipt=await readFile(path.join(x.root,"observer-latest.json"),"utf8");
    const lease=await readFile(path.join(x.root,"observer.lease"),"utf8");
    assert.equal(JSON.parse(receipt).status,"UNKNOWN_RECONCILIATION_REQUIRED");
    assert.equal(JSON.parse(receipt).error,"INJECTED_POST_ENTRY_FAILURE");
    assert.match(JSON.parse(receipt).invocationId,/^[a-f0-9-]{36}$/);
    await assert.rejects(lstat(plan.file),{code:"ENOENT"});
    await assert.rejects(startControlSchedule({...x.options,initialTimeoutMs:10000}),/INITIAL_LEASE_HELD_RECONCILIATION_REQUIRED/);
    assert.equal(await readFile(path.join(x.root,"observer-latest.json"),"utf8"),receipt);
    assert.equal(await readFile(path.join(x.root,"observer.lease"),"utf8"),lease);
    assert.deepEqual(await (await openControlStore(x.profile.directory)).read(),before);
  } finally {await rm(x.temp,{recursive:true,force:true});}
});

test("actual periodic interval produces its own native receipt without any immediate kick",{...darwin,timeout:110000},async(t)=>{
  const x=await fixture();let registered=false,intercepted;
  const options={...x.options,intervalSeconds:60};
  try {
    const spawn=childProcess.spawn,commands=[];
    intercepted=t.mock.method(childProcess,"spawn",(executable,args,opts)=>{
      if(executable==="/bin/launchctl")commands.push(args[0]);
      return spawn(executable,args,opts);
    });syncBuiltinESMExports();
    const before=await (await openControlStore(x.profile.review.directory)).read();
    const plan=await registerControlSchedule(options);registered=true;
    const started=performance.now(),observations=[];let receipt;
    while(performance.now()-started<90000) {
      try{receipt=JSON.parse(await readFile(path.join(x.root,"observer-latest.json")));break;}
      catch(error){if(error.code!=="ENOENT")throw error;}
      if(!observations.length||performance.now()-started-observations.at(-1).elapsedMs>=10000) {
        const seen=await nativeCtl(["print",plan.target]);
        observations.push({elapsedMs:Math.round(performance.now()-started),code:seen.code,
          state:seen.output.match(/^\s*(?:state|pid|runs|last exit code) = .+$/gm),
          lease:await readFile(path.join(x.root,"observer.lease"),"utf8").catch(e=>e.code)});
      }
      await sleep(100);
    }
    t.diagnostic(JSON.stringify({case:"real-periodic-no-kick",root:x.root,observations,elapsedMs:Math.round(performance.now()-started),receiptPresent:!!receipt}));
    assert.ok(receipt,"Actual timer receipt required; registration alone is not observation");
    assert.equal(receipt.status,"ONE_TICK_OBSERVED");assert.equal(receipt.calls,0);assert.equal(receipt.paused,true);
    assert.equal(commands.includes("kickstart"),false);
    assert.deepEqual(await (await openControlStore(x.profile.review.directory)).read(),before);
  } finally {
    intercepted?.mock.restore();syncBuiltinESMExports();
    if(registered)await stop(options);
    await rm(x.temp,{recursive:true,force:true});
  }
});
