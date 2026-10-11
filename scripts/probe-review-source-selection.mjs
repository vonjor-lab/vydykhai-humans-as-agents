// One fresh source-selection diagnostic; partial judgments cannot enter the host.
import {readFile,writeFile,mkdir,realpath} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {inspectControlRuntime,stageControlRuntime,loadControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {cycleAnswer,cycleAcquired,requireCycleReads,requireCycleRetainedBytes} from "./qualify-control-cycle.mjs";
import {validateRepairAllocation} from "./run-repair-control-cycle.mjs";
const hash=v=>sha256(canonicalJson(v)),need=(v,c)=>{if(!v)throw Error(c);};
const json=async p=>JSON.parse(await readFile(p));
const save=(p,v)=>writeFile(p,canonicalJson(v)+"\n",{mode:0o600,flag:"wx"});
export async function probeSourceSelection({previous,output}) {
  need([previous,output].every(p=>typeof p==="string"&&path.isAbsolute(p)),"PROBE_EXPLICIT_PATHS_REQUIRED");
  const f=await json(path.join(previous,"freeze.json")),prior=await json(path.join(previous,"owner-return-result.json"));
  validateRepairAllocation(f);
  need(prior.status==="COMPLETE_REVIEW_WITH_OWNED_RESIDUAL_REPAIR"&&prior.runs.length===27,"PROBE_PRIOR_SCOPE_INVALID");
  const old=await loadControlRuntime({packageRoot:f.runtime.root,expectedDigest:f.runtime.digest,workspace:f.workspace}),
    host=await old.host.openControlHost(f.profile.directory,f.profile.config,{}),state=await host.snapshot();
  need(hash(state)===hash(prior.state)&&!state.paused&&!state.acceptances.consumer.reviewLease,"PROBE_STATE_CHANGED");
  await requireCycleRetainedBytes(f,state.acceptances.consumer);
  const source=await openReviewSources(f.registryFile),snapshot=await source.snapshot(),bound=await host.reviewInput("consumer"),input=bound.input;
  need(input.sourceEvidence?.scope===undefined&&input.sourceEvidence?.digest===snapshot.digest,"PROBE_NOT_UNSCOPED");
  const parent=await realpath(path.dirname(output)),candidate=path.join(parent,path.basename(output));
  need(parent===path.dirname(output)&&![f.workspace,f.root,previous].some(p=>candidate===p||candidate.startsWith(p+path.sep)),"PROBE_OUTPUT_UNSAFE");
  await mkdir(output,{mode:0o700});const out=await realpath(output);
  need(!out.startsWith(f.workspace+path.sep)&&!out.startsWith(f.root+path.sep),"PROBE_OUTPUT_UNSAFE");
  const sourceRoot=fileURLToPath(new URL("..",import.meta.url)),identity=await inspectControlRuntime(sourceRoot);
  await mkdir(path.join(out,"packages"),{mode:0o700});
  const installed=await stageControlRuntime({sourceRoot,directory:path.join(out,"packages"),workspace:f.workspace,expectedDigest:identity.digest});
  const runtime=await loadControlRuntime({packageRoot:installed.root,expectedDigest:installed.digest,workspace:f.workspace}),
    {modelReviewPrompt}=await import(pathToFileURL(path.join(installed.root,"scripts/control-model-review.mjs")));
  const scope=f.profile.review.scope,offer={phase:"POST_ACCEPT",runId:"source-selection-diagnostic-no-admission",key:bound.key,input};
  const prompt=modelReviewPrompt(offer,scope,["C15.04","C12.01"]);
  await save(path.join(out,"allocation.json"),{scope:"Two-criterion source-selection diagnostic only; no host admission, closure or owner action",
    priorAttempts:27,maxCalls:1,retries:0,model:"gpt-6.1-sol",effort:"low",timeoutMs:120000,
    runtime:installed.digest,sourceDigest:snapshot.digest,stateHash:hash(state),promptSha256:sha256(prompt),scriptSha256:sha256(await readFile(fileURLToPath(import.meta.url)))});
  const runs=[...prior.runs];let status="PROBE_FAILED",failure=null,answer=null,acquired=[];
  try {
    const started=Date.now(),result=await runtime.worker.runControlledWorker({...f.profile.review.native,role:"review",prompt,endpointFile:f.registryFile});
    let usage=null;try{usage=result.output.split("\n").filter(Boolean).map(JSON.parse).find(e=>e.type==="turn.completed")?.usage??null;}catch{}
    runs.push({name:"source-selection-probe",status:result.status,reason:result.reason??null,seconds:(Date.now()-started)/1000,usage});
    await save(path.join(out,"trace.json"),result);answer=cycleAnswer(result);acquired=cycleAcquired(result).map(({text,...r})=>r);
    requireCycleReads(result,scope.requiredSourceIds,snapshot);
    need(acquired.some(r=>r.id==="repair-owner-map")&&acquired.some(r=>r.id.startsWith("repair-inventory-")),"PROBE_RELEVANT_ADDITIONS_NOT_ACQUIRED");
    need(hash(await host.snapshot())===hash(state)&&(await source.snapshot()).digest===snapshot.digest,"PROBE_MUTATED_OR_DRIFTED");
    await requireCycleRetainedBytes(f,state.acceptances.consumer);status="SOURCE_SELECTION_OBSERVED_NO_ADMISSION";
  }catch(e){failure=e.message;if(runs.length===27)runs.push({name:"source-selection-probe",status:"UNKNOWN",reason:failure,usage:null});}
  const report={status,failure,runtime:installed.digest,answer,acquired,runs,stateUnchanged:hash(await host.snapshot())===hash(state),
    controlAdmission:"NOT_ATTEMPTED_PARTIAL_VERDICT",findingsClosed:0,productReplayed:false,release:"NO_RELEASE"};
  await save(path.join(out,"result.json"),report);return {status,failure,attempts:runs.length,runtime:installed.digest,release:"NO_RELEASE"};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await probeSourceSelection({previous:process.argv[2],output:process.argv[3]})));
