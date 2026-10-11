// Reuse one completed, independently judged response; no refund or inference replay.
import {readFile,writeFile,mkdir,realpath,readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {loadControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {cycleCompleted,cycleAnswer,requireCycleRetainedBytes} from "./qualify-control-cycle.mjs";
import {validateRepairAllocation,gradeRecoveredReadback,validReadbackSemanticDecision} from "./run-repair-control-cycle.mjs";
const hash=v=>sha256(canonicalJson(v)),need=(v,c)=>{if(!v)throw Error(c);};
export async function stageReadbackRecovery({previous,output}) {
  need([previous,output].every(p=>typeof p==="string"&&path.isAbsolute(p)),"REPAIR_RECOVERY_PATH_REQUIRED");
  const read=async name=>JSON.parse(await readFile(path.join(previous,name)));
  const old=await read("freeze.json"),failed=await read("result.json"),decision=await read("readback-semantic-decision.json");
  const trace=await readFile(path.join(previous,"trace-current-readback.json")),observed=JSON.parse(trace);
  validateRepairAllocation(old);cycleCompleted(observed);
  need(!old.recovery&&failed.status==="REPAIR_QUALIFICATION_FAILED"&&failed.failure==="REPAIR_CURRENT_READBACK_WRONG"&&
    failed.runs.length===17&&hash(failed.runs.slice(0,16))===hash(old.priorRuns)&&
    failed.runs.at(-1).name==="current-readback"&&failed.runs.at(-1).status==="PREPARATION_STATUS_VERIFIED"&&
    !gradeRecoveredReadback(cycleAnswer(observed)).length,"REPAIR_RECOVERY_PRIOR_INVALID");
  need(validReadbackSemanticDecision(decision)&&decision.traceSha256===sha256(trace)&&
    decision.freezeSha256===sha256(await readFile(path.join(previous,"freeze.json")))&&
    decision.failedResultSha256===sha256(await readFile(path.join(previous,"result.json"))),"REPAIR_SEMANTIC_DECISION_REQUIRED");
  const runtime=await loadControlRuntime({packageRoot:old.runtime.root,expectedDigest:old.runtime.digest,workspace:old.workspace});
  const host=await runtime.host.openControlHost(old.profile.directory,old.profile.config,{}),state=await host.snapshot();
  need(hash(state)===old.stateHash&&hash(state)===hash(failed.state)&&!state.paused,"REPAIR_RECOVERY_STATE_CHANGED");
  await requireCycleRetainedBytes(old,state.acceptances.consumer);
  need((await(await openReviewSources(old.registryFile)).snapshot()).digest===old.sources.digest,"REPAIR_RECOVERY_SOURCE_CHANGED");
  need(!(await readdir(old.profile.review.directory)).some(file=>/^\d{10}\.json$/.test(file)),"REPAIR_REVIEW_ALREADY_STARTED");
  const parent=await realpath(path.dirname(output));need(path.join(parent,path.basename(output))===output&&
    [old.workspace,old.root,previous].every(root=>output!==root&&!output.startsWith(root+path.sep)&&!root.startsWith(output+path.sep)),"REPAIR_RECOVERY_OUTPUT_UNSAFE");
  await mkdir(output,{mode:0o700});
  const f={...old,out:output,priorRuns:failed.runs,allocation:{...old.allocation,maxNewCalls:10,priorAttempts:17,
    calls:{...old.allocation.calls,currentReadback:0}},recovery:{previous,decisionFile:path.join(previous,"readback-semantic-decision.json"),
      freezeSha256:hash(old),resultSha256:hash(failed),traceSha256:sha256(trace),decisionSha256:hash(decision)},qualifierFiles:{}};
  for(const file of ["repair-control-cycle.mjs","run-repair-control-cycle.mjs","repair-cycle-publication.mjs","qualify-control-cycle.mjs"])
    f.qualifierFiles[file]=sha256(await readFile(new URL(file,import.meta.url)));
  f.scriptSha256=f.qualifierFiles["repair-control-cycle.mjs"];f.runnerSha256=f.qualifierFiles["run-repair-control-cycle.mjs"];
  validateRepairAllocation(f);
  await writeFile(path.join(output,"freeze.json"),canonicalJson(f)+"\n",{mode:0o600,flag:"wx"});
  return {output,priorAttempts:17,remainingCalls:10,newModels:0,originalFailurePreserved:true,runtime:f.runtime.digest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await stageReadbackRecovery({previous:process.argv[2],output:process.argv[3]})));
