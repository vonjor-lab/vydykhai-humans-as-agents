// Synchronous host callbacks use only the installed project. No scheduler or model.
import {lstat,realpath,readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const run=promisify(execFile), sourceFile='.vydykhai/guard-state-source.json';
const sessionId=s=>typeof s==='string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(s);
const issuePath=url=>typeof url==='string' && /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/([1-9]\d*)$/.exec(url);

async function githubState(project,binding){
  const match=issuePath(binding.url);
  if(!match || !sessionId(binding.session) || match[1].split('/').some(x=>x==='.' || x==='..'))throw Error('invalid State locator');
  const options={cwd:project,timeout:5000,maxBuffer:2*1024*1024};
  try{
    const remote=(await run('git',['remote','get-url','origin'],options)).stdout.trim().replace(/\.git$/i,'').toLowerCase();
    if(!['https://github.com/','git@github.com:','ssh://git@github.com/'].some(prefix=>remote===prefix+match[1].toLowerCase()))throw Error();
    const {stdout}=await run('gh',['api','--hostname','github.com','--method','GET','repos/'+match[1]+'/issues/'+match[2]],options);
    const issue=JSON.parse(stdout);
    if(issue.pull_request || issue.state!=='open' || issue.html_url.toLowerCase()!==binding.url.toLowerCase() ||
        typeof issue.body!=='string' || !issue.body.trim())throw Error();
    return issue.body.replaceAll('\r\n','\n');
  }catch{throw Error('authoritative GitHub State unavailable or identity mismatch; no cached fallback');}
}
function routeOwner(route){
  const lines=route.match(/^Orchestrator health:.*$/gm)||[];
  const declarations=route.match(/^Guard foreground owner:.*$/gm)||[];
  if(lines.length>1 || declarations.length>1)return {};
  const declared=/^Guard foreground owner: ([A-Za-z0-9_.:-]{1,180})$/.exec(declarations[0])?.[1];
  const health=lines[0]||'',native=/\| Context: codex:\/\/threads\/([a-f0-9-]{36})(?:\s|$)/.exec(health)?.[1];
  if((declarations.length && !declared) || (health.match(/\| Context:/g)||[]).length>1 ||
      (health.includes('codex://threads/') && !sessionId(native)) || (declared && native && declared!==native))return {};
  return {native,owner:declared||native};
}
export async function foregroundState(project,{session,url,readContinuation,fetchState=githubState}){
  project=await realpath(project);
  if(!sessionId(session))throw Error('actual owner session required');
  const raw=await localText(project,sourceFile), prior=raw?JSON.parse(raw):null;
  const binding=url?{session,url,generation:prior?.generation||randomUUID()}:prior;
  if(binding && (!sessionId(binding.generation) || !issuePath(binding.url) || binding.session!==session ||
      (prior && (prior.url!==binding.url || prior.session!==session))))throw Error('State binding conflict; reconcile current owner/source');
  const route=binding?await fetchState(project,binding):await localText(project,'PROJECT_STATE.md');
  const current=readContinuation(route);
  if(!current.key || routeOwner(route).native!==session ||
      current.orchestrator!=='codex://threads/'+session)throw Error('State or current owner/action unresolved');
  const expected=hookConfigs(project).expected;
  if(JSON.stringify(JSON.parse(await localText(project,'.codex/hooks.json')||'null'))!==JSON.stringify(expected))throw Error('managed Stop is not installed; custom hooks preserved');
  const dir=path.join(project,'.vydykhai');
  if(await realpath(dir)!==dir)throw Error('redirected Guard directory');
  if(url && !prior)await writeFile(path.join(project,sourceFile),JSON.stringify(binding)+'\n',{flag:'wx',mode:0o600});
  const state=JSON.parse(await localText(project,'.vydykhai/guard-foreground.json')||'{}');
  const source=binding?.url||'PROJECT_STATE.md',sourceSha256=createHash('sha256').update(route).digest('hex');
  const last=state.lastOwnerStop?.session===session && state.lastOwnerStop.source===source &&
    state.lastOwnerStop.generation===(binding?.generation||null)?state.lastOwnerStop:null;
  return {status:'CONFIGURED_STATE_BOUND',source,session,work:current.value.work,actionId:current.value.id,state:current.value.state,
    sourceSha256,lastObservedStop:last,callbackEvidence:!last?'UNOBSERVED':last.sourceSha256===sourceSha256?'LOCAL_RECORD_CURRENT':'LOCAL_RECORD_HISTORICAL'};
}

async function localText(project,relative){
  const file=path.join(project,relative);
  try{
    if(await realpath(file)!==file)throw Error('project source is redirected');
    const info=await stat(file);
    if(!info.isFile() || info.size>2*1024*1024)throw Error('project source outside supported bounds');
    return await readFile(file,'utf8');
  }catch(e){if(e.code==='ENOENT')return '';throw e;}
}
export async function changedReturns(project,previous,parse){
  const relative='.vydykhai/guard-outbox.md',file=path.join(project,relative);
  let stamp='absent';
  try{
    if(await realpath(file)!==file)throw Error('redirected outbox');
    const s=await stat(file,{bigint:true});if(!s.isFile() || s.size>2097152n)throw Error('invalid outbox');
    stamp=[s.dev,s.ino,s.size,s.ctimeNs,s.mtimeNs].join(':');
  }catch(e){if(e.code!=='ENOENT')throw e;}
  if(previous?.stamp===stamp && Array.isArray(previous.routed) && Array.isArray(previous.reports) && Array.isArray(previous.bound))return previous;
  const result=parse(await localText(project,relative));
  if(!result.issues.every(x=>/^Durable outbox: return .* requires routing$/.test(x)))throw Error('invalid outbox; existing evidence retained');
  const rows=new Map(result.returns.map(r=>[r.id,r.fields]));
  const pending=result.pendingReturnIds.map(id=>{
    if(!/^[a-zA-Z0-9_.:-]{1,180}$/.test(id))throw Error('unsafe receipt id');
    const row=rows.get(id);return [id,row.Status,createHash('sha256').update(JSON.stringify(row)).digest('hex')];
  });
  const reports=result.returns.map(r=>[r.id,createHash('sha256').update(JSON.stringify(r.fields)).digest('hex')]);
  const bound=result.routes.filter(row=>row.valid && row.application).map(row=>row.id);
  return {stamp,pending,routed:result.routedReturnIds,bound,reports};
}
async function writeAtomic(file,data){
  const tmp=file+'.'+randomUUID();try{
    await writeFile(tmp,JSON.stringify(data)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file);
  }finally{await rm(tmp,{force:true});}
}
export function waitClaimName(owner,receipt){
  return 'manager-wait-'+createHash('sha256').update(JSON.stringify([owner,receipt])).digest('hex')+'.json';
}
export function compactWaitView(view){
  const fields=['dod','obligations','pause','effects','spend','sources'];
  if(!fields.every(k=>typeof view?.[k]==='string' && view[k].length<=768))throw Error('invalid compact wait view');
  return Object.fromEntries(fields.map(k=>[k,view[k]]));
}
export async function portableGuard(project,{parse,session,decision,receipt,bindingOnly=false,event,readContinuation,fetchState=githubState}={}){
  project=await realpath(project);
  const dir=path.join(project,'.vydykhai');await mkdir(dir,{recursive:true});
  if(await realpath(dir)!==dir)throw Error('redirected project state');
  const lock=path.join(dir,'guard-foreground.lock'),file=path.join(dir,'guard-foreground.json');
  try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')return {status:'LIMITED',reason:'foreground state busy or interrupted'};throw e;}
  try{
    let state;const previous=await localText(project,'.vydykhai/guard-foreground.json');
    state=previous?JSON.parse(previous):{schema:1,background:'UNSET',paused:false,seen:[]};
    if(state.schema!==1 || !Array.isArray(state.seen) || !['UNSET','DECLINED','APPROVED'].includes(state.background))throw Error('invalid Guard state');
    const opened=state.ownerTurn;
    // Retire the old turn before fallible IO. A repeated Stop must not replay after a failed read.
    if(opened && opened.session===session && (event?.hook_event_name==='UserPromptSubmit' ||
        (event?.hook_event_name==='Stop' && opened.turn===event.turn_id))){
      delete state.ownerTurn;await writeAtomic(file,state);
    }
    const before=JSON.stringify(state);
    const locator=await localText(project,sourceFile), binding=locator?JSON.parse(locator):null;
    if(locator && (!binding || !sessionId(binding.generation) || !sessionId(binding.session) || !issuePath(binding.url)))throw Error('invalid State locator');
    const route=binding?(session===binding.session?await fetchState(project,binding):''):await localText(project,'PROJECT_STATE.md');
    const source=binding?.url||'PROJECT_STATE.md';
    const {native,owner}=routeOwner(route);
    if(binding && binding.session===session && native!==session)return {status:'LIMITED',reason:'bound State no longer identifies the native owner'};
    const flag=/^Project Guard: (PAUSED|RESUME)\b/m.exec(route)?.[1];
    if(flag==='PAUSED')state.paused=true;
    if(flag==='RESUME')state.paused=false;
    if(decision)state.background=decision;
    // An unbound or foreign session must not acknowledge the owner's notices.
    let continueOwner=false;
    if(owner && owner===session && event && typeof readContinuation==='function' &&
        typeof event.turn_id==='string' && /^[\w:-]{1,180}$/.test(event.turn_id)){
      const turn=event.turn_id, current=readContinuation(route);
      const valid=!state.paused && current.key && current.orchestrator==='codex://threads/'+session;
      const fingerprint=s=>createHash('sha256').update(s.trim().replace(/\s+/g,' ').toLowerCase()).digest('hex');
      if(event.hook_event_name==='UserPromptSubmit'){
        // Baseline only. A fresh prompt (including a pause) cannot inherit an old continuation.
        state.ownerTurn={session,turn,source,generation:binding?.generation||null,work:valid?current.value.work:null,prior:valid?current.value.id:null,
          ...(valid?{step:fingerprint(current.value.action),basis:fingerprint(current.value.evidence)}:{})};
      }else if(event.hook_event_name==='Stop' && opened?.session===session && opened.turn===turn){
        delete state.ownerTurn;
        continueOwner=Boolean(valid && event.stop_hook_active===false && opened.source===source &&
          opened.generation===(binding?.generation||null) && opened.work===current.value.work &&
          opened.step && opened.basis && opened.step!==fingerprint(current.value.action) &&
          opened.basis!==fingerprint(current.value.evidence) &&
          opened.prior!==current.value.id && current.value.state==='READY' &&
          ['PREPARED','RETURNED','WAITING'].includes(current.binding.leaseIdentity?.state) &&
          route.match(/^Human attention:.*$/gm)?.length===1 && /^Human attention:[ \t]*NONE[ \t]*\r?$/m.test(route));
      }
      if(event.hook_event_name==='Stop' && current.key && native===session){
        state.lastOwnerStop={source,session,turn,generation:binding?.generation||null,actionId:current.value.id,state:current.value.state,
          sourceSha256:createHash('sha256').update(route).digest('hex'),decision:continueOwner?'CONTINUE':'QUIET'};
      }
    }
    const changed=[];
    if(parse && !state.paused && owner && owner===session){
      state.cursor=await changedReturns(project,state.cursor,parse);
      const seen=new Map(state.seen.map(r=>[r[0],r]));
      for(const [id,hash] of state.cursor.reports){
        if(seen.has(id) && seen.get(id)[2]!==hash)throw Error('conflicting immutable return; reconcile without replay');
      }
      for(const item of state.cursor.pending){
        if(receipt && receipt!==item[0])continue;
        const previous=seen.get(item[0]);
        if(previous && previous[2]!==item[2])throw Error('conflicting immutable return; reconcile without replay');
        if(!previous && changed.length<16){state.seen.push(item);changed.push(item.slice(0,2));}
      }
    }
    let managerView;
    if(!receipt && changed.length){
      for(const [id] of changed){
        const raw=await localText(project,'.vydykhai/'+waitClaimName(owner,id));
        if(!raw)continue;
        const claim=JSON.parse(raw);
        if(claim.owner!==owner || claim.receipt!==id)throw Error('manager wait binding mismatch');
        managerView={receipt:id,dispatchView:compactWaitView(claim.view)};
        break;
      }
    }
    if(JSON.stringify(state)!==before || !previous)await writeAtomic(file,state);
    if(receipt){
      if(state.paused)return {status:'PAUSED'};
      if(!owner || owner!==session)return {status:'LIMITED',reason:'wait owner is not bound'};
      if(bindingOnly)return {status:'OWNER_BOUND'};
      if(typeof parse!=='function')return {status:'LIMITED',reason:'current outbox evidence unavailable'};
      if(state.cursor?.routed?.includes(receipt)){
        // A legacy route closes notification, not the owner's application obligation.
        if(!state.cursor.bound.includes(receipt))return {status:'APPLICATION_PENDING',application:'RECONCILE_CURRENT_STATE_WITHOUT_REPLAY'};
        return {status:'ALREADY_RECONCILED',application:'RECORDED_NOT_EXECUTION_PROOF',assurance:'DECLARED_ROUTE_NOT_TASK_ACCEPTANCE'};
      }
      if(changed.length)return {status:'RETURN',changed,application:'PENDING'};
      // Observation deduplicates notification, not the owner's obligation to apply.
      if(state.cursor?.pending?.some(([id])=>id===receipt))return {status:'APPLICATION_PENDING',receipt};
      if(state.seen.some(([id])=>id===receipt))return {status:'LIMITED',reason:'observed return missing from current outbox; reconcile retained evidence'};
    }
    return {status:state.paused?'PAUSED':continueOwner?'OWNER_STEP_READY':changed.length?'CHANGED':'QUIET',background:state.background,changed,...(managerView?{managerView}:{})};
  }finally{await rm(lock,{recursive:true});}
}
function hookConfigs(project){
  const script=path.join(project,'scripts/project-guard-hook.mjs');
  const unsafe=process.platform==='win32'?/[%"!&|<>^$`\r\n]/:/[\r\n]/;
  if(unsafe.test(script))throw Error('hook command path unsupported');
  const quoted=process.platform==='win32'?'"'+script+'"':"'"+script.replaceAll("'","'\\''")+"'";
  const group=[{hooks:[{type:'command',command:'node '+quoted}]}];
  const legacy={hooks:{SessionStart:group,UserPromptSubmit:group}};
  const expected={hooks:{...legacy.hooks,Stop:group}};
  return {legacy,expected};
}
export async function installOpenHook(project){
  const dir=path.join(project,'.codex');await mkdir(dir,{recursive:true});
  if(await realpath(dir)!==dir)return 'LIMITED (redirected hook directory)';
  const {legacy,expected}=hookConfigs(project);
  const file=path.join(dir,'hooks.json');
  try{await writeFile(file,JSON.stringify(expected,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch(e){
    if(e.code!=='EEXIST')throw e;
    let same=false;
    if((await lstat(file)).isFile()){
      try{
        const current=JSON.stringify(JSON.parse(await localText(project,'.codex/hooks.json')));
        same=current===JSON.stringify(expected);
        if(current===JSON.stringify(legacy)){await writeAtomic(file,expected);same=true;}
      }
      catch{/* A malformed or redirected custom hook remains owned by the project. */}
    }
    if(!same)return 'LIMITED (existing hook configuration preserved)';
  }
  if(JSON.stringify(JSON.parse(await localText(project,'.codex/hooks.json')))!==JSON.stringify(expected))return 'LIMITED (Stop readback mismatch)';
  return 'CONFIGURED (Stop registered; State binding and native execution require separate readback)';
}
