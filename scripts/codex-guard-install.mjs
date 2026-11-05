// Run installed services from private, verified installer copies, never project code.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile,realpath,readdir,mkdtemp,rename,rm,symlink,readlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const digest=x=>createHash('sha256').update(x).digest('hex');
async function privateDir(dir){
  await mkdir(dir,{mode:0o700,recursive:true});
  const s=await lstat(dir);
  if(!s.isDirectory() || s.uid!==process.getuid() || s.mode&0o077 || await realpath(dir)!==dir)throw Error('unsafe native Guard directory');
}
async function files(source,paths){
  const result=[];
  for(const name of paths){
    const full=path.join(source,name),s=await lstat(full);
    if(s.isDirectory())result.push(...await files(source,(await readdir(full)).sort().map(f=>path.join(name,f))));
    else if(s.isFile())result.push([name,await readFile(full)]);
    else throw Error('unexpected installer file type');
  }
  return result;
}
export async function nativeSetup(project, fresh){
  if(!['linux','darwin'].includes(process.platform))return 'LIMITED (native user scheduler unavailable on this host)';
  const home=await realpath(homedir()), base=path.join(home,'.vydykhai-guard');
  if(!path.relative(project,base).startsWith('..'+path.sep) ||
     !path.relative(base,project).startsWith('..'+path.sep))throw Error('native Guard storage overlaps project');
  await privateDir(base);
  const root=path.join(base,'native-'+digest(project).slice(0,32));await privateDir(root);
  const source=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const pointer=path.join(root,'current');
  let active=await readlink(pointer).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(active && !/^[a-f0-9]{64}$/.test(active))throw Error('invalid private runtime binding');
  const mirror=await lstat(path.join(source,'.vydykhai-lock.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
  if(!mirror && source!==project && path.relative(project,source).startsWith('..'+path.sep)){
    const manifest=JSON.parse(await readFile(path.join(source,'vydykhai.json'),'utf8'));
    const content=await files(source,manifest.managedPaths.filter(f=>f.startsWith('scripts/') || f==='vendor/ws'));
    const revision=digest(JSON.stringify(content.map(([name,bytes])=>[name,digest(bytes)])));
    if(revision!==active){
      const tmp=await mkdtemp(path.join(root,'.candidate-'));
      try{
        for(const [name,bytes] of content){
          const f=path.join(tmp,name);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,bytes,{mode:0o400});
        }
        try{await rename(tmp,path.join(root,revision));}catch(e){if(!['EEXIST','ENOTEMPTY'].includes(e.code))throw e;}
        // Same content-addressed directory may exist from a prior interrupted publish.
        for(const [name,bytes] of content)
          if(digest(await readFile(path.join(root,revision,name)))!==digest(bytes))throw Error('private runtime digest mismatch');
        const link=tmp+'.link';await symlink(revision,link);await rename(link,pointer);active=revision;
      }finally{await rm(tmp,{recursive:true,force:true});}
    }
  }
  if(!active)throw Error('current trusted source installer required for first native Guard adoption');
  const exe=await realpath(process.execPath);
  if(!path.relative(project,exe).startsWith('..'+path.sep))throw Error('untrusted node executable');
  return execFileSync(exe,[path.join(pointer,'scripts/codex-guard-native.mjs'),'setup',root,project,fresh?'fresh':'existing'],
    {encoding:'utf8',timeout:20000,cwd:home,env:{HOME:home,PATH:'/usr/bin:/bin',XDG_RUNTIME_DIR:process.env.XDG_RUNTIME_DIR,
      CODEX_HOME:process.env.CODEX_HOME,CODEX_THREAD_ID:process.env.CODEX_THREAD_ID,WS_NO_BUFFER_UTIL:'1',WS_NO_UTF_8_VALIDATE:'1'},
      stdio:['ignore','pipe','pipe']}).trim();
}
