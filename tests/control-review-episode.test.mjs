import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,realpath,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openPartitionModelReview} from '../scripts/control-partition-model-review.mjs';
import {openModelReview} from '../scripts/control-model-review.mjs';
import {openControlHost} from '../scripts/control-host.mjs';
import {healthControl} from '../scripts/control-health.mjs';
import {openControlStore} from '../scripts/control-store.mjs';
import {openReviewSources} from '../scripts/control-review-sources.mjs';
import {validateReviewEpisode,validateReviewPart,frozenReviewPartitions} from '../scripts/control-review-partitions.mjs';
import {controlCheckIds} from '../scripts/control-catalog.mjs';
import {runControlTick} from '../scripts/control-loop.mjs';
import {ownerControl} from '../scripts/control-owner.mjs';
import {canonicalJson,sha256} from '../scripts/memory-brief.mjs';
import {retentionKinds} from '../scripts/post-accept.mjs';
import {createReturnSync} from '../scripts/vydykhai.mjs';
import {execFileSync} from 'node:child_process';

const hash=v=>sha256(canonicalJson(v));
const groups=[['C20'],['C01','C02','C04','C15'],['C05','C06','C07','C09','C19'],
  ['C03','C11','C21','C26'],['C12','C18','C24'],['C14','C16','C17','C25'],
  ['C10','C22','C23','C28'],['C08','C13','C27']];
const limits={episodeGroups:groups,episodeMaxDurationMs:3600000,episodeMaxUsageTokens:1000};
const retry={reviewer:'reviewer',action:'RETRY',evidence:'Synthetic independent stopped-attempt decision'};

