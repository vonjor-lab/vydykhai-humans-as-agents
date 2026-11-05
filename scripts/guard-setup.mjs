// Install/update client for an already provisioned project-owned host adapter.
// The capability is a private Unix socket, never a command from the target tree.
import {nativeSetup} from './codex-guard-install.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {lstat, realpath, mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {homedir} from 'node:os';
import path from 'node:path';

function requireProof(ok, reason) {
  if (!ok) throw Error(reason);
}

async function exchange(socketPath, project, operation, fields = {}) {
  const id = randomUUID();
  const request = {protocol: 'vydykhai.guard-setup.v1', project, operation, id, ...fields};
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    const deadline = setTimeout(() => socket.destroy(Error('host response deadline')), 3000);
    let reply = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'));
    socket.on('error', reject);
    socket.on('close', () => { clearTimeout(deadline); reject(Error('host closed without proof')); });
    socket.on('data', chunk => {
      reply += chunk;
      try {
        requireProof(Buffer.byteLength(reply) <= 32768, 'oversize host response');
        if (!reply.includes('\n')) return;
        const result = JSON.parse(reply);
        requireProof(result.id === id && result.project === project && result.protocol === request.protocol &&
          result.operation === operation && result.ok === true, 'host refused or response identity mismatched');
        resolve(result);
        socket.destroy();
      } catch (error) { socket.destroy(error); }
    });
  });
}

function inventory(status) {
  requireProof(typeof status.paused === 'boolean' && typeof status.revision === 'string' &&
    status.revision.length > 0 && Array.isArray(status.runners), 'runner inventory unavailable');
  requireProof(status.runners.length <= 1, 'multiple registrations need owner reconciliation');
}

// A checkout may remember a choice, but cannot grant itself host authority.
export async function backgroundGrant(target,decision){
  if(!['linux','darwin'].includes(process.platform))return false;
  const project=await realpath(target),base=path.join(await realpath(homedir()),'.vydykhai-guard');
  if(!path.relative(project,base).startsWith('..'+path.sep) || !path.relative(base,project).startsWith('..'+path.sep))return false;
  if(decision==='APPROVED')await mkdir(base,{mode:0o700,recursive:true});
  const dir=await lstat(base).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(!dir)return false;
  requireProof(dir.isDirectory() && dir.uid===process.getuid() && !(dir.mode&0o077),'unsafe permission directory');
  const file=path.join(base,'consent-'+createHash('sha256').update(project).digest('hex')+'.json');
  if(decision==='DECLINED'){await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});return false;}
  if(decision==='APPROVED'){
    try{await writeFile(file,JSON.stringify({project,permission:'background-guard-v1'}),{flag:'wx',mode:0o600});}
    catch(e){if(e.code!=='EEXIST')throw e;}
  }
  const f=await lstat(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!f)return false;
  requireProof(f.isFile() && f.uid===process.getuid() && f.nlink===1 && !(f.mode&0o077),'unsafe background consent');
  const grant=JSON.parse(await readFile(file,'utf8'));
  return grant.project===project && grant.permission==='background-guard-v1';
}
export async function setupProjectGuard(target, fresh = false) {
  try {
    const project = await realpath(target);
    const key = createHash('sha256').update(project).digest('hex').slice(0, 32);
    const home = await realpath(homedir());
    const directory = path.join(home, '.vydykhai-guard');
    const socketPath = path.join(directory, key + '.sock');
    requireProof(path.relative(project, directory).split(path.sep)[0] === '..' &&
      path.relative(directory, project).split(path.sep)[0] === '..', 'Guard host capability must live outside the project');
    // Existing bridge wins. An unreachable registered socket stays LIMITED.
    if (['linux','darwin'].includes(process.platform)) {
      const owned = path.join(directory, 'native-'+key, 'state.json');
      const nativeOwner = await lstat(owned).then(()=>true, e=>{if(e.code==='ENOENT')return false;throw e;});
      if(nativeOwner)return await nativeSetup(project, fresh);
      try { await lstat(socketPath); }
      catch (e) { if (e.code === 'ENOENT') return await nativeSetup(project, fresh); throw e; }
    }
    const privateDir = await lstat(directory);
    requireProof(privateDir.isDirectory() && privateDir.uid === process.getuid() &&
      !(privateDir.mode & 0o077), 'Guard host directory ownership or permissions unavailable');
    const endpoint = await lstat(socketPath);
    requireProof(endpoint.isSocket() && endpoint.uid === process.getuid(), 'trusted project-owned socket unavailable');
    const call = (operation, fields) => exchange(socketPath, project, operation, fields);
    let status = await call('inspect');
    inventory(status);
    if (status.paused) return 'PAUSED (explicit host pause preserved)';
    if (!status.runners.length) {
      requireProof(status.mayRegister === true && status.atomicSingleton === true, 'host cannot authorize one external registration');
      // The host atomically checks revision, pause and uniqueness. After any
      // uncertain response this invocation stops. A later update inspects first.
      await call('ensure', {key, expectedRevision: status.revision});
      status = await call('inspect');
      inventory(status);
      if (status.paused) return 'PAUSED (explicit host pause preserved)';
    }
    requireProof(status.mayVerify === true, 'host cannot authorize a bounded delivery probe');
    const [runner] = status.runners;
    requireProof(runner && typeof runner.id === 'string' && runner.id && runner.external === true &&
      runner.scheduled === true && runner.event === true && typeof runner.recipient === 'string' &&
      runner.recipient.length > 0, 'one addressed external event and schedule runner was not observed');
    const binding = {key, runner: runner.id, recipient: runner.recipient, expectedRevision: status.revision};
    // Stable key lets the adapter resume an interrupted proof without sending
    // a second notice. Read delivery and quiet-repeat evidence back separately.
    const proofKey = createHash('sha256').update(JSON.stringify(binding)).digest('hex');
    const probe = await call('verify', {...binding, proofKey});
    requireProof(typeof probe.receipt === 'string' && probe.receipt, 'host proof receipt unavailable');
    const proof = await call('readback', {...binding, proofKey, receipt: probe.receipt});
    requireProof(proof.receipt === probe.receipt && proof.proofKey === proofKey &&
      proof.runner === runner.id && proof.recipient === runner.recipient && proof.revision === status.revision &&
      proof.event?.deliveries === 1 && proof.event.consumedBy === runner.recipient &&
      typeof proof.event.returnId === 'string' && proof.event.returnId.length > 0 &&
      typeof proof.event.executionId === 'string' && proof.event.executionId.length > 0 &&
      typeof proof.schedule?.executionId === 'string' && proof.schedule.executionId.length > 0 &&
      proof.schedule.executionId !== proof.event.executionId && proof.schedule.returnId === proof.event.returnId &&
      proof.schedule.result === 'NOOP' && proof.schedule.deliveries === 0 && proof.schedule.modelCalls === 0,
      'addressed event or quiet schedule execution could not be verified');
    const final = await call('inspect');
    inventory(final);
    if (final.paused) return 'PAUSED (explicit host pause preserved)';
    const observed = final.runners[0];
    requireProof(final.revision === status.revision && observed?.id === runner.id && observed.recipient === runner.recipient &&
      observed.external === true && observed.event === true && observed.scheduled === true, 'binding changed during verification');
    return 'ACTIVE (host verified one external runner, addressed delivery and quiet scheduled repeat)';
  } catch (error) {
    const reason = error.code === 'ENOENT' || error.code === 'ECONNREFUSED' ? 'project-owned host adapter unavailable' : error.message;
    return 'LIMITED (kit installed; monitoring unverified: ' + reason + ')';
  }
}
