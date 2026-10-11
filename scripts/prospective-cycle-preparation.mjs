// Maintainer qualification helpers. None of these checks grants execution.
import {access,lstat,readFile,realpath} from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {gradeCycleMeaning} from "./qualify-control-cycle.mjs";
import {gradeInputPolicies} from "./repair-control-cycle.mjs";
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
const digest=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);

export function gradeProspectiveReadback(value,{request,worker,environment,now=Date.now()}) {
  const errors=[...gradeCycleMeaning(value),...gradeInputPolicies(value)];
  const observed=Date.parse(environment?.observedAt);
  if(environment?.schema!=="qualification.prospective-environment.v1"||
    environment.phase!=="BEFORE_PROTECTED_ACTION"||environment.actor!=="CONTROLLED_LAUNCH_ADAPTER_PREFLIGHT"||
    !Number.isFinite(observed)||observed>now||now-observed>180000||environment.output!=="ABSENT_CREATE_ONCE"||
    environment.taskSha256!==request.task.sha256||environment.capsuleSha256!==request.capsule.sha256||
    ![environment.taskSha256,environment.capsuleSha256,environment.commandSha256,environment.scriptSha256].every(digest)||
    ![environment.workspace,environment.executable,environment.home].every(v=>typeof v==="string"&&path.isAbsolute(v))||
    environment.effectiveEnv?.HOME!==environment.home||environment.effectiveEnv?.CODEX_HOME!=="EXTERNAL_AUTH_REFERENCE"||
    environment.effectiveEnv?.PATH!=="/usr/local/bin:/usr/bin:/bin"||
    environment.authHomeReference!=="EXISTING_EXTERNAL_AUTH_DIRECTORY_CHECKED_NO_SECRET_READ"||
    environment.checks!=="PATH_IDENTITY_ACCESS_AND_SELECTED_PROFILE_ONLY")errors.push("environmentReceipt");
  if(value?.worker!==worker)errors.push("worker");
  if(value?.taskSha256!==request.task.sha256)errors.push("taskSha256");
  if(value?.capsuleSha256!==request.capsule.sha256)errors.push("capsuleSha256");
  if(value?.environmentSha256!==hash(environment))errors.push("environmentSha256");
  if(value?.executionAuthorized!==false)errors.push("executionAuthorized");
  const conditions=value?.stopConditions;
  const stops=Array.isArray(conditions)?conditions.map(v=>typeof v==="string"?v:v?.code):
    conditions&&typeof conditions==="object"?Object.entries(conditions).filter(([,v])=>typeof v==="string"&&v.trim()).map(([k])=>k):[];
  for(const id of ["STALE_BINDING","PERMISSION_MISSING","PRODUCER_CHANGE","DUPLICATE_ID"])
    if(!stops.includes(id))errors.push(`stop:${id}`);
  return errors;
}

// Binding validation only. Caller must acquire the actual pinned host state and
// independent reviewer return; caller-selected strings are not authentication.
export function validateProspectiveDependencyDecision(decision,{manifestSha256,priorStateHash,sourceDigest,priorState,reviewer,owner,executor}) {
  const findingIds=Object.values(priorState?.acceptances??{}).flatMap(a=>(a.findings??[]).filter(f=>f.status==="OPEN").map(f=>f.id));
  need(decision?.schema==="qualification.prospective-dependency-decision.v1"&&
    decision.decision==="INDEPENDENT_NEW_CONSUMPTION_ONLY"&&
    [manifestSha256,priorStateHash,sourceDigest].every(digest)&&hash(priorState)===priorStateHash&&
    typeof owner==="string"&&owner.trim()&&typeof executor==="string"&&executor.trim()&&
    typeof reviewer==="string"&&reviewer.trim()&&reviewer!==owner&&reviewer!==executor&&decision.reviewer===reviewer&&
    decision.manifestSha256===manifestSha256&&decision.priorStateHash===priorStateHash&&
    decision.sourceDigest===sourceDigest&&Array.isArray(decision.findingDispositions)&&
    findingIds.length>0&&new Set(findingIds).size===findingIds.length&&
    canonicalJson(decision.findingDispositions.map(r=>r?.id).sort())===canonicalJson([...findingIds].sort())&&
    decision.findingDispositions.every(r=>
      typeof r?.id==="string"&&typeof r?.reason==="string"&&r.reason.trim()&&
      r.disposition==="RETAIN_OLD_HOLD_NO_DEPENDENCE")&&
    decision.historicalClosure===false&&decision.oldConsumerDependency===false&&
    decision.executionGranted===false,"PROSPECTIVE_INDEPENDENT_DEPENDENCY_REQUIRED");
  return true;
}

