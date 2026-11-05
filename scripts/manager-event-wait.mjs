// One durable claim per owner and Return id. Never start a second timed wait.
import {watch} from 'node:fs';
import {readFile,writeFile,lstat,realpath,link,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {portableGuard,waitClaimName,compactWaitView} from './project-guard-open.mjs';

const need=(ok,message)=>{if(!ok)throw Error(message);};
async function smallJson(file){
  const info=await lstat(file);
  need(info.isFile() && info.size<=16384 && await realpath(file)===file,'unsafe or oversized wait checkpoint');
  return JSON.parse(await readFile(file,'utf8'));
}
// Link a complete immutable record into place; a crash cannot publish partial JSON.
async function once(file,data){
  const tmp=file+'.'+randomUUID();
  try{
    await writeFile(tmp,JSON.stringify(data)+'\n',{flag:'wx',mode:0o600});
    try{await link(tmp,file);return true;}catch(e){if(e.code==='EEXIST')return false;throw e;}
  }finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function waitForReturn(project,receipt,owner,parse){
  const idPattern=/^[a-zA-Z0-9_.:-]{1,180}$/;
  need(idPattern.test(receipt) && typeof owner==='string' && idPattern.test(owner),'invalid wait identity');
  const dir=path.join(project,'.vydykhai');
  need(await realpath(dir)===dir,'wait state is redirected');
  const claim=path.join(dir,waitClaimName(owner,receipt));
  let plan=await smallJson(claim).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  let first=false;
  if(!plan){
    // The dispatch packet is project-local. The first agreed deadline wins.
    plan=await smallJson(path.join(dir,'manager-wait-plan.json'));
    need(plan.owner===owner && plan.receipt===receipt,'dispatch identity mismatch');
    need(Number.isSafeInteger(plan.outerBudgetMs) && plan.outerBudgetMs>0 &&
      Number.isFinite(Date.parse(plan.deadline)),'invalid wait bounds');
    plan={owner,receipt,deadline:plan.deadline,outerBudgetMs:plan.outerBudgetMs,view:compactWaitView(plan.view)};
    first=await once(claim,plan);
    if(!first)plan=await smallJson(claim);
  }
  need(plan.owner===owner && plan.receipt===receipt,'wait claim identity mismatch');
  const check=()=>portableGuard(project,{session:owner,receipt,parse});
  const result=(status,extra={})=>({status,owner,receipt,deadline:plan.deadline,...extra});
  const limited=async reason=>{
    await once(claim+'.limited', {at:new Date().toISOString(),reason,owner,receipt});
    return result('LIMITED',{reason,view:plan.view,obligation:path.basename(claim)});
  };
  const terminal=async r=>{
    if(r.status==='QUIET')return null;
    if(r.status==='LIMITED' || r.status==='PAUSED')return limited(r.reason||r.status);
    return result(r.status,{...(r.changed?{changed:r.changed}:{}),view:plan.view});
  };
  const remaining=Date.parse(plan.deadline)-Date.now();
  if(!first || remaining<=0 || remaining+500>plan.outerBudgetMs || remaining>900000){
    const observed=await terminal(await check());if(observed)return observed;
    const earlier=await smallJson(claim+'.limited').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(earlier)return result('LIMITED',{reason:earlier.reason,view:plan.view,obligation:path.basename(claim)});
    if(remaining<=0 || remaining+500>plan.outerBudgetMs || remaining>900000)return limited('deadline or outer bound; next actual return requires owner entry');
    return result('WAIT_ALREADY_CLAIMED',{obligation:path.basename(claim),instruction:'Do not re-arm; await actual return or owned deadline.'});
  }
  let wake,dirty=true,error,timer,expired=false;
  const signal=()=>{dirty=true;wake?.();};
  const watchers=[];
  try{
    // Subscribe before first read. Watch the directory to cover atomic replacement.
    for(const [root,name] of [[dir,'guard-outbox.md'],[project,'PROJECT_STATE.md']]){
      const watcher=watch(root,(_,file)=>{if(!file || file===name)signal();});
      watcher.on('error',e=>{error=e;signal();});watchers.push(watcher);
    }
    timer=setTimeout(()=>{expired=true;signal();},remaining);
    while(true){
      dirty=false;
      const observed=await terminal(await check());if(observed)return observed;
      if(error)return limited('filesystem wake unavailable: '+error.message);
      if(expired || Date.now()>=Date.parse(plan.deadline))return limited('deadline reached without Return; re-enter only on new evidence');
      if(!dirty)await new Promise(resolve=>{wake=resolve;});wake=null;
    }
  }catch(e){
    const held=await limited(e.message);
    try{return await terminal(await check()) || held;}catch{return held;}
  }
  finally{clearTimeout(timer);for(const watcher of watchers)watcher.close();}
}
