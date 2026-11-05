import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:net';
import {mkdtemp, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));

test('ordinary install and updates reconcile the host without replay or disturbing work', async t => {
  // Short pathname fits Unix sockets on macOS. No OS timer is created.
  const root = await realpath(await mkdtemp('/tmp/vg-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const project = path.join(root,'project');
  const host = path.join(root,'.vydykhai-guard');
  await mkdir(project);
  await mkdir(host,{mode:0o700});
  const file = path.join(project,'ongoing-work.md');
  await writeFile(file,'Paused work, open question and memory.');
  const canonicalCLI = path.join(source,'scripts/vydykhai.mjs');
  const installedCLI = path.join(project,'scripts/vydykhai.mjs');
  const invoke = async (cli,...args) => (await run(process.execPath,[cli,...args], {
    env:{...process.env,HOME:root},cwd:root,timeout:15000})).stdout;
  const update = () => invoke(installedCLI,'update',project,'--from',source);
  assert.match(await invoke(canonicalCLI,'install',project), /Project Guard: FOREGROUND/);

  const key = createHash('sha256').update(project).digest('hex').slice(0,32);
  let paused = true, runners = [], revision = 1, registrations = 0, verifications = 0;
  let damage = false, dropEnsure = false;
  const proofs = new Map();
  const inbox = path.join(root,'fixture-inbox.json');
  const handle = async q => {
    assert.equal(q.project,project);
    const base = {protocol:q.protocol,project:q.project,id:q.id,operation:q.operation,ok:true};
    if (q.operation === 'inspect') return {...base,paused,revision:String(revision),runners,
      mayRegister:true,mayVerify:true,atomicSingleton:true};
    assert.equal(paused,false);
    assert.equal(q.key,key);
    assert.equal(q.expectedRevision,String(revision));
    if (q.operation === 'ensure') {
      assert.equal(runners.length,0);
      runners=[{id:'fixture-runner',recipient:'fixture-owner',external:true,scheduled:true,event:true}];
      registrations++; revision++;
      if (dropEnsure) { dropEnsure=false; return null; }
      return base;
    }
    const runner=runners[0];
    assert.equal(q.runner,runner.id);
    assert.equal(q.recipient,runner.recipient);
    if (q.operation === 'verify') {
      if (!proofs.has(q.proofKey)) {
        verifications++;
        // A real local inbox and a later timer callback exercise two passes
        // through the isolated fixture runner. No installed OS service is implied.
        const deliver = async () => {
          const seen = JSON.parse(await readFile(inbox,'utf8').catch(e => {
            if (e.code === 'ENOENT') return '[]';
            throw e;
          }));
          if (seen.some(entry => entry.returnId === q.proofKey)) return 0;
          seen.push({returnId:q.proofKey,consumedBy:runner.recipient});
          await writeFile(inbox,JSON.stringify(seen));
          return 1;
        };
        const deliveries=await deliver();
        const received=JSON.parse(await readFile(inbox)).find(entry => entry.returnId === q.proofKey);
        await delay(5);
        const repeated=await deliver();
        proofs.set(q.proofKey,{event:{...received,executionId:'event-'+revision,deliveries},
          schedule:{returnId:received.returnId,executionId:'scheduled-'+revision,
            result:repeated?'DELIVERED':'NOOP',deliveries:repeated,modelCalls:0}});
      }
      return {...base,receipt:q.proofKey};
    }
    assert.equal(q.operation,'readback');
    const proof=proofs.get(q.proofKey);
    return {...base,...proof,receipt:q.receipt,proofKey:q.proofKey,runner:runner.id,
      recipient:damage?'wrong-recipient':runner.recipient,revision:String(revision)};
  };
  const server = createServer(socket => {
    let request='';
    socket.on('data',async chunk => {
      request+=chunk;
      if (!request.includes('\n')) return;
      const response=await handle(JSON.parse(request));
      if (response) socket.end(JSON.stringify(response)+'\n'); else socket.destroy();
    });
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(path.join(host,key+'.sock'),resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  assert.match(await invoke(installedCLI,'update',project,'--from',source,'--guard-background-approved'),/Project Guard: PAUSED/);
  assert.equal(registrations,0);
  paused=false;
  dropEnsure=true;
  assert.match(await update(),/Project Guard: LIMITED/);
  assert.equal(registrations,1);
  assert.match(await update(),/Project Guard: ACTIVE/);
  assert.match(await update(),/Project Guard: ACTIVE/);
  assert.equal(registrations,1);
  assert.equal(verifications,1);
  damage=true;
  assert.match(await update(),/Project Guard: LIMITED/);
  assert.equal(registrations,1);
  assert.equal(await readFile(file,'utf8'),'Paused work, open question and memory.');
  paused=true;
  assert.match(await update(),/Project Guard: PAUSED/);
  assert.equal(runners.length,1);
  paused=false;
  // Reinstall through the normal install path with the existing healthy runner.
  damage=false;
  assert.match(await invoke(canonicalCLI,'install',project),/Project Guard: ACTIVE/);
  assert.equal(registrations,1);
  // The fixture host reports a genuinely missing registration at a new revision.
  runners=[];
  revision++;
  assert.match(await update(),/Project Guard: ACTIVE/);
  assert.equal(registrations,2);
  assert.equal(runners.length,1);
  assert.equal(verifications,2);
});
