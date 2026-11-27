import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,realpath,rm,writeFile,copyFile,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installOpenHook} from '../scripts/project-guard-open.mjs';

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
