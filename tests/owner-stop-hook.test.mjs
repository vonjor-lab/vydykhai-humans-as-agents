import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,realpath,rm,writeFile,copyFile,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installOpenHook,foregroundState,portableGuard} from '../scripts/project-guard-open.mjs';
import {readProductionContinuation as readContinuation} from '../scripts/vydykhai.mjs';

const session='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',owner='codex://threads/'+session;
async function project(t){
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),'owner-stop-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
test('installed callback uses fresh owner progress once, without granting authority or consuming Returns',async t=>{
  const root=await project(t),dir=path.join(root,'scripts'),hook=path.join(dir,'project-guard-hook.mjs');
  await mkdir(dir);
  await copyFile(new URL('../scripts/project-guard-hook.mjs',import.meta.url),hook);
  for(const name of ['project-guard-open.mjs','vydykhai.mjs']){
    await symlink(fileURLToPath(new URL('../scripts/'+name,import.meta.url)),path.join(dir,name));
  }
  function invoke(kind,overrides={}){
    const run=spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({
      cwd:root,session_id:session,turn_id:'turn',hook_event_name:kind,stop_hook_active:false,...overrides})});
    assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout.trim()||'{}');
  }
  async function state(id,{status='READY',guard='ACTIVE',attention='NONE',lease='PREPARED',work='A',
    action=id==='before'?'Verify saved copy':'Route next eligible group',evidence=id==='before'?'accepted task':'saved comparison'}={}){
    const next={schemaVersion:1,id,work,action,owner,state:status,evidence,resumeWhen:'review returns'};
    await writeFile(path.join(root,'PROJECT_STATE.md'),[
      'Orchestrator health: HEALTHY | Context: '+owner+' | Profile: selected','Project Guard: '+guard,'Human attention: '+attention,
      '## Execution Leases','| Work | State | Owner / context |','| --- | --- | --- |',
      '| '+work+' | '+lease+' | executor |','## Pending Return Inbox','## Next-Best-Action','```json',
      JSON.stringify(next),'```','<!-- vydykhai:project-state:end -->'].join('\n'));
  }
  await state('before');invoke('UserPromptSubmit');await state('after');
  assert.deepEqual(invoke('Stop',{session_id:'foreign'}),{});
  assert.deepEqual(invoke('Stop',{turn_id:'old'}),{});
  assert.equal(invoke('Stop').decision,'block');
  assert.deepEqual(invoke('Stop'),{});
  for(const [opts,event] of [[{}, {stop_hook_active:true}],[{status:'WAITING'},{}],
    [{attention:'PENDING'},{}],[{attention:'NONE; awaiting approval'},{}],
    [{action:' VERIFY  SAVED COPY '},{}],[{evidence:'accepted task'},{}],
    [{work:'B'},{}],[{lease:'OUTCOME_UNKNOWN'},{}],
    [{lease:'WORKING'},{}],[{guard:'PAUSED'},{}]]){
    await state('before');invoke('UserPromptSubmit');await state('after',opts);
    assert.deepEqual(invoke('Stop',event),{});
  }
  await state('unchanged',{guard:'RESUME'});invoke('UserPromptSubmit');
  assert.deepEqual(invoke('Stop'),{});
});

test('fresh hook and exact previous kit config include Stop; custom hooks are preserved',async t=>{
  const root=await project(t),file=path.join(root,'.codex/hooks.json');
  await installOpenHook(root);
  const current=JSON.parse(await readFile(file));
  assert.deepEqual(current.hooks.Stop,current.hooks.UserPromptSubmit);
  const old=structuredClone(current);delete old.hooks.Stop;
  await writeFile(file,JSON.stringify(old));await installOpenHook(root);
  assert.deepEqual(JSON.parse(await readFile(file)),current);
  old.hooks.Stop=[];const custom=JSON.stringify(old);
  await writeFile(file,custom);assert.match(await installOpenHook(root),/LIMITED/);
  assert.equal(await readFile(file,'utf8'),custom);
});

test('Stop and activation use the same live issue, not stale local State; unavailable or conflicting sources cannot wake',async t=>{
  const root=await project(t),url='https://github.com/example/project/issues/9';
  await mkdir(path.join(root,'.vydykhai'));
  let id='before',phase='READY',available=true,reads=0,extraOwner='';
  const fetchState=async()=>{
    reads++;
    if(!available)throw Error('unavailable');
    return ['Orchestrator health: HEALTHY | Context: '+owner+' | Profile: selected',extraOwner,'Human attention: NONE',
      '## Execution Leases','| Work | State | Owner / context |','| --- | --- | --- |','| W | PREPARED | executor |',
      '## Pending Return Inbox','## Next-Best-Action','```json',JSON.stringify({schemaVersion:1,work:'W',owner,id,state:phase,
        resumeWhen:'real gate',action:'authorized step '+id,evidence:'source '+id}),'```','<!-- vydykhai:project-state:end -->'].join('\n');
  };
  const options={session,readContinuation,fetchState};
  await assert.rejects(foregroundState(root,{...options,url}),/Stop is not installed/);
  await installOpenHook(root);
  await writeFile(path.join(root,'PROJECT_STATE.md'),'stale copy');
  assert.equal((await foregroundState(root,{...options,url})).lastObservedStop,null);
  await assert.rejects(foregroundState(root,{...options,url:url+'0'}),/conflict/);
  const fire=(kind,extra={})=>portableGuard(root,{...options,event:{hook_event_name:kind,turn_id:'turn',stop_hook_active:false},...extra});
  await fire('UserPromptSubmit');id='next';const n=reads;
  await fire('Stop',{session:'unrelated'});assert.equal(reads,n);
  assert.equal((await fire('Stop')).status,'OWNER_STEP_READY');
  const result=await foregroundState(root,options);
  assert.equal(result.lastObservedStop.sourceSha256,result.sourceSha256);
  await fire('UserPromptSubmit');id='gate';phase='WAITING';
  assert.equal((await fire('Stop')).status,'QUIET');
  assert.equal((await foregroundState(root,options)).lastObservedStop.state,'WAITING');
  phase='READY';id='fresh';await fire('UserPromptSubmit');
  available=false;await assert.rejects(fire('Stop'),/unavailable/);
  available=true;id='after-recovery';assert.equal((await fire('Stop')).status,'QUIET');
  await fire('UserPromptSubmit');id='ambiguous';extraOwner='Guard foreground owner: '+session+'\nGuard foreground owner: other';
  await assert.rejects(foregroundState(root,options),/unresolved/);
  assert.equal((await fire('Stop')).status,'LIMITED');
  assert.equal((await portableGuard(root,{...options,receipt:'r',bindingOnly:true})).status,'LIMITED');
  const explicitOnly=async()=> (await fetchState()).replace(/^Orchestrator health:.*$/m,'').replace('Guard foreground owner: other','');
  assert.equal((await portableGuard(root,{...options,fetchState:explicitOnly,receipt:'r',bindingOnly:true})).status,'LIMITED');
  extraOwner='';assert.equal((await fire('Stop')).status,'QUIET');
  id='newer';assert.equal((await foregroundState(root,options)).callbackEvidence,'LOCAL_RECORD_HISTORICAL');
  await fire('UserPromptSubmit');await rm(path.join(root,'.vydykhai/guard-state-source.json'));
  await foregroundState(root,{...options,url});id='changed after re-enrollment';
  assert.equal((await fire('Stop')).status,'QUIET');
});
