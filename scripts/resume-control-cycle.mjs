// Maintainer experiment recovery only. Does not erase the failed native attempt.
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {loadControlRuntime} from "./control-runtime.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {cycleReviewRun,cycleCompleted,requireCycleRetainedBytes} from "./qualify-control-cycle.mjs";
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
export async function recoverEpisodeReport(output) {
  const read=async name=>JSON.parse(await readFile(path.join(output,name)));
  const freeze=await read("freeze.json"),post=await read("post-accept.json"),owner=await read("trace-disposition.json");
  need(freeze.continuation?.schema==="qualification.retained-post-episodes.v1"&&freeze.continuation.resume,
    "EPISODE_REPORT_SCOPE_INVALID");
  const runtime=await loadControlRuntime({packageRoot:freeze.runtime.root,expectedDigest:freeze.runtime.digest,workspace:freeze.workspace});
  const storeModule=await import(pathToFileURL(path.join(freeze.runtime.root,"scripts/control-store.mjs")));
  const journal=await(await storeModule.openControlStore(freeze.episodeProfile.review.directory)).read();
  const service=await runtime.service.openControlService(freeze.episodeProfile),state=await service.host.snapshot(),accepted=state.acceptances.consumer;
  need(journal.digest===post.journal.digest&&hash(journal.state)===hash(post.journal.state)&&
    accepted.review?.rows.length===87&&accepted.disposition?.action==="REPAIR"&&
    accepted.enrollment==="CONTINUATION_OR_REPAIR_DUE","EPISODE_REPORT_NOT_OBSERVED_REPAIR");
  await requireCycleRetainedBytes(freeze,accepted);cycleCompleted(owner);
  const events=owner.output.split("\n").filter(Boolean).map(JSON.parse);
  const calls=events.filter(e=>e.type==="item.completed"&&e.item?.server==="vydykhai_owner"&&
    e.item.status==="completed"&&!e.item.error&&!e.item.result?.isError);
  const value=e=>JSON.parse(e.item.result.content[0].text);
  const verdict=calls.find(e=>e.item.tool==="read_verdict"),control=calls.find(e=>e.item.tool==="read_control"),respond=calls.find(e=>e.item.tool==="respond");
  need(verdict&&control&&respond&&events.indexOf(verdict)<events.indexOf(respond)&&events.indexOf(control)<events.indexOf(respond)&&
    value(verdict).runId===accepted.review.runId&&value(verdict).reviewKey===accepted.disposition.reviewKey&&
    value(control).rows[0].currentControl.enrollment==="OWNER_DISPOSITION_DUE"&&
    value(control).rows[0].findings.length===accepted.findings.length&&respond.item.arguments.decision.action==="REPAIR"&&
    value(respond).action==="REPAIR_REQUIRED","EPISODE_REPORT_OWNER_NOT_APPLIED");
  const runs=[...freeze.continuation.priorRuns],previousCount=freeze.continuation.priorRuns.length-7;
  for(let n=previousCount+1;n<=8;n++) {
    const checkpoint=await read(`post-episode-${n}.json`),row=checkpoint.state.acceptances.consumer,
      runId=row.reviewLease?.runId??row.review?.runId,run=checkpoint.journal.state.runs[runId];
    need(run,"EPISODE_REPORT_CHECKPOINT_RUN_MISSING");
    for(const part of run.parts)need(sha256(await readFile(path.join(part.journal,part.observation.trace.file)))===
      part.observation.trace.sha256,"EPISODE_REPORT_TRACE_CHANGED");
    const started=Date.parse(run.startedAt),finished=Date.parse(run.finishedAt);
    runs.push(cycleReviewRun(run,{seconds:(finished-started)/1000,episode:true}));
  }
  const usage=events.find(e=>e.type==="turn.completed")?.usage??null;
  runs.push({name:"disposition",status:owner.status,reason:owner.reason??null,usage,
    seconds:(owner.timing?.elapsedMs??0)/1000});
  need(runs.length===16&&journal.state.calls===8,"EPISODE_REPORT_CALL_ACCOUNTING_CHANGED");
  const report={schema:"qualification.episode-report-recovery.v1",status:"OBSERVED_COMPLETE_REVIEW_AND_OWNED_REPAIR",
    originalFailure:"Report publication threw Canonical JSON accepts only JSON values: final parent lacked completedParts",
    runtime:freeze.runtime.digest,producerRuntime:freeze.continuation.producerRuntime.digest,runs,state,
    postSha256:sha256(await readFile(path.join(output,"post-accept.json"))),ownerTraceSha256:sha256(await readFile(path.join(output,"trace-disposition.json"))),
    criteria:87,blockingFindings:accepted.findings.filter(f=>f.status==="OPEN"&&f.blocksResume).length,
    modelsLaunchedByRecovery:0,acceptedProductReplayed:false,retainedNext:"NOT_RUN",cleanCycle:"NOT_PROVEN",
    usageLimit:"Original incomplete attempts remain UNKNOWN, not zero",release:"NO_RELEASE"};
  await writeFile(path.join(output,"result-recovery.json"),canonicalJson(report)+"\n",{mode:0o600,flag:"wx"});
  return {status:report.status,criteria:87,blockingFindings:report.blockingFindings,attempts:runs.length,modelsLaunched:0,release:"NO_RELEASE"};
}
export async function resumeCycle(output,{decisionEvidence}) {
  need(typeof decisionEvidence==="string"&&decisionEvidence.trim(),"INDEPENDENT_DECISION_REQUIRED");
  const read=async name=>JSON.parse(await readFile(path.join(output,name),"utf8"));
  const freeze=await read("freeze.json"),original=await read("result.json");
  need(original.status==="QUALIFICATION_FAILED"&&original.checks.failure==="WORKER_ACTION_NOT_COMPLETED"&&
    original.runtime===freeze.runtime.digest,"ORIGINAL_SCOPE_MISMATCH");
  const trace=await read("trace-continue.json");
  const events=trace.output.trim().split("\n").map(l=>JSON.parse(l));
  need(trace.state==="CLOSED"&&trace.status==="CLI_EXIT_OK"&&
    !events.some(e=>e.item?.type==="mcp_tool_call"),"PRIOR_ATTEMPT_NOT_PROVEN_UNDISPATCHED");
  const runtime=await loadControlRuntime({packageRoot:freeze.runtime.root,expectedDigest:freeze.runtime.digest,workspace:freeze.workspace});
  const api=await import(pathToFileURL(path.join(freeze.runtime.root,"scripts/vydykhai.mjs")));
  const endpointModule=await import(pathToFileURL(path.join(freeze.runtime.root,"scripts/control-endpoint.mjs")));
  const ctx=await import(pathToFileURL(path.join(freeze.runtime.root,"scripts/context-run.mjs")));
  const file=path.join(freeze.root,"next-worker.json"),profile=JSON.parse(await readFile(file,"utf8"));
  need(hash(profile.config)===hash(freeze.config)&&profile.requests?.length===1&&profile.requests[0].id==="continue","REGISTERED_ROUTE_CHANGED");
  const host=await runtime.host.openControlHost(profile.directory,profile.config,api),before=await host.snapshot();
  need(hash(before)===hash(original.state)&&!before.paused,"RETAINED_STATE_CHANGED");
  const row=before.acceptances.consumer;
  need(row.disposition?.action==="CONTINUE"&&!row.findings.some(f=>f.status==="OPEN"&&f.blocksResume),"CONTINUATION_NOT_OWNED");
  const grants=Object.values(before.grants).filter(g=>g.dependencies.includes("consumer"));
  need(grants.length===1&&!before.reservations[grants[0].id],"CONTINUATION_ALREADY_RESERVED_OR_AMBIGUOUS");
  const grant=grants[0],request=profile.requests[0].request;
  const prepared=await ctx.runContextTransition({...request,operation:"preflight"},api);
  need(prepared.status==="READY"&&grant.binding.taskSha256===request.task.sha256&&
    grant.binding.capsuleSha256===request.capsule.sha256&&grant.binding.sourceDigest===prepared.coverageBasis.sourceDigest&&
    grant.binding.dependencyDigest===prepared.coverageBasis.dependencyDigest,"CURRENT_INPUTS_NOT_CONFIRMED");
  const artifact=path.join(freeze.workspace,row.acceptance.artifact.path),beforeArtifact=await readFile(artifact);
  need(sha256(beforeArtifact)===row.acceptance.artifact.sha256,"ACCEPTED_ARTIFACT_CHANGED");
  await writeFile(path.join(output,"continuation-recovery-allocation.json"),canonicalJson({
    scope:"one unused registered action through existing protected adapter",decisionEvidence,mode:"DETERMINISTIC_NO_MODEL",
    originalResultHash:hash(original),stateHash:hash(before),grant:grant.id,runtime:freeze.runtime.digest,
    paidCalls:0,automaticRetry:false})+"\n",{mode:0o600,flag:"wx"});
  // Renew only the same unused, freshly rechecked action. Never reset a reservation.
  if(grant.expiresAt<=Date.now())await host.approveCommand(grant.binding,{reviewer:profile.config.reviewer,
    reviewReceipt:`independent-recovery:${decisionEvidence}`,dependencies:grant.dependencies,expiresAt:Date.now()+60000});
  const started=Date.now();let status="RECOVERY_FAILED",result=null,error=null;
  try {
    const endpoint=await endpointModule.openWorkerEndpoint(file,api);
    result=await endpoint.execute({requestId:"continue"});need(result.status==="ACTION_COMPLETED","RECOVERY_ACTION_NOT_COMPLETED");
    const actual=JSON.parse(await readFile(path.join(freeze.workspace,"continued.json"),"utf8"));
    need(hash(actual)===hash({used:["AA","b"]}),"CONTINUATION_OUTPUT_WRONG");
    need(sha256(await readFile(artifact))===sha256(beforeArtifact),"ACCEPTED_ARTIFACT_CHANGED");
    need((await host.assess("consumer")).action==="CONTROL_CONFIRMED","CONTROL_NOT_CONFIRMED");
    await host.close("consumer");
    try{await host.control.authorize(grant.binding);throw Error("REPLAY_ALLOWED");}
    catch(e){need(e.message==="COMMAND_NOT_APPROVED","REPLAY_NOT_REFUSED");}
    status="SCOPED_CYCLE_CLOSED_AFTER_DETERMINISTIC_RECOVERY";
  }catch(e){error=e.message;}
  const receipt={status,error,result,seconds:(Date.now()-started)/1000,state:await host.snapshot(),paidCalls:0,
    originalNativeContinuation:"FAILED_NO_TOOL_CALL",originalResultPreserved:hash(await read("result.json"))===hash(original),
    cleanNativeCycle:"NOT_PROVEN",productionAdoption:"NOT_PROVEN",release:"NO_RELEASE"};
  await writeFile(path.join(output,"continuation-recovery-result.json"),canonicalJson(receipt)+"\n",{mode:0o600,flag:"wx"});
  return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(process.argv[2]==="report-episodes"?await recoverEpisodeReport(process.argv[3]):
    await resumeCycle(process.argv[2],{decisionEvidence:process.argv[3]})));