// Scripted native observations exercise the real adapter/host journals. No model,
// real product source, semantic capability, or CLI protocol success is implied.
async function fixture(t, changes={}) {
  const {health=false,...reviewChanges}=changes;
  const acceptedId=health?'@health':'accepted';
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'review-episode-')));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const name of ['workspace','host','review','room','home'])await mkdir(path.join(root,name),{mode:0o700});
  const workspace=path.join(root,'workspace'),sourceFile=path.join(root,'sources.json');
  await writeFile(path.join(workspace,'source.md'),'Synthetic frozen source');
  await writeFile(sourceFile,JSON.stringify({schema:'control.review-sources.v1',workspace,
    sources:[{id:'source',path:'source.md',purpose:'Synthetic protocol evidence'}]}),{mode:0o600});
  if(health) {
    const git=args=>execFileSync('git',args,{cwd:workspace,stdio:'pipe'});
    git(['init','--quiet']);
    git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','baseline']);
  }
  const config={workspace,policy:sha256('policy'),owner:'owner',executor:'worker',reviewer:'reviewer',evidenceRegistry:sourceFile,
    ...(health?{health:{scope:'Synthetic health',intervalMs:604800000,maxBranches:1,maxWorktrees:2,
      triggerSourceIds:['source'],repairTasks:['maintenance']}}:{})};
  const options={directory:path.join(root,'review'),controlRoot:root,sourceFile,reviewer:'reviewer',
    maxCalls:8,expiresAt:new Date(Date.now()+3600000).toISOString(),...limits,...reviewChanges,
    scope:{host:{directory:path.join(root,'host'),config},requiredSourceIds:['source']},
    native:{binary:'/never-launch-model',workspace:path.join(root,'room'),home:path.join(root,'home'),
      model:'no-inference',effort:'low',timeoutMs:120000}};
  let host,review;
  const dispatched=[],control={};
  const children=async (opts,ids)=>{
    const journal=await openControlStore(opts.directory);
    const index=validateReviewEpisode(options).partitions.findIndex(p=>hash(p)===hash(ids));
    return {
      async initialize(){await journal.initialize({runs:{}});},
      async capacity(){return {remaining:1};},
      async preflight(offer){
        const current=health?await host.health.reviewInput():await host.reviewInput(acceptedId),s=await host.snapshot();
        assert.equal((health?s.health:s.acceptances.accepted).reviewLease.runId,offer.runId);
        assert.equal(current.stateRevision,offer.stateRevision);
        assert.equal(hash(current.input),hash(offer.input));
        assert.equal(hash(current.episode),hash(offer.episode));
        return (await openReviewSources(sourceFile)).snapshot();
      },
      async review(offer){
        dispatched.push({index,runId:offer.runId,journal:opts.directory});
        const mode=await control.before?.(index,offer);
        const finishedAt=new Date().toISOString(),readSources=offer.input.sourceEvidence.rows;
        let wireAnswer={schema:'control.review-answer.v2',rowGroups:[{ids:[...ids],status:'PASS',sourceIds:['source']}],
          newFindings:[],resolutions:[]};
        control.mutate?.(wireAnswer,index);
        const trace=JSON.stringify({synthetic:true,index,wireAnswer,mode});
        await writeFile(path.join(opts.directory,'synthetic-trace.json'),trace,{mode:0o600});
        const observation={runId:offer.runId,state:mode==='UNKNOWN'?'UNKNOWN':'STOPPED',finishedAt,
          trace:{file:'synthetic-trace.json',sha256:sha256(trace)},readSources,
          usage:control.usage===undefined?{input_tokens:2,output_tokens:3}:control.usage};
        let failure=mode;
        if(!failure)try {
          const decoded=validateReviewPart(wireAnswer,ids,{readbacks:readSources,offer,reviewer:'reviewer',observedAt:finishedAt});
          Object.assign(observation,{wireAnswer,verdict:{...decoded,key:offer.key,reviewer:'reviewer',runId:offer.runId,observedAt:finishedAt}});
        }catch(error){failure=error.message;}
        await journal.transact(s=>{s.runs[offer.runId]=observation;return s;});
        await control.after?.(index,offer);
        if(failure)throw Error(failure);
        return observation.verdict;
      },
      async observe(runId){return (await journal.read()).state.runs[runId]??{runId,state:'UNKNOWN'};}
    };
  };
  const services={createReturnSync,observeReviewRun:runId=>review.observe(runId)};
  host=await openControlHost(path.join(root,'host'),config,services);await host.initialize();
  const ref=name=>({path:name+'.md',sha256:sha256(name)});
  const acceptance={schema:'work.product-acceptance.v1',id:'accepted',project:'synthetic',task:'synthetic-task',
    owner:'owner',executor:'worker',status:'ACCEPTED',acceptedAt:new Date().toISOString(),
    producerReturn:ref('return'),artifact:ref('artifact'),technicalProof:ref('proof'),goal:ref('goal'),
    retention:retentionKinds.map(id=>({id,required:true,expected:ref(id)}))};
  for(const name of ['return','artifact','proof','goal',...retentionKinds])await writeFile(path.join(workspace,name+'.md'),name);
  if(!health)await host.accept(acceptance);
  review=await openPartitionModelReview(options,children);await review.initialize();
  return {root,workspace,config,options,control,dispatched,acceptance,
    get host(){return host;},get review(){return review;},
    async reopen(){review=await openPartitionModelReview(options,children);
      host=await openControlHost(path.join(root,'host'),config,services);},
    tick(extra={}){return runControlTick(host,{review:review.review,episode:review.episodeSpec,timeoutMs:5000,...extra});},
    async run(){const s=await host.snapshot();return health?s.health:s.acceptances.accepted;}
  };
}

test('neutral frozen whole groups cover 87 exactly; C20-first is only this oracle',()=>{
  const spec=validateReviewEpisode(limits);
  assert.deepEqual(spec.partitions[0],['C20.01','C20.02','C20.03']);
  assert.deepEqual([...spec.partitions.flat()].sort(),[...controlCheckIds]);
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.partitions)&&spec.partitions.every(Object.isFrozen));
  assert.doesNotThrow(()=>validateReviewEpisode({...limits,episodeGroups:[...groups].reverse()}));
  for(const episodeGroups of [groups.slice(1),[...groups,['C20']],groups.map((g,i)=>i===1?['C99']:g)])
    assert.throws(()=>validateReviewEpisode({...limits,episodeGroups}));
  const split=spec.partitions.map(p=>[...p]);split[1].push(split[0].pop());
  assert.throws(()=>frozenReviewPartitions(split),/GROUP_SPLIT/);
  for(const change of [{episodeMaxDurationMs:0},{episodeMaxDurationMs:86400001},{episodeMaxUsageTokens:NaN}])
    assert.throws(()=>validateReviewEpisode({...limits,...change}));
});

