// Fixed independent parts share one immutable offer. Only their complete union
// can become a host verdict; a stopped part never grants partial acceptance.
import {mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {openControlStore} from './control-store.mjs';
import {openReviewSources} from './control-review-sources.mjs';
import {reviewPartitions,mergeReviewParts,validateReviewPart,validateReviewEpisode} from './control-review-partitions.mjs';
import {decodeReviewAnswer} from './control-review-wire.mjs';
import {validateControlFindings} from './control-findings.mjs';
import {canonicalJson,sha256} from './memory-brief.mjs';

const hash=value=>sha256(canonicalJson(value));
const need=(value,code)=>{if(!value)throw Error(code);};
export async function openPartitionModelReview(options,openSingle) {
  options=structuredClone(options);
  const {directory,controlRoot,sourceFile,reviewer,maxCalls,expiresAt,partitionCount}=options;
  const root=await realpath(controlRoot),dir=await realpath(directory);
  const episode=options.episodeGroups===undefined?null:validateReviewEpisode(options);
  const parts=episode?.partitions??reviewPartitions(partitionCount);
  need(dir.startsWith(root+path.sep)&&Number.isSafeInteger(maxCalls)&&maxCalls>=parts.length&&maxCalls<=20&&
    Number.isFinite(Date.parse(expiresAt)),'MODEL_REVIEW_PARTITION_CONFIG_INVALID');
  const initialSources=await openReviewSources(sourceFile);
  const hostBound=options.scope?.host!==undefined;
  need(!episode || (hostBound && (partitionCount===undefined || partitionCount===1)),
    'MODEL_REVIEW_EPISODE_HOST_REQUIRED');
  const planSha256=episode?hash(episode):null;
  const registryKey=hash({workspace:initialSources.workspace,registry:await initialSources.list()});
  const configKey=hash({options,parts,...(hostBound?{sourceWorkspace:initialSources.workspace}:{registryKey})});
  const store=await openControlStore(directory);
  const check=s=>need(s?.schema==='control.model-review.v1'&&s.configKey===configKey,'MODEL_REVIEW_CONFIG_MISMATCH');
  const currentSources=async()=>{
    const sources=await openReviewSources(sourceFile);
    need(sources.workspace===initialSources.workspace &&
      (hostBound || hash({workspace:sources.workspace,registry:await sources.list()})===registryKey),'MODEL_REVIEW_REGISTRY_CHANGED');
    return sources;
  };
  const validOffer=offer=>{
    need(/^[a-f0-9-]{36}$/.test(offer?.runId)&&/^[a-f0-9]{64}$/.test(offer?.key),'MODEL_REVIEW_OFFER_INVALID');
    need(!hostBound || offer.phase===undefined || ['POST_ACCEPT','HEALTH'].includes(offer.phase),'MODEL_REVIEW_HOST_PARTITION_PHASE_UNSUPPORTED');
    if(episode)need(offer.episode?.planSha256===planSha256 &&
      /^[a-f0-9-]{36}$/.test(offer.episode.id) &&
      offer.episode.basisSha256===hash({key:offer.key,input:offer.input}) &&
      Number.isFinite(Date.parse(offer.episode.startedAt)),'MODEL_REVIEW_EPISODE_OFFER_INVALID');
  };
  const prepareChild=async(offer,index)=>{
    const partDir=path.join(dir,`${offer.runId}-part-${index}`);
    await mkdir(partDir,{mode:0o700,recursive:true});
    need(await realpath(partDir)===partDir,'MODEL_REVIEW_PART_DIRECTORY_INVALID');
    const child=await openSingle({...options,directory:partDir,maxCalls:1,partitionCount:1},parts[index]);
    if(!(await (await openControlStore(partDir)).read())){
      try{await child.initialize();}
      catch(error){if(error.message!=='CONTROL_ALREADY_INITIALIZED')throw error;}
    }
    await child.capacity();
    return {child,index,partDir};
  };
  const snapshot=async(offer,prepared)=>{
    if(hostBound){
      need(typeof prepared.child.preflight==='function','MODEL_REVIEW_HOST_PREFLIGHT_REQUIRED');
      return prepared.child.preflight(structuredClone(offer));
    }
    return (await currentSources()).snapshot();
  };
  return {
    ...(episode?{episodeSpec:episode}:{}),
    async initialize(){await store.initialize({schema:'control.model-review.v1',configKey,calls:0,runs:{}});},
    async preflight(originalOffer){
      const offer=structuredClone(originalOffer);validOffer(offer);
      const row=await store.read();check(row?.state);
      try {
        const before=await snapshot(offer,await prepareChild(offer,0));
        need(offer.input?.sourceEvidence===undefined||hash(offer.input.sourceEvidence)===hash(before),'MODEL_REVIEW_OFFER_EVIDENCE_MISMATCH');
        return before;
      }catch(error) {
        if(episode && /SOURCE_DRIFT|REGISTRY_CHANGED|OFFER_EVIDENCE_MISMATCH/.test(error.message)) {
          await store.transact(s=>{
            check(s);
            const previous=s.runs[offer.episode.previousRunId];
            for(const run of Object.values(s.runs))if(run.episode?.id===offer.episode.id)run.invalidated=true;
            // No reservation/dispatch happened in preflight. Retain this known
            // refusal separately without changing native observations or spend.
            if(!Object.hasOwn(s.runs,offer.runId))s.runs[offer.runId]={runId:offer.runId,state:'STOPPED',
              episode:offer.episode,offerKey:offer.key,offerSha256:hash(offer),reason:error.message,
              invalidated:true,dispatched:false,reservedNativeCalls:0,actualDispatches:0,
              startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),
              parts:structuredClone(previous?.parts??[]),completedParts:previous?.parts?.length??0,
              sourceDigest:previous?.sourceDigest??null,spentTokens:previous?.spentTokens??0,
              usage:structuredClone(previous?.usage??null),usageUnknown:previous?.usageUnknown??false};
            return s;
          });
        }
        throw error;
      }
    },
    async capacity(){
      const row=await store.read();check(row?.state);
      const remainingNativeCalls=Date.now()<Date.parse(expiresAt)?Math.max(0,maxCalls-row.state.calls):0;
      return {remaining:remainingNativeCalls,remainingReviews:episode?remainingNativeCalls:Math.floor(remainingNativeCalls/parts.length),used:row.state.calls,
        remainingNativeCalls,callAccounting:'RESERVED_NATIVE_SLOTS_NO_REFUND',partsPerReview:parts.length};
    },
    async observe(runId){
      const row=await store.read();check(row?.state);const run=row.state.runs[runId];
      return run?.state==='STOPPED'?{...run,evidence:`partition-review:${row.digest}:${hash(run)}`}:{runId,state:'UNKNOWN'};
    },
    async review(originalOffer,{signal}={}) {
      const offer=structuredClone(originalOffer);
      validOffer(offer);
      let allocationError;
      await store.transact(s=>{
        check(s);need(!Object.hasOwn(s.runs,offer.runId),'MODEL_REVIEW_ALREADY_DISPATCHED');
        const previous=episode && offer.episode.previousRunId?s.runs[offer.episode.previousRunId]:null;
        if(episode && offer.episode.previousRunId) {
          need(previous?.state==='STOPPED' && !previous.verdict && !previous.invalidated && !previous.nextRunId &&
            previous.episode.id===offer.episode.id && previous.episode.planSha256===planSha256 &&
            previous.episode.basisSha256===offer.episode.basisSha256 &&
            previous.episode.startedAt===offer.episode.startedAt,'MODEL_REVIEW_EPISODE_PREVIOUS_INVALID');
          previous.nextRunId=offer.runId;
        }
        const slots=episode?1:parts.length;
        allocationError=s.calls+slots<=maxCalls&&Date.now()<Date.parse(expiresAt)?null:'MODEL_REVIEW_BUDGET_EXHAUSTED';
        if(allocationError){s.runs[offer.runId]={runId:offer.runId,state:'STOPPED',reason:allocationError,dispatched:false};return s;}
        s.calls+=slots;
        s.runs[offer.runId]={runId:offer.runId,state:'IN_FLIGHT',offerKey:offer.key,offerSha256:hash(offer),
          startedAt:new Date().toISOString(),reservedNativeCalls:slots,parts:structuredClone(previous?.parts??[]),actualDispatches:0,
          ...(episode?{episode:offer.episode,spentTokens:previous?.spentTokens??0,
            usage:structuredClone(previous?.usage??{input_tokens:0,output_tokens:0,cached_input_tokens:0,reasoning_output_tokens:0}),
            usageUnknown:previous?.usageUnknown??false,sourceDigest:previous?.sourceDigest??null}: {})};return s;
      });
      if(allocationError)throw Error(allocationError);
      let active=null,completed=0;
      const withinEnvelope=()=>{
        need(!signal?.aborted,'CANCELLED');
        need(Date.now()<Date.parse(expiresAt),'MODEL_REVIEW_BUDGET_EXHAUSTED');
        if(episode)need(Date.now()<Date.parse(offer.episode.startedAt)+episode.maxDurationMs,
          'MODEL_REVIEW_EPISODE_EXPIRED');
      };
      const usageEnvelope=(run,dispatch=false)=>{if(episode){need(!run.usageUnknown,'MODEL_REVIEW_EPISODE_USAGE_UNKNOWN');
        need(dispatch?run.spentTokens<episode.maxUsageTokens:run.spentTokens<=episode.maxUsageTokens,
          'MODEL_REVIEW_EPISODE_USAGE_EXHAUSTED');}};
      const saveUsage=(run,observed)=>{
        if(!episode)return;
        const u=observed?.usage;
        if(observed?.dispatched===false)return;
        if(!u || !['input_tokens','output_tokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0)) {
          run.usageUnknown=true;run.usage=null;
        }
        else {run.spentTokens+=u.input_tokens+u.output_tokens;
          if(!Number.isSafeInteger(run.spentTokens))run.usageUnknown=true;
          if(!run.usageUnknown)for(const k of Object.keys(run.usage))run.usage[k]=
            Number.isSafeInteger(run.usage[k]) && Number.isSafeInteger(u[k]) && u[k]>=0?run.usage[k]+u[k]:null;
        }
      };
      try {
        withinEnvelope();
        const retained=(await store.read()).state.runs[offer.runId];
        need(!episode || !retained.invalidated,'MODEL_REVIEW_EPISODE_INVALIDATED');
        completed=retained.parts.length;usageEnvelope(retained,true);
        const first=await prepareChild(offer,0);
        const before=await snapshot(offer,first);
        need(!episode || !retained.sourceDigest || retained.sourceDigest===before.digest,'MODEL_REVIEW_SOURCE_DRIFT');
        need(offer.input?.sourceEvidence===undefined||hash(offer.input.sourceEvidence)===hash(before),'MODEL_REVIEW_OFFER_EVIDENCE_MISMATCH');
        await store.transact(s=>{check(s);s.runs[offer.runId].sourceDigest=before.digest;return s;});
        const stop=episode?Math.min(parts.length,completed+1):parts.length;
        for(let index=completed;index<stop;index++){
          withinEnvelope();
          const prepared=index===0?first:await prepareChild(offer,index);
          need((await snapshot(offer,prepared)).digest===before.digest,'MODEL_REVIEW_SOURCE_DRIFT');
          const {child,partDir}=prepared;
          await store.transact(s=>{check(s);need(!episode || !s.runs[offer.runId].invalidated,'MODEL_REVIEW_EPISODE_INVALIDATED');
            s.runs[offer.runId].actualDispatches++;return s;});
          withinEnvelope();
          active=prepared;
          await child.review(structuredClone(offer),{signal});
          const observed=await child.observe(offer.runId);
          need(observed.state==='STOPPED'&&observed.wireAnswer&&observed.verdict,'MODEL_REVIEW_PART_INCOMPLETE');
          if(episode) {
            need(observed.runId===offer.runId && observed.verdict.key===offer.key && observed.verdict.reviewer===reviewer &&
              /^[a-f0-9]{64}$/.test(observed.trace?.sha256),'MODEL_REVIEW_PART_ASSOCIATION_INVALID');
            validateReviewPart(observed.wireAnswer,parts[index],{readbacks:observed.readSources,offer,reviewer,observedAt:observed.finishedAt});
          }
          await store.transact(s=>{check(s);s.runs[offer.runId].parts.push({index,ids:parts[index],
            journal:partDir,observation:observed});saveUsage(s.runs[offer.runId],observed);return s;});
          completed++;active=null;
        }
        withinEnvelope();
        need((await snapshot(offer,first)).digest===before.digest,'MODEL_REVIEW_SOURCE_DRIFT');
        const current=(await store.read()).state.runs[offer.runId];
        need(!episode || !current.invalidated,'MODEL_REVIEW_EPISODE_INVALIDATED');
        usageEnvelope(current);
        if(episode && completed<parts.length) {
          await store.transact(s=>{check(s);withinEnvelope();need(!s.runs[offer.runId].invalidated,'MODEL_REVIEW_EPISODE_INVALIDATED');
            Object.assign(s.runs[offer.runId],{
            state:'STOPPED',reason:null,deferred:true,finishedAt:new Date().toISOString(),completedParts:completed});return s;});
          withinEnvelope();
          return {status:'REVIEW_EPISODE_PROGRESS',runId:offer.runId};
        }
        const answers=current.parts.map(p=>p.observation.wireAnswer),readbacks=current.parts.flatMap(p=>p.observation.readSources);
        const observedAt=new Date().toISOString();
        const answer=decodeReviewAnswer(mergeReviewParts(answers,parts),{readbacks,offer,reviewer,observedAt});
        const verdict={...answer,phase:offer.phase==='HEALTH'?'HEALTH':'POST_ACCEPT',key:offer.key,reviewer,runId:offer.runId,observedAt};
        need(!validateControlFindings({review:verdict,previousFindings:offer.input.previousFindings,key:offer.key}),'MODEL_REVIEW_PARTS_GLOBAL_INVALID');
        await store.transact(s=>{check(s);withinEnvelope();const run=s.runs[offer.runId];
          need(!episode || !run.invalidated,'MODEL_REVIEW_EPISODE_INVALIDATED');
          const usage=run.parts.map(p=>p.observation.usage);
          if(!episode)run.usage=usage.every(u=>u&&Number.isFinite(u.input_tokens)&&Number.isFinite(u.output_tokens))?
            Object.fromEntries(['input_tokens','output_tokens','cached_input_tokens','reasoning_output_tokens'].map(k=>
              [k,usage.every(u=>Number.isFinite(u[k]))?usage.reduce((sum,u)=>sum+u[k],0):null])):null;
          Object.assign(run,{state:'STOPPED',reason:null,finishedAt:observedAt,verdict});return s;});
        withinEnvelope();
        return verdict;
      }catch(error){
        let failedPart=null;
        if(active){try{failedPart=await active.child.observe(offer.runId);}catch{failedPart={state:'UNKNOWN'};}}
        await store.transact(s=>{check(s);const run=s.runs[offer.runId];
          if(run.verdict){run.unacceptedVerdictSha256=hash(run.verdict);delete run.verdict;}
          if(active)saveUsage(run,failedPart);
          if(/SOURCE_DRIFT|OFFER_EVIDENCE_MISMATCH|HOST_OFFER_MISMATCH/.test(error.message))run.invalidated=true;
          Object.assign(run,{
          state:failedPart?.state==='UNKNOWN'?'UNKNOWN':'STOPPED',reason:error.message,
          finishedAt:new Date().toISOString(),completedParts:run.parts.length,failedPart});return s;});
        throw error;
      }
    }
  };
}
