// Maintainer-only fixture adapter. Uses the installed preparation route, not receipts invented by the harness.
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {canonicalJson, sha256} from './memory-brief.mjs';

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if (!value) throw Error(code);};
export function fixtureApplicationPlan(receipt, task) {
  const rows = receipt.observations, unit = rows?.find(row => row.input === 1)?.output;
  need(receipt.exitStatus === 0 && unit?.currency === 'USD' && Number.isSafeInteger(unit.totalCents) && unit.totalCents > 0 &&
    rows.length >= 3 && rows.every(row => Number.isSafeInteger(row.input) && row.input > 0 &&
      row.output.currency === unit.currency && row.output.totalCents === row.input * unit.totalCents), 'FIXTURE_PLAN_PUBLIC_BASIS_INVALID');
  need(['maintenance', 'next-quote'].includes(task), 'FIXTURE_PLAN_TASK_INVALID');
  return {operation: task === 'maintenance' ? 'RECONCILE_MEMORY' : 'CONSUME_QUOTE',
    unitCents: unit.totalCents, currency: unit.currency, quantity: 3,
    input: 'current-consumer.json, public contract and retained history in this prepared packet',
    writes: task === 'maintenance' ? ['memory.md'] : ['next-quote.json'],
    procedure: task === 'maintenance' ?
      'Read this bound plan; check its unit price through the fixed public quote API; replace the current price assertion with that price and the supersession reference. Do not alter history, ideas, state, data or quote implementation.' :
      'Read this bound plan and stored current memory; check the public unit price, then call quote(quantity) and retain the result once.',
    verification: 'Fresh source readback, preserved source hashes, independent repair judgment, then a separately prepared dependent call',
    limits: ['deterministic fixture algorithm, not model planning', 'plan is not evidence that its mutation has run']};
}
export async function prepareAdoptionContext(workspace, name, action) {
  const prefix = `${name}-preparation`, output = `${prefix}/prepared`;
  const put = async (name, value) => {
    const bytes = typeof value === 'string' ? value : canonicalJson(value) + '\n';
    await writeFile(path.join(workspace, name), bytes, {flag: 'wx', mode: 0o600});
    return {path: name, sha256: sha256(bytes)};
  };
  const {mkdir} = await import('node:fs/promises');
  await mkdir(path.join(workspace, prefix), {mode: 0o700});
  const read = async name => JSON.parse(await readFile(path.join(workspace, name)));
  const pin = async name => ({path: name, sha256: sha256(await readFile(path.join(workspace, name)))});
  const files = ['contract.md', 'history.md', 'ideas.md', 'scope.md', 'state.md', 'memory.md'];
  const bodies = Object.fromEntries(await Promise.all(files.map(async name => [name, (await readFile(path.join(workspace, name), 'utf8')).trim()])));
  const sourceBindings = await Promise.all(files.map(pin));
  const events = files.map((file, index) => ({id: `S${index}`, authorKind: 'artifact', body: bodies[file]}));
  const source = await put(`${prefix}/events.json`, {schema: 'context.events.v1', complete: true, events});
  const classifications = events.map((event, index) => {
    const file = files[index], evidenceOnly = file === 'memory.md' && name !== 'next-quote';
    return {sourceId: 'pricing-records', eventId: event.id, eventDisposition: evidenceOnly ? 'evidence_only' : 'assertions',
      assertions: evidenceOnly ? [] : [{id: `${event.id}:1`, quote: event.body, disposition: 'current_constraint',
        scope: ['pricing'], targetRef: 'module:pricing-consumer',
        reason: file === 'ideas.md' ? 'Retain the source wording and missing ownership, if any; do not invent a tax approval or return condition.' :
          file === 'history.md' ? 'Historical price is not current authority; retain its explicit supersession.' : 'Preserve this exact source-backed boundary.',
        supersededBy: null, ownerGate: null, trigger: null}],
      reason: evidenceOnly ? 'Current memory is an object of independent inspection, not automatically an accepted constraint. Its complete snapshot remains in the source set and reviewer registry.' :
        'Explicit fixture-owner classification, not model discovery or independent acceptance.'};
  });
  const cmd = script => ({executable: process.execPath, args: [script], cwd: '.', timeoutMs: 3000, maxOutputBytes: 65536});
  const oracle = await put(`${prefix}/oracle.json`, {schema: 'context.oracle.v1', examples: [{id: 'Q1',
    sourceAssertionRefs: ['S0:1'], input: 3, expected: {currency: 'USD', totalCents: 3750}}]});
  const verificationScript = await put(`${prefix}/verify.mjs`, "import {quote} from '../quote.mjs'; console.log(JSON.stringify({schema:'context.observations.v1',candidateSha256:process.env.VYDYKHAI_CANDIDATE_SHA256,oracleSha256:process.env.VYDYKHAI_ORACLE_SHA256,observations:[{id:'Q1',observed:quote(3)}]}));\n");
  const pkg = {schema: 'context.package.v2', owner: 'owner',
    task: {id: name, worker: 'worker', scope: ['pricing'], action: cmd(action), candidateFiles: [action]},
    module: {publicBoundary: 'pricing-consumer', implementationFiles: [action], retainedExampleIds: ['Q1'], newExampleIds: [],
      oracle: oracle.path, verificationScript: verificationScript.path, verificationCommand: cmd(verificationScript.path), contractFiles: ['contract.md', 'scope.md']},
    moduleAccess: {schema: 'context.module-access.v1', modules: [
      {id: 'pricing-consumer', intent: 'change', contractFiles: ['scope.md'], privatePaths: [action, 'memory.md'], release: null},
      {id: 'quote', intent: 'consume', contractFiles: ['contract.md'], privatePaths: ['producer'],
        release: {artifact: await pin('quote.mjs'), connection: await pin('current-consumer.json')}}]},
    navigation: {taskId: name, worker: 'worker', preparedBy: 'fixture-preparer', outcome: 'Preserve accepted quote behavior and source precedence; no producer edits',
      assignment: {owner: 'owner', requestId: name, question: 'Retrieve public quote contract, retained success, historical decisions and idea obligations before the exact bounded action', phase: 'initial', previous: null},
      references: ['contract.md', 'scope.md', 'history.md', 'ideas.md', 'state.md'].map(file => ({id: file.slice(0, -3), path: file,
        quote: bodies[file], purpose: file.slice(0, -3), appliesTo: 'task'})),
      constraints: [{text: 'Consume the released quote unchanged; history and ideas are not disposable.', appliesTo: 'task', referenceIds: ['contract', 'history', 'ideas']}], gaps: []},
    sources: [{id: 'pricing-records', path: source.path, scope: ['pricing']}], classifications,
    dependencies: ['quote.mjs', 'current-consumer.json', 'contract.md', 'history.md', 'ideas.md', 'scope.md', 'state.md',
      ...(name === 'next-quote' ? ['memory.md'] : [])].map((file, i) => ({id: `D${i}`, path: file, scope: ['pricing']})),
    sharedArtifacts: ['contract.md', 'history.md', 'ideas.md', 'scope.md', 'state.md']};
  await put(`${prefix}/package.json`, pkg);
  const invoke = (mode, args, expected) => {
    const result = JSON.parse(execFileSync(process.execPath, [path.join(workspace, 'scripts/vydykhai.mjs'), 'context-prepare', mode,
      '--output', output, ...args], {cwd: workspace, encoding: 'utf8', timeout: 30000}));
    need(result.status === expected, `ADOPTION_PREPARATION_${mode.toUpperCase()}:${result.code ?? result.status}`); return result;
  };
  invoke('plan', ['--input', `${prefix}/package.json`], 'PLAN_READY');
  const integrated = invoke('confirm', ['--owner', 'owner', '--decision', 'approved'], 'PREPARED');
  const delivery = invoke('read', ['--worker', 'worker'], 'DELIVERED');
  need(['1250', '1000', 'Tax', 'PAUSED'].every(term => delivery.context.includes(term)), 'PREPARATION_RECALL_INCOMPLETE');
  need(!delivery.context.includes('export function quote'), 'PRODUCER_IMPLEMENTATION_LEAKED');
  const evidence = await put(`${prefix}/worker-evidence.json`, {schema: 'qualification.fixture-worker-readback.v1', worker: 'worker',
    deliveredContextSha256: sha256(delivery.context), contract: bodies['contract.md'], history: bodies['history.md'],
    ideas: bodies['ideas.md'], pausedWork: bodies['state.md'],
    plan: fixtureApplicationPlan(await read('current-consumer.json'), name),
    ...(name === 'next-quote' ? {storedMemory: bodies['memory.md']} : {}),
    limits: ['deterministic fixture readback, not unhinted model recall', 'not repair completion or independent acceptance']});
  invoke('ack', ['--worker', 'worker', '--evidence', evidence.path], 'ACKNOWLEDGED');
  const request = await read(`${output}/resume.json`), task = await read(request.task.path), capsule = await read(request.capsule.path);
  const report = {schema: 'qualification.adoption-preparation.v1', task: name, owner: 'owner', worker: 'worker',
    sourceBindings, sourceReceipt: integrated.sourceReceipt, scope: pkg.task.scope, assignment: pkg.navigation.assignment,
    renderedContext: delivery.context, readback: await read(evidence.path),
    request, integration: await read(`${output}/integration.json`), moduleAccess: pkg.moduleAccess,
    limits: ['fixture-owner classifications', 'deterministic worker, not evidence of model comprehension',
      'current memory snapshot inspected separately; preparation does not repair or accept it']};
  await put(`${prefix}/report.json`, report);
  return {request, report, binding: {operation: 'resume', taskId: name, taskSha256: request.task.sha256,
    capsuleSha256: request.capsule.sha256, sourceDigest: capsule.sourceDigest,
    dependencyDigest: capsule.dependencyDigest, commandSha256: hash(task.action), cwd: workspace,
    executable: await realpath(process.execPath), kind: 'dependent'}};
}