test('HEALTH uses retained whole-group checkpoints and only a full 87-row union reaches its owner',async t=>{
  const x=await fixture(t,{health:true}),owner=ownerControl(x.host,'owner');
  assert.equal((await x.tick()).results[0].action,'REVIEW_EPISODE_DUE');
  let h=await x.run();assert.equal(h.review,null);assert.equal(h.reviewEpisode.progress.completedParts,1);
  await assert.rejects(owner.readVerdict('@health'),/NOT_AVAILABLE/);
  await assert.rejects(x.host.health.assertReady('ordinary-product'),/HEALTH_CONTROL_PENDING/);
  assert.deepEqual((await x.host.snapshot()).grants,{});
  const next=await x.host.claimReview('@health',{episode:x.review.episodeSpec});
  const native=await openModelReview(x.options);
  await native.preflight(next);
  await assert.rejects(native.preflight({...next,episode:{...next.episode,id:'a'.repeat(36)}}),/HOST_OFFER_MISMATCH/);
  const part=await x.review.review(next);await x.host.deferReview('@health',next);
  assert.equal(part.status,'REVIEW_EPISODE_PROGRESS');
  await x.reopen();
  for(let i=2;i<8;i++)await x.tick();
  h=await x.run();assert.equal(h.enrollment,'OWNER_DISPOSITION_DUE');assert.equal(h.review.rows.length,87);
  assert.equal(h.review.phase,'HEALTH');assert.equal(h.reviewEpisode,undefined);
  assert.equal(h.reviewEpisodeHistory.at(-1).progress.completedParts,7);
  assert.deepEqual(x.dispatched.map(p=>p.index),[0,1,2,3,4,5,6,7]);
  const current=ownerControl(x.host,'owner');await current.readVerdict('@health');
  assert.equal((await current.respond('@health',{owner:'owner',action:'CONTINUE',evidence:'Synthetic applied union'})).action,'HEALTH_WINDOW_CONFIRMED');
  assert.deepEqual(await x.host.due(),[]);assert.equal((await x.review.capacity()).used,8);
});

test('HEALTH retains completed part after invalid second part; retry needs an independent changed-attempt decision',async t=>{
  const x=await fixture(t,{health:true,maxCalls:9});await x.tick();
  x.control.mutate=(answer,index)=>{if(index===1)answer.rowGroups[0].ids.pop();};
  assert.equal((await x.tick()).results[0].action,'REVIEW_RECONCILIATION_REQUIRED');
  const before=await x.run();assert.equal(before.review,null);
  await assert.rejects(x.host.reconcileReview('@health'),/RETRY_DECISION_REQUIRED/);
  assert.equal((await x.review.observe(before.reviewLease.runId)).completedParts,1);
  await x.host.reconcileReview('@health',retry);x.control.mutate=null;await x.reopen();
  await x.tick();assert.equal((await x.run()).reviewEpisode.progress.completedParts,2);
  assert.deepEqual(x.dispatched.map(p=>p.index),[0,1,1]);assert.equal((await x.review.capacity()).used,3);
});

for(const boundary of ['source','pause'])test(`HEALTH ${boundary} invalidation survives restore and reopening`,async t=>{
  const x=await fixture(t,{health:true});await x.tick();const old=(await x.run()).reviewEpisode.id;
  if(boundary==='source') {
    await writeFile(path.join(x.workspace,'source.md'),'Changed');
    assert.equal((await x.tick()).calls,0);
    await writeFile(path.join(x.workspace,'source.md'),'Synthetic frozen source');
  } else {await x.host.pause(true);await x.host.pause(false);}
  await x.reopen();assert.equal((await x.tick()).calls,0);
  const held=await x.run();assert.ok(held.reviewEpisode.invalidated);
  await x.host.reconcileReview('@health',retry);
  assert.equal((await x.run()).reviewEpisode,undefined);
  assert.equal((await x.run()).reviewEpisodeHistory.at(-1).id,old);
  assert.equal((await x.review.capacity()).used,1);
});

test('HEALTH deferred progress survives a lost host receipt without an extra native call',async t=>{
  const x=await fixture(t,{health:true}),offer=await x.host.claimReview('@health',{episode:x.review.episodeSpec});
  await x.review.review(offer);await x.host.reviewFailure('@health',offer.runId);await x.reopen();
  assert.deepEqual(await x.host.reconcileReview('@health'),{action:'REVIEW_EPISODE_DUE',reused:true});
  assert.equal((await x.run()).reviewEpisode.progress.completedParts,1);
  assert.equal((await x.review.capacity()).used,1);
});

