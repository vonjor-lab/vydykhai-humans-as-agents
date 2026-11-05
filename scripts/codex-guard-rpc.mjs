// Connect only to the user's private native Codex app-server. No turn/start.
import ws from './vendor/ws/index.js';
import {lstat, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir,homedir} from 'node:os';

export async function nativeSocket(codexHome = process.env.CODEX_HOME || path.join(homedir(),'.codex')) {
  if(process.platform==='darwin'){
    const control=path.join(await realpath(codexHome),'app-server-control');
    const dir=await lstat(control);
    if(!dir.isDirectory() || dir.uid!==process.getuid() || dir.mode&0o077)throw Error('unsafe native control directory');
    const file=await realpath(path.join(control,'app-server-control.sock'));
    const socketDir='/private/tmp/codex-daemon-'+process.getuid();
    const parent=await lstat(socketDir),sock=await lstat(file);
    if(path.dirname(file)!==socketDir || !/^[a-f0-9]{64}$/.test(path.basename(file)) ||
      !parent.isDirectory() || parent.uid!==process.getuid() || parent.mode&0o077 ||
      !sock.isSocket() || sock.uid!==process.getuid() || sock.mode&0o077)throw Error('unsafe native control endpoint');
    return file;
  }
  const dir = path.join(tmpdir(),'codex-daemon-'+process.getuid());
  const d = await lstat(dir);
  if (!d.isDirectory() || d.uid !== process.getuid() || d.mode & 0o077) throw Error('unsafe native socket directory');
  const entries = (await readdir(dir)).filter(n => /^[a-f0-9]{64}$/.test(n));
  if (entries.length !== 1) throw Error('native Codex endpoint absent or ambiguous');
  const file = path.join(dir,entries[0]), stat = await lstat(file);
  if (!stat.isSocket() || stat.uid !== process.getuid() || stat.mode & 0o077) throw Error('unsafe native socket');
  return file;
}

export async function withNative(file, action) {
  const socket = new ws('ws+unix://'+file+':/', {handshakeTimeout:4000,maxPayload:8*1024*1024,perMessageDeflate:false});
  const pending = new Map();
  let seq = 0;
  const deadline = setTimeout(()=>socket.terminate(),10000);
  const closed = () => { for (const p of pending.values()) p.reject(Error('native connection ended')); pending.clear(); };
  socket.on('close',closed);
  socket.on('error',closed);
  socket.on('message', raw => {
    try {
      const m=JSON.parse(raw); const p=pending.get(m.id);
      if (p) { pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); }
    } catch {socket.terminate();}
  });
  const call = (method, params) => new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
  });
  try {
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
    await call('initialize',{clientInfo:{name:'vydykhai-guard',version:'1'},capabilities:{experimentalApi:true}});
    return await action(call);
  } finally { clearTimeout(deadline);socket.close(); }
}