export async function prospectiveEnvironment({workspace,binary,home,authHome,endpointParent,request,action}) {
  need([workspace,binary,home,authHome,endpointParent].every(p=>typeof p==="string"&&path.isAbsolute(p)),
    "PROSPECTIVE_ENVIRONMENT_PATHS_REQUIRED");
  for(const directory of [workspace,home,authHome,endpointParent]) {
    need(await realpath(directory)===directory&&(await lstat(directory)).isDirectory(),"PROSPECTIVE_ENVIRONMENT_DIRECTORY_UNSAFE");
  }
  need(home.startsWith(endpointParent+path.sep)&&home!==workspace&&!home.startsWith(workspace+path.sep)&&
    authHome!==workspace&&!authHome.startsWith(workspace+path.sep)&&
    !((await lstat(home)).mode&0o077)&&!((await lstat(endpointParent)).mode&0o077),"PROSPECTIVE_ENVIRONMENT_HOME_UNSAFE");
  const executable=await realpath(binary);
  await access(executable,constants.X_OK);await access(workspace,constants.R_OK|constants.W_OK);
  need(action?.cwd==="."&&Array.isArray(action.args)&&action.args.length===1&&
    typeof action.args[0]==="string"&&!path.isAbsolute(action.args[0])&&
    !action.args[0].split(/[\\/]/).some(p=>p===".."||!p),"PROSPECTIVE_ENVIRONMENT_ACTION_UNSAFE");
  const script=path.join(workspace,action.args[0]);
  need(await realpath(script)===script&&(await lstat(script)).isFile(),"PROSPECTIVE_ENVIRONMENT_ACTION_UNSAFE");
  await access(script,constants.R_OK);await access(await realpath(action.executable),constants.X_OK);
  const output=path.join(workspace,"consumer-output.json");
  try {await lstat(output);throw Error("PROSPECTIVE_OUTPUT_ALREADY_EXISTS");}catch(e){if(e.code!=="ENOENT")throw e;}
  return {schema:"qualification.prospective-environment.v1",observedAt:new Date().toISOString(),
    phase:"BEFORE_PROTECTED_ACTION",actor:"CONTROLLED_LAUNCH_ADAPTER_PREFLIGHT",
    workspace,executable,home,authHomeReference:"EXISTING_EXTERNAL_AUTH_DIRECTORY_CHECKED_NO_SECRET_READ",
    effectiveEnv:{HOME:home,CODEX_HOME:"EXTERNAL_AUTH_REFERENCE",PATH:"/usr/local/bin:/usr/bin:/bin"},
    taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,commandSha256:hash(action),
    scriptSha256:sha256(await readFile(script)),output:"ABSENT_CREATE_ONCE",checks:"PATH_IDENTITY_ACCESS_AND_SELECTED_PROFILE_ONLY",
    limits:["Not an OS sandbox or credential/network entitlement proof.","Native adapter rechecks actual launch layout before spawn.",
      "Readback and independent readiness remain required; this receipt grants no execution."]};
}
export async function observeProspectiveCommand({workspace,action,producerRef}) {
  need(path.isAbsolute(workspace)&&await realpath(workspace)===workspace&&
    action?.cwd==="."&&path.isAbsolute(action.executable??"")&&Array.isArray(action.args)&&action.args.length===1&&
    [action.args[0],producerRef?.path].every(p=>typeof p==="string"&&p&&!path.isAbsolute(p)&&
      !p.split(/[\\/]/).some(s=>s===".."||!s))&&digest(producerRef?.sha256),"PROSPECTIVE_COMMAND_PROOF_INVALID");
  const executable=await realpath(action.executable),script=path.join(workspace,action.args[0]),producer=path.join(workspace,producerRef.path);
  for(const file of [executable,script,producer])need(await realpath(file)===file&&(await lstat(file)).isFile(),"PROSPECTIVE_COMMAND_IDENTITY_UNSAFE");
  await access(executable,constants.X_OK);await access(script,constants.R_OK);await access(producer,constants.R_OK);
  const producerSha256=sha256(await readFile(producer));
  need(producerSha256===producerRef.sha256,"PROSPECTIVE_PINNED_PRODUCER_CHANGED");
  return {schema:"qualification.prospective-command-observation.v1",observedAt:new Date().toISOString(),
    phase:"BEFORE_PROTECTED_ACTION",workspace,commandSha256:hash(action),
    executable:{configured:action.executable,resolved:executable,sha256:sha256(await readFile(executable)),access:"X_OK"},
    script:{path:action.args[0],sha256:sha256(await readFile(script)),access:"R_OK"},
    producer:{...producerRef,sha256:producerSha256,access:"R_OK",context:"OPAQUE_BYTES_HASH_ONLY"},
    executionAuthorized:false,limits:"Selected identity/access/byte pins only; not OS sandbox, credentials, network or runtime behavior proof."};
}