test('HEALTH changed plan and changed execution cannot reuse an earlier checkpoint',async t=>{
  const plan=await fixture(t,{health:true});await plan.tick();
  const changed=validateReviewEpisode({...limits,episodeGroups:[...groups].reverse()});
  await assert.rejects(plan.host.claimReview('@health',{episode:changed}),/PLAN_CHANGED/);
  await assert.rejects(plan.host.claimReview('@health',{episode:plan.review.episodeSpec}),/NOT_DUE/);
  assert.equal((await plan.review.capacity()).used,1);
  const authority=await fixture(t,{health:true});await authority.tick();
  await authority.host.approveCommand({taskId:'maintenance'},{reviewer:'reviewer',reviewReceipt:'Synthetic new authority',
    dependencies:[],expiresAt:Date.now()+60000});
  assert.equal((await authority.tick()).calls,0);
  assert.equal((await authority.run()).reviewEpisode.invalidated,'REVIEW_EPISODE_BASIS_CHANGED');
});

test('HEALTH stopped reconciliation cannot clear a newer lease after invalidation reload',async t=>{
  const x=await fixture(t,{health:true});await x.tick();
  const old=(await x.run()).reviewLease.runId;
  await x.host.reviewFailure('@health',old);
  await writeFile(path.join(x.workspace,'source.md'),'Changed reconciliation basis');
  const journal=await openControlStore(x.options.scope.host.directory);
  let replacement;
  const api=healthControl({config:x.config,observeReviewRun:id=>x.review.observe(id),
    state:async()=>{
      const s=await x.host.snapshot();
      if(s.health.reviewEpisode?.invalidated && !replacement) {
        await x.host.reconcileReview('@health',retry);
        replacement=await x.host.claimReview('@health');
        return x.host.snapshot();
      }
      return s;
    },
    update:mutate=>journal.transact(s=>{mutate(s);return s;})});
  await assert.rejects(api.reconcile(retry),/HEALTH_LEASE_MISMATCH/);
  const current=await x.run();
  assert.notEqual(replacement.runId,old);
  assert.equal(current.reviewLease.runId,replacement.runId);
  assert.equal(current.enrollment,'REVIEW_IN_FLIGHT');
});

for(const health of [false,true])test(`${health?'HEALTH':'POST'} pre-dispatch cancellation preserves durable completed parts and spent reservation`,async t=>{
  const x=await fixture(t,{health,maxCalls:9}),id=health?'@health':'accepted';
  await x.tick();
  const offer=await x.host.claimReview(id,{episode:x.review.episodeSpec});
  const abort=new AbortController();abort.abort();
  await assert.rejects(x.review.review(offer,{signal:abort.signal}),/CANCELLED/);
  await x.host.reviewFailure(id,offer.runId);await x.reopen();
  const observed=await x.review.observe(offer.runId);
  assert.equal(observed.state,'STOPPED');assert.equal(observed.parts.length,1);
  assert.equal(observed.completedParts,1);assert.equal(observed.actualDispatches,0);
  assert.equal((await x.review.capacity()).used,2);
  await x.host.reconcileReview(id,retry);await x.tick();
  assert.deepEqual(x.dispatched.map(p=>p.index),[0,1]);
  assert.equal((await x.run()).reviewEpisode.progress.completedParts,2);
  assert.equal((await x.review.capacity()).used,3);
});

test('HEALTH cannot discard a checkpoint by switching to confined-command custody',async t=>{
  const x=await fixture(t,{health:true});await x.tick();
  const journal=await openControlStore(x.options.scope.host.directory);
  await journal.transact(s=>{s.health.domainCandidate={schema:'control.health-domain.v1'};return s;});
  await assert.rejects(x.host.claimReview('@health',{episode:x.review.episodeSpec}),/DOMAIN_UNSUPPORTED/);
  assert.equal((await x.review.capacity()).used,1);assert.equal((await x.run()).review,null);
});

test('HEALTH unknown termination or missing usage cannot be turned into continuation permission',async t=>{
  for(const mode of ['UNKNOWN','usage']) {
    const x=await fixture(t,{health:true});await x.tick();
    if(mode==='UNKNOWN')x.control.before=()=>mode;else x.control.usage=null;
    await x.tick();const h=await x.run();
    await assert.rejects(x.host.reconcileReview('@health',retry),mode==='UNKNOWN'?/OUTCOME_UNKNOWN/:/PROGRESS_INVALID/);
    assert.equal((await x.run()).reviewLease.runId,h.reviewLease.runId);
    assert.equal((await x.review.capacity()).used,2);
    await assert.rejects(ownerControl(x.host,'owner').readVerdict('@health'),/NOT_AVAILABLE/);
  }
});

