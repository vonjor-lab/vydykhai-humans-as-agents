// Actual CLI with scripted responses: protocol and retention, never semantic proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {endpointFixture,endpointServices} from './control-endpoint-fixture.mjs';
import {nativeProvider,codeItem,answerItem} from './native-provider-fixture.mjs';
import {openControlHost} from '../scripts/control-host.mjs';
import {openModelReview} from '../scripts/control-model-review.mjs';
import {openControlStore} from '../scripts/control-store.mjs';
import {validateReviewEpisode} from '../scripts/control-review-partitions.mjs';
import {runControlTick} from '../scripts/control-loop.mjs';
import {ownerControl} from '../scripts/control-owner.mjs';
import {retentionKinds} from '../scripts/post-accept.mjs';
import {sha256} from '../scripts/memory-brief.mjs';
import {controlCatalog} from '../scripts/control-catalog.mjs';
import {execFileSync} from 'node:child_process';

const binary=process.env.VYDYKHAI_CODEX_BINARY;
for(const health of [false,true])test(`actual CLI ${health?'HEALTH':'POST'} episodes retain A after invalid B and require full 87 union`,
  {skip:!binary||process.platform!=='darwin',timeout:120000},async t=>{
    const x=await endpointFixture(t),dirs={};
    for(const name of ['episode-host','review','room','home']) {
      dirs[name]=path.join(x.privateRoot,name);await mkdir(dirs[name],{mode:0o700});
    }
    await x.f.put('evidence.md','Synthetic bounded transport evidence, not semantic approval.');
    const sourceFile=path.join(x.privateRoot,'sources.json');
    await writeFile(sourceFile,JSON.stringify({schema:'control.review-sources.v1',workspace:x.f.root,
      sources:[{id:'evidence',path:'evidence.md',purpose:'Scripted transport only'}]}),{mode:0o600});
    const groups=health?[controlCatalog.slice(0,14).map(g=>g.id),controlCatalog.slice(14).map(g=>g.id)]:
      [['C20'],['C01','C02','C04','C15'],['C05','C06','C07','C09','C19'],
      ['C03','C11','C21','C26'],['C12','C18','C24'],['C14','C16','C17','C25'],
      ['C10','C22','C23','C28'],['C08','C13','C27']];
    const limits={episodeGroups:groups,episodeMaxDurationMs:300000,episodeMaxUsageTokens:1000};
    const parts=validateReviewEpisode(limits).partitions,sequence=[0,1,1,...parts.map((_,i)=>i).slice(2)];
    const acceptedId=health?'@health':'accepted';
    const provider=await nativeProvider(t,async n=>{
      if(n%2===1)return codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'evidence'}));",`read_${n}`);
      const attempt=n/2-1,ids=[...parts[sequence[attempt]]];
      if(attempt===1)ids.pop();
      return answerItem({schema:'control.review-answer.v2',rowGroups:[{ids,status:'PASS',sourceIds:['evidence']}],
        newFindings:[],resolutions:[]});
    });
    if(health) {
      const git=args=>execFileSync('git',args,{cwd:x.f.root,stdio:'pipe'});
      git(['init','--quiet']);
      git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','baseline']);
    }
    const config={...x.profile.config,evidenceRegistry:sourceFile,...(health?{health:{scope:'Synthetic native health',
      intervalMs:604800000,maxBranches:1,maxWorktrees:2,triggerSourceIds:['evidence'],repairTasks:['maintenance']}}:{})};
    const options={directory:dirs.review,controlRoot:x.privateRoot,sourceFile,reviewer:'reviewer',
      maxCalls:sequence.length,expiresAt:new Date(Date.now()+300000).toISOString(),...limits,
      scope:{host:{directory:dirs['episode-host'],config},requiredSourceIds:['evidence']},
      native:{binary,workspace:dirs.room,home:dirs.home,model:'gpt-6.1-sol',effort:'low',
        timeoutMs:15000,provider:provider.provider}};
    let review=await openModelReview(options);
    const services={...endpointServices,observeReviewRun:id=>review.observe(id)};
    let host=await openControlHost(dirs['episode-host'],config,services);
    await host.initialize();await review.initialize();
    const ref=name=>({path:name+'.md',sha256:sha256(name)});
    for(const name of ['return','artifact','proof','goal',...retentionKinds])await x.f.put(name+'.md',name);
    if(!health)await host.accept({schema:'work.product-acceptance.v1',id:'accepted',project:'synthetic',task:'synthetic-task',
      owner:'owner',executor:'worker',status:'ACCEPTED',acceptedAt:new Date().toISOString(),
      producerReturn:ref('return'),artifact:ref('artifact'),technicalProof:ref('proof'),goal:ref('goal'),
      retention:retentionKinds.map(id=>({id,required:true,expected:ref(id)}))});
    const tick=()=>runControlTick(host,{review:review.review,episode:review.episodeSpec,timeoutMs:16000});
    const row=async()=>{const s=await host.snapshot();return health?s.health:s.acceptances.accepted;};
    assert.equal((await tick()).results[0].action,'REVIEW_EPISODE_DUE');
    const first=await review.observe((await row()).reviewLease.runId);
    assert.equal(first.parts.length,1);assert.equal(first.verdict,undefined);
    const part=first.parts[0],trace=await readFile(path.join(part.journal,part.observation.trace.file));
    assert.equal(sha256(trace),part.observation.trace.sha256);
    assert.equal(part.observation.verdict.rows.length,parts[0].length);
    const pending=await ownerControl(host,'owner').inbox();
    if(health) {
      assert.equal(pending[0].action,'REVIEW_EPISODE_DUE');assert.equal(pending[0].reviewKey,null);
    } else assert.deepEqual(pending,[]);
    await assert.rejects(ownerControl(host,'owner').readVerdict(acceptedId),/NOT_AVAILABLE/);
    assert.deepEqual((await host.snapshot()).grants,{});
    assert.equal((await tick()).results[0].action,'REVIEW_RECONCILIATION_REQUIRED');
    const failed=await review.observe((await row()).reviewLease.runId);
    assert.equal(failed.state,'STOPPED');assert.equal(failed.reason,'MODEL_REVIEW_PART_COVERAGE_INVALID');
    assert.deepEqual(failed.parts[0],part);assert.equal(failed.verdict,undefined);
    assert.equal(provider.requests.length,4);
    review=await openModelReview(options);host=await openControlHost(dirs['episode-host'],config,services);
    assert.equal((await tick()).calls,0);assert.equal(provider.requests.length,4);
    await assert.rejects(host.reconcileReview(acceptedId),/RETRY_DECISION_REQUIRED/);
    await host.reconcileReview(acceptedId,{reviewer:'reviewer',action:'RETRY',
      evidence:'Scripted malformed B independently observed stopped; retry only B, A remains exact.'});
    for(let index=1;index<parts.length;index++) {
      assert.equal((await tick()).results[0].action,index===parts.length-1?'OWNER_DISPOSITION_DUE':'REVIEW_EPISODE_DUE');
      if(index<parts.length-1)assert.equal((await row()).review,null);
    }
    const journal=(await(await openControlStore(dirs.review)).read()).state;
    const final=journal.runs[(await row()).review.runId];
    assert.deepEqual(final.parts[0],part);assert.equal(final.parts.length,parts.length);
    assert.equal((await row()).review.rows.length,87);
    assert.equal(journal.calls,sequence.length);assert.equal((await review.capacity()).remaining,0);
    assert.equal(provider.requests.length,2*sequence.length);
    assert.equal((await ownerControl(host,'owner').inbox())[0].action,'OWNER_DISPOSITION_DUE');
    assert.deepEqual((await host.snapshot()).grants,{});
    t.diagnostic(`${sequence.length} real CLI child attempts; ${2*sequence.length} local scripted responses; zero inference. No semantic or release acceptance.`);
  });
