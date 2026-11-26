import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,realpath,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareNativeWait,waitForReturn} from '../scripts/manager-event-wait.mjs';
import {waitClaimName} from '../scripts/project-guard-open.mjs';

const now=Date.UTC(2026,0,1);
const owner='manager',receipt='RETURN-1',targets=['worker-a','worker-b'];
async function fixture(t,overrides={}){
  const project=await mkdtemp(path.join(await realpath(os.tmpdir()),'native-wait-'));
  t.after(()=>rm(project,{recursive:true,force:true}));
  const dir=path.join(project,'.vydykhai');
  await mkdir(dir);
  const state=flag=>writeFile(path.join(project,'PROJECT_STATE.md'),
    'Guard foreground owner: '+owner+'\n'+(flag?'Project Guard: '+flag+'\n':''));
  await state();
  const plan={owner,receipt,targets,deadline:new Date(now+120000).toISOString(),outerBudgetMs:120500,
    view:{dod:'fixture',obligations:'',pause:'',effects:'',spend:'',sources:''},...overrides};
  const publish=()=>writeFile(path.join(dir,'manager-wait-plan.json'),JSON.stringify(plan));
  await publish();
  return {project,state,plan,publish,claim:path.join(dir,waitClaimName(owner,receipt)),
    prepare:(ids=targets)=>prepareNativeWait(project,receipt,owner,ids)};
}

test('uses the live deadline and honors the outer reserve and maximum',async t=>{
  const clock=t.mock.method(Date,'now',()=>now);
  const x=await fixture(t);
  clock.mock.mockImplementation(()=>now+250);
  assert.deepEqual(await x.prepare([...targets].reverse()),
    {status:'PASS',waitArgs:{targets,timeout_ms:119750}});
  clock.mock.mockImplementation(()=>now);
  for(const [remaining,outerBudgetMs] of [[0,1500],[1000,1499],[900001,901000]]){
    const y=await fixture(t,{deadline:new Date(now+remaining).toISOString(),outerBudgetMs});
    const result=await y.prepare();
    assert.equal(result.status,'LIMITED');
    assert.match(result.reason,/bound/);
    y.plan.deadline=new Date(now+1).toISOString();
    await y.publish();
    assert.match((await y.prepare()).reason,/existing wait claim/);
  }
  const max=await fixture(t,{deadline:new Date(now+900000).toISOString(),outerBudgetMs:900500});
  assert.equal((await max.prepare()).waitArgs.timeout_ms,900000);
});

test('concurrent native admissions share the immutable claim with file wait',async t=>{
  const x=await fixture(t);
  t.mock.method(Date,'now',()=>now);
  const results=await Promise.all([x.prepare(),x.prepare()]);
  assert.deepEqual(results.map(r=>r.status).sort(),['LIMITED','PASS']);
  const original=await readFile(x.claim,'utf8');
  assert.deepEqual(JSON.parse(original).targets,targets);
  const parse=()=>({issues:[],returns:[],pendingReturnIds:[],routedReturnIds:[],routes:[]});
  const file=await waitForReturn(x.project,receipt,owner,parse);
  assert.match(file.reason,/live observer/);
  assert.equal(await readFile(x.claim,'utf8'),original);
  const y=await fixture(t,{deadline:new Date(now).toISOString()});
  assert.equal((await waitForReturn(y.project,receipt,owner,parse)).status,'LIMITED');
  y.plan.deadline=x.plan.deadline;
  await y.publish();
  assert.match((await y.prepare()).reason,/existing wait claim/);
});

test('pause and unbound owner do not grant a native wait',async t=>{
  t.mock.method(Date,'now',()=>now);
  const x=await fixture(t);
  await x.state('PAUSED');
  assert.deepEqual(await x.prepare(),{status:'PAUSED'});
  await x.state('RESUME');
  assert.match((await x.prepare()).reason,/existing wait claim/);
  const y=await fixture(t);
  await writeFile(path.join(y.project,'PROJECT_STATE.md'),'Guard foreground owner: other\n');
  assert.deepEqual(await y.prepare(),{status:'LIMITED',reason:'wait owner is not bound'});
});

test('missing, substituted, extra, or duplicate targets grant nothing',async t=>{
  t.mock.method(Date,'now',()=>now);
  const x=await fixture(t);
  for(const ids of [null,[],['worker-a'],['worker-a','foreign'],[...targets,'foreign'],['worker-a','worker-a']]){
    assert.match((await x.prepare(ids)).reason,/targets/);
  }
  for(const intended of [undefined,[],['worker-a','worker-a']]){
    x.plan.targets=intended;
    await x.publish();
    assert.match((await x.prepare()).reason,/targets/);
  }
  await assert.rejects(readFile(x.claim),{code:'ENOENT'});
  x.plan.targets=targets;
  await x.publish();
  assert.equal((await x.prepare()).status,'PASS');
});
