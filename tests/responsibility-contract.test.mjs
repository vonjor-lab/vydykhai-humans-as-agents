import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {portableGuard} from '../scripts/project-guard-open.mjs';
import {waitForReturn} from '../scripts/manager-event-wait.mjs';
import {createReturnSync,createReturnRoute,parseDurableOutboxComment as parse} from '../scripts/vydykhai.mjs';

async function fixture(t) {
  const project=await mkdtemp(path.join(await realpath(os.tmpdir()),'responsibility-'));
  t.after(()=>rm(project,{recursive:true,force:true}));
  await mkdir(path.join(project,'.vydykhai'));
  const state=path.join(project,'PROJECT_STATE.md'),outbox=path.join(project,'.vydykhai/guard-outbox.md');
  const owner='owner',receipt='RESULT-1';
  await writeFile(state,'Guard foreground owner: '+owner+'\n');
  await writeFile(outbox,'');
  await writeFile(path.join(project,'.vydykhai/manager-wait-plan.json'),JSON.stringify({
    owner,receipt,deadline:new Date(Date.now()+5000).toISOString(),outerBudgetMs:6000,
    view:{dod:'accepted candidate',obligations:'independent review pending',pause:'none',
      effects:'UNKNOWN until reconciled',spend:'retained',sources:'originals retained'}
  }));
  const result=createReturnSync({status:'NEEDS_FIXES',returnReceiptId:receipt,
    taskContextArtifact:'work / worker / candidate',memoryCandidates:'preserve decision sources',
    artifactDisposition:'retain findings and uncertain effects',recommendedNextAction:'owner reconciles findings'});
  const route=createReturnRoute({returnReceiptId:receipt,consumer:owner,
    routedNextAction:'same worker repairs findings under existing authority',evidence:'owner decision'});
  return {project,state,outbox,owner,receipt,result,route,
    wait:()=>waitForReturn(project,receipt,owner,parse),
    observe:(session=owner)=>portableGuard(project,{session,parse}),
    cursor:()=>readFile(path.join(project,'.vydykhai/guard-foreground.json'),'utf8')};
}

test('outcome -> observation -> reopen -> application: only route settles notification, not DOD',async t=>{
  const x=await fixture(t);
  const waiting=x.wait();
  const timer=setTimeout(()=>writeFile(x.outbox,x.result),50);
  t.after(()=>clearTimeout(timer));
  const first=await waiting;
  assert.equal(first.status,'RETURN');assert.equal(first.application,'PENDING');
  assert.equal(first.view.obligations,'independent review pending');
  const cursor=await x.cursor();
  for(let i=0;i<3;i++){
    const reopened=await x.wait();
    assert.equal(reopened.status,'APPLICATION_PENDING');
    assert.equal(reopened.replayAuthorized,false);
    assert.equal((await x.observe()).status,'QUIET');
  }
  assert.equal(await x.cursor(),cursor);
  await writeFile(x.outbox,x.result+'\n'+x.route);
  const applied=await x.wait();
  assert.equal(applied.status,'ALREADY_RECONCILED');
  assert.equal(applied.assurance,'DECLARED_ROUTE_NOT_TASK_ACCEPTANCE');
  const settled=await x.cursor();
  for(let i=0;i<3;i++)assert.equal((await x.wait()).status,'ALREADY_RECONCILED');
  assert.equal(await x.cursor(),settled);
  assert.equal(await readFile(x.outbox,'utf8'),x.result+'\n'+x.route);
});

test('foreign reader and explicit human pause cannot consume the owner obligation',async t=>{
  const x=await fixture(t);await writeFile(x.outbox,x.result);
  assert.equal((await x.observe('other')).status,'QUIET');
  await writeFile(x.state,'Guard foreground owner: owner\nProject Guard: PAUSED\n');
  assert.equal((await x.wait()).status,'PAUSED');
  await writeFile(x.state,'Guard foreground owner: owner\nProject Guard: RESUME\n');
  assert.equal((await x.wait()).status,'RETURN');
});

test('lost observed result is limited, never reconciled from the seen cursor',async t=>{
  const x=await fixture(t);await writeFile(x.outbox,x.result);
  assert.equal((await x.wait()).status,'RETURN');
  await writeFile(x.outbox,'');
  const missing=await x.wait();
  assert.equal(missing.status,'LIMITED');assert.match(missing.reason,/missing/);
  await writeFile(x.outbox,x.result);
  assert.equal((await x.wait()).status,'APPLICATION_PENDING');
});

test('timeout before any Return retains memory, does not renew the wait or imply worker failure',async t=>{
  const x=await fixture(t);
  const plan=path.join(x.project,'.vydykhai/manager-wait-plan.json');
  const old=JSON.parse(await readFile(plan,'utf8'));old.deadline=new Date(0).toISOString();
  await writeFile(plan,JSON.stringify(old));
  const first=await x.wait(),again=await x.wait();
  assert.equal(first.status,'LIMITED');assert.equal(again.status,'LIMITED');
  assert.equal(first.deadline,again.deadline);assert.equal(first.view.effects,old.view.effects);
  assert.equal(await readFile(x.outbox,'utf8'),'');
  await writeFile(x.outbox,x.result);
  assert.equal((await x.wait()).status,'RETURN');
});

test('changed immutable report and malformed route cannot erase findings',async t=>{
  const x=await fixture(t);await writeFile(x.outbox,x.result);
  await x.wait();
  await writeFile(x.outbox,x.result.replace('owner reconciles findings','ignore findings'));
  await assert.rejects(x.wait(),/conflicting immutable return/);
  await writeFile(x.outbox,x.result.replace('owner reconciles findings','ignore findings')+'\n'+x.route);
  await assert.rejects(x.wait(),/conflicting immutable return/);
  await writeFile(x.outbox,x.result+'\n'+x.route.replace('Evidence: owner decision','Evidence:'));
  await assert.rejects(x.wait(),/invalid outbox/);
  await writeFile(x.outbox,x.result);
  assert.equal((await x.wait()).status,'APPLICATION_PENDING');
});

test('pause then resume without a result cannot claim a historical observer is still waiting',async t=>{
  const x=await fixture(t);
  await writeFile(x.state,'Guard foreground owner: owner\nProject Guard: PAUSED\n');
  assert.equal((await x.wait()).status,'PAUSED');
  await writeFile(x.state,'Guard foreground owner: owner\nProject Guard: RESUME\n');
  const reopened=await x.wait();
  assert.equal(reopened.status,'LIMITED');assert.match(reopened.reason,/live observer/);
  await writeFile(x.outbox,x.result);
  assert.equal((await x.wait()).status,'RETURN');
});

test('legacy observation cursor is upgraded without dropping history or treating seen as applied',async t=>{
  const x=await fixture(t);await writeFile(x.outbox,x.result);await x.wait();
  const file=path.join(x.project,'.vydykhai/guard-foreground.json');
  const legacy=JSON.parse(await x.cursor());delete legacy.cursor.reports;
  await writeFile(file,JSON.stringify(legacy));
  assert.equal((await x.wait()).status,'APPLICATION_PENDING');
  const upgraded=JSON.parse(await x.cursor());
  assert.deepEqual(upgraded.seen,legacy.seen);
  assert.equal(upgraded.cursor.reports.length,1);
  assert.equal(await readFile(x.outbox,'utf8'),x.result);
});