test('C20 checkpoint retains actual observation before host progress, admits nothing; eighth part globally admits',async t=>{
  const x=await fixture(t),owner=ownerControl(x.host,'owner');
  assert.equal((await x.tick()).results[0].action,'REVIEW_EPISODE_DUE');
  let row=await x.run();
  assert.equal(row.review,null);assert.equal(row.reviewEpisode.progress.completedParts,1);
  const first=await x.review.observe(row.reviewLease.runId);
  assert.equal(first.verdict,undefined);assert.equal(first.parts[0].observation.verdict.rows.length,3);
  assert.equal(first.parts[0].observation.runId,row.reviewLease.runId);
  assert.ok(first.parts[0].observation.trace.sha256);assert.ok(first.parts[0].observation.readSources.length);
  assert.deepEqual(await owner.inbox(),[]);assert.deepEqual((await x.host.snapshot()).grants,{});
  await assert.rejects(owner.readVerdict('accepted'),/NOT_AVAILABLE/);
  await assert.rejects(x.host.disposition('accepted',{owner:'owner',action:'DONE',reviewKey:'a'.repeat(64),evidence:'partial'}));
  const actual=await openModelReview(x.options),next=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  await actual.preflight(next);
  await assert.rejects(actual.preflight({...next,episode:{...next.episode,id:'a'.repeat(36)}}),/HOST_OFFER_MISMATCH/);
  // Continue the already authenticated second lease without claiming twice.
  await x.host.deferReview('accepted',next).then(()=>assert.fail('unobserved lease')).catch(e=>assert.match(e.message,/PROGRESS_INVALID/));
  await x.review.review(next);await x.host.deferReview('accepted',next);
  for(let i=2;i<8;i++) {
    await x.reopen();const result=await x.tick();
    assert.equal(result.results[0].action,i===7?'OWNER_DISPOSITION_DUE':'REVIEW_EPISODE_DUE');
    if(i<7)assert.equal((await x.run()).review,null);
  }
  row=await x.run();assert.equal(row.review.rows.length,87);
  assert.equal((await x.review.capacity()).used,8);assert.deepEqual(x.dispatched.map(p=>p.index),[0,1,2,3,4,5,6,7]);
  assert.equal(row.reviewEpisode,null);assert.equal(row.reviewEpisodeHistory.length,1);
  assert.equal((await ownerControl(x.host,'owner').inbox())[0].action,'OWNER_DISPOSITION_DUE');
});

for(const state of ['STOPPED','UNKNOWN'])test(`completed A survives B ${state}/reopen; only explicit stopped reconciliation can advance`,async t=>{
  const x=await fixture(t,{maxCalls:9});await x.tick();const a=await x.run();
  const original=await x.review.observe(a.reviewLease.runId);
  x.control.before=index=>index===1?state:null;
  assert.equal((await x.tick()).results[0].action,'REVIEW_RECONCILIATION_REQUIRED');
  const b=await x.run(),parent=(await(await openControlStore(x.options.directory)).read()).state.runs[b.reviewLease.runId];
  assert.deepEqual(parent.parts[0],original.parts[0]);assert.equal(parent.spentTokens,10);
  await x.reopen();assert.equal((await x.tick()).calls,0);
  await assert.rejects(x.host.claimReview('accepted',{episode:x.review.episodeSpec}),/ALREADY_CLAIMED/);
  assert.equal((await x.review.capacity()).used,2);
  if(state==='UNKNOWN') {
    await assert.rejects(x.host.reconcileReview('accepted',retry),/OUTCOME_UNKNOWN/);
    assert.equal((await x.tick()).calls,0);assert.equal(x.dispatched.length,2);return;
  }
  await assert.rejects(x.host.reconcileReview('accepted'),/RETRY_DECISION_REQUIRED/);
  assert.deepEqual(await x.host.reconcileReview('accepted',retry),{action:'REVIEW_EPISODE_DUE',reused:false});
  x.control.before=()=>null;
  await x.tick();assert.deepEqual(x.dispatched.map(p=>p.index),[0,1,1]);
  const current=await x.review.observe((await x.run()).reviewLease.runId);
  assert.deepEqual(current.parts[0],original.parts[0]);assert.equal(current.spentTokens,15);
  for(let i=2;i<8;i++)await x.tick();
  assert.equal((await x.review.capacity()).used,9);assert.equal((await x.run()).review.rows.length,87);
  const final=await x.review.observe((await x.run()).review.runId);
  assert.equal(final.usage.input_tokens+final.usage.output_tokens,45);
});

