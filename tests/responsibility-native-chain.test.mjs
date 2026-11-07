import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runControlChild} from '../scripts/control-child.mjs';
import {portableGuard} from '../scripts/project-guard-open.mjs';
import {waitForReturn} from '../scripts/manager-event-wait.mjs';
import {createReturnSync,createReturnRoute,parseDurableOutboxComment as parse,
  evaluateProductionContinuation,readProductionContinuation} from '../scripts/vydykhai.mjs';

// Finite isolated owner fixture, not a production dispatcher or model simulator.
// Native process close delivers the stop while the owner remains in bounded await.
const worker = `
import fs from 'node:fs';
const checkpoint=JSON.parse(fs.readFileSync('checkpoint.json','utf8'));
const mode=process.argv[1];
fs.appendFileSync('actions.log',mode+'\\n');
if(mode==='initial'){
  checkpoint.completed=['A'];checkpoint.remaining=['B'];
  fs.writeFileSync('checkpoint.json',JSON.stringify(checkpoint));
  fs.writeFileSync('A.txt','retained A');
  process.kill(process.pid,'SIGTERM');
}else{
  if(JSON.stringify(checkpoint.completed)!=='["A"]'||fs.readFileSync('A.txt','utf8')!=='retained A')
    throw Error('checkpoint missing or completed work repeated');
  fs.writeFileSync('B.txt','remaining B');
  checkpoint.completed.push('B');checkpoint.remaining=[];
  fs.writeFileSync('checkpoint.json',JSON.stringify(checkpoint));
}
`;
const reviewer = `
import fs from 'node:fs';
const c=JSON.parse(fs.readFileSync('checkpoint.json','utf8'));
if(fs.readFileSync('A.txt','utf8')!=='retained A'||fs.readFileSync('B.txt','utf8')!=='remaining B'||
  fs.readFileSync('actions.log','utf8')!=='initial\\nresume\\n'||
  c.work!=='WORK-1'||c.owner!=='worker'||c.remaining.length||
  c.memory!=='original rationale retained'||c.review!=='required')
  throw Error('independent fixture acceptance failed');
console.log('PASS');
`;
function state() {
  const next={schemaVersion:1,id:'NEXT-1',work:'WORK-1',action:'Finish retained outcome',
    owner:'worker',state:'WORKING',evidence:'checkpoint.json'};
  return 'Orchestrator health: HEALTHY | Context: manager | Profile: maximum\n'+
    'Project Guard: ACTIVE | Incident: none\nHuman attention: NONE\n'+
    '## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n'+
    '| WORK-1 [GOAL] - retained outcome | WORKING | worker |\n'+
    '## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n'+
    '<!-- vydykhai:project-state:end -->';
}

