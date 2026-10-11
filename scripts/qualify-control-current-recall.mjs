// A new, separately allocated read-only qualification after the stale-state
// finding. Never rewrites or retries the original cycle/recall allocation.
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {inspectControlRuntime,stageControlRuntime,loadControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {cycleAnswer,requireCycleReads,gradeCycleMeaning} from "./qualify-control-cycle.mjs";
const need=(v,c)=>{if(!v)throw Error(c);};
const hash=v=>sha256(canonicalJson(v));
export function gradeCurrentRecall(answer,projection){
  const row=projection.rows[0],errors=gradeCycleMeaning({...answer?.recipe,
    rejected:answer?.rejectedApproachIds,idea:answer?.deferredRecall});
  const expected={historicalAcceptance:row.historicalAcceptance.status,productAcceptance:row.currentControl.productAcceptance,
    controlEnrollment:row.currentControl.enrollment,
    assessedAction:row.currentControl.assessedAction,paused:projection.paused,
    retentionComplete:row.retention.complete,openFindingIds:row.findings.map(f=>f.id).sort(),executionAuthorized:false};
  const current=answer?.current;
  if(!current||hash({...current,openFindingIds:[...(current.openFindingIds??[])].sort()})!==hash(expected))errors.push("current");
  return errors;
}
export async function qualifyCurrentRecall(cycleRoot,output){
  const setup=JSON.parse(await readFile(path.join(cycleRoot,"freeze.json")));
  const original=await readFile(path.join(cycleRoot,"result.json")),prior=JSON.parse(original);
  need(prior.status==="SCOPED_CYCLE_CLOSED","PRIOR_SCOPED_CYCLE_REQUIRED");
  await mkdir(output,{mode:0o700});
  const save=(name,value)=>writeFile(path.join(output,name),canonicalJson(value)+"\n",{mode:0o600,flag:"wx"});
  const sourceRoot=fileURLToPath(new URL("..",import.meta.url)),{digest}=await inspectControlRuntime(sourceRoot);
  await mkdir(path.join(output,"packages"),{mode:0o700});
  const staged=await stageControlRuntime({sourceRoot,directory:path.join(output,"packages"),workspace:setup.workspace,expectedDigest:digest});
  const runtime=await loadControlRuntime({packageRoot:staged.root,expectedDigest:digest,workspace:setup.workspace});
  const host=await runtime.host.openControlHost(path.join(setup.root,"host"),setup.config,{});
  const beforeHost=await host.snapshot(),projection=await host.preparationStatus(["consumer"]);
  const artifact=prior.state.acceptances.consumer.acceptance.artifact;
  const artifactBefore=sha256(await readFile(path.join(setup.workspace,artifact.path)));
  need(artifactBefore===artifact.sha256,"ACCEPTED_ARTIFACT_CHANGED");
  const ids=["contract","retained-memory","retained-map","retained-tracker","retained-custody"];
  const file=path.join(output,"sources.json");
  await save("sources.json",{schema:"control.review-sources.v1",workspace:setup.workspace,
    sources:ids.map(id=>({id,path:`${id}.md`,purpose:id==="contract"?"Public module contract":"Immutable acceptance-time snapshot; obtain current control separately"}))});
  const sources=await openReviewSources(file),before=await sources.snapshot();
  for(const row of before.rows){
    const expected=row.id==="contract"?setup.frozenSources.rows.find(r=>r.id===row.id):
      prior.state.acceptances.consumer.acceptance.retention.find(r=>`retained-${r.id}`===row.id)?.expected;
    need(row.status==="AVAILABLE"&&row.sha256===expected?.sha256,"RETAINED_SOURCE_CHANGED");
  }
  const controlEndpointFile=path.join(output,"control.json");
  await save("control.json",{schema:"control.owner-endpoint.v1",capability:"CONTROL_READ_ONLY",acceptanceIds:["consumer"],
    directory:path.join(setup.root,"host"),config:setup.config});
  const prompt="Prepare an additional JSON consumer of the existing bundle module. Recover the correct public wiring, prior decisions, rejected approaches, success limits and pending user decisions. Retained documents are acceptance-time snapshots, not the current lifecycle state: acquire current status through the registered read-only control tool as well as original retained knowledge. No effects or execution are authorized. Return only JSON: {recipe:{entrypoint,revision,preprocess,format,producerEdits},rejectedApproachIds:[exact approach identifiers],deferredRecall:{id,disposition},current:{historicalAcceptance,productAcceptance,controlEnrollment,assessedAction,paused,retentionComplete,openFindingIds,executionAuthorized},context:{currentDecision,supersededDecision,successEvidence,rejectedReason,deferredRecall}}. In current, historicalAcceptance copies historicalAcceptance.status and productAcceptance copies currentControl.productAcceptance from the status projection; do not interchange them. Apply the observed current status, preserve historical meaning, and keep missing evidence explicit. This is preparation, not acceptance.";
  const native={binary:setup.binary,authHome:setup.authHome,workspace:path.join(output,"room"),home:path.join(output,"home"),
    role:"preparation",endpointFile:file,controlEndpointFile,model:"gpt-6.1-sol",effort:"low",timeoutMs:120000,prompt};
  await mkdir(native.workspace,{mode:0o700});await mkdir(native.home,{mode:0o700});
  await save("allocation.json",{runtime:staged,promptSha256:sha256(prompt),sources:before,projection,
    originalCycleResultSha256:sha256(original),hostStateSha256:hash(beforeHost),artifact:{path:artifact.path,sha256:artifactBefore},
    harnessSha256:sha256(await readFile(new URL(import.meta.url))),model:native.model,effort:native.effort,maxCalls:1,seconds:120,retries:0});
  await writeFile(path.join(output,"frozen-harness.mjs"),await readFile(new URL(import.meta.url)),{mode:0o600,flag:"wx"});
  const started=Date.now();let usage=null,answer=null,status="FAILED",failure=null;
  try{
    const run=await runtime.worker.runControlledWorker(native);await save("trace.json",run);
    try{usage=run.output.split("\n").filter(Boolean).map(s=>JSON.parse(s)).find(e=>e.type==="turn.completed")?.usage??null;}catch{}
    need(run.status==="PREPARATION_STATUS_VERIFIED"&&run.preparation?.status==="VERIFIED","CURRENT_PREPARATION_UNVERIFIED");
    answer=cycleAnswer(run);requireCycleReads(run,["contract","retained-memory","retained-map"],before);
    need((await sources.snapshot()).digest===before.digest,"RETAINED_SOURCES_CHANGED");
    await host.preparationStatus(["consumer"],{expectedDigest:projection.digest});
    need(gradeCurrentRecall(answer,projection).length===0,"CURRENT_RECALL_WIRE_MISMATCH");
    status="CURRENT_CONTEXT_WIRE_OBSERVED_SEMANTIC_REVIEW_REQUIRED";
  }catch(e){failure=e.message;}
  const preserved=hash(await host.snapshot())===hash(beforeHost)&&sha256(await readFile(path.join(cycleRoot,"result.json")))===sha256(original)&&
    sha256(await readFile(path.join(setup.workspace,artifact.path)))===artifactBefore;
  if(!preserved){status="FAILED";failure="ORIGINAL_STATE_CHANGED";}
  const result={status,failure,seconds:(Date.now()-started)/1000,usage,answer,preserved,runtime:digest,
    productExecution:"NOT_RUN",findingClosure:"NOT_CLAIMED",release:"NO_RELEASE"};
  await save("result.json",result);return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await qualifyCurrentRecall(process.argv[2],process.argv[3])));