for(const kind of ['source','key'])test(`${kind} drift invalidation survives byte restoration and explicit reconciliation discards progress`,async t=>{
  const x=await fixture(t,{maxCalls:9});await x.tick();const before=await x.run();
  const name=kind==='source'?'source':'memory',original=kind==='source'?'Synthetic frozen source':'memory';
  await writeFile(path.join(x.workspace,name+'.md'),'Changed');
  assert.equal((await x.tick()).calls,0);assert.equal((await x.run()).enrollment,'REVIEW_RECONCILIATION_REQUIRED');
  await writeFile(path.join(x.workspace,name+'.md'),original);await x.reopen();
  await x.host.reconcileReview('accepted',retry);assert.equal((await x.run()).reviewEpisode,null);
  await x.tick();const after=await x.run();
  assert.notEqual(after.reviewEpisode.id,before.reviewEpisode.id);
  assert.equal(after.reviewEpisode.progress.completedParts,1);assert.deepEqual(x.dispatched.map(p=>p.index),[0,0]);
  assert.equal((await x.review.capacity()).used,2);
});

for(const boundary of ['defer','final'])test(`observed drift at ${boundary} admission is sticky even if restored before failure recording`,async t=>{
  const x=await fixture(t,{maxCalls:9});
  if(boundary==='final')for(let i=0;i<7;i++)await x.tick();
  const offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec}),answer=await x.review.review(offer);
  const old=(await x.run()).reviewEpisode.id;
  await writeFile(path.join(x.workspace,'source.md'),'Drift at admission');
  await assert.rejects(boundary==='defer'?x.host.deferReview('accepted',offer):x.host.review('accepted',offer,answer),
    /EPISODE_BASIS_CHANGED/);
  await writeFile(path.join(x.workspace,'source.md'),'Synthetic frozen source');
  await x.host.reviewFailure('accepted',offer.runId);await x.reopen();
  await x.host.reconcileReview('accepted',retry);
  assert.equal((await x.run()).review,null);assert.equal((await x.run()).reviewEpisode,null);
  assert.equal((await x.run()).reviewEpisodeHistory.at(-1).id,old);
  assert.equal((await x.run()).reviewEpisodeHistory.at(-1).invalidated,'REVIEW_EPISODE_BASIS_CHANGED');
});

test('pause revokes deferred authority; unpause cannot resurrect it',async t=>{
  const x=await fixture(t);await x.tick();await x.host.pause(true);await x.host.pause(false);await x.reopen();
  assert.equal((await x.tick()).calls,0);assert.equal((await x.run()).reviewEpisode.invalidated,'REVIEW_EPISODE_PAUSED');
  assert.deepEqual(await x.host.reconcileReview('accepted',retry),{action:'REVIEW_DUE',reused:false});
  assert.equal((await x.run()).reviewEpisode,null);
});

test('reconciliation observes changed basis directly and discards progress in one explicit decision',async t=>{
  const x=await fixture(t);await x.tick();
  await writeFile(path.join(x.workspace,'source.md'),'Changed before reconciliation');
  assert.deepEqual(await x.host.reconcileReview('accepted',retry),{action:'REVIEW_DUE',reused:false});
  assert.equal((await x.run()).reviewEpisode,null);assert.equal((await x.run()).review,null);
});