async function scenario(t,{pause=false,unknown=false}={}) {
  const root=await mkdtemp(path.join(await realpath(os.tmpdir()),'native-responsibility-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'.vydykhai'));
  await writeFile(path.join(root,'checkpoint.json'),JSON.stringify({
    work:'WORK-1',owner:'worker',completed:[],remaining:['A','B'],
    memory:'original rationale retained',review:'required'
  }));
  const events=[],receipts=[];let starts=0;
  const run=async(program,args=[])=>{
    starts++;
    const r=await runControlChild({executable:process.execPath,
      args:['--input-type=module','-e',program,...args],cwd:root,
      env:{PATH:process.env.PATH},input:'',timeoutMs:5000,maxBytes:8192});
    receipts.push(r);return r;
  };
  const stop=await run(worker,['initial']);
  events.push('NATIVE_STOP_DELIVERED');
  assert.equal(stop.state,'CLOSED');assert.equal(stop.signal,'SIGTERM');
  assert.equal(stop.code,null);assert.equal(stop.reason,null);
  await writeFile(path.join(root,'native-stop.json'),JSON.stringify(stop));
  const current=state();
  const decision=evaluateProductionContinuation(current,{
    schemaVersion:1,continuationKey:readProductionContinuation(current).key,
    observedAt:new Date().toISOString(),
    orchestrator:{context:'manager',status:'ACTIVE',evidence:'bounded owner still running'},
    owner:{context:'worker',status:'IDLE',evidence:'native-stop.json',turnId:'attempt-1',
      terminal:{turnId:'attempt-1',status:'UNAVAILABLE',evidence:'native-stop.json'}}
  });
  assert.equal(decision.nextAction,'RECOVER_OBSERVATION');
  // This fixture's known fault and complete allowed write set are reconciled,
  // not inferred from SIGTERM. In production these remain owner decisions.
  const checkpoint=JSON.parse(await readFile(path.join(root,'checkpoint.json'),'utf8'));
  assert.deepEqual(checkpoint.completed,['A']);
  assert.equal(await readFile(path.join(root,'A.txt'),'utf8'),'retained A');
  events.push('CHECKPOINT_READ');
  if(pause||unknown){
    events.push(pause?'HUMAN_PAUSE_HELD':'UNKNOWN_EFFECTS_HELD');
    assert.equal(starts,1);
    assert.equal(await readFile(path.join(root,'actions.log'),'utf8'),'initial\n');
    return {events,starts,status:pause?'PAUSED':'OUTCOME_UNKNOWN'};
  }
  events.push('FIXTURE_EFFECTS_RECONCILED');
  assert.equal((await run(worker,['resume'])).code,0);
  events.push('REMAINING_WORK_COMPLETED');
  const review=await run(reviewer);
  assert.equal(review.code,0);assert.equal(review.output.trim(),'PASS');
  events.push('SEPARATE_PROCESS_REVIEW_PASS');
  await writeFile(path.join(root,'PROJECT_STATE.md'),'Guard foreground owner: manager\n');
  const outbox=path.join(root,'.vydykhai/guard-outbox.md');
  const result=createReturnSync({status:'CHECKPOINT_READY',returnReceiptId:'RESULT-1',
    taskContextArtifact:'WORK-1 / checkpoint.json',memoryCandidates:'original rationale retained',
    artifactDisposition:'separate process review receipt retained',recommendedNextAction:'accept exact fixture outcome'});
  await writeFile(outbox,result);
  await writeFile(path.join(root,'.vydykhai/manager-wait-plan.json'),JSON.stringify({
    owner:'manager',receipt:'RESULT-1',deadline:new Date(Date.now()+5000).toISOString(),
    outerBudgetMs:6000,view:{dod:'A+B verified',obligations:'apply independent fixture verdict',
      pause:'none',effects:'fixture writes reconciled',spend:'three local processes; no models',sources:'checkpoint'}
  }));
  const wait=()=>waitForReturn(root,'RESULT-1','manager',parse);
  assert.equal((await wait()).status,'RETURN');
  assert.equal((await wait()).status,'APPLICATION_PENDING');
  events.push('OUTCOME_OBSERVED_NOT_YET_APPLIED');
  await writeFile(outbox,result+'\n'+createReturnRoute({returnReceiptId:'RESULT-1',
    consumer:'manager',routedNextAction:'fixture accepted; no outstanding fixture work',
    evidence:'separate process PASS and exact retained checkpoint'}));
  assert.equal((await wait()).status,'ALREADY_RECONCILED');
  events.push('OUTCOME_APPLIED');
  const cursor=await readFile(path.join(root,'.vydykhai/guard-foreground.json'),'utf8');
  for(let i=0;i<3;i++)assert.equal((await portableGuard(root,{session:'manager',parse})).status,'QUIET');
  assert.equal(await readFile(path.join(root,'.vydykhai/guard-foreground.json'),'utf8'),cursor);
  assert.equal(starts,3);
  assert.equal(await readFile(path.join(root,'actions.log'),'utf8'),'initial\nresume\n');
  assert.equal(receipts.length,3);
  events.push('QUIET_NO_RESTART');
  return {events,starts,status:'BOUNDED_LOCAL_CHAIN_VERIFIED',modelCalls:0,
    assurance:'REAL_LOCAL_PROCESSES_NOT_DESKTOP_CHAT_WAKEUP'};
}

test('real interruption is delivered through existing bounded wait and finite owner applies remaining work without user input',
  {skip:process.platform==='win32'},async t=>{
    const result=await scenario(t);
    assert.equal(result.status,'BOUNDED_LOCAL_CHAIN_VERIFIED');
    t.diagnostic(JSON.stringify(result));
  });
test('same native interruption does not override human pause',{skip:process.platform==='win32'},async t=>{
  assert.equal((await scenario(t,{pause:true})).status,'PAUSED');
});
test('same native interruption does not replay uncertain effects',{skip:process.platform==='win32'},async t=>{
  assert.equal((await scenario(t,{unknown:true})).status,'OUTCOME_UNKNOWN');
});
