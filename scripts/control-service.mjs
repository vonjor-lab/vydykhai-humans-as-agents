// Finite independent host service. Scheduling never replenishes the journal's
// model-call budget or retries an uncertain review. The owner consumes its inbox.
import {setTimeout as delay} from "node:timers/promises";
import {pathToFileURL} from "node:url";
import {openControlHost} from "./control-host.mjs";
import {openModelReview} from "./control-model-review.mjs";
import {ownerControl} from "./control-owner.mjs";
import {runControlTick} from "./control-loop.mjs";
import {readPrivateControlJson} from "./control-review-sources.mjs";
import {createReturnSync,parseDurableOutboxComment} from "./vydykhai.mjs";
import {openControlNotification} from "./control-notification.mjs";
import {openOwnerDelivery} from "./control-owner-delivery.mjs";
import {readControlAllowance} from "./control-allowance.mjs";
import {runRegisteredContinuations} from "./control-continuation.mjs";
import {canonicalJson} from "./memory-brief.mjs";
import {MAX_CONTROL_WORK_MS} from "./control-child.mjs";

export async function openControlService(profile, services = {}) {
  if(profile.config?.reviewPolicy && (profile.review?.episodeGroups || (profile.review?.partitionCount??1)!==1))
    throw Error('CONTROL_PHASE_PARTITION_UNSUPPORTED');
  if(!services || typeof services !== "object" || Array.isArray(services) ||
    Object.keys(services).some(key=>key!=="observeCommandFailure") ||
    (services.observeCommandFailure!==undefined && typeof services.observeCommandFailure!=="function"))
    throw Error("CONTROL_SERVICE_COMMAND_OBSERVER_INVALID");
  const {observeCommandFailure}=services;
  if(profile?.schema!=="control.service.v1" || profile.review?.reviewer!==profile.config?.reviewer ||
    !Number.isSafeInteger(profile.review?.native?.timeoutMs) || !Number.isSafeInteger(profile.timeoutMs) ||
    profile.review.native.timeoutMs*(profile.review.episodeGroups?1:(profile.review.partitionCount??1))+1000>profile.timeoutMs || profile.timeoutMs>MAX_CONTROL_WORK_MS ||
    !Number.isSafeInteger(profile.maxReviewsPerTick) || profile.maxReviewsPerTick<0 || profile.maxReviewsPerTick>4)
    throw Error("CONTROL_SERVICE_CONFIG_INVALID");
  if(profile.config.evidenceRegistry!==undefined&&profile.config.evidenceRegistry!==profile.review.sourceFile)
    throw Error("CONTROL_SERVICE_SOURCE_REGISTRY_MISMATCH");
  if(profile.continuation&&(profile.continuation.mode!=="REGISTERED_PREAPPROVED_ONLY"||
    !Number.isSafeInteger(profile.continuation.maxActions)||profile.continuation.maxActions<1||profile.continuation.maxActions>4))
    throw Error("CONTROL_SERVICE_CONTINUATION_INVALID");
  if(profile.allowance && (profile.config.health?.cadence?.mode!=="OBSERVED_RESET" ||
    !Number.isSafeInteger(profile.allowance.refreshMs) || profile.allowance.refreshMs<60000 ||
    profile.allowance.refreshMs>86400000 || profile.allowance.refreshMs>profile.config.health.cadence.maxObservationAgeMs))
    throw Error("CONTROL_SERVICE_ALLOWANCE_CONFIG_INVALID");
  let reviewOptions=profile.review;
  if(profile.config.evidenceRegistry) {
    const hostBinding={directory:profile.directory,config:profile.config};
    if(profile.review.scope?.host !== undefined &&
      canonicalJson(profile.review.scope.host) !== canonicalJson(hostBinding))
      throw Error("CONTROL_SERVICE_REVIEW_HOST_MISMATCH");
    reviewOptions={...profile.review,scope:{...profile.review.scope,host:hostBinding}};
  }
  const review=await openModelReview(reviewOptions);
  const host=await openControlHost(profile.directory,profile.config,{createReturnSync,observeReviewRun:review.observe,observeCommandFailure});
  const owner=ownerControl(host,profile.config.owner);
  const notifications=profile.notifications?await openControlNotification({...profile.notifications,owner:profile.config.owner}):null;
  const ownerDelivery=profile.ownerDelivery?await openOwnerDelivery({...profile.ownerDelivery,
    endpoint:{schema:"control.owner-endpoint.v1",capability:"CONTROL_DISPOSITION_ONLY",directory:profile.directory,config:profile.config,notifications:profile.notifications}},
    {host,notifications,observeControl:id=>waitControlEvent({host},{id,waitMs:0})}):null;
  return {host,review,owner,ownerDelivery,sourceCoverage:profile.config.evidenceRegistry?"REGISTRY_AND_RETENTION":"RETENTION_ONLY_QUALIFICATION",
    async continueRegistered() {
      return profile.continuation?runRegisteredContinuations(profile.continuation,{host,workspace:profile.config.workspace,
        controlRoot:profile.review.controlRoot,services:{createReturnSync,parseDurableOutboxComment}}):null;
    },
    async tick() {
      let allowance=null;
      if(profile.allowance) {
        const state=await host.snapshot(),observedAt=state.health.resetObservation?.observedAt;
        if(state.paused || state.health.reviewLease)allowance={status:"DEFERRED",reason:"PAUSED_OR_REVIEW_IN_FLIGHT"};
        else if(observedAt!==undefined && Date.now()-observedAt<profile.allowance.refreshMs)
          allowance={status:"RETAINED",observedAt};
        else {
          const read=await readControlAllowance(profile.allowance);
          allowance={status:read.status,reason:read.reason??null,observation:read.observation};
          if(read.status==="OBSERVED") {
            try{await host.health.recordResetObservation({observer:profile.config.health.cadence.observer,observation:read.observation});}
            catch{allowance={status:"UNKNOWN",reason:"RESET_APPLICATION_REFUSED"};}
          }
        }
      }
      const budget=await review.capacity();
      const result=await runControlTick(host,{review:review.review,episode:review.episodeSpec,
        maxReviews:Math.min(profile.maxReviewsPerTick,budget.remainingReviews??budget.remaining),timeoutMs:profile.timeoutMs});
      return {...result,...(allowance?{allowance}:{}),inbox:await owner.inbox()};
    }
  };
}
export async function runControlService(service,{ticks=1,intervalMs=60000,signal}={}) {
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>100||!Number.isSafeInteger(intervalMs)||intervalMs<1||intervalMs>3600000)
    throw Error("CONTROL_SERVICE_SCHEDULE_INVALID");
  const results=[];
  for(let i=0;i<ticks&&!signal?.aborted;i++) {
    results.push(await service.tick());
    if(i+1<ticks) {try{await delay(intervalMs,undefined,{signal});}catch(e){if(e.name!=="AbortError")throw e;break;}}
  }
  return results;
}
// Passive observation only. Waiting neither runs a tick nor cancels/redispatches
// work. The caller's transport timeout must exceed this explicitly chosen wait.
export async function waitControlEvent(service,{id="@health",waitMs=60000,signal}={}) {
  if(typeof id!=="string"||!id||!Number.isSafeInteger(waitMs)||waitMs<0||waitMs>86400000)
    throw Error("CONTROL_EVENT_WAIT_INVALID");
  const until=Date.now()+waitMs;
  let previous=null,view=null;
  for(;;) {
    const state=await service.host.snapshot(),row=id==="@health"?state.health:state.acceptances[id];
    if(!row)throw Error("CONTROL_EVENT_TARGET_MISSING");
    const signature=canonicalJson({paused:state.paused,row});
    if(signature!==previous) {
      previous=signature;
      view={id,enrollment:row.enrollment,resultUse:row.review?.resultUse?.status??null,
        disposition:row.disposition?.action??null,findings:row.findings.filter(f=>f.status==="OPEN")};
      if(state.paused)return {status:"PAUSED",...view};
      if(["REPAIR_DUE","REVIEW_RECONCILIATION_REQUIRED","REPAIR_REVIEW_DUE"].includes(row.enrollment)||
        row.enrollment==="OWNER_DISPOSITION_DUE"&&(view.findings.length||["REJECT","UNKNOWN"].includes(view.resultUse)))
        return {status:"OWNER_ATTENTION_REQUIRED",...view};
      if(id==="@health"&&row.enrollment==="SETTLED"&&row.disposition?.action==="CONTINUE")
        return {status:"APPLIED",...view};
      if(id!=="@health"&&row.disposition&&["CONTINUATION_OR_REPAIR_DUE","FINAL_READBACK_DUE","CLOSED"].includes(row.enrollment)) {
        const assessment=await service.host.assess(id);
        return {status:["VERIFY_CONTINUATION","CONTROL_CONFIRMED","CONTROL_DONE_CONFIRMED","CONTROL_WAIT_CONFIRMED"].includes(assessment.action)?"APPLIED":"OWNER_ATTENTION_REQUIRED",...view,assessment};
      }
    }
    if(signal?.aborted||Date.now()>=until)return {status:"PENDING",reason:signal?.aborted?"WAIT_CANCELLED":"WAIT_TIMEOUT",...view,executionInterrupted:false};
    try{await delay(Math.min(250,until-Date.now()),undefined,{signal});}catch(e){if(e.name!=="AbortError")throw e;}
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const profile=await readPrivateControlJson(process.argv[2]);
  const service=await openControlService(profile);
  const results=await runControlService(service,{ticks:profile.ticks??1,intervalMs:profile.intervalMs??60000});
  process.stdout.write(JSON.stringify({status:"CONTROL_SERVICE_CHECKPOINT",results})+"\n");
}
