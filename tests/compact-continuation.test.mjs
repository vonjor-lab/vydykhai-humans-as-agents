import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runControlChild} from '../scripts/control-child.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// This is a real local process integration, not a native-model/desktop experiment.
// Optional evidence output retains originals and every terminal receipt for review.
test('terminal wait and fresh compact read preserve one task and source authority', async t => {
  const destination = process.env.CONTEXT_CONTINUATION_EVIDENCE;
  const root = destination ? path.resolve(destination) : await mkdtemp(path.join(tmpdir(), 'compact-continuation-'));
  if (destination) await mkdir(root); // Never overwrite prior evidence.
  else t.after(() => rm(root, {recursive:true, force:true}));
  await cp(path.join(repository, 'examples/context-preparation'), root, {recursive:true});
  const get = name => readFile(path.join(root, name), 'utf8');
  const put = (name, value) => writeFile(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const originals = {};
  for (const name of ['package.json','sources.json','candidate.mjs','shared.md','oracle.json']) originals[name] = await get(name);
  await put('originals.json', originals);
  const pkg = JSON.parse(originals['package.json']);
  pkg.sharedArtifacts = [{path:'shared.md',startMarker:'<!-- bundle:start -->',endMarker:'<!-- bundle:end -->'}];
  await put('package.json',pkg);
  const calls = [];
  const invoke = async (...args) => {
    const receipt = await runControlChild({executable:process.execPath,
      args:[path.join(repository,'scripts/vydykhai.mjs'),...args],cwd:root,env:process.env,
      input:'',timeoutMs:10000,maxBytes:2*1024*1024});
    calls.push({args,...receipt});
    await put('terminal-receipts.json',calls);
    assert.equal(receipt.state,'CLOSED'); assert.equal(receipt.reason,null);
    return JSON.parse(receipt.output);
  };
  const prepare = (mode,...args) => invoke('context-prepare',mode,'--output','prepared',...args);
  const run = mode => invoke('context-run','--input',`prepared/${mode}.json`);
  assert.equal((await prepare('plan','--input','package.json')).status,'PLAN_READY');
  assert.equal((await prepare('confirm','--owner','module-owner','--decision','approved')).status,'PREPARED');
  const checkpoint = await get('prepared/awaiting-worker.json');
  await put('checkpoint-before.json',JSON.parse(checkpoint));
  const first = await prepare('read','--worker','bundle-worker');
  assert.equal(first.status,'DELIVERED');
  // A new CLI process reconstructs its input solely from current pinned sources.
  const fresh = await prepare('read','--worker','bundle-worker');
  assert.deepEqual(fresh,first);
  for (const obligation of [/buildBundle/,/DUPLICATE_ID/,/case-insensitively/,/CSV/]) assert.match(fresh.context,obligation);
  await put('compact-delivery.json',fresh);
  await put('worker-evidence.txt','Read buildBundle, retained B1/B2 and new N1: case-insensitive duplicate rejection preserves spelling, schema, normalization, ordering and count. CSV remains owner-gated. Next: verify baseline, apply local correction, verify; no dependent action replay.');
  assert.equal((await prepare('ack','--worker','bundle-worker','--evidence','worker-evidence.txt')).status,'ACKNOWLEDGED');
  const baseline = await run('accept');
  assert.equal(baseline.code,'BEHAVIOR_MISMATCH');
  await put('baseline.json',baseline);
  // Causal repair: the original case-sensitive key contradicts the selected S4.
  await put('candidate.mjs',originals['candidate.mjs'].replace('const key = entry.id;','const key = entry.id.toLowerCase();'));
  const candidate = await run('accept');
  assert.equal(candidate.status,'VERIFIED');
  assert.equal(candidate.receipt.productAcceptance,'NOT_ESTABLISHED');
  await put('candidate-result.json',candidate);
  assert.equal(await get('prepared/awaiting-worker.json'),checkpoint);
  assert.equal(await get('sources.json'),originals['sources.json']);
  // A current source cannot be silently substituted under the saved selection.
  const source = JSON.parse(originals['sources.json']);
  source.events[0].body += '\nChanged authority after selection.';
  await put('sources.json',source);
  const stale = await prepare('read','--worker','bundle-worker');
  assert.equal(stale.code,'PACKAGE_PLAN_STALE'); assert.equal(stale.commands,0); await put('stale-result.json',stale);
  source.events = JSON.parse(originals['sources.json']).events;
  source.complete = false;
  await put('sources.json',source);
  const incomplete = await prepare('read','--worker','bundle-worker');
  assert.equal(incomplete.code,'PACKAGE_SOURCE_INCOMPLETE'); assert.equal(incomplete.commands,0); await put('incomplete-result.json',incomplete);
  await put('sources.json',originals['sources.json']);
  // Evidence failures above never invoke the dependent action.
  await assert.rejects(get('actions.log'),{code:'ENOENT'});
  const effectReceipts = [];
  for (const mode of ['failure','timeout','unknown']) {
    const program = `import {appendFileSync} from 'node:fs';
      import {spawn} from 'node:child_process';
      appendFileSync('effects.log', '${mode}\\n');
      if ('${mode}' === 'failure') process.exit(7);
      if ('${mode}' === 'unknown') {
        const child = spawn(process.execPath,['-e','setTimeout(()=>{},2000)'],{detached:true,stdio:['ignore',1,2]});
        console.log(child.pid); child.unref();
      }
      setInterval(()=>{},1000);`;
    const receipt = await runControlChild({executable:process.execPath,args:['--input-type=module','-e',program],
      cwd:root,env:process.env,input:'',timeoutMs:300,maxBytes:4096,stopGraceMs:50});
    effectReceipts.push({mode,...receipt}); await put('effect-receipts.json',effectReceipts);
    if (mode === 'failure') assert.equal(receipt.code,7);
    else assert.equal(receipt.reason,'TIMEOUT');
    if (mode === 'unknown') {
      const pid = Number(receipt.output.trim());
      try { if(pid) process.kill(-pid,'SIGKILL'); } catch(error) { if(error.code !== 'ESRCH') throw error; }
      assert.equal(receipt.state,'UNKNOWN');
    }
    // No retry wrapper: an observed failure cannot erase effects or authorize replay.
    assert.equal((await get('effects.log')).split('\n').filter(line=>line===mode).length,1);
  }
  await put('measurement.json',{kind:'deterministic-local-process-integration',
    processCalls:calls.length+effectReceipts.length,modelCalls:0,modelStatusPolls:0,
    processElapsedMs:[...calls,...effectReceipts].reduce((sum,c)=>sum+c.timing.elapsedMs,0),
    checkpointSha256:digest(checkpoint),sourceSha256:digest(originals['sources.json']),
    actualModelInputTokens:null,actualModelCost:null,
    limits:['No desktop wakeup or physical model-context eviction proof','Replay protection remains caller-owned','No token or subscription savings inferred from artifact sizes']});
});
