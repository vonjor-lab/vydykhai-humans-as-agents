// Synchronous host callbacks use only the installed project. No scheduler or model.
import {lstat,realpath,readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';

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
  if(previous?.stamp===stamp && Array.isArray(previous.routed))return previous;
  const result=parse(await localText(project,relative));
  if(!result.issues.every(x=>/^Durable outbox: return .* requires routing$/.test(x)))throw Error('invalid outbox; existing evidence retained');
  const rows=new Map(result.returns.map(r=>[r.id,r.fields]));
  const pending=result.pendingReturnIds.map(id=>{
    if(!/^[a-zA-Z0-9_.:-]{1,180}$/.test(id))throw Error('unsafe receipt id');
    const row=rows.get(id);return [id,row.Status,createHash('sha256').update(JSON.stringify(row)).digest('hex')];
  });
  return {stamp,pending,routed:result.routedReturnIds};
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
export async function portableGuard(project,{parse,session,decision,receipt}={}){
  project=await realpath(project);
  const dir=path.join(project,'.vydykhai');await mkdir(dir,{recursive:true});
  if(await realpath(dir)!==dir)throw Error('redirected project state');
  const lock=path.join(dir,'guard-foreground.lock'),file=path.join(dir,'guard-foreground.json');
  try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')return {status:'LIMITED',reason:'foreground state busy or interrupted'};throw e;}
  try{
    let state;const previous=await localText(project,'.vydykhai/guard-foreground.json');
    state=previous?JSON.parse(previous):{schema:1,background:'UNSET',paused:false,seen:[]};
    if(state.schema!==1 || !Array.isArray(state.seen) || !['UNSET','DECLINED','APPROVED'].includes(state.background))throw Error('invalid Guard state');
    const before=JSON.stringify(state);
    const route=await localText(project,'PROJECT_STATE.md');
    const flag=/^Project Guard: (PAUSED|RESUME)\b/m.exec(route)?.[1];
    if(flag==='PAUSED')state.paused=true;
    if(flag==='RESUME')state.paused=false;
    if(decision)state.background=decision;
    // An unbound or foreign session must not acknowledge the owner's notices.
    const declared=/^Guard foreground owner: ([A-Za-z0-9_.:-]{1,180})$/m.exec(route)?.[1];
    const native=/^Orchestrator health:.*?\| Context: codex:\/\/threads\/([a-f0-9-]{36})(?:\s|$)/m.exec(route)?.[1];
    const owner=declared && native && declared!==native ? null : declared || native;
    const changed=[];
    if(parse && !state.paused && owner && owner===session){
      state.cursor=await changedReturns(project,state.cursor,parse);
      const seen=new Map(state.seen.map(r=>[r[0],r]));
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
      if(changed.length)return {status:'RETURN',changed};
      if(state.seen.some(([id])=>id===receipt) || state.cursor?.routed?.includes(receipt))return {status:'ALREADY_RECONCILED'};
    }
    return {status:state.paused?'PAUSED':changed.length?'CHANGED':'QUIET',background:state.background,changed,...(managerView?{managerView}:{})};
  }finally{await rm(lock,{recursive:true});}
}
export async function installOpenHook(project){
  const dir=path.join(project,'.codex');await mkdir(dir,{recursive:true});
  if(await realpath(dir)!==dir)return 'LIMITED (redirected hook directory)';
  const script=path.join(project,'scripts/project-guard-hook.mjs');
  const unsafe=process.platform==='win32'?/[%"!&|<>^$`\r\n]/:/[\r\n]/;
  if(unsafe.test(script))return 'LIMITED (hook command path unsupported)';
  const quoted=process.platform==='win32'?'"'+script+'"':"'"+script.replaceAll("'","'\\''")+"'";
  const group=[{hooks:[{type:'command',command:'node '+quoted}]}];
  const expected={hooks:{SessionStart:group,UserPromptSubmit:group}};
  const file=path.join(dir,'hooks.json');
  try{await writeFile(file,JSON.stringify(expected,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch(e){
    if(e.code!=='EEXIST')throw e;
    let same=false;
    if((await lstat(file)).isFile()){
      try{same=JSON.stringify(JSON.parse(await localText(project,'.codex/hooks.json')))===JSON.stringify(expected);}
      catch{/* A malformed or redirected custom hook remains owned by the project. */}
    }
    if(!same)return 'LIMITED (existing hook configuration preserved)';
  }
  return 'CONFIGURED (host trust and hook support required)';
}
