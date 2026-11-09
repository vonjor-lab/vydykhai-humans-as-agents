import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {measureContextUse} from '../scripts/context-cost.mjs';
const sample = (overrides={}) => ({id:'request-1',role:'execution',model:'qualified-worker',effort:'medium',evidence:'native-request-1',inputTokens:240000,cachedInputTokens:230000,outputTokens:300,...overrides});
const input = () => ({schema:'context.usage.v1',owner:'owner',taskId:'same-task',maxInputTokens:32000,complete:true,unknownCosts:[],samples:[sample()]});
test('small capsule or high cache cannot conceal oversized actual input',()=>{
 const v=input(),before=structuredClone(v),r=measureContextUse(v);
 assert.equal(r.status,'SAFE_BOUNDARY_REFRAME_DUE');assert.equal(r.totals.inputTokens,240000);
 assert.equal(r.totals.cachedInputTokens,230000);assert.equal(r.totals.overBudgetRequests,1);
 assert.equal(r.automaticAction,'NONE');assert.equal(r.quality,'NOT_ASSESSED');assert.deepEqual(v,before);
});
test('compact successor remains same logical task; quality and quota not inferred',()=>{
 const v=input();v.samples=[sample({inputTokens:20000,cachedInputTokens:1000})];
 const r=measureContextUse(v);assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.taskId,'same-task');
 assert.equal(r.coverage,'PARTIAL');assert.equal(r.subscriptionUsage,'UNKNOWN');
});
test('missing telemetry and unknown overhead cannot pass as efficient',()=>{
 const v=input();v.samples=[];assert.equal(measureContextUse(v).status,'INSUFFICIENT_EVIDENCE');
 v.samples=[sample({inputTokens:100,cachedInputTokens:0})];v.unknownCosts=['review tail'];
 assert.equal(measureContextUse(v).coverage,'PARTIAL');v.complete=false;v.unknownCosts=[];
 assert.equal(measureContextUse(v).status,'INSUFFICIENT_EVIDENCE');
});
test('all supplied roles count once and high pressure survives incomplete coverage',()=>{
 const v=input();v.complete=false;v.samples.push(sample({id:'request-2',role:'coordination'}),sample({id:'request-3',role:'review'}));
 const r=measureContextUse(v);assert.equal(r.totals.inputTokens,720000);assert.equal(r.totals.outputTokens,900);
 assert.equal(r.status,'SAFE_BOUNDARY_REFRAME_DUE');assert.equal(r.coverage,'PARTIAL');
});
test('duplicate telemetry, cumulative-shaped fields and invalid quantities rejected',()=>{
 for(const mutate of [v=>v.samples.push(sample()),v=>v.samples[0].cachedInputTokens=250000,v=>v.maxInputTokens=0,
  v=>v.samples[0].inputTokens=-1,v=>v.samples[0].totalSessionTokens=123,v=>v.samples[0].role='__proto__']){
  const v=input();mutate(v);assert.throws(()=>measureContextUse(v),/USAGE_/);
 }
});
test('overflow is rejected rather than silently approximated',()=>{
 const v=input();v.samples=[sample({inputTokens:Number.MAX_SAFE_INTEGER}),sample({id:'second'})];
 assert.throws(()=>measureContextUse(v),/USAGE_OVERFLOW/);
});
test('ordinary measure CLI has no packet, dispatch or write side effects',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'context-usage-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 await writeFile(path.join(cwd,'usage.json'),JSON.stringify(input()));
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/vydykhai.mjs',import.meta.url)),'context-prepare','measure','--input','usage.json'],{cwd,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'SAFE_BOUNDARY_REFRAME_DUE');
 assert.deepEqual(await readdir(cwd),['usage.json']);
});
