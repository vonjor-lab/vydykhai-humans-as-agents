// Finish the existing delivered verdict only; never repeat independent review.
import {readFile,writeFile,realpath,lstat} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {loadControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {cycleCompleted,requireCycleOwnerControl,requireCycleRetainedBytes} from "./qualify-control-cycle.mjs";
import {recordRepairCall} from "./repair-cycle-publication.mjs";
import {validateRepairAllocation} from "./run-repair-control-cycle.mjs";
const hash=v=>sha256(canonicalJson(v)),need=(v,c)=>{if(!v)throw Error(c);};
const json=async p=>JSON.parse(await readFile(p));
const save=(p,v)=>writeFile(p,canonicalJson(v)+"\n",{mode:0o600,flag:"wx"});
export async function completeRepairOwner(output) {
  const f=await json(path.join(output,"freeze.json")),failed=await json(path.join(output,"result.json"));
  validateRepairAllocation(f);
  need(failed.failure==="CONTROL_WORKER_HOME_UNSAFE"&&failed.runs.length===26&&failed.runs.at(-1).name==="disposition"&&
    failed.runs.at(-1).reason==="CONTROL_WORKER_HOME_UNSAFE"&&failed.retainedNext==="NOT_RUN","OWNER_RETURN_SCOPE_INVALID");
  const runtime=await loadControlRuntime({packageRoot:f.runtime.root,expectedDigest:f.runtime.digest,workspace:f.workspace}),
    service=await runtime.service.openControlService(f.profile),before=await service.host.snapshot(),row=before.acceptances.consumer;
  need(hash(before)===hash(failed.state)&&!before.paused&&row.enrollment==="OWNER_DISPOSITION_DUE"&&
    row.review?.rows.length===87&&row.findings.some(x=>x.status==="OPEN"&&x.blocksResume),"OWNER_RETURN_STATE_CHANGED");
  await requireCycleRetainedBytes(f,row);
  const sources=await(await openReviewSources(f.registryFile)).snapshot();
  const failedEndpoint=path.join(output,"owner.json"),endpointFile=path.join(f.root,"owner.json"),
    endpoint=await json(endpointFile),native=f.profile.review.native;
  need(endpoint.capability==="CONTROL_DISPOSITION_ONLY"&&hash(endpoint.config)===hash(f.profile.config)&&
    native.home.startsWith(path.dirname(endpointFile)+path.sep)&&!native.home.startsWith(path.dirname(failedEndpoint)+path.sep)&&
    await realpath(native.home)===native.home&&!((await lstat(native.home)).mode&0o077),"OWNER_RETURN_LAYOUT_NOT_PROVEN");
  const prompt="Read inbox, exact current verdict for consumer and fresh read_control before responding. Preserve every original finding and accepted artifact. This verdict has OPEN blockers, so record owned REPAIR with one PREPARED lease per unique owner/work, checkpoint independent source-backed repair review, evidence assigned but not executed, reviewAt no later than its earliest finding. Do not close, reclassify, retry, override pause or claim DONE. Missing proof remains missing. Report only the observed host result. No product command is authorized.";
  await save(path.join(output,"owner-return-allocation.json"),{schema:"qualification.owner-return.v1",model:"gpt-6.1-sol",effort:"low",timeoutMs:120000,maxCalls:1,retries:0,
    cumulativeAttempt:27,maxCumulativeAttempts:27,priorAttempts:26,slot:"Original unspent retained-next allocation reassigned explicitly to owner only; recall prohibited by blockers",
    originalResultSha256:hash(failed),stateHash:hash(before),sourceDigest:sources.digest,runtime:f.runtime.digest,promptSha256:sha256(prompt),
    prelaunchFailure:{original:"UNKNOWN row retained",observed:"HOME outside endpoint parent is rejected before runControlChild by frozen worker adapter; no review replay or refund"}});
  const current=await service.host.preparationStatus(["consumer"]),runs=[...failed.runs];let failure=null,status="OWNER_RETURN_FAILED";
  try {
    const started=Date.now(),result=await runtime.worker.runControlledWorker({...native,endpointFile,role:"owner-disposition",prompt});
    await recordRepairCall({runs,name:"disposition-return",result,seconds:(Date.now()-started)/1000,
      saveTrace:r=>save(path.join(output,"trace-disposition-return.json"),r)});
    cycleCompleted(result);requireCycleOwnerControl(result,current);
    const after=await service.host.snapshot(),accepted=after.acceptances.consumer;
    need(accepted.enrollment==="CONTINUATION_OR_REPAIR_DUE"&&accepted.disposition?.action==="REPAIR"&&
      hash(accepted.review)===hash(row.review)&&hash(accepted.findings)===hash(row.findings)&&
      (await(await openReviewSources(f.registryFile)).snapshot()).digest===sources.digest,"OWNER_RETURN_NOT_APPLIED");
    await requireCycleRetainedBytes(f,accepted);status="COMPLETE_REVIEW_WITH_OWNED_RESIDUAL_REPAIR";
  }catch(e){failure=e.message;if(runs.length===26)runs.push({name:"disposition-return",status:"UNKNOWN",reason:failure,usage:null});}
  const result={status,failure,runtime:f.runtime.digest,runs,state:await service.host.snapshot(),retainedNext:"NOT_AUTHORIZED_BLOCKERS_REMAIN",
    originalFailurePreserved:true,reviewsRepeated:0,productReplayed:false,release:"NO_RELEASE"};
  await save(path.join(output,"owner-return-result.json"),result);
  return {status,failure,attempts:runs.length,reviewRepeated:0,release:"NO_RELEASE"};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await completeRepairOwner(process.argv[2])));