test('public partition preflight drift remains invalid after restore/reopen and preserves A and spent calls',async t=>{
  const x=await fixture(t);await x.tick();
  const a=await x.run(),original=await x.review.observe(a.reviewLease.runId);
  const offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  await writeFile(path.join(x.workspace,'source.md'),'Drift observed by public preflight');
  const actual=await openModelReview(x.options);
  await assert.rejects(actual.preflight(offer),/MISMATCH|DRIFT/);
  const invalid=await x.review.observe(a.reviewLease.runId);
  assert.equal(invalid.invalidated,true);
  assert.deepEqual(invalid.parts,original.parts);assert.equal(invalid.spentTokens,original.spentTokens);
  assert.equal((await x.review.capacity()).used,1);
  await writeFile(path.join(x.workspace,'source.md'),'Synthetic frozen source');await x.reopen();
  await assert.rejects(x.review.review(offer),/ALREADY_DISPATCHED|PREVIOUS_INVALID|BASIS_CHANGED/);
  assert.equal((await x.tick()).calls,0);assert.deepEqual(x.dispatched.map(p=>p.index),[0]);
  assert.equal((await x.run()).review,null);assert.equal((await x.review.capacity()).used,1);
  // The preflight refusal is known undispatched, not a fabricated native result.
  const refused=await x.review.observe(offer.runId);
  assert.equal(refused.state,'STOPPED');assert.equal(refused.dispatched,false);
  assert.deepEqual(refused.parts,original.parts);
  assert.deepEqual(await x.host.reconcileReview('accepted',retry),{action:'REVIEW_DUE',reused:false});
  assert.equal((await x.run()).reviewEpisode,null);
  assert.deepEqual((await x.review.observe(a.reviewLease.runId)).parts,original.parts);
  assert.equal((await x.review.capacity()).used,1);
});

test('stopped reconciliation drift persists before retry-decision refusal; restoration cannot reuse A',async t=>{
  const x=await fixture(t),offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  await x.review.review(offer);await x.host.reviewFailure('accepted',offer.runId);
  const original=await x.review.observe(offer.runId);
  await writeFile(path.join(x.workspace,'source.md'),'Drift observed during reconciliation');
  await assert.rejects(x.host.reconcileReview('accepted'),/RETRY_DECISION_REQUIRED/);
  assert.equal((await x.run()).reviewEpisode.invalidated,'REVIEW_EPISODE_BASIS_CHANGED');
  await writeFile(path.join(x.workspace,'source.md'),'Synthetic frozen source');await x.reopen();
  await assert.rejects(x.host.reconcileReview('accepted'),/RETRY_DECISION_REQUIRED/);
  assert.equal((await x.tick()).calls,0);assert.deepEqual(x.dispatched.map(p=>p.index),[0]);
  assert.equal((await x.run()).review,null);assert.equal((await x.review.capacity()).used,1);
  assert.deepEqual((await x.review.observe(offer.runId)).parts,original.parts);
  assert.equal((await x.review.observe(offer.runId)).spentTokens,original.spentTokens);
  assert.deepEqual(await x.host.reconcileReview('accepted',retry),{action:'REVIEW_DUE',reused:false});
  assert.equal((await x.run()).reviewEpisode,null);assert.equal((await x.review.capacity()).used,1);
});

for(const defect of ['missing','duplicate','unassigned'])test(`${defect} criteria cannot produce progress or DONE`,async t=>{
  const x=await fixture(t);x.control.mutate=(answer)=>{
    const ids=answer.rowGroups[0].ids;
    if(defect==='missing')ids.pop();else if(defect==='duplicate')ids.push(ids[0]);else ids[0]='C01.01';
  };
  await x.tick();const row=await x.run(),observed=await x.review.observe(row.reviewLease.runId);
  assert.equal(row.enrollment,'REVIEW_RECONCILIATION_REQUIRED');assert.equal(row.review,null);
  assert.equal(observed.completedParts,0);assert.equal(observed.verdict,undefined);
  assert.equal((await x.tick()).calls,0);
});

test('native slots never refund known failure and reopen cannot replenish eight-slot authority',async t=>{
  const x=await fixture(t);await x.tick();let failed=false;
  x.control.before=index=>index===1&&!failed?(failed=true,'STOPPED'):null;
  await x.tick();await x.host.reconcileReview('accepted',retry);
  for(let i=0;i<6;i++)await x.tick();
  await x.reopen();assert.equal((await x.review.capacity()).remaining,0);
  const offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  await assert.rejects(x.review.review(offer),/BUDGET_EXHAUSTED/);
  assert.equal(x.dispatched.length,8);assert.equal((await x.run()).review,null);
});

