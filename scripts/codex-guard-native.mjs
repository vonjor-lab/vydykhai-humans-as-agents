// Executed by the user scheduler only from an installer-owned runtime outside the project.
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,realpath,rename,lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {changedReturns} from './project-guard-open.mjs';
import {backgroundGrant} from './guard-setup.mjs';
import {nativeSocket,withNative} from './codex-guard-rpc.mjs';
import {parseDurableOutboxComment} from './vydykhai.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
function need(ok,message){if(!ok)throw Error(message);}
const read=async f=>JSON.parse(await readFile(f,'utf8'));
async function save(f,value){
  const temp=f+'.'+randomUUID();
  const handle=await open(temp,'wx',0o600);
  try {await handle.writeFile(JSON.stringify(value)+'\n');await handle.sync();} finally {await handle.close();}
  await rename(temp,f);
  const dir=await open(path.dirname(f),'r');try{await dir.sync();}finally{await dir.close();}
}
async function projectText(project,name){
  const file=path.join(project,name);
  try {
    need(await realpath(file)===file,'project source symlink');
    const stat=await lstat(file);need(stat.isFile() && stat.size<=2*1024*1024,'project source invalid');
    return await readFile(file,'utf8');
  } catch(e){if(e.code==='ENOENT')return '';throw e;}
}
function stateRoute(text){
  const owner=/^Orchestrator health:.*?\| Context: codex:\/\/threads\/([a-f0-9-]{36})(?:\s|$)/m.exec(text)?.[1];
  const guard=/^Project Guard: ([A-Z_]+)/m.exec(text)?.[1];
  return {owner,guard};
}
async function nativeRecipient(call,s){
  const {thread}=await call('thread/read',{threadId:s.owner,includeTurns:false});
  need(thread.id===s.owner && await realpath(thread.cwd)===s.project,'native recipient identity mismatch');
  const file=await realpath(thread.path);
  const sessions=await realpath(path.join(s.codexHome,'sessions'));
  need(file.startsWith(sessions+path.sep) && file.endsWith(s.owner+'.jsonl'),'native history identity mismatch');
  return {file,status:thread.status.type};
}
async function markerCount(file,text){
  const data=await readFile(file,'utf8');
  return data.split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.type==='response_item' &&
    e.payload?.type==='message' && e.payload.role==='user' &&
    e.payload.content?.some(c=>c.type==='input_text' && c.text===text)).length;
}
async function exclusiveBackend(root,project){
  const bridge=path.join(path.dirname(root),hash(project).slice(0,32)+'.sock');
  const existing=await lstat(bridge).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
  need(!existing,'another host adapter appeared; both routes require owner reconciliation');
}
async function observe(root,s){
  const route=stateRoute(await projectText(s.project,'PROJECT_STATE.md'));
  if(route.guard==='PAUSED'){s.paused=true;s.verified=false;return 'PAUSED';}
  if(s.paused && !(route.guard==='RESUME' && (!s.owner || route.owner===s.owner)))return 'PAUSED';
  if(!await backgroundGrant(s.project))return 'BACKGROUND_NOT_AUTHORIZED';
  await exclusiveBackend(root,s.project);
  if(!s.owner){
    if(!route.owner)return 'WAITING_OWNER';
    need(['MISSING','RESUME'].includes(route.guard),'existing runner disposition unresolved');
    s.socket=await nativeSocket(s.codexHome);s.owner=route.owner;
    await withNative(s.socket,call=>nativeRecipient(call,s));
    await save(path.join(root,'state.json'),s);
  }
  need(route.owner===s.owner,'recipient changed or missing; rebind requires owner reconciliation');
  s.cursor=await changedReturns(s.project,s.cursor,parseDurableOutboxComment);
  const unresolved=Object.entries(s.effects).find(([,effect])=>effect.state==='UNKNOWN');
  const id=unresolved?.[0] || s.cursor.pending.find(([i])=>!Object.hasOwn(s.effects,i))?.[0];
  if(!id && !s.paused)return 'QUIET';
  const sock=await nativeSocket(s.codexHome);need(sock===s.socket,'native endpoint changed');
  return withNative(sock,async call=>{
    const peer=await nativeRecipient(call,s);
    if(s.paused){s.paused=false;if(!id)return 'RESUMED';}
    need(/^[a-zA-Z0-9_.:-]{1,180}$/.test(id),'unsafe return identifier');
    const text='Vydykhai Guard: pending Return Sync '+id+' in .vydykhai/guard-outbox.md. Receipt '+hash(s.project+'\n'+s.owner+'\n'+id)+'.';
    const prior=await markerCount(peer.file,text);
    if(prior===1){s.effects[id]={state:'DELIVERED',owner:s.owner};return 'RECONCILED';}
    need(prior===0 && !unresolved,'delivery UNKNOWN; no replay');
    if(peer.status!=='idle')return 'WAITING_OWNER';
    s.effects[id]={state:'UNKNOWN',owner:s.owner};await save(path.join(root,'state.json'),s);
    await call('thread/inject_items',{threadId:s.owner,items:[{type:'message',role:'user',content:[{type:'input_text',text}]}]});
    need(await markerCount(peer.file,text)===1,'delivery UNKNOWN; no replay');
    s.effects[id].state='DELIVERED';
    return 'DELIVERED';
  });
}
const ctl=(...args)=>execFileSync('/usr/bin/systemctl',['--user',...args],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}).trim();
async function putUnit(file,text){
  try{await writeFile(file,text,{flag:'wx',mode:0o600});}
  catch(e){if(e.code!=='EEXIST')throw e;need((await lstat(file)).isFile() && await readFile(file,'utf8')===text,'existing unit conflicts');}
}
async function registerMac(root,s,args){
  const label='com.vydykhai.guard.'+hash(s.project).slice(0,24), domain='gui/'+process.getuid();
  const dir=path.join(homedir(),'Library/LaunchAgents');
  await mkdir(dir,{recursive:true});
  const directory=await lstat(dir);
  need(await realpath(dir)===dir && directory.uid===process.getuid() && !(directory.mode&0o022),'unsafe LaunchAgents directory');
  const file=path.join(dir,label+'.plist');
  const xml=value=>{need(!/[\x00-\x1f]/.test(value),'invalid launchd string');return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');};
  const plist='<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>'+
    '<key>Label</key><string>'+label+'</string><key>ProgramArguments</key><array>'+
    args.map(a=>'<string>'+xml(a)+'</string>').join('')+'</array><key>StartInterval</key><integer>15</integer>'+
    '<key>EnvironmentVariables</key><dict><key>HOME</key><string>'+xml(homedir())+'</string>'+
    '<key>NODE_OPTIONS</key><string></string><key>NODE_PATH</key><string></string>'+
    '<key>WS_NO_BUFFER_UTIL</key><string>1</string><key>WS_NO_UTF_8_VALIDATE</key><string>1</string></dict></dict></plist>\n';
  const invoke=(...cmd)=>spawnSync('/bin/launchctl',cmd,{encoding:'utf8',timeout:8000,env:{PATH:'/usr/bin:/bin'}});
  const target=domain+'/'+label;
  const existing=invoke('print',target);
  const envMatches=output=>{
    const block=/^\s*environment = \{\n([\s\S]*?)^\s*\}/m.exec(output)?.[1] || '';
    const env=new Map(block.trimEnd().split('\n').map(line=>{
      const m=/^\s*([^ ]+) => ?(.*)$/.exec(line);return m?[m[1],m[2]]:['',''];
    }));
    const expected={HOME:homedir(),NODE_PATH:'',NODE_OPTIONS:'',WS_NO_BUFFER_UTIL:'1',WS_NO_UTF_8_VALIDATE:'1',XPC_SERVICE_NAME:label};
    return env.size===Object.keys(expected).length && Object.entries(expected).every(([k,v])=>env.get(k)===v);
  };
  const matches=r=>r.status===0 && envMatches(r.stdout) && /^\s*run interval = 15 seconds\s*$/m.test(r.stdout) && /^\s*path = (.+)$/m.exec(r.stdout)?.[1]===file &&
    /^\s*program = (.+)$/m.exec(r.stdout)?.[1]===args[0] &&
    JSON.stringify(/^\s*arguments = \{\n([\s\S]*?)^\s*\}/m.exec(r.stdout)?.[1].split('\n').map(x=>x.trim()).filter(Boolean))===JSON.stringify(args);
  if(existing.status===0)need(matches(existing),'existing launchd job conflicts');
  else need(existing.status===113 && existing.stderr.includes('Could not find service "'+label+'"'),'launchd job inventory unavailable');
  await putUnit(file,plist);
  const attrs=await lstat(file);
  need(attrs.isFile() && attrs.uid===process.getuid() && attrs.nlink===1 && !(attrs.mode&0o022),'unsafe LaunchAgent plist ownership or permissions');
  if(existing.status!==0){
    const started=invoke('bootstrap',domain,file);
    need(started.status===0,'launchd bootstrap unconfirmed; inspect on update');
  }
  need(matches(invoke('print',target)),'launchd registration readback mismatch');
  return label;
}
async function register(root,s){
  const args=[process.execPath,path.join(root,'current/scripts/codex-guard-native.mjs'),'tick',root];
  if(process.platform==='darwin')return registerMac(root,s,args);
  const unit='vydykhai-guard-'+hash(s.project).slice(0,24);
  const dir=path.join(homedir(),'.config/systemd/user');await mkdir(dir,{recursive:true});
  need(await realpath(dir)===dir,'unsafe user unit directory');
  need(args.every(v=>/^[\w./-]+$/.test(v)),'unsupported service path');
  for(const ext of ['service','timer']){
    const name=unit+'.'+ext,file=path.join(dir,name);
    const existing=ctl('show',name,'--property=FragmentPath','--value');
    need(!existing || existing===file,'pre-existing foreign unit');
    const body=ext==='service' ? '[Service]\nType=oneshot\nUnsetEnvironment=NODE_OPTIONS NODE_PATH\nEnvironment=WS_NO_BUFFER_UTIL=1 WS_NO_UTF_8_VALIDATE=1\nExecStart='+args.join(' ')+'\n' :
      '[Timer]\nOnActiveSec=2s\nOnUnitActiveSec=15s\nAccuracySec=1s\n[Install]\nWantedBy=timers.target\n';
    await putUnit(file,'[Unit]\nDescription=Vydykhai project Guard\n'+body);
  }
  ctl('daemon-reload');ctl('enable','--now',unit+'.timer');
  need(ctl('is-active',unit+'.timer')==='active','timer registration unverified');
  return unit;
}
export async function mainNative(mode,root,project,adoption){
  if(!mode.startsWith('locked-')){
    need(['tick','setup'].includes(mode),'unknown Guard operation');
    // -F execs Node with the kernel lock held. Exit, SIGKILL and reboot release it.
    const args=['--exclusive','--nonblock','--conflict-exit-code','75','--no-fork',path.join(root,'guard.flock'),
      process.execPath,fileURLToPath(import.meta.url),'locked-'+mode,root,...[project,adoption].filter(x=>x!==undefined)];
    let child;
    if(process.platform==='darwin'){
      const lockProgram=[
        'import fcntl, os, sys',
        'fd=os.open(sys.argv[1],os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)',
        'try: fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)',
        'except BlockingIOError: sys.exit(75)',
        'os.set_inheritable(fd,True)',
        'os.execv(sys.argv[2],sys.argv[2:])'
      ].join('\n');
      child=spawnSync('/usr/bin/python3',['-I','-c',lockProgram,...args.slice(5)],{encoding:'utf8',timeout:15000});
    }else child=spawnSync('/usr/bin/flock',args,{encoding:'utf8',timeout:15000});
    if(child.status===75)return 'LIMITED (operation currently locked)';
    if(child.error || child.status!==0)throw Error(child.error?.message || child.stderr.trim() || 'Guard operation failed');
    return child.stdout.trim();
  }
  mode=mode.slice('locked-'.length);
  const f=path.join(root,'state.json');
    let s;try{s=await read(f);}catch(e){if(e.code!=='ENOENT'||mode!=='setup')throw e;}
    if(mode==='setup'){
      const route=stateRoute(await projectText(project,'PROJECT_STATE.md'));
      if(!s){
        need(adoption==='fresh' || ['MISSING','PAUSED'].includes(route.guard),'existing runner inventory unavailable');
        need(!route.guard || ['MISSING','PAUSED'].includes(route.guard),'existing registration requires reconciliation');
        s={project,owner:null,paused:route.guard==='PAUSED',codexHome:await realpath(process.env.CODEX_HOME || path.join(homedir(),'.codex')),
          socket:null,effects:{},ticks:0};
        if(route.owner && !s.paused){
          need(!process.env.CODEX_THREAD_ID || route.owner===process.env.CODEX_THREAD_ID,'setup owner disagrees with native recipient');
          s.socket=await nativeSocket(s.codexHome);s.owner=route.owner;
          await withNative(s.socket,call=>nativeRecipient(call,s));
        }
        await save(f,s);
      }
      need(s.project===project,'project changed; rebind withheld');
      if(route.guard==='PAUSED'){s.paused=true;s.verified=false;await save(f,s);return 'PAUSED';}
      if(s.paused && route.guard!=='RESUME')return 'PAUSED';
      need(!s.owner || route.owner===s.owner,'recipient changed; rebind withheld');
      await exclusiveBackend(root,project);
      if(s.paused){
        if(route.guard!=='RESUME' || !route.owner)return 'PAUSED';
        const socket=await nativeSocket(s.codexHome);need(!s.socket || s.socket===socket,'endpoint changed during resume');
        await withNative(socket,call=>nativeRecipient(call,{...s,owner:route.owner}));
        s.paused=false;s.owner=route.owner;s.socket=socket;s.verified=false;await save(f,s);
      }
      if(Object.values(s.effects).some(e=>e.state==='UNKNOWN'))return 'LIMITED (unsettled native delivery; no replay)';
      if(s.verified){
        need(await nativeSocket(s.codexHome)===s.socket,'native endpoint changed');
        await withNative(s.socket,call=>nativeRecipient(call,s));
      }
      const unit=await register(root,s);
      return (s.verified?'ACTIVE':'REGISTERED_AWAITING_PROOF')+' ('+unit+(process.platform==='darwin'?'':'.timer')+')';
    }
    need(mode==='tick','unknown native Guard operation');
    s.effects=Object.assign(Object.create(null),s.effects);
    let outcome;
    try{outcome=await observe(root,s);}catch(e){
      // Reload the write-ahead reservation even if delivery became uncertain.
      const durable=await read(f);durable.verified=false;durable.last='LIMITED';durable.reason=e.message;
      await save(f,durable);throw e;
    }
    s.ticks++;s.last=outcome;s.quietTicks=outcome==='QUIET'?(s.quietTicks||0)+1:0;
    if(outcome!=='QUIET')s.verified=false;
    if(outcome==='QUIET' && Object.values(s.effects).some(e=>e.state==='DELIVERED'))s.verified=true;
    await save(f,s);console.log(JSON.stringify({tick:s.ticks,outcome,at:new Date().toISOString()}));
    return outcome;
}
if(process.argv[1] && await realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)){
  mainNative(...process.argv.slice(2)).then(console.log).catch(e=>{console.error('LIMITED: '+e.message);process.exitCode=1;});
}
