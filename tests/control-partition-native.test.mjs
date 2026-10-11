import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {endpointFixture} from './control-endpoint-fixture.mjs';
import {nativeProvider,codeItem,answerItem} from './native-provider-fixture.mjs';
import {openModelReview} from '../scripts/control-model-review.mjs';
import {reviewPartitions} from '../scripts/control-review-partitions.mjs';
import {sha256} from '../scripts/memory-brief.mjs';
import {openControlStore} from '../scripts/control-store.mjs';
const binary=process.env.VYDYKHAI_CODEX_BINARY;
for(const mode of ['complete','missing','drift'])test(`three-part native review ${mode}: all-or-nothing bounded admission`,
  {skip:!binary||process.platform!=='darwin',timeout:60000},async t=>{
    const x=await endpointFixture(t),dirs={};
    for(const name of ['review','room','home']){dirs[name]=path.join(x.privateRoot,name);await mkdir(dirs[name],{mode:0o700});}
    await x.f.put('evidence.md','Protocol evidence, not semantic proof.');
    const sourceFile=path.join(x.privateRoot,'sources.json');
    await writeFile(sourceFile,JSON.stringify({schema:'control.review-sources.v1',workspace:x.f.root,
      sources:[{id:'evidence',path:'evidence.md',purpose:'Native protocol proof'}]}),{mode:0o600});
    const parts=reviewPartitions(3);
    const provider=await nativeProvider(t,async n=>{
      if(n%2===1)return codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'evidence'}));",`read_${n}`);
      const index=n/2-1,ids=[...parts[index]];
      if(mode==='missing'&&index===1)ids.pop();
      if(mode==='drift'&&index===1)await x.f.put('evidence.md','Changed during second part');
      return answerItem({schema:'control.review-answer.v2',rowGroups:[{ids,status:'PASS',sourceIds:['evidence']}],newFindings:[],resolutions:[]});
    });
    const options={directory:dirs.review,controlRoot:x.privateRoot,sourceFile,reviewer:'reviewer',partitionCount:3,
      maxCalls:3,expiresAt:new Date(Date.now()+90000).toISOString(),scope:{requiredSourceIds:['evidence']},
      native:{binary,workspace:dirs.room,home:dirs.home,model:'gpt-6.1-sol',effort:'low',timeoutMs:15000,provider:provider.provider}};
    const review=await openModelReview(options);await review.initialize();
    const offer={phase:'POST_ACCEPT',runId:randomUUID(),key:sha256('fixed-offer'),input:{previousFindings:[]}};
    if(mode==='complete'){
      const verdict=await review.review(offer);assert.equal(verdict.rows.length,87);
      assert.equal(provider.requests.length,6);
      const recovered=await openModelReview(options);assert.deepEqual((await recovered.observe(offer.runId)).verdict,verdict);
    }else{
      await assert.rejects(review.review(offer),mode==='missing'?/PART_COVERAGE_INVALID/:/SOURCE_DRIFT/);
      assert.equal(provider.requests.length,4);
      const stopped=await review.observe(offer.runId);
      assert.equal(stopped.state,'STOPPED');assert.equal(stopped.verdict,undefined);assert.equal(stopped.parts.length,1);
    }
    const state=(await(await openControlStore(dirs.review)).read()).state;
    assert.equal(state.calls,3);assert.equal(state.runs[offer.runId].actualDispatches,mode==='complete'?3:2);
    assert.equal((await review.capacity()).remaining,0);
    await assert.rejects(review.review({...offer,runId:randomUUID()}),/BUDGET_EXHAUSTED/);
    assert.equal(provider.requests.length,mode==='complete'?6:4);
  });
