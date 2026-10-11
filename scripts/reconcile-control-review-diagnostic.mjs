// Maintainer-only recovery of diagnostic evidence. Never writes a host journal,
// refunds its budget, repairs a project, or grants execution authority.
import {readFile,writeFile,mkdir,realpath,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalJson,sha256} from './memory-brief.mjs';
import {openControlStore} from './control-store.mjs';
import {openReviewSources} from './control-review-sources.mjs';
import {observeRepositoryHealth} from './control-repo-observation.mjs';
import {inspectControlRuntime,loadControlRuntime} from './control-runtime.mjs';
import {controlCatalog} from './control-catalog.mjs';
import {modelReviewPrompt} from './control-model-review.mjs';
import {reviewPartitions,validateReviewPart,mergeReviewParts} from './control-review-partitions.mjs';
import {decodeReviewAnswer} from './control-review-wire.mjs';
import {validateControlFindings} from './control-findings.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const save=(f,v)=>writeFile(f,canonicalJson(v)+'\n',{flag:'wx',mode:0o600});

export function recoverDiagnosticPart(trace,observation,ids,offer,snapshot) {
  need(observation.state==='STOPPED'&&observation.code===0&&!observation.signal,
    'RECOVERY_TRANSPORT_INCOMPLETE');
  need(sha256(trace.output)===observation.outputSha256,'RECOVERY_OUTPUT_CHANGED');
  const events=trace.output.trim().split('\n').filter(Boolean).map(JSON.parse);
  const turns=events.filter(e=>e.type==='turn.completed');
  need(turns.length===1&&!events.some(e=>e.type==='turn.failed'),'RECOVERY_TURN_INCOMPLETE');
  const reads=events.filter(e=>e.type==='item.completed'&&e.item?.type==='mcp_tool_call'&&
    e.item.server==='vydykhai_review'&&e.item.tool==='read_source'&&e.item.status==='completed'&&!e.item.result?.isError)
    .flatMap(e=>e.item.result?.content??[]).filter(c=>c.type==='text').map(c=>JSON.parse(c.text));
  need(snapshot.rows.every(s=>reads.some(r=>r.id===s.id&&r.status===s.status&&r.sha256===s.sha256))&&
    reads.every(r=>snapshot.rows.some(s=>s.id===r.id&&s.status===r.status&&s.sha256===r.sha256)),
    'RECOVERY_SOURCE_UNREAD_OR_CHANGED');
  const answer=JSON.parse(events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message').at(-1)?.item.text);
  const decoded=validateReviewPart(answer,ids,{readbacks:reads,offer,reviewer:'reviewer',observedAt:observation.finishedAt});
  return {answer,readbacks:reads.map(({id,status,sha256})=>({id,status,sha256})),
    rows:decoded.rows.length,findings:decoded.findings.length,usage:turns[0].usage??null,
    observedAt:observation.finishedAt,timing:trace.timing??null};
}

async function originalContext(original) {
  const setup=await json(path.join(original,'setup.json'));
  need(setup.schema==='qualification.adoption-setup.v1'&&setup.profile.review.partitionCount===3,
    'RECOVERY_SYNTHETIC_PARTITION_FIXTURE_REQUIRED');
  const journal=await(await openControlStore(setup.profile.review.directory)).read();
  const runs=Object.values(journal.state.runs);
  need(runs.length===1,'RECOVERY_SINGLE_ORIGINAL_REQUIRED');
  const run=runs[0];
  need(run.state==='STOPPED'&&run.actualDispatches===2&&run.completedParts===1&&
    run.reason==='MISSING_REASON:C02.03'&&!run.verdict,'RECOVERY_NOT_EXPECTED_FORMAT_FAILURE');
  const source=await openReviewSources(setup.profile.review.sourceFile),snapshot=await source.snapshot();
  need(snapshot.digest===run.sourceDigest&&snapshot.digest===setup.frozenSources.digest,
    'RECOVERY_SOURCE_CHANGED');
  need(sha256(await readFile(setup.profile.review.sourceFile))===setup.registrySha256,'RECOVERY_REGISTRY_CHANGED');
  const {observedAt,...repositoryFacts}=await observeRepositoryHealth(setup.workspace);
  const plan=setup.profile.config.health;
  const trigger=hash({sources:snapshot.rows.filter(r=>plan.triggerSourceIds.includes(r.id)),
    repository:repositoryFacts.status!=='OBSERVED'?'LIMITED':{
      branches:repositoryFacts.branchCount>plan.maxBranches?repositoryFacts.branches.map(({name})=>name):null,
      worktrees:repositoryFacts.worktreeCount>plan.maxWorktrees?repositoryFacts.worktrees.map(({path,branch,detached})=>({path,branch,detached})):null}});
  // The old journal stored only the offer hash. Recover its original host state
  // from append-only history and require exact hash identity, never a rebase.
  await(await openControlStore(setup.profile.directory)).read();
  const names=(await readdir(setup.profile.directory)).filter(n=>/^\d{10}\.json$/.test(n)).sort();
  let offer;
  for(const name of names){
    const {state}=await json(path.join(setup.profile.directory,name));
    if(state.health.enrollment!=='REVIEW_IN_FLIGHT'||state.health.reviewLease?.runId!==run.runId)continue;
    const input={policy:setup.profile.config.policy,scope:plan.scope,previousFindings:state.health.findings,
      sourceEvidence:snapshot,repository:repositoryFacts,trigger};
    const candidate={runId:run.runId,key:hash(input),phase:'HEALTH',input,
      stateRevision:hash({health:state.health,paused:state.paused})};
    if(hash(candidate)===run.offerSha256)offer=candidate;
  }
  need(offer&&offer.key===run.offerKey,'RECOVERY_ORIGINAL_OFFER_NOT_REPRODUCIBLE');
  const parts=reviewPartitions(3),retained=[];
  for(let index=0;index<2;index++){
    const observation=index===0?run.parts[0].observation:run.failedPart;
    const file=path.join(setup.profile.review.directory,`${run.runId}-part-${index}`,observation.trace.file);
    const bytes=await readFile(file);need(sha256(bytes)===observation.trace.sha256,'RECOVERY_TRACE_CHANGED');
    retained.push(recoverDiagnosticPart(JSON.parse(bytes),observation,parts[index],offer,snapshot));
  }
  return {setup,journal,run,snapshot,offer,retained};
}

export async function stageDiagnosticRecovery(original,output) {
  original=await realpath(original);
  const context=await originalContext(original),{offer,retained,setup,journal,snapshot}=context;
  await mkdir(output,{mode:0o700});const root=await realpath(output);
  const ids=reviewPartitions(3)[2];
  const prompt=modelReviewPrompt(offer,{...setup.profile.review.scope,reviewer:'reviewer',now:new Date().toISOString()},ids);
  await writeFile(path.join(root,'prompt.txt'),prompt,{flag:'wx',mode:0o600});
  await writeFile(path.join(root,'sources.json'),await readFile(setup.profile.review.sourceFile),{flag:'wx',mode:0o600});
  await save(path.join(root,'retained.json'),{offer,retained});
  const allocation={schema:'diagnostic.recovery-allocation.v1',original,journalDigest:journal.digest,
    originalSetupSha256:sha256(await readFile(path.join(original,'setup.json'))),
    originalFailureSha256:sha256(await readFile(path.join(original,'failed-result.json'))),
    offerSha256:hash(offer),retainedSha256:hash({offer,retained}),sourceDigest:snapshot.digest,
    catalogSha256:hash(controlCatalog),normalizerRuntime:(await inspectControlRuntime(repository)).digest,
    harnessSha256:sha256(await readFile(fileURLToPath(import.meta.url))),
    originalRuntime:setup.activation.runtime.digest,promptSha256:sha256(prompt),ids,
    maxNewCalls:1,timeoutMs:90000,retries:0,model:'gpt-6.1-sol',effort:'low',
    budget:'NEW_DIAGNOSTIC_ALLOCATION_NO_REFUND_OF_ORIGINAL_SLOTS',authority:'NONE',release:'NO_RELEASE'};
  await save(path.join(root,'allocation.json'),allocation);
  return {root,retainedCriteria:retained.reduce((s,r)=>s+r.rows,0),missingCriteria:ids.length,maxNewCalls:1,authority:'NONE'};
}

export async function runDiagnosticRecovery(output) {
  const root=await realpath(output),a=await json(path.join(root,'allocation.json'));
  await save(path.join(root,'intent.json'),{allocationSha256:hash(a),maxNewCalls:1,retries:0,authority:'NONE'});
  let actualNewCalls=0,result;
  try {
    need(a.maxNewCalls===1&&a.timeoutMs===90000&&a.model==='gpt-6.1-sol'&&a.effort==='low'&&a.authority==='NONE',
      'RECOVERY_ALLOCATION_INVALID');
    need(a.harnessSha256===sha256(await readFile(fileURLToPath(import.meta.url)))&&
      a.catalogSha256===hash(controlCatalog)&&a.normalizerRuntime===(await inspectControlRuntime(repository)).digest,
      'RECOVERY_IMPLEMENTATION_CHANGED');
    const verifyOriginal=async()=>{
      const c=await originalContext(a.original);
      need(c.journal.digest===a.journalDigest&&hash(c.offer)===a.offerSha256&&c.snapshot.digest===a.sourceDigest&&
        a.originalSetupSha256===sha256(await readFile(path.join(a.original,'setup.json')))&&
        a.originalFailureSha256===sha256(await readFile(path.join(a.original,'failed-result.json'))),
        'RECOVERY_ORIGINAL_CHANGED');
      return c;
    };
    const c=await verifyOriginal(),saved=await json(path.join(root,'retained.json'));
    need(hash(saved)===a.retainedSha256&&hash(saved)===hash({offer:c.offer,retained:c.retained})&&
      hash(a.ids)===hash(reviewPartitions(3)[2]),'RECOVERY_RETAINED_CHANGED');
    const prompt=await readFile(path.join(root,'prompt.txt'),'utf8');
    need(sha256(prompt)===a.promptSha256,'RECOVERY_PROMPT_CHANGED');
    const endpointFile=path.join(root,'sources.json');
    need(sha256(await readFile(endpointFile))===c.setup.registrySha256,'RECOVERY_REGISTRY_CHANGED');
    const runtime=await loadControlRuntime({packageRoot:c.setup.activation.runtime.root,
      expectedDigest:a.originalRuntime,workspace:c.setup.workspace});
    const home=path.join(root,'home'),workspace=path.join(root,'room');
    await mkdir(home,{mode:0o700});await mkdir(workspace,{mode:0o700});
    actualNewCalls++;
    const trace=await runtime.worker.runControlledWorker({binary:c.setup.binary,authHome:c.setup.authHome,
      home,workspace,endpointFile,role:'review',prompt,
      model:a.model,effort:a.effort,timeoutMs:a.timeoutMs});
    await save(path.join(root,'trace.json'),trace);
    const observedAt=new Date().toISOString();
    need(trace.status==='CLI_EXIT_OK','RECOVERY_TRANSPORT_INCOMPLETE');
    const last=recoverDiagnosticPart(trace,{state:'STOPPED',code:trace.code,signal:trace.signal,
      outputSha256:sha256(trace.output),finishedAt:observedAt},a.ids,c.offer,c.snapshot);
    await verifyOriginal();
    const all=[...c.retained,last],raw=mergeReviewParts(all.map(p=>p.answer),reviewPartitions(3));
    const decoded=decodeReviewAnswer(raw,{readbacks:all.flatMap(p=>p.readbacks),offer:c.offer,reviewer:'reviewer',observedAt});
    need(!validateControlFindings({review:{...decoded,reviewer:'reviewer'},previousFindings:c.offer.input.previousFindings,key:c.offer.key}),
      'RECOVERY_GLOBAL_REVIEW_INVALID');
    result={status:'COMPLETE_DIAGNOSTIC_NOT_HOST_ACCEPTANCE',originalStatus:'FAILED_UNCHANGED',
      parts:all,decoded,offerSha256:a.offerSha256,originalJournalDigest:a.journalDigest};
  }catch(error){result={status:'DIAGNOSTIC_RECOVERY_FAILED',reason:error.message};}
  result={...result,actualNewCalls,authority:'NONE',release:'NO_RELEASE'};
  await save(path.join(root,'result.json'),result);return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const [mode,first,second]=process.argv.slice(2);
  const result=mode==='stage'?await stageDiagnosticRecovery(first,second):mode==='run'?await runDiagnosticRecovery(first):null;
  need(result,'EXPECTED_STAGE_OR_RUN');
  console.log(JSON.stringify({status:result.status??'STAGED',reason:result.reason,root:result.root,
    actualNewCalls:result.actualNewCalls,criteria:result.decoded?.rows.length,findings:result.decoded?.findings.length,
    authority:result.authority},null,2));
}
