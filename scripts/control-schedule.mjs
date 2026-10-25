// Supported macOS registration. launchd wakes a finite observer, not a permanent
// manager. The observer owns retained budgets, pause and unknown-effect handling.
import {mkdir,realpath,lstat,open,readFile,unlink} from "node:fs/promises";
import {homedir} from "node:os";
import {randomUUID} from "node:crypto";
import path from "node:path";
import {verifyControlActivation,controlDirectory,readActivationJson,acquireControlLease} from "./control-activation.mjs";
import {runControlChild} from "./control-child.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";

const need=(v,c)=>{if(!v)throw Error(c);};
const xml=s=>String(s).replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));
const labelFor=root=>`com.vydykhai.control.${sha256(root).slice(0,24)}`;
const absent=(r,label)=>r.code===113&&r.errors.includes(`Could not find service "${label}"`);
export function matchesControlRegistration(output,plan) {
  const args=/^\s*arguments = \{\n([\s\S]*?)^\s*\}/m.exec(output)?.[1].split("\n").map(s=>s.trim()).filter(Boolean);
  const program=/^\s*program = (.+)$/m.exec(output)?.[1];
  const file=/^\s*path = (.+)$/m.exec(output)?.[1];
  return program===plan.args[0] && file===plan.file && canonicalJson(args??null)===canonicalJson(plan.args);
}
async function launchctl(args,timeoutMs=10000) {
  const r=await runControlChild({executable:"/bin/launchctl",args,cwd:"/",env:{PATH:"/usr/bin:/bin"},
    input:"",timeoutMs,maxBytes:128*1024});
  need(r.state === "CLOSED" && !r.reason,"CONTROL_SCHEDULE_COMMAND_UNKNOWN");
  return r;
}
async function planFor({descriptorFile,intervalSeconds=3600,mode="LOGIN"},verify=true) {
  need(process.platform === "darwin" && ["LOGIN","SESSION"].includes(mode) &&
    Number.isSafeInteger(intervalSeconds) && intervalSeconds>=60 && intervalSeconds<=86400,"CONTROL_SCHEDULE_CONFIG_INVALID");
  // Removing an owned registration must still work when observation dependencies
  // have disappeared. Its private immutable descriptor is the ownership anchor.
  let descriptor;
  if(verify)({descriptor}=await verifyControlActivation(descriptorFile));
  else {
    const identity=await controlDirectory(path.dirname(descriptorFile));
    descriptor=await readActivationJson(descriptorFile);
    need(descriptorFile===path.join(identity.path,"activation.json") &&
      !((await lstat(descriptorFile)).mode&0o222) && descriptor.schema==="control.activation.v1" &&
      descriptor.status==="PRIVATE_ACTIVATED_NOT_PROJECT_READY" &&
      canonicalJson(descriptor.controlRoot)===canonicalJson(identity),"CONTROL_SCHEDULE_OWNERSHIP_INVALID");
  }
  const root=descriptor.controlRoot.path;
  const label=labelFor(root), domain=`gui/${process.getuid()}`,target=`${domain}/${label}`;
  const directory=mode === "LOGIN" ? path.join(homedir(),"Library","LaunchAgents") : root;
  const args=[await realpath(process.execPath),path.join(descriptor.runtime.root,"scripts/control-observer-run.mjs"),descriptorFile];
  need(args.every(s=>s===s.trim()&&!/[\r\n\t]/.test(s)),"CONTROL_SCHEDULE_ARGUMENT_UNSUPPORTED");
  const plist=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${xml(label)}</string>\n<key>ProgramArguments</key><array>${args.map(s=>`<string>${xml(s)}</string>`).join("")}</array>\n<key>RunAtLoad</key><false/>\n<key>StartInterval</key><integer>${intervalSeconds}</integer>\n<key>ProcessType</key><string>Background</string>\n</dict></plist>\n`;
  return {schema:"control.schedule.v1",label,domain,target,directory,file:path.join(directory,`${label}.plist`),
    descriptorFile,descriptorHash:sha256(canonicalJson(descriptor)),mode,intervalSeconds,args,plist};
}
export const controlSchedulePlan=options=>planFor(options);
async function verifyInstalled(plan,{allowLegacyRunAtLoad=false}={}) {
  const s=await lstat(plan.file);
  need(s.isFile()&&!s.isSymbolicLink()&&await realpath(plan.file)===plan.file&&s.uid===process.getuid()&&
    !(s.mode&0o077),"CONTROL_SCHEDULE_FILE_CONFLICT");
  const contents=await readFile(plan.file,"utf8");
  const legacy=plan.plist.replace("<key>RunAtLoad</key><false/>","<key>RunAtLoad</key><true/>");
  need(contents===plan.plist||(allowLegacyRunAtLoad&&contents===legacy),"CONTROL_SCHEDULE_FILE_CONFLICT");
}
export async function registerControlSchedule(options) {
  const initial=await controlSchedulePlan(options);
  const release=await acquireControlLease(path.dirname(initial.descriptorFile));
  try {return {...await registerUnderLease(options),initialObservation:"NOT_PERFORMED"};}
  finally {await release();}
}
// This read-only wait never owns or aborts the scheduler's process. A later
// caller can keep waiting on the same receipt boundary without redispatch.
export async function waitControlObservation({descriptorFile, afterReceiptSha256 = null, waitMs = 1000}) {
  need(Number.isSafeInteger(waitMs) && waitMs >= 0 && waitMs <= 300000, "CONTROL_WAIT_INVALID");
  const plan = await controlSchedulePlan({descriptorFile});
  const until = Date.now() + waitMs;
  do {
    let receipt;
    try {receipt = await readActivationJson(path.join(path.dirname(descriptorFile), "observer-latest.json"));}
    catch(error) {if(error.code !== "ENOENT")throw error;}
    if(receipt && receipt.descriptorHash === plan.descriptorHash) {
      const receiptSha256 = sha256(canonicalJson(receipt));
      if(receiptSha256 !== afterReceiptSha256 && ["COMPLETED","FAILED"].includes(receipt.stage))
        return {status:"OBSERVED", receiptSha256, receipt};
    }
    const remaining = until - Date.now();
    if(remaining <= 0)break;
    await new Promise(resolve=>setTimeout(resolve, Math.min(100, remaining)));
  } while(true);
  return {status:"PENDING", reason:"WAIT_TIMEOUT", descriptorHash:plan.descriptorHash,
    afterReceiptSha256, executionInterrupted:false};
}
export async function startScheduledControl(options) {
  // The first natural interval is the initial wake. No separate kickstart
  // transaction can be lost or duplicated between registration and dispatch.
  const schedule = await registerControlSchedule(options);
  if(options.eventDriven) return {status:'REGISTERED_EVENT_REQUESTED',schedule,
    initialWake:await requestScheduledObservation(options),executionRestarted:false};
  return {status:"REGISTERED_AWAITING_TICK", schedule,
    initialWake:"NATURAL_INTERVAL", executionRestarted:false};
}
// The event/acceptance is already durable. This is only a non-terminating wake
// of the SAME registered service; a lost/coalesced signal is recovered by its timer.
export async function requestScheduledObservation(options, binding) {
  try {
    const plan=await controlSchedulePlan(options);
    const {profile}=await verifyControlActivation(options.descriptorFile);
    need(!binding || profile.directory===binding.directory && canonicalJson(profile.config)===canonicalJson(binding.config),
      'CONTROL_EVENT_HOST_MISMATCH');
    const state=await (await import('./control-store.mjs')).openControlStore(profile.directory).then(s=>s.read());
    if(state.state.paused)return {status:'PAUSED',modelCalls:0};
    await verifyInstalled(plan);
    const present=await launchctl(['print',plan.target]);
    need(present.code===0 && matchesControlRegistration(present.output,plan),'CONTROL_EVENT_REGISTRATION_UNKNOWN');
    const wake=await launchctl(['kickstart',plan.target]); // Never -k: active work must survive.
    return {status:wake.code===0?'WAKE_REQUESTED':'TIMER_RECOVERY',eventPersisted:true,modelCalls:0,
      ...(wake.code===0?{}:{reason:'WAKE_NOT_ACKNOWLEDGED'})};
  } catch(error) {
    return {status:'TIMER_RECOVERY',eventPersisted:true,modelCalls:0,reason:error.message};
  }
}
// Initial observation is a separately observed operation, not a launchd wakeup.
// This trusted setup route never retries an unknown observer or replenishes budget.
export async function startControlSchedule(options) {
  const {initialTimeoutMs}=options;
  need(Number.isSafeInteger(initialTimeoutMs)&&initialTimeoutMs>0&&initialTimeoutMs<=300000,
    "CONTROL_SCHEDULE_INITIAL_BUDGET_REQUIRED");
  const plan=await controlSchedulePlan(options),root=path.dirname(plan.descriptorFile);
  const present=await launchctl(["print",plan.target]);
  need(absent(present,plan.label),"CONTROL_SCHEDULE_INITIAL_REQUIRES_UNREGISTERED");
  try {await lstat(path.join(root,"observer.lease"));throw Error("CONTROL_SCHEDULE_INITIAL_LEASE_HELD_RECONCILIATION_REQUIRED");}
  catch(error){if(error.code!=="ENOENT")throw error;}
  const invocationId=randomUUID();
  const initial=await runControlChild({executable:plan.args[0],args:[...plan.args.slice(1),invocationId],cwd:root,
    env:{PATH:"/usr/bin:/bin",HOME:homedir()},input:"",timeoutMs:initialTimeoutMs,maxBytes:64*1024});
  need(initial.state==="CLOSED"&&!initial.reason&&initial.code===0,"CONTROL_SCHEDULE_INITIAL_OUTCOME_UNVERIFIED");
  let receipt;try{receipt=JSON.parse(initial.output);}catch{throw Error("CONTROL_SCHEDULE_INITIAL_RECEIPT_INVALID");}
  const saved=await readActivationJson(path.join(root,"observer-latest.json"));
  need(receipt.schema==="control.observer-readback.v1"&&receipt.status==="ONE_TICK_OBSERVED"&&
    receipt.invocationId===invocationId&&receipt.descriptorHash===plan.descriptorHash&&canonicalJson(receipt)===canonicalJson(saved),
    "CONTROL_SCHEDULE_INITIAL_RECEIPT_UNVERIFIED");
  need((await controlSchedulePlan(options)).descriptorHash===plan.descriptorHash,"CONTROL_SCHEDULE_DESCRIPTOR_CHANGED");
  const schedule=await registerControlSchedule(options);
  return {status:"INITIAL_OBSERVED_PERIODIC_REGISTERED",projectReadiness:"NOT_CERTIFIED",
    initialObservation:receipt,schedule};
}
async function registerUnderLease(options) {
  const plan=await controlSchedulePlan(options);
  if(plan.mode === "LOGIN") {
    await mkdir(plan.directory,{recursive:true,mode:0o700});
    const d=await lstat(plan.directory);
    need(d.isDirectory()&&!d.isSymbolicLink()&&await realpath(plan.directory)===plan.directory&&
      d.uid===process.getuid()&&!(d.mode&0o022),"CONTROL_SCHEDULE_DIRECTORY_UNSAFE");
  } else await controlDirectory(plan.directory);
  try {
    const f=await open(plan.file,"wx",0o600);try{await f.writeFile(plan.plist);await f.sync();}finally{await f.close();}
  } catch(e) {if(e.code!=="EEXIST")throw e;}
  await verifyInstalled(plan);
  const present=await launchctl(["print",plan.target]);
  if(present.code===0) {
    // A foreign registration cannot acquire our label merely through a matching
    // file. Refuse rather than replacing or unloading an unknown job.
    need(matchesControlRegistration(present.output,plan),"CONTROL_SCHEDULE_REGISTRATION_CONFLICT");
    return {...plan,status:"REGISTERED",reused:true,readiness:"NOT_CERTIFIED"};
  }
  need(absent(present,plan.label),"CONTROL_SCHEDULE_REGISTRATION_UNKNOWN");
  const started=await launchctl(["bootstrap",plan.domain,plan.file]);
  need(started.code===0,"CONTROL_SCHEDULE_REGISTRATION_FAILED");
  const observed=await launchctl(["print",plan.target]);
  need(observed.code===0&&matchesControlRegistration(observed.output,plan),"CONTROL_SCHEDULE_REGISTRATION_UNVERIFIED");
  return {...plan,status:"REGISTERED",reused:false,readiness:"NOT_CERTIFIED"};
}
export async function unregisterControlSchedule(options) {
  const plan=await planFor(options,false);await verifyInstalled(plan,{allowLegacyRunAtLoad:true});
  // Hold the same dispatch lease through removal. A timer firing after `print`
  // cannot start a reviewer before bootout. An unknown lease is never stolen.
  const release=await acquireControlLease(path.dirname(plan.descriptorFile));
  let safeToRelease=true,stopStarted=null,lastObservation=null;
  try {
    const present=await launchctl(["print",plan.target]);
    need(present.code===0||absent(present,plan.label),"CONTROL_SCHEDULE_REGISTRATION_UNKNOWN");
    if(present.code===0) {
      need(matchesControlRegistration(present.output,plan),"CONTROL_SCHEDULE_REGISTRATION_CONFLICT");
      // A post-tick process may linger after its durable receipt and lease release.
      // Owning the lease excludes unfinished effects and prevents new dispatch;
      // bootout may terminate that idle process, but never a retained active lease.
      safeToRelease=false;
      stopStarted=performance.now();
      const stopped=await launchctl(["bootout",plan.target]);need(stopped.code===0,"CONTROL_SCHEDULE_STOP_UNVERIFIED");
    }
    const deadline=(stopStarted??performance.now())+10000;
    for(;;) {
      const remaining=Math.ceil(deadline-performance.now());
      need(remaining>0,"CONTROL_SCHEDULE_STILL_REGISTERED_OR_UNKNOWN");
      const after=await launchctl(["print",plan.target],remaining);
      lastObservation={code:after.code,errors:after.errors.slice(0,512),
        process:after.output.match(/^\s*(?:state|pid|runs|last exit code) = .+$/gm)};
      if(absent(after,plan.label))break;
      need(after.code===0&&matchesControlRegistration(after.output,plan),"CONTROL_SCHEDULE_REGISTRATION_UNVERIFIED");
      // bootout acknowledgment precedes process removal. Observe, never repeat it.
      await new Promise(resolve=>setTimeout(resolve,Math.min(25,Math.max(0,deadline-performance.now()))));
    }
    safeToRelease=true;
    await unlink(plan.file);
    return {status:"UNREGISTERED",state:"PRESERVED",label:plan.label};
  } catch(error) {
    error.observation={last:lastObservation,elapsedMs:stopStarted===null?null:Math.round(performance.now()-stopStarted),
      leaseRetained:!safeToRelease};
    throw error;
  } finally {if(safeToRelease)await release();}
}
