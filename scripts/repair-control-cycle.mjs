// Maintainer qualification only: one evidence repair, no producer replay or installation.
import {readFile,writeFile,mkdir,readdir,lstat,realpath,access} from "node:fs/promises";
import {constants} from "node:fs";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {inspectControlRuntime,stageControlRuntime,loadControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {validateRepairRegistry,replaceRepairRegistry,validateRepairSourceExtension} from "./repair-cycle-publication.mjs";
import {requireCycleRetainedBytes,gradeCycleMeaning} from "./qualify-control-cycle.mjs";

const hash=v=>sha256(canonicalJson(v)),need=(v,c)=>{if(!v)throw Error(c);};
const json=async file=>JSON.parse(await readFile(file));
const save=(file,value)=>writeFile(file,canonicalJson(value)+"\n",{mode:0o600,flag:"wx"});
const execute=promisify(execFile);
export function gradeInputPolicies(value) {
  const errors=[];
  if(value?.duplicatePolicy!=="case-insensitive-reject")errors.push("duplicatePolicy");
  if(value?.idPolicy!=="preserve-exact")errors.push("idPolicy");
  if(value?.labelPolicy!=="trim")errors.push("labelPolicy");
  if(value?.orderPolicy!=="codepoint")errors.push("orderPolicy");
  return errors;
}
export function gradeCurrentReadback(value) {
  const errors=[...gradeCycleMeaning(value),...gradeInputPolicies(value)];
  if(value?.temporalScope!=="CURRENT_ONLY_NOT_HISTORICAL")errors.push("temporalScope");
  if(value?.worker!=="worker")errors.push("worker");
  if(value?.actionPolicy!=="NO_ACTION_AUTHORIZED")errors.push("actionPolicy");
  if(!Array.isArray(value?.stopConditions)||!["DUPLICATE_ID","OWNER_GATE","CONTROL_HOLD","UNPROVEN_ENVIRONMENT"]
    .every(condition=>value.stopConditions.includes(condition)))errors.push("stopConditions");
  return errors;
}
export async function inventoryCycleRoot(root) {
  need(await realpath(root)===root,"REPAIR_INVENTORY_ROOT_UNSAFE");
  const rows=[];
  async function walk(relative="") {
    for(const name of (await readdir(path.join(root,relative))).sort()) {
      const file=path.join(relative,name),absolute=path.join(root,file),stat=await lstat(absolute);
      need(rows.length<4096&&!stat.isSymbolicLink()&&await realpath(absolute)===absolute,"REPAIR_INVENTORY_UNSAFE");
      if(stat.isDirectory()){rows.push({path:file,kind:"directory",owner:"maintainer",disposition:"RETAIN"});await walk(file);}
      else {need(stat.isFile()&&stat.size<=8*1024*1024,"REPAIR_INVENTORY_CAPACITY");
        rows.push({path:file,kind:"file",bytes:stat.size,sha256:sha256(await readFile(absolute)),owner:"maintainer",disposition:"RETAIN"});}
    }
  }
  await walk();return {root,rows,scope:"This fixture only; file hashes do not expose producer contents",observedAt:new Date().toISOString()};
}
export async function stageRepairCycle({previous,output,sourceRoot=fileURLToPath(new URL("..",import.meta.url))}) {
  need([previous,output,sourceRoot].every(p=>typeof p==="string"&&path.isAbsolute(p)),"REPAIR_PATHS_REQUIRED");
  const parent=await realpath(path.dirname(output));need(path.join(parent,path.basename(output))===output,"REPAIR_OUTPUT_UNSAFE");
  const old=await json(path.join(previous,"freeze.json")),report=await json(path.join(previous,"result-recovery.json")),
    originalProfile=await json(path.join(previous,"host-profile.json"));
  need(report.status==="OBSERVED_COMPLETE_REVIEW_AND_OWNED_REPAIR"&&report.runs.length===16&&
    report.criteria===87&&report.blockingFindings===15&&report.retainedNext==="NOT_RUN","REPAIR_PRIOR_SCOPE_INVALID");
  const selected=await loadControlRuntime({packageRoot:old.runtime.root,expectedDigest:old.runtime.digest,workspace:old.workspace});
  const oldHost=await selected.host.openControlHost(originalProfile.directory,old.config,{}),state=await oldHost.snapshot(),row=state.acceptances.consumer;
  need(!state.paused&&hash(state)===hash(report.state)&&!row.reviewLease&&row.enrollment==="CONTINUATION_OR_REPAIR_DUE"&&
    row.disposition?.action==="REPAIR"&&Object.values(state.reservations).every(r=>r.status!=="IN_FLIGHT"),"REPAIR_PRIOR_STATE_CHANGED");
  const sources=await openReviewSources(old.registryFile),before=await sources.snapshot();
  need(before.digest===old.frozenSources.digest,"REPAIR_PRIOR_SOURCES_CHANGED");
  await requireCycleRetainedBytes(old,row);
  need([old.workspace,old.root,previous].every(root=>output!==root&&!output.startsWith(root+path.sep)&&!root.startsWith(output+path.sep)),"REPAIR_OUTPUT_UNSAFE");
  const registryBytes=await readFile(old.registryFile),registry=JSON.parse(registryBytes);
  need(!registry.sources.some(r=>r.id.startsWith("repair-")||r.path.startsWith("cycle-repair-evidence/")),"REPAIR_ALREADY_STAGED");
  await mkdir(output,{mode:0o700});const out=await realpath(output);
  const identity=await inspectControlRuntime(sourceRoot);await mkdir(path.join(out,"packages"),{mode:0o700});
  const runtime=await stageControlRuntime({sourceRoot,directory:path.join(out,"packages"),workspace:old.workspace,expectedDigest:identity.digest});
  const inventories=[];
  for(const root of [old.workspace,old.root,previous])inventories.push(await inventoryCycleRoot(root));
  const processes=(await execute("/bin/ps",["-axo","pid=,ppid=,pgid=,command="],{maxBuffer:8*1024*1024})).stdout.split("\n")
    .filter(line=>line.includes(old.root)||line.includes(old.workspace)).map(line=>line.trim());
  const env={observedAt:new Date().toISOString(),workspace:await realpath(old.workspace),node:await realpath(process.execPath),
    access:{workspace:"READ_WRITE",artifact:"READ",binary:"EXECUTE"},role:"MAINTAINER_PREFLIGHT_ONLY",
    limitation:"Observed in maintainer process only, NOT executor-environment qualification or a product command readiness receipt",
    historical:"No contemporaneous environment receipt recovered; original qualification remains UNPROVEN"};
  await access(old.workspace,constants.R_OK|constants.W_OK);await access(path.join(old.workspace,row.acceptance.artifact.path),constants.R_OK);
  await access(old.binary,constants.X_OK);
  const producer=old.continuation.producerRuntime;
  const preservedPackages=[];
  for(const pkg of [producer,old.runtime,runtime]) {
    await loadControlRuntime({packageRoot:pkg.root,expectedDigest:pkg.digest,workspace:old.workspace});
    const license=await readFile(path.join(pkg.root,"LICENSE.md")),notice=await readFile(path.join(pkg.root,"NOTICE.md"));
    need(sha256(license)===pkg.description.files["LICENSE.md"]&&sha256(notice)===pkg.description.files["NOTICE.md"],"REPAIR_PROVENANCE_CHANGED");
    preservedPackages.push({runtime:pkg.digest,sourceVersion:pkg.description.sourceVersion,kind:pkg.description.kind,
      licenseSha256:sha256(license),noticeSha256:sha256(notice),manifestFiles:Object.keys(pkg.description.files).length,status:"BYTES_VERIFIED_CURRENTLY_NOT_ACTIVATION"});
  }
  const provenance={sourceVersion:runtime.description.sourceVersion,kind:runtime.description.kind,activation:"STAGED_NOT_ACTIVATED",
    producerRuntime:producer.digest,postRuntime:old.runtime.digest,repairRuntime:runtime.digest,
    license:await readFile(path.join(runtime.root,"LICENSE.md"),"utf8"),notice:await readFile(path.join(runtime.root,"NOTICE.md"),"utf8"),
    files:runtime.description.files,preservedPackages,updateDue:"No installed project in this fixture; production activation/Q5 remains unproven"};
  const mapping={observedAt:new Date().toISOString(),declaredBy:"maintainer",current:{workerPacket:"worker-1",executor:"worker",
    knowledgePlan:"orchestrator",outcomeOwner:"owner",independentReviewer:"reviewer"},
    temporalScope:"Current fixture role mapping only, not recovered historical authentication",task:old.request.task,
    integrationPlan:await json(path.join(old.workspace,"cycle-fixture-repair/integration-plan.json")),
    integrationReviewLimit:"maintainer-synthetic-fixture review is not independent approval"};
  const {openControlStore}=await import(pathToFileURL(path.join(old.runtime.root,"scripts/control-store.mjs")));
  const transport=[];
  for(const directory of ["repair-review","post-high-review"]) {
    const journal=await(await openControlStore(path.join(old.root,directory))).read();
    const run=Object.values(journal.state.runs).find(r=>r.reason==="TIMEOUT");need(run,"REPAIR_PRIOR_TIMEOUT_MISSING");
    const bytes=await readFile(path.join(old.root,directory,run.trace.file));need(sha256(bytes)===run.trace.sha256,"REPAIR_PRIOR_TRACE_CHANGED");
    const raw=JSON.parse(bytes),events=raw.output.trim().split("\n").map(JSON.parse);
    transport.push({directory,runId:run.runId,state:run.state,reason:run.reason,signal:run.signal,trace:run.trace,
      elapsedMs:raw.timing.elapsedMs,lastStdoutMs:raw.timing.lastStdoutMs,
      turnCompleted:events.filter(e=>e.type==="turn.completed").length,
      completedJudgments:events.filter(e=>e.type==="item.completed"&&e.item?.type==="agent_message").length,
      usage:run.usage,internalInferenceCause:"UNKNOWN"});
  }
  const packet={schema:"qualification.repair-evidence.v1",observedAt:new Date().toISOString(),acceptedScope:"One JSON consumer only, not platform/release",
    currentLifecycle:{enrollment:row.enrollment,ownerDisposition:row.disposition.action,closure:"PENDING",productAcceptance:"PRESERVED",
      trackerPhase:"retained-tracker was authored before terminal proposal and independent POST; it remains historical, not applied DONE"},
    sources:{mapping:"repair-owner-map",provenance:"repair-provenance",environment:"repair-environment",
      inventories:inventories.map((_,i)=>`repair-inventory-${i+1}`)},custody:{processes,processScope:"Observed matching fixture paths only, not all machine processes",
      cleanup:"No deletion. Maintainer owns retained fixture, control journals and packages until explicit archive decision.",
      excluded:"External authHome is provisioned authentication, not fixture-owned storage; never inspected or copied"},
    debt:{owner:"maintainer",inherited:["unfinished experiment preserved","CSV owner gate remains pending, not implemented"],
      discovered:row.findings.map(f=>({id:f.id,checkId:f.checkId,status:f.status,work:f.work})),created:["repair evidence publication and current readback"],
      qualificationLimits:["historical worker understanding absent","historical environment receipt absent","Q4 HEALTH and Q5 adoption incomplete","Q6 effectiveness comparison incomplete"],
      revisit:"Before release, or before any future dependent product mutation; no automatic retry of historical absence"},
    healthDue:{scope:"Uninstalled one-consumer fixture, not initial project adoption",healthEnrolled:state.health!==undefined,
      checkpoint:"POST repair currently due; archive deadline is not a HEALTH trigger",releaseObligation:"Q4 independent HEALTH still required"},
    accounting:{priorAttempts:report.runs,knownOnly:true,unknownTimeouts:2,next:"NOT_RUN",comparability:"INCOMPLETE_Q6"},
    transport:{observations:transport,qualification:"Caller timeout/SIGKILL recorded; no completed verdict in retained trace. Internal inference cause remains UNKNOWN."},
    limitations:"New observations are current evidence, never backdated historical compliance. Independent review may retain findings or reject proposed scope."};
  const values=[["repair-evidence","amendment.json",packet],["repair-owner-map","roles.json",mapping],
    ["repair-provenance","provenance.json",provenance],["repair-environment","environment.json",env],
    ...inventories.map((value,i)=>[`repair-inventory-${i+1}`,`inventory-${i+1}.json`,value])];
  need(values.every(([, ,v])=>Buffer.byteLength(canonicalJson(v)+"\n")<=128*1024)&&
    before.bytes+values.reduce((n,[,,v])=>n+Buffer.byteLength(canonicalJson(v)+"\n"),0)<=2*1024*1024,"REPAIR_SOURCE_CAPACITY");
  need(sha256(await readFile(old.registryFile))===sha256(registryBytes),"REPAIR_PRIOR_SOURCES_CHANGED");
  const base="cycle-repair-evidence",register=values.map(([id,file])=>({id,path:path.posix.join(base,file),purpose:"Observed bounded repair evidence; historical limits explicit"}));
  registry.sources.push(...register);validateRepairRegistry(registry);
  await mkdir(path.join(old.workspace,base),{mode:0o700});
  for(const [id,file,value] of values) {
    const relative=path.posix.join(base,file);await save(path.join(old.workspace,relative),value);
  }
  const prospective=path.join(out,"staged-sources.json");await save(prospective,registry);
  const stagedSources=await(await openReviewSources(prospective)).snapshot();
  validateRepairSourceExtension(before,stagedSources,register.map(r=>r.id));
  const controlFile=path.join(out,"current-readback-control.json");
  await save(controlFile,{schema:"control.owner-endpoint.v1",capability:"CONTROL_READ_ONLY",directory:originalProfile.directory,config:old.config,acceptanceIds:["consumer"]});
  const allocation={model:"gpt-6.1-sol",effort:"low",secondsPerCall:120,maxNewCalls:11,retries:0,
    calls:{currentReadback:1,postRepair:8,owner:1,retainedNext:1},priorAttempts:16,maxCumulativeAttempts:27,
    usage:"Review max2500000 observed input+output tokens, checked between calls; inside-turn ceiling not guaranteed"};
  const profile={...originalProfile,review:{...originalProfile.review,directory:path.join(old.root,"owned-repair-review"),maxCalls:8,
    expiresAt:new Date(Date.now()+3600000).toISOString(),episodeMaxUsageTokens:2500000,
    scope:{...originalProfile.review.scope,requiredSourceIds:[...originalProfile.review.scope.requiredSourceIds,"repair-evidence"]}}};
  await mkdir(profile.review.directory,{mode:0o700});
  const qualifierFiles={};
  for(const file of ["repair-control-cycle.mjs","run-repair-control-cycle.mjs","repair-cycle-publication.mjs","qualify-control-cycle.mjs"])
    qualifierFiles[file]=sha256(await readFile(new URL(file,import.meta.url)));
  const freeze={schema:"qualification.owned-repair-cycle.v1",out,previous,workspace:old.workspace,root:old.root,registryFile:old.registryFile,
    old,profile,runtime,controlFile,allocation,stateHash:hash(state),acceptedHash:hash(row.acceptance),priorRuns:report.runs,
    previousReportHash:sha256(await readFile(path.join(previous,"result-recovery.json"))),
    sources:stagedSources,
    scriptSha256:sha256(await readFile(fileURLToPath(import.meta.url))),
    runnerSha256:sha256(await readFile(new URL("run-repair-control-cycle.mjs",import.meta.url))),qualifierFiles};
  await save(path.join(out,"freeze.json"),freeze);
  await replaceRepairRegistry(old.registryFile,registryBytes,registry);
  return {output:out,runtime:runtime.digest,priorAttempts:16,modelsLaunched:0,productReplayed:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await stageRepairCycle({previous:process.argv[2],output:process.argv[3]})));