test('locally valid parts with cross-part duplicate findings fail complete87 global admission',async t=>{
  const x=await fixture(t);x.control.mutate=answer=>{
    const ids=answer.rowGroups[0].ids,id=ids[0];
    answer.rowGroups=[{ids:[id],status:'FINDING',sourceIds:['source'],findingId:'collision',reason:'Synthetic missing proof'},
      {ids:ids.slice(1),status:'PASS',sourceIds:['source']}];
    answer.newFindings=[{id:'collision',checkId:id,sourceIds:['source'],evidence:'Synthetic missing proof',
      owner:'owner',work:'synthetic-repair',reviewAt:'2099-01-01T00:00:00Z',blocksResume:true}];
  };
  for(let i=0;i<8;i++) {
    const result=await x.tick();assert.equal(result.results[0].action,i===7?'REVIEW_RECONCILIATION_REQUIRED':'REVIEW_EPISODE_DUE');
  }
  const row=await x.run(),observed=await x.review.observe(row.reviewLease.runId);
  assert.equal(observed.completedParts,8);assert.equal(observed.verdict,undefined);
  assert.match(observed.reason,/DUPLICATE_NEW_FINDING/);assert.equal(row.review,null);
});

test('lost deferred response reconciles journal-backed progress without retry or extra dispatch',async t=>{
  const x=await fixture(t),offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  await x.review.review(offer);await x.host.reviewFailure('accepted',offer.runId);await x.reopen();
  assert.deepEqual(await x.host.reconcileReview('accepted'),{action:'REVIEW_EPISODE_DUE',reused:true});
  assert.equal(x.dispatched.length,1);assert.equal((await x.review.capacity()).used,1);
  await x.tick();assert.deepEqual(x.dispatched.map(p=>p.index),[0,1]);
});

test('stopped cancellation retains a journaled complete part; explicit retry advances rather than replaying it',async t=>{
  const x=await fixture(t),offer=await x.host.claimReview('accepted',{episode:x.review.episodeSpec});
  const abort=new AbortController();x.control.after=()=>abort.abort();
  await assert.rejects(x.review.review(offer,{signal:abort.signal}),/CANCELLED/);
  await x.host.reviewFailure('accepted',offer.runId);await x.reopen();
  const observed=await x.review.observe(offer.runId);
  assert.equal(observed.parts.length,1);assert.equal(observed.completedParts,1);assert.equal(observed.verdict,undefined);
  await x.host.reconcileReview('accepted',retry);x.control.after=null;
  await x.tick();assert.deepEqual(x.dispatched.map(p=>p.index),[0,1]);
  assert.equal((await x.run()).reviewEpisode.progress.completedParts,2);
});

for(const usage of [null,{input_tokens:2,output_tokens:30}])test(`usage ${usage?'over limit':'unknown'} retains actual part but cannot progress`,async t=>{
  const x=await fixture(t,{episodeMaxUsageTokens:10});x.control.usage=usage;
  await x.tick();const row=await x.run(),observed=await x.review.observe(row.reviewLease.runId);
  assert.equal(row.review,null);assert.equal(observed.parts.length,1);assert.equal(observed.verdict,undefined);
  assert.equal(observed.reason,usage?'MODEL_REVIEW_EPISODE_USAGE_EXHAUSTED':'MODEL_REVIEW_EPISODE_USAGE_UNKNOWN');
  await x.host.reconcileReview('accepted',retry);await x.tick();
  assert.equal(x.dispatched.length,1);assert.equal((await x.run()).review,null);
});

test('total lifetime includes idle gaps; exact authority expiry admits nothing',async t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  const x=await fixture(t,{episodeMaxDurationMs:100});
  assert.equal((await x.tick()).results[0].action,'REVIEW_EPISODE_DUE');
  const startedAt=(await x.run()).reviewEpisode.startedAt;
  now=Date.parse(startedAt)+100;await x.reopen();
  assert.equal((await x.tick()).calls,0);assert.equal((await x.run()).reviewEpisode.invalidated,'REVIEW_EPISODE_EXPIRED');
  assert.equal(x.dispatched.length,1);
});

test('native expiry and tick cancellation admit nothing',async t=>{
  const y=await fixture(t);y.control.after=()=>new Promise(resolve=>setTimeout(resolve,20));
  assert.equal((await y.tick({timeoutMs:1})).results[0].action,'REVIEW_RECONCILIATION_REQUIRED');
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal((await y.run()).review,null);assert.equal((await y.tick()).calls,0);
  const z=await fixture(t,{expiresAt:new Date(Date.now()-1).toISOString()});
  await z.tick();assert.equal(z.dispatched.length,0);assert.equal((await z.run()).review,null);
});
