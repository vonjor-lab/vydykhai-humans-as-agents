// One durable claim per owner and Return id. Never start a second timed wait.
import {watch} from 'node:fs';
import {readFile,writeFile,lstat,realpath,link,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {portableGuard,waitClaimName,compactWaitView} from './project-guard-open.mjs';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const idPattern=/^[a-zA-Z0-9_.:-]{1,180}$/;
const validId=value=>typeof value==='string' && idPattern.test(value);
const withinBounds=(remaining,budget)=>remaining>0 && remaining<=900000 && remaining+500<=budget;
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
async function waitPaths(project,receipt,owner){
  need(validId(receipt) && validId(owner),'invalid wait identity');
  const dir=path.join(project,'.vydykhai');
  need(await realpath(dir)===dir,'wait state is redirected');
  return {dir,claim:path.join(dir,waitClaimName(owner,receipt))};
}
async function readPlan(dir,receipt,owner){
  const plan=await smallJson(path.join(dir,'manager-wait-plan.json'));
  need(plan.owner===owner && plan.receipt===receipt,'dispatch identity mismatch');
  need(Number.isSafeInteger(plan.outerBudgetMs) && plan.outerBudgetMs>0 &&
    typeof plan.deadline==='string' && Number.isFinite(Date.parse(plan.deadline)),'invalid wait bounds');
  return {...plan,view:compactWaitView(plan.view)};
}
function claimRecord({owner,receipt,deadline,outerBudgetMs,view}){
  return {owner,receipt,deadline,outerBudgetMs,view};
}

// plan.targets binds an exact, nonempty set. PASS grants one immediate wait_agent
// call via waitArgs; LIMITED (reason) and PAUSED grant none. Never replay a PASS.
export async function prepareNativeWait(project,receipt,owner,targets){
  const limited=reason=>({status:'LIMITED',reason});
  try{
    const requested=Array.isArray(targets)?new Set(targets):new Set();
    const {dir,claim}=await waitPaths(project,receipt,owner);
    const existing=await lstat(claim).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(existing)return limited('existing wait claim; do not re-arm');
    const plan=await readPlan(dir,receipt,owner);
    const intended=plan.targets;
    if(!Array.isArray(targets) || !Array.isArray(intended) || !intended.length || !intended.every(validId) ||
      new Set(intended).size!==intended.length || requested.size!==targets.length ||
      requested.size!==intended.length || !intended.every(id=>requested.has(id))){
      return limited('native wait targets do not match dispatch plan');
    }
    if(!await once(claim,{...claimRecord(plan),targets:intended}))return limited('existing wait claim; do not re-arm');
    const guard=await portableGuard(project,{session:owner,receipt,bindingOnly:true});
    if(guard.status==='PAUSED')return {status:'PAUSED'};
    if(guard.status!=='OWNER_BOUND'){
      return limited(guard.reason || 'native wait guard did not admit');
    }
    const remaining=Date.parse(plan.deadline)-Date.now();
    if(remaining<10000 || !withinBounds(remaining,plan.outerBudgetMs))return limited('deadline outside native wait bounds; do not re-arm');
    return {status:'PASS',waitArgs:{targets:intended,timeout_ms:remaining}};
  }catch(e){
    return limited(e.code?'native wait state unavailable':e.message);
  }
}

export async function waitForReturn(project,receipt,owner,parse){
  const {dir,claim}=await waitPaths(project,receipt,owner);
  let plan=await smallJson(claim).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  let first=false;
  if(!plan){
    // The dispatch packet is project-local. The first agreed deadline wins.
    plan=claimRecord(await readPlan(dir,receipt,owner));
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
    if(r.status==='LIMITED')return limited(r.reason);
    return result(r.status,{...(r.changed?{changed:r.changed}:{}),
      ...(r.application?{application:r.application}:{}),
      ...(r.assurance?{assurance:r.assurance}:{}),view:plan.view,
      replayAuthorized:false});
  };
  const remaining=Date.parse(plan.deadline)-Date.now();
  if(!first || !withinBounds(remaining,plan.outerBudgetMs)){
    const observed=await terminal(await check());if(observed)return observed;
    const earlier=await smallJson(claim+'.limited').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(earlier)return result('LIMITED',{reason:earlier.reason,view:plan.view,obligation:path.basename(claim)});
    if(!withinBounds(remaining,plan.outerBudgetMs))return limited('deadline or outer bound; next actual return requires owner entry');
    return limited('existing wait claim does not prove a live observer; reconcile return coverage without re-arming');
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
