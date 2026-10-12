// The existing independent REVIEW also owns periodic/triggered consideration.
// Health is not fabricated product acceptance and shares the host's CAS journal.
import {randomUUID} from "node:crypto";
import path from "node:path";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {observeRepositoryHealth} from "./control-repo-observation.mjs";
import {validateControlFindings} from "./control-findings.mjs";
import {checkFindingLeases} from "./finding-history.mjs";
import {evaluateControlCadence} from "./control-cadence.mjs";
import {observeConfinedFile,validCompletedEffects} from "./control-health-domain.mjs";
import {reviewEpisodeDescriptor,reviewEpisodeProgress,validateReviewEpisodeSpec} from "./control-review-partitions.mjs";

const hash = v => sha256(canonicalJson(v));
const need = (v, code) => {if (!v) throw Error(code);};
const filled = v => typeof v === "string" && !!v.trim();
export const healthId = "@health";
export function initialHealth(config) {
  const h = config.health;
  need(filled(config.evidenceRegistry) && h && filled(h.scope) && Number.isSafeInteger(h.intervalMs) &&
    h.intervalMs >= 60000 && h.intervalMs <= 31 * 86400000 &&
    [h.maxBranches,h.maxWorktrees].every(n => Number.isSafeInteger(n) && n >= 1) &&
    [h.triggerSourceIds,h.repairTasks].every(a => Array.isArray(a) && a.every(filled) && new Set(a).size === a.length),
    "HEALTH_PLAN_INVALID");
  if(h.cadence)need(h.cadence.mode === "OBSERVED_RESET" && filled(h.cadence.observer) &&
    Number.isSafeInteger(h.cadence.maxObservationAgeMs) && h.cadence.maxObservationAgeMs > 0 &&
    h.cadence.maxObservationAgeMs <= 31 * 86400000,"HEALTH_CADENCE_INVALID");
  return {enrollment:"REVIEW_DUE", findings:[], review:null, disposition:null, reviewLease:null,
    repairLeases:[], history:[], nextDueAt:0, trigger:null, repairIds:[],reviewedCheckpoints:[]};
}
export function healthControl({state,update,config,observeReviewRun}) {
  const plan = config.health;
  const cadence = s => {if(!plan.cadence)return null;
    const result=evaluateControlCadence({observation:s.health.resetObservation,
    now:Date.now(),previousCompletedResetEpoch:s.health.completedResetEpoch ?? null,
    maxObservationAgeMs:plan.cadence.maxObservationAgeMs,followupOwner:plan.cadence.observer,paused:s.paused});
    if(s.health.pendingResetEpoch !== undefined && s.health.pendingResetEpoch !== null)
      return {...result,status:s.paused?"PAUSED":"REVIEW_DUE",due:!s.paused,
        periodic:{...result.periodic,status:"DUE",reason:"RETAINED_RESET_OBLIGATION",resetEpoch:s.health.pendingResetEpoch}};
    return result;
  };
  const retainReset = (current, epoch) => {
    if(epoch!==undefined && epoch!==null && epoch>(current.health.completedResetEpoch??-1))
      current.health.pendingResetEpoch=Math.max(current.health.pendingResetEpoch??-1,epoch);
  };
  const execution = s => !s.grants || !s.reservations ?
    {coverage:"HOST_REGISTRY_UNAVAILABLE",approvedCommands:null,reservations:null} :
    ({coverage:"HOST_REGISTRY_ONLY_NOT_EXTERNAL_TASK_INVENTORY",
    approvedCommands:Object.values(s.grants).map(g=>({id:g.id,taskId:g.binding.taskId,
      recordSha256:hash(g),bindingSha256:g.bindingSha256,dependencies:g.dependencies,expiresAt:g.expiresAt})),
    reservations:Object.values(s.reservations).map(r=>({id:r.reservationId,taskId:r.nextTask,
      recordSha256:hash(r),status:r.status,dependencies:r.dependencies}))});
  const scopeKey = s => hash({health:s.health,paused:s.paused,execution:execution(s)});
  const coordinationKey = s => {
    const {grants,reservations,...other}=s;
    const {reviewBasis,...health}=other.health;
    if(health.reviewLease) {const {captured,...lease}=health.reviewLease;health.reviewLease=lease;}
    return hash({...other,health});
  };
  const sources = async s => {
    s ??= await state();
    const registry = await openReviewSources(config.evidenceRegistry);
    need(registry.workspace === config.workspace,"HEALTH_WORKSPACE_MISMATCH");
    const sourceEvidence = await registry.snapshot(), repo = await observeRepositoryHealth(config.workspace);
    need(plan.triggerSourceIds.every(id => sourceEvidence.rows.some(r => r.id === id)),"HEALTH_TRIGGER_SOURCE_MISSING");
    const {observedAt,...repository} = repo;
    const trigger = hash({sources:sourceEvidence.rows.filter(r => plan.triggerSourceIds.includes(r.id)),
      repository:repo.status !== "OBSERVED" ? "LIMITED" : {
        branches:repo.branchCount > plan.maxBranches ? repo.branches.map(({name})=>name) : null,
        worktrees:repo.worktreeCount > plan.maxWorktrees ? repo.worktrees.map(({path,branch,detached})=>({path,branch,detached})) : null}});
    return {sourceEvidence,repository,trigger,execution:execution(s)};
  };
  // Exclude transient enrollment/lease state so claiming this review does not
  // invalidate its own offer. These are coordination facts, not repair proof.
  const lifecycle = h => ({receipt:"COORDINATION_ONLY_NOT_REPAIR_PROOF",
    phase:h.repairIds.length?"REPAIR_VERIFICATION":h.review?"FOLLOWUP_DIAGNOSIS":"INITIAL_DIAGNOSIS",
    previousReview:h.review?{sha256:hash(h.review),key:h.review.key,observedAt:h.review.observedAt,
      reviewer:h.review.reviewer}:null,
    ownerDisposition:h.disposition?structuredClone(h.disposition):null,
    repairAssignments:structuredClone(h.repairLeases),requestedRepairFindingIds:[...h.repairIds]});
  const input = async s => ({policy:config.policy,scope:plan.scope,previousFindings:s.health.findings,
    lifecycle:lifecycle(s.health),...await sources(s),
    ...(s.health.domainCandidate?{domainCandidate:structuredClone(s.health.domainCandidate)}:{})});
  const episodeBasis = fresh => hash({key:hash(fresh),input:fresh});
  const assertEpisodeBasis = async (s,fresh,reject=true) => {
    const e=s.health.reviewEpisode;
    if(!e)return;
    const reason=e.invalidated || (e.basisSha256!==episodeBasis(fresh) ? "REVIEW_EPISODE_BASIS_CHANGED" :
      Date.now()>=Date.parse(e.startedAt)+e.spec.maxDurationMs ? "REVIEW_EPISODE_EXPIRED" : null);
    if(!reason)return;
    await update(current=>{need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");
      current.health.reviewEpisode.invalidated=reason;
      current.health.enrollment="REVIEW_RECONCILIATION_REQUIRED";});
    if(reject)throw Error(reason);
    return reason;
  };
  const sourceKey = fresh => hash({sourceEvidence:fresh.sourceEvidence,repository:fresh.repository,trigger:fresh.trigger,execution:fresh.execution});
  const blockingDomainFinding = (h,taskId) => h.findings.concat(h.disposition?[]:
    h.history.findLast(row=>row.disposition&&row.review)?.review.findings??[]).some(f=>f.status==="OPEN"&&
      (f.lastResult==="FAILED"||f.blocksResume&&(f.affectedTasks===undefined||f.affectedTasks.includes(taskId))));
  const currentDomain = async (s,domain) => {
    const grant=s.grants?.[domain.grantId];
    need(grant && hash(grant)===domain.grantSha256 && grant.expiresAt>Date.now() &&
      !blockingDomainFinding(s.health,grant.binding.taskId),"HEALTH_DOMAIN_AUTHORITY_CHANGED");
    const registry=await openReviewSources(config.evidenceRegistry),entries=await registry.list();
    need(!entries.some(r=>path.resolve(config.workspace,r.path)===path.resolve(config.workspace,domain.file)),"HEALTH_DOMAIN_SOURCE_OVERLAP");
    return {grant,observation:await observeConfinedFile(config.workspace,domain.file)};
  };
  const admitCaptured = async (s,basis,offer=basis.offer) => {
    need(!s.paused && hash(offer)===hash(basis.offer) && coordinationKey(s)===basis.coordinationSha256,
      "HEALTH_SOURCE_CHANGED");
    const domain=s.health.domain, {grant,observation}=await currentDomain(s,domain);
    const fresh=await sources(s),original=basis.offer.input;
    need(hash(fresh.sourceEvidence)===hash(original.sourceEvidence) && fresh.trigger===original.trigger &&
      hash(fresh.execution.approvedCommands)===hash(original.execution.approvedCommands) &&
      fresh.execution.coverage===original.execution.coverage &&
      observation.protectedSha256===basis.observation.protectedSha256 &&
      hash(observation.identity)===hash(basis.observation.identity),"HEALTH_SOURCE_CHANGED");
    if(sourceKey(fresh)===sourceKey(original)) {
      need(hash(observation)===hash(basis.observation),"HEALTH_SOURCE_CHANGED");
      return structuredClone(basis.offer);
    }
    const id=domain.grantId,row=s.reservations[id];
    need(!original.execution.reservations.some(r=>r.id===id) &&
      hash(fresh.execution.reservations.filter(r=>r.id!==id))===hash(original.execution.reservations) &&
      validCompletedEffects(row,grant,{...domain,observation:basis.observation}) &&
      row.effects.before.repositorySha256===hash(original.repository) &&
      row.effects.after.repositorySha256===hash(fresh.repository) &&
      hash(observation)===hash(row.effects.after),"HEALTH_EFFECTS_NOT_ADMITTED");
    return structuredClone(basis.offer);
  };
  const sameCheckpoint = (a,b) => a.id===b.id&&a.reviewAt===b.reviewAt;
  const overdue = (h,now) => h.findings.filter(f=>f.status==="OPEN"&&Date.parse(f.reviewAt)<=now&&
    !(h.reviewedCheckpoints??[]).some(p=>sameCheckpoint(p,f)));
  const periodicDue = s => plan.cadence ? cadence(s).due &&
    cadence(s).periodic.resetEpoch !== s.health.reviewedResetEpoch : Date.now() >= s.health.nextDueAt;
  const isDue = (s,fresh) => s.health.enrollment === "REVIEW_DUE" ||
    ["SETTLED","REPAIR_DUE"].includes(s.health.enrollment) &&
    (periodicDue(s) || fresh.trigger !== s.health.trigger ||
      overdue(s.health,Date.now()).length>0) ||
    s.health.enrollment === "OWNER_DISPOSITION_DUE" && s.health.reviewSourceKey !== sourceKey(fresh);
  const api = {
    async reviewInput() {
      const s=await state(),fresh=await input(s);
      if(s.health.reviewLease?.captured)return admitCaptured(s,s.health.reviewLease.captured);
      await assertEpisodeBasis(s,fresh);
      return {key:hash(fresh),phase:"HEALTH",input:fresh,stateRevision:scopeKey(s),
        ...(s.health.reviewEpisode?{episode:reviewEpisodeDescriptor(s.health.reviewEpisode)}:{})};
    },
    async admitReview(offer) {
      const s=await state();
      need(!s.paused && s.health.enrollment==="REVIEW_IN_FLIGHT" &&
        s.health.reviewLease?.runId===offer.runId && s.health.reviewLease.reviewer===config.reviewer,"HEALTH_LEASE_MISMATCH");
      if(s.health.reviewLease.captured)return admitCaptured(s,s.health.reviewLease.captured,offer);
      const current=await api.reviewInput();
      need(current.key===offer.key && current.stateRevision===offer.stateRevision && hash(current.input)===hash(offer.input) &&
        hash(current.episode??null)===hash(offer.episode??null),"HEALTH_SOURCE_CHANGED");
      return structuredClone(offer);
    },
    async proposeDomain({owner,grantId,sourceIds}) {
      const s=await state(),grant=s.grants?.[grantId],confined=grant?.binding.confined;
      need(owner===config.owner&&!s.paused&&!s.health.reviewLease&&!s.health.domain &&
        grant && !s.reservations[grantId] && grant.expiresAt>Date.now() && grant.dependencies.length===0 &&
        grant.executionRequest?.operation==="resume" && confined?.schema==="control.confined-command.v1" &&
        confined.writeFiles?.length===1 && Array.isArray(sourceIds)&&sourceIds.length>0&&new Set(sourceIds).size===sourceIds.length,
        "HEALTH_DOMAIN_PROPOSAL_INVALID");
      const registry=await openReviewSources(config.evidenceRegistry),snapshot=await registry.snapshot();
      const bindings=sourceIds.map(id=>snapshot.rows.find(r=>r.id===id));
      need(bindings.every(r=>r?.status==="AVAILABLE") && !snapshot.rows.some(r=>
        path.resolve(config.workspace,r.path)===path.resolve(config.workspace,confined.writeFiles[0])),"HEALTH_DOMAIN_SOURCE_OVERLAP");
      const refs=[grant.executionRequest.task,confined.module,confined.plan,confined.approval];
      need(refs.every(ref=>bindings.some(r=>r.path===ref.path&&r.sha256===ref.sha256&&!r.startMarker&&!r.endMarker)),"HEALTH_DOMAIN_AUTHORITY_UNREAD");
      const candidate={schema:"control.health-domain.v1",file:confined.writeFiles[0],grantId,grantSha256:hash(grant),
        sourceBindings:bindings,rights:structuredClone(confined),authority:"DECLARED_RIGHTS_NOT_EFFECTS",
        observation:await observeConfinedFile(config.workspace,confined.writeFiles[0])};
      need(!blockingDomainFinding(s.health,grant.binding.taskId),"HEALTH_DOMAIN_GLOBAL_FINDING");
      await update(current=>{need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");
        current.health.domainCandidate=candidate;current.health.enrollment="REVIEW_DUE";});
    },
    async cadence() {return cadence(await state());},
    async recordResetObservation({observer,observation}) {
      need(plan.cadence && observer === plan.cadence.observer,"HEALTH_RESET_OBSERVER_REQUIRED");
      const s=await state();need(!s.health.reviewLease,"HEALTH_RESET_REVIEW_IN_FLIGHT");
      const candidate={...observation,trusted:true};
      const assessed=evaluateControlCadence({observation:candidate,now:Date.now(),
        previousCompletedResetEpoch:s.health.completedResetEpoch ?? null,
        maxObservationAgeMs:plan.cadence.maxObservationAgeMs,followupOwner:observer});
      need(assessed.periodic.status !== "UNKNOWN","HEALTH_RESET_OBSERVATION_INVALID");
      const old=s.health.resetObservation;
      need(!old || assessed.periodic.observation.observedAt >= old.observedAt &&
        assessed.periodic.observation.resetAt >= old.resetAt,"HEALTH_RESET_OBSERVATION_REGRESSED");
      await update(current=>{
        need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");
        if(cadence(s)?.periodic.status === "DUE")retainReset(current,cadence(s).periodic.resetEpoch);
        if(assessed.periodic.status === "DUE")retainReset(current,assessed.periodic.resetEpoch);
        current.health.resetObservation=assessed.periodic.observation;
      });
    },
    async due() {
      let s = await state(); if(s.paused)return [];
      if(s.health.enrollment==="REVIEW_EPISODE_DUE" && s.health.reviewEpisode) {
        await assertEpisodeBasis(s,await input(s),false);
        return [{id:healthId,action:(await state()).health.enrollment,kind:"HEALTH"}];
      }
      if(s.health.reviewLease)return [{id:healthId,action:s.health.enrollment}];
      if(cadence(s)?.periodic.status === "DUE" && s.health.pendingResetEpoch !== cadence(s).periodic.resetEpoch) {
        const epoch=cadence(s).periodic.resetEpoch;
        await update(current=>{need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");retainReset(current,epoch);});
        s=await state();
      }
      const h = s.health;
      const admitted=h.reviewBasis ? await admitCaptured(s,h.reviewBasis).then(()=>true,()=>false) : false;
      const due = h.enrollment==="OWNER_DISPOSITION_DUE" && h.reviewBasis ? !admitted : isDue(s,await sources());
      return due ? [{id:healthId,action:"REVIEW_DUE",kind:"HEALTH"}] :
        h.enrollment === "SETTLED" ? cadence(s)?.followup ?
          [{id:healthId,action:"CADENCE_OBSERVATION_DUE",kind:"HEALTH",followup:cadence(s).followup}] : [] :
          [{id:healthId,action:h.enrollment,kind:"HEALTH"}];
    },
    async claimReview({episode}={}) {
      const s = await state(), fresh = await input(s);
      const continuing=s.health.enrollment==="REVIEW_EPISODE_DUE" && s.health.reviewEpisode;
      need(!s.paused && (!s.health.reviewLease || continuing) && (continuing || isDue(s,fresh)),"HEALTH_REVIEW_NOT_DUE");
      if(episode)validateReviewEpisodeSpec(episode);
      // Captured confined-command effects have a different custody protocol.
      need(!episode || (!s.health.domain && !s.health.domainCandidate),"HEALTH_EPISODE_DOMAIN_UNSUPPORTED");
      if(continuing) {
        await assertEpisodeBasis(s,fresh);
        if(!episode || hash(episode)!==s.health.reviewEpisode.planSha256) {
          await update(current=>{need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");
            current.health.reviewEpisode.invalidated="REVIEW_EPISODE_PLAN_CHANGED";
            current.health.enrollment="REVIEW_RECONCILIATION_REQUIRED";});
          throw Error("REVIEW_EPISODE_PLAN_CHANGED");
        }
      }
      const runId = randomUUID(), key = hash(fresh),claimedAt=Date.now();
      const overdueCheckpoints=overdue(s.health,claimedAt).map(({id,reviewAt})=>({id,reviewAt}));
      const observed=s.health.domain ? await currentDomain(s,s.health.domain) : null;
      if(observed) {
        const prior=s.reservations[s.health.domain.grantId];
        need(prior ? validCompletedEffects(prior,observed.grant,s.health.domain) &&
          hash(observed.observation)===hash(prior.effects.after) : hash(observed.observation)===hash(s.health.domain.observation),
          "HEALTH_DOMAIN_EFFECTS_REQUIRED");
      }
      await update(current => {
        need(scopeKey(current) === scopeKey(s),"HEALTH_STATE_CHANGED");
        if(episode && !continuing)current.health.reviewEpisode={id:runId,planSha256:hash(episode),
          basisSha256:episodeBasis(fresh),startedAt:new Date(claimedAt).toISOString(),previousRunId:null,
          spec:structuredClone(episode),progress:null};
        current.health.reviewLease = {runId,reviewer:config.reviewer,startedAt:new Date(claimedAt).toISOString(),key,overdueCheckpoints,
          ...(cadence(s)?.periodic.status === "DUE" ? {resetEpoch:cadence(s).periodic.resetEpoch} : {})};
        current.health.enrollment = "REVIEW_IN_FLIGHT";
        if(observed) {
          const offer={runId,key,phase:"HEALTH",input:fresh,stateRevision:hash({coordination:coordinationKey(current),execution:execution(current)})};
          current.health.reviewLease.captured={offer,coordinationSha256:coordinationKey(current),observation:observed.observation};
        }
      });
      if(observed)return structuredClone((await state()).health.reviewLease.captured.offer);
      return {...await api.reviewInput(),runId};
    },
    async deferReview(offer) {
      const s=await state(),h=s.health,fresh=await input(s);
      await assertEpisodeBasis(s,fresh);
      need(!s.paused && ["REVIEW_IN_FLIGHT","REVIEW_RECONCILIATION_REQUIRED"].includes(h.enrollment) &&
        h.reviewLease?.runId===offer.runId && h.reviewEpisode && offer.stateRevision===scopeKey(s) &&
        hash(reviewEpisodeDescriptor(h.reviewEpisode))===hash(offer.episode),"REVIEW_EPISODE_BASIS_CHANGED");
      need(typeof observeReviewRun==="function","REVIEW_OBSERVER_REQUIRED");
      const observed=await observeReviewRun(offer.runId),e=h.reviewEpisode;
      need(observed?.runId===offer.runId && observed.state==="STOPPED" && filled(observed.evidence) &&
        observed.deferred===true && !observed.reason && !observed.verdict && !observed.invalidated &&
        !observed.usageUnknown && Number.isSafeInteger(observed.spentTokens) && observed.spentTokens>=0 &&
        observed.spentTokens<=e.spec.maxUsageTokens && Number.isSafeInteger(observed.completedParts) &&
        observed.completedParts>0 && observed.completedParts<e.spec.partitions.length &&
        observed.completedParts===(e.progress?.completedParts??0)+1 &&
        observed.parts?.length===observed.completedParts &&
        observed.parts.every((p,i)=>p.index===i && hash(p.ids)===hash(e.spec.partitions[i])) &&
        observed.sourceDigest===fresh.sourceEvidence.digest && hash(observed.episode)===hash(offer.episode),
        "REVIEW_EPISODE_PROGRESS_INVALID");
      await update(current=>{need(scopeKey(current)===scopeKey(s),"HEALTH_STATE_CHANGED");
        current.health.reviewEpisode.previousRunId=offer.runId;
        current.health.reviewEpisode.progress=reviewEpisodeProgress(observed);
        current.health.enrollment="REVIEW_EPISODE_DUE";});
      return {action:"REVIEW_EPISODE_DUE"};
    },
    async review(_id,offer,verdict) {
      const s = await state(), h = s.health, fresh = await input(s);
      await assertEpisodeBasis(s,fresh);
      if(h.reviewLease?.captured)await api.admitReview(offer);
      else need(!s.paused && offer.stateRevision === scopeKey(s) && offer.key === hash(fresh) && hash(offer.input)===hash(fresh),"HEALTH_SOURCE_CHANGED");
      need(verdict?.phase === "HEALTH" && verdict.key === offer.key && verdict.reviewer === config.reviewer &&
        verdict.runId === offer.runId && h.reviewLease?.runId === offer.runId &&
        Number.isFinite(Date.parse(verdict.observedAt)) && Date.parse(verdict.observedAt) >= Date.parse(h.reviewLease.startedAt),
        "HEALTH_VERDICT_IDENTITY_INVALID");
      if(h.reviewEpisode)need(hash(reviewEpisodeDescriptor(h.reviewEpisode))===hash(offer.episode),
        "REVIEW_EPISODE_BASIS_CHANGED");
      const v = structuredClone(verdict);
      // A reviewed repair that leaves its named finding open is a failed attempt,
      // not a fresh incident. The wire cannot silently reset that attempt.
      for(const id of h.repairIds) {
        const f = v.findings?.find(f => f.id === id), old = h.findings.find(f => f.id === id);
        if(f?.status === "OPEN") {f.attempts = old.attempts + 1; f.lastResult = "FAILED";}
      }
      need(!validateControlFindings({review:v,previousFindings:h.findings,key:offer.key}),"HEALTH_FINDINGS_INVALID");
      const open = check => v.findings.some(f => f.checkId === check && f.status === "OPEN");
      need(fresh.repository.status === "OBSERVED" || open("C12.01"),"HEALTH_REPOSITORY_UNKNOWN");
      need(!fresh.sourceEvidence.rows.some(r => r.status === "MISSING") || open("C24.02"),"HEALTH_SOURCE_UNKNOWN");
      if(v.healthDomain)need(h.domainCandidate && v.healthDomain.domainSha256===hash(h.domainCandidate) &&
        v.healthDomain.file===h.domainCandidate.file && v.healthDomain.grantId===h.domainCandidate.grantId &&
        v.rows.some(r=>r.id==="C05.02"&&r.status==="PASS") &&
        v.healthDomain.reviewer===config.reviewer && v.healthDomain.key===offer.key &&
        v.healthDomain.sourceBindings && hash(v.healthDomain.sourceBindings)===hash(h.domainCandidate.sourceBindings) &&
        filled(v.healthDomain.evidence) && !blockingDomainFinding({ ...h, findings:v.findings },s.grants[h.domainCandidate.grantId].binding.taskId),
        "HEALTH_DOMAIN_APPROVAL_INVALID");
      await update(current => {
        need(scopeKey(current) === scopeKey(s),"HEALTH_STATE_CHANGED");
        const row = current.health;
        if(row.review)row.history.push({review:row.review,disposition:row.disposition,repairLeases:row.repairLeases});
        row.findings = v.findings; row.review = v; row.disposition = null; row.reviewLease = null;
        if(row.reviewEpisode) {
          (row.reviewEpisodeHistory??=[]).push({...row.reviewEpisode,completedRunId:v.runId});
          delete row.reviewEpisode;
        }
        const considered=[...(h.reviewedCheckpoints??[]),...(h.reviewLease.overdueCheckpoints??[])];
        row.reviewedCheckpoints=considered.filter((p,index)=>
          considered.findIndex(q=>sameCheckpoint(p,q))===index&&
          v.findings.some(f=>f.status==="OPEN"&&sameCheckpoint(p,f)));
        row.reviewedResetEpoch = h.reviewLease.resetEpoch ?? h.reviewedResetEpoch ?? null;
        row.reviewSourceKey = sourceKey(fresh);
        row.enrollment = "OWNER_DISPOSITION_DUE"; row.trigger = fresh.trigger; row.repairIds = [];
        if(h.reviewLease.captured)row.reviewBasis={...h.reviewLease.captured,coordinationSha256:coordinationKey(current)};
        else delete row.reviewBasis;
      });
    },
    async reviewFailure(_id,runId) {
      const before=await state();
      if(before.health.reviewEpisode)await assertEpisodeBasis(before,await input(before),false);
      await update(s => {
        need(s.health.reviewLease?.runId === runId,"HEALTH_LEASE_MISMATCH");
        s.health.enrollment = "REVIEW_RECONCILIATION_REQUIRED";
      });
    },
    async reconcile(decision) {
      let s = await state();const lease = s.health.reviewLease;
      need(!s.paused && lease && typeof observeReviewRun === "function","HEALTH_OBSERVER_REQUIRED");
      const observed = await observeReviewRun(lease.runId);
      need(observed?.state === "STOPPED" && observed.runId === lease.runId && filled(observed.evidence),"HEALTH_OUTCOME_UNKNOWN");
      need(scopeKey(await state()) === scopeKey(s),"HEALTH_STATE_CHANGED");
      const fresh=await input(s);
      if(s.health.reviewEpisode && await assertEpisodeBasis(s,fresh,false)) {
        s=await state();
        need(s.health.reviewLease?.runId===lease.runId,"HEALTH_LEASE_MISMATCH");
      }
      const e=s.health.reviewEpisode;
      const episodeCurrent=!e || (!e.invalidated && !observed.invalidated && e.basisSha256===episodeBasis(fresh) &&
        Date.now()<Date.parse(e.startedAt)+e.spec.maxDurationMs);
      if(observed.deferred && !observed.reason && episodeCurrent) {
        try {
          await api.deferReview({...await api.reviewInput(),runId:lease.runId});
          return {action:"REVIEW_EPISODE_DUE",reused:true};
        } catch {}
      }
      let validationFailure = null;
      if(observed.verdict && episodeCurrent) {
        if(observed.verdict.key === hash(fresh)) {
          try {
            await api.review(healthId,{...await api.reviewInput(),runId:lease.runId},observed.verdict);
            return {action:"OWNER_DISPOSITION_DUE",reused:true};
          } catch(error) {
            if(error.message !== "HEALTH_FINDINGS_INVALID")throw error;
            validationFailure = error.message;
          }
        }
      }
      need(decision?.reviewer === config.reviewer && decision.action === "RETRY" && filled(decision.evidence),"HEALTH_RETRY_DECISION_REQUIRED");
      await update(current => {
        need(scopeKey(current) === scopeKey(s),"HEALTH_STATE_CHANGED");
        need(current.health.reviewLease?.runId===lease.runId,"HEALTH_LEASE_MISMATCH");
        current.health.history.push({lease,observation:observed,decision:structuredClone(decision),
          ...(validationFailure ? {validationFailure} : {})});
        if(current.health.reviewEpisode) {
          const episode=current.health.reviewEpisode;
          if(!episodeCurrent || !observed.episode) {
            (current.health.reviewEpisodeHistory??=[]).push({...episode,
              invalidated:episode.invalidated??"REVIEW_EPISODE_INVALIDATED"});
            delete current.health.reviewEpisode;
          } else {
            need(hash(observed.episode)===hash(reviewEpisodeDescriptor(episode)) && !observed.usageUnknown &&
              Number.isSafeInteger(observed.completedParts) && observed.completedParts>=0 &&
              observed.completedParts<=episode.spec.partitions.length && observed.parts?.length===observed.completedParts &&
              observed.parts.every((p,i)=>p.index===i && hash(p.ids)===hash(episode.spec.partitions[i])),
              "REVIEW_EPISODE_PROGRESS_INVALID");
            episode.progress=reviewEpisodeProgress(observed);episode.previousRunId=lease.runId;
            current.health.enrollment="REVIEW_EPISODE_DUE";return;
          }
        }
        current.health.reviewLease = null; current.health.enrollment = "REVIEW_DUE";
      });
      return {action:(await state()).health.enrollment,reused:false};
    },
    async disposition(decision,leases=[]) {
      const s = await state(), h = s.health;
      need(!s.paused && !h.reviewLease && h.enrollment === "OWNER_DISPOSITION_DUE" &&
        decision?.owner === config.owner && decision.reviewKey === hash(h.review) && filled(decision.evidence) &&
        ["CONTINUE","REPAIR"].includes(decision.action),"HEALTH_DISPOSITION_INVALID");
      if(h.reviewBasis)await admitCaptured(s,h.reviewBasis);
      else need(h.reviewSourceKey === sourceKey(await sources()),"HEALTH_SOURCE_CHANGED");
      need(!checkFindingLeases(h.findings,leases),"HEALTH_REPAIR_OWNER_REQUIRED");
      const blocked = h.findings.some(f => f.status === "OPEN" && f.blocksResume);
      need(!blocked || decision.action === "REPAIR","HEALTH_REPAIR_REQUIRED");
      await update(current => {
        need(scopeKey(current) === scopeKey(s),"HEALTH_STATE_CHANGED");
        Object.assign(current.health,{disposition:structuredClone(decision),repairLeases:structuredClone(leases),
          enrollment:blocked ? "REPAIR_DUE" : "SETTLED",nextDueAt:Date.now()+plan.intervalMs});
        if(h.review.healthDomain) {
          need(decision.action==="CONTINUE"&&!blocked&&h.domainCandidate,"HEALTH_DOMAIN_NOT_APPLIED");
          current.health.domain={...h.domainCandidate,approval:structuredClone(h.review.healthDomain),ownerDisposition:structuredClone(decision)};
          delete current.health.domainCandidate;
        }
        if(h.reviewBasis && s.reservations[h.domain.grantId]?.status==="COMPLETED") {
          current.health.history.push({completedDomain:structuredClone(h.domain),appliedReviewKey:hash(h.review)});
          delete current.health.domain;
        }
        delete current.health.reviewBasis;
        if(!blocked && h.reviewedResetEpoch !== null && h.reviewedResetEpoch !== undefined) {
          current.health.completedResetEpoch=h.reviewedResetEpoch;
          if((current.health.pendingResetEpoch??-1)<=h.reviewedResetEpoch)current.health.pendingResetEpoch=null;
        }
      });
      return {action:blocked ? "REPAIR_DUE" : "HEALTH_WINDOW_CONFIRMED",nextDueAt:(await state()).health.nextDueAt};
    },
    async requestRepairReview({owner,evidence,findingIds}) {
      need(owner === config.owner && filled(evidence) && Array.isArray(findingIds) && findingIds.length &&
        new Set(findingIds).size === findingIds.length,"HEALTH_REPAIR_REQUEST_INVALID");
      const s = await state(), h = s.health;
      need(!s.paused && !h.reviewLease && h.disposition?.action === "REPAIR","HEALTH_REPAIR_NOT_OWNED");
      need(h.repairIds.length === 0,"HEALTH_REPAIR_ALREADY_PENDING");
      for(const id of findingIds) {
        const f = h.findings.find(f => f.id === id);
        need(f?.status === "OPEN" && !checkFindingLeases([f],h.repairLeases) &&
          h.repairLeases.find(l=>l.owner===f.owner && l.work===f.work).state !== "WAITING", "HEALTH_REPAIR_NOT_OWNED");
        need(f?.status === "OPEN" && (f.lastResult !== "FAILED" || (f.retryDecisions??[]).some(d =>
          d.fromAttempt === f.attempts && d.toAttempt === f.attempts+1 && d.reviewedBy === config.reviewer)),
          "HEALTH_FAILED_REPAIR_NEEDS_DECISION");
      }
      await update(current => {
        need(scopeKey(current) === scopeKey(s),"HEALTH_STATE_CHANGED");
        current.health.history.push({repairRequest:{owner,evidence,findingIds:[...findingIds]}});
        current.health.repairIds = [...findingIds]; current.health.enrollment = "REVIEW_DUE";
      });
    },
    async authorizeRepairRetry({reviewer,findingId,fromAttempt,reviewKey,evidence,decision}) {
      need(reviewer === config.reviewer && filled(evidence) && filled(decision),"HEALTH_RETRY_DECISION_REQUIRED");
      await update(s => {
        const h = s.health, f = h.findings.find(f => f.id === findingId);
        need(!s.paused && !h.reviewLease && !h.repairIds.length &&
          ["REPAIR_DUE","SETTLED"].includes(h.enrollment) && h.disposition?.action === "REPAIR" &&
          reviewKey === hash(h.review) && f?.status === "OPEN" && fromAttempt === f.attempts &&
          f.owner !== reviewer && !checkFindingLeases([f],h.repairLeases) &&
          h.repairLeases.find(l=>l.owner===f.owner && l.work===f.work).state !== "WAITING" &&
          f.lastResult === "FAILED" && !(f.retryDecisions??[]).some(d => d.fromAttempt === f.attempts),"HEALTH_RETRY_INVALID");
        (f.retryDecisions??=[]).push({fromAttempt:f.attempts,toAttempt:f.attempts+1,previousResult:"FAILED",
          reviewedBy:reviewer,reviewKey,evidence,decision});
      });
    },
    async assertReady(taskId) {
      const s = await state();
      need(!s.paused && filled(taskId),"HEALTH_CONTROL_PENDING");
      const h = s.health;
      const previousApplied = h.history.findLast(row=>row.disposition && row.review);
      const findings = h.findings.concat(h.disposition ? [] : previousApplied?.review.findings ?? []);
      const repairs = findings.filter(f=>f.status === "OPEN" && f.work === taskId);
      // A known repair never falls through as an unrelated product task. All
      // findings served by that work must have an applied, runnable lease/retry.
      if(repairs.length) {
        need(h.disposition?.action === "REPAIR" && repairs.every(f=>{
          const leases=h.repairLeases.filter(l=>l.work===f.work && l.owner===f.owner);
          return !checkFindingLeases([f],leases) && leases[0].state !== "WAITING" &&
            (f.lastResult !== "FAILED" || (f.retryDecisions??[]).some(d=>
              d.fromAttempt === f.attempts && d.toAttempt === f.attempts+1 && d.reviewedBy === config.reviewer));
        }),"HEALTH_CONTROL_PENDING");
        return;
      }
      if(plan.repairTasks.includes(taskId))return;
      // A periodic obligation remains due without becoming a new global hold.
      // Initial diagnosis still needs owner application; unknown finding scope
      // stays global until independently closed, never guessed by the executor.
      const applied = h.disposition || previousApplied;
      need(applied && !findings.some(f=>f.status === "OPEN" && f.blocksResume &&
        (f.affectedTasks === undefined || f.affectedTasks.includes(taskId))),"HEALTH_CONTROL_PENDING");
    }
  };
  return api;
}
