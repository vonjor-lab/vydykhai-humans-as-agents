import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, rm, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {adoptionOracle, adoptionStableRevision, stageAdoption, stageAdoptionReadbacks, restoreAdoptionStableKit, runAdoption, checkAdoptionReview, verifyAdoptionBaseline, adoptionRepairPlan} from '../scripts/qualify-control-adoption.mjs';
import {sha256} from '../scripts/memory-brief.mjs';
import {fixtureApplicationPlan} from '../scripts/qualify-adoption-preparation.mjs';

const supported = {skip: process.platform !== 'darwin', timeout: 60000};
test('fixture worker derives its action from public evidence instead of a hardcoded target price', () => {
  const receipt = cents => ({exitStatus: 0, observations: [1,3,7].map(input => ({input, output: {currency: 'USD', totalCents: input*cents}}))});
  assert.equal(fixtureApplicationPlan(receipt(1600), 'maintenance').unitCents, 1600);
  assert.equal(fixtureApplicationPlan(receipt(1250), 'next-quote').operation, 'CONSUME_QUOTE');
  const broken = receipt(1250); broken.observations[1].output.totalCents = 3000;
  assert.throws(() => fixtureApplicationPlan(broken, 'maintenance'), /PUBLIC_BASIS_INVALID/);
});
test('unexpected blockers require an owned repair plan before another paid acceptance',()=>{
  const findings=[{id:'price',checkId:'C15.01',status:'OPEN',owner:'owner',work:'maintenance',blocksResume:true},
    {id:'tax',checkId:'C02.03',status:'OPEN',owner:'owner',work:'tax',blocksResume:false},
    {id:'proof',checkId:'C19.01',status:'OPEN',owner:'owner',work:'current-qualification',blocksResume:true,
      reviewAt:'2026-10-08T00:00:00Z',evidence:'No current public consumer proof'}];
  const before=structuredClone(findings),plan=adoptionRepairPlan(findings);
  assert.equal(plan.status,'ADDITIONAL_OWNED_REPAIR_REQUIRED');
  assert.deepEqual(plan.candidateFindingIds,['price']);
  assert.deepEqual(plan.outsideBlocking.map(f=>f.id),['proof']);
  assert.equal(plan.retainedOpen.length,3);assert.equal(plan.authority,'NONE');
  assert.deepEqual(findings,before);
  assert.equal(adoptionRepairPlan(findings.slice(0,2)).status,'BOUNDED_MEMORY_REPAIR_CANDIDATE');
  assert.deepEqual(adoptionRepairPlan([{...findings[2],status:'CLOSED'}]).outsideBlocking,[]);
  assert.equal(adoptionRepairPlan([{...findings[2],work:'maintenance'}]).status,'ADDITIONAL_OWNED_REPAIR_REQUIRED');
});
async function setup(t, healthy = false, diagnosisOnly = false, stableBaseline = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'adoption-qualification-')));
  t.after(() => rm(root, {recursive: true, force: true}));
  const output = path.join(root, 'case');
  // Empty synthetic home: activation checks metadata, never real credentials.
  const authHome = path.join(root, 'empty-auth'); await mkdir(authHome, {mode: 0o700});
  const staged = await stageAdoption({output, binary: process.execPath, authHome, healthy, diagnosisOnly, stableBaseline});
  return {output, staged, freeze: JSON.parse(await readFile(path.join(output, 'setup.json')))};
}
test('stable1.34.1 update and explicit kit restoration preserve paused controller, inherited work and separate participant reads', supported, async t => {
  const x = await setup(t, true, false, true);
  const updater = JSON.parse(await readFile(path.join(x.output, 'updater.json')));
  assert.equal(updater.baseline, adoptionStableRevision); assert.equal(updater.baselineVersion, '1.34.1');
  assert.equal(x.freeze.baselineVersion, '1.34.1'); assert.equal(updater.doctor.ok, true);
  assert.equal(x.staged.modelsLaunched, 0);
  for (const [name, digest] of Object.entries(x.freeze.preserved))
    assert.equal(sha256(await readFile(path.join(x.freeze.workspace, name))), digest);
  assert.match(await readFile(path.join(x.freeze.workspace, 'state.md'), 'utf8'), /PAUSED/);
  assert.equal(x.freeze.activation.status, 'PRIVATE_ACTIVATED_NOT_PROJECT_READY');
  await assert.rejects(restoreAdoptionStableKit(x.output), /OPERATOR_EXCLUSION_REQUIRED/);
  const lockBefore = await readFile(path.join(x.freeze.workspace,'.vydykhai-lock.json'));
  const preflight = await restoreAdoptionStableKit(x.output,{noRacingSchedulerOperators:true,preflightOnly:true});
  assert.equal(preflight.status,'RESTORATION_INPUTS_VALIDATED'); assert.equal(preflight.effects,0);
  assert.deepEqual(await readFile(path.join(x.freeze.workspace,'.vydykhai-lock.json')),lockBefore);
  await assert.rejects(readFile(path.join(x.output,'restoration-intent.json')),/ENOENT/);
  const restored = await restoreAdoptionStableKit(x.output,{noRacingSchedulerOperators:true});
  assert.equal(restored.scope,'NOT_CONTROLLER_ROLLBACK'); assert.equal(restored.nativeCalls,0);
  assert.equal(restored.doctor.installedVersion,'1.34.1'); assert.equal(restored.pausedState.paused,true);
  assert.equal(restored.controller.digest,x.freeze.activation.runtime.digest);
  assert.equal(restored.denial,'COMMAND_NOT_APPROVED'); assert.match(restored.interruption,/LEASE_HELD/);
  await assert.rejects(readFile(path.join(x.output,'adoption-readback-specs.json')),/ENOENT/);
  const candidate = await setup(t,true,false,true);
  const specs = await stageAdoptionReadbacks(candidate.output);
  assert.equal(specs.temporalScope,'CANDIDATE_INSTALLED_BEFORE_RESTORATION');
  assert.equal(specs.pausedState.paused,true);
  await assert.rejects(restoreAdoptionStableKit(candidate.output,{noRacingSchedulerOperators:true}),/NOT_FRESH_STAGE/);
  assert.equal(specs.maxCalls,3); assert.equal(specs.actualCalls,0); assert.equal(specs.status,'AWAITING_INDEPENDENT_BYTE_APPROVAL');
  assert.equal(new Set(specs.specs.map(s=>s.request.workspace)).size,3);
  assert.equal(specs.timeoutMs,180000); assert.equal(specs.model,'gpt-6.1-sol'); assert.equal(specs.effort,'low');
  for (const spec of specs.specs) {
    assert.equal(spec.maxCalls,1); assert.equal(spec.retries,0);
    assert.equal(spec.request.timeoutMs,180000); assert.equal(spec.request.model,'gpt-6.1-sol'); assert.equal(spec.request.effort,'low');
    assert.equal(await readFile(path.join(spec.request.workspace,'pending-graph-delta.json'),'utf8'),
      await readFile(path.join(candidate.freeze.workspace,'pending-graph-delta.json'),'utf8'));
    assert.ok(spec.sourceSnapshot.rows.some(r=>r.id==='candidate-obligations'));
  }
  await assert.rejects(restoreAdoptionStableKit(x.output,{noRacingSchedulerOperators:true}), /NOT_FRESH_STAGE|EEXIST/);
});
test('oracle is separate, pricing-specific and capped to four Low calls without retries', () => {
  assert.equal(adoptionOracle.budget.maxCalls, 4); assert.equal(adoptionOracle.budget.timeoutMs, 120000);
  assert.equal(adoptionOracle.budget.retries, 0); assert.equal(adoptionOracle.budget.effort, 'low');
  assert.deepEqual(adoptionOracle.nextOutput, {currency: 'USD', totalCents: 3750});
  assert.throws(() => checkAdoptionReview({enrollment: 'OWNER_DISPOSITION_DUE', findings: []}, {healthy: false}), /PRICING_FINDING/);
  assert.throws(() => checkAdoptionReview({enrollment: 'REVIEW_IN_FLIGHT', findings: []}, {healthy: true}), /NOT_COMPLETE/);
  assert.throws(() => checkAdoptionReview({enrollment: 'OWNER_DISPOSITION_DUE', findings: [{status: 'OPEN'}]}, {healthy: true}), /NO_CHANGE/);
});
test('historical updater plus installed activation, exact repair, independent protocol check and guarded quote', supported, async t => {
  const x = await setup(t);
  assert.equal(x.staged.modelsLaunched, 0);
  assert.equal(x.freeze.activation.status, 'PRIVATE_ACTIVATED_NOT_PROJECT_READY');
  assert.ok(x.freeze.sourceTree['scripts/control-service.mjs']);
  assert.equal(x.freeze.profile.review.maxCalls, 2);
  const registry = JSON.parse(await readFile(x.freeze.profile.review.sourceFile));
  assert.ok(!registry.sources.some(r => r.path.includes('oracle') || r.path.endsWith('.mjs')));
  assert.ok(registry.sources.some(r => r.id === 'baseline-consumer'));
  assert.ok(registry.sources.some(r => r.id === 'current-consumer'));
  const prepared = JSON.parse(await readFile(path.join(x.freeze.workspace, 'preparation.json')));
  assert.equal(prepared.sourceReceipt.observed.length, 6);
  const universe = JSON.parse(await readFile(path.join(x.freeze.workspace, 'source-universe.json')));
  assert.equal(universe.origin, 'SYNTHETIC_GENERATED_CLOSED_CORPUS');
  assert.equal(universe.phase, 'PRE_REPAIR_BASELINE');
  assert.deepEqual(universe.semanticSources, prepared.sourceBindings);
  assert.equal(prepared.sourceReceipt.classifiedPrefixes[0].eventIds.length, 6);
  assert.match(prepared.renderedContext, /1250/);
  assert.match(prepared.renderedContext, /Historical price was 1000/);
  assert.match(prepared.renderedContext, /Nobody owns recall/);
  assert.match(prepared.renderedContext, /PAUSED/);
  assert.equal(prepared.readback.plan.unitCents, 1250);
  assert.equal(prepared.readback.plan.operation, 'RECONCILE_MEMORY');
  assert.doesNotMatch(prepared.renderedContext, /export function quote/);
  assert.equal(prepared.moduleAccess.modules.find(m => m.id === 'quote').intent, 'consume');
  const current = JSON.parse(await readFile(path.join(x.freeze.workspace, 'current-consumer.json')));
  assert.equal(current.phase, 'POST_UPDATE');
  assert.equal(current.installedRuntime, x.freeze.activation.runtime.digest);
  const baseline = JSON.parse(await readFile(path.join(x.freeze.workspace, 'baseline-consumer.json')));
  assert.equal(baseline.acceptance, 'SYNTHETIC_FIXTURE_ACCEPTANCE');
  assert.equal(baseline.exitStatus, 0);
  assert.equal(baseline.artifactSha256, x.freeze.preserved['quote.mjs']);
  assert.equal(baseline.contractSha256, x.freeze.preserved['contract.md']);
  assert.ok(x.freeze.refs.includes(baseline.head));
  assert.deepEqual(baseline.observations.map(r => r.output.totalCents), [1250,3750,8750]);
  assert.equal(x.freeze.preserved['baseline-consumer.json'], sha256(await readFile(path.join(x.freeze.workspace, 'baseline-consumer.json'))));
  const result = await runAdoption(x.output, {protocol: true});
  assert.equal(result.status, 'PROTOCOL_PASS_NOT_SEMANTIC', JSON.stringify(result));
  assert.equal(result.actualCalls, 0); assert.equal(result.release, 'NO_RELEASE');
  assert.equal(result.state.health.enrollment, 'SETTLED');
  assert.ok(result.state.health.findings.some(f => f.checkId === 'C15.01' && f.status === 'CLOSED'));
  assert.ok(result.state.health.findings.some(f => f.checkId === 'C02.03' && f.status === 'OPEN'));
  assert.equal(Object.keys(result.state.reservations).length, 2);
  const after = JSON.parse(await readFile(path.join(x.freeze.workspace, 'preparation.json')));
  assert.equal(after.task, 'next-quote');
  assert.equal(after.readback.storedMemory, adoptionOracle.repairedMemory.trim());
  assert.equal(after.readback.plan.operation, 'CONSUME_QUOTE');
  assert.notEqual(after.request.capsule.sha256, prepared.request.capsule.sha256);
  assert.match(after.renderedContext, /Prior 1000-cent assertion is superseded/);
  assert.ok(after.sourceBindings.some(row => row.path === 'memory.md' && row.sha256 === sha256(adoptionOracle.repairedMemory)));
  const original = await readFile(path.join(x.output, 'result.json'));
  assert.equal((await runAdoption(x.output, {protocol: true})).status, 'QUALIFICATION_FAILED');
  assert.deepEqual(await readFile(path.join(x.output, 'result.json')), original);
});
test('prepared route rejects removed delivery evidence and changed shared sources before execution', supported, async t => {
  const x = await setup(t);
  const {runContextTransition} = await import('../scripts/context-run.mjs');
  const request = {...x.freeze.repair.request, operation: 'preflight'};
  assert.equal((await runContextTransition(request)).status, 'READY');
  const ack = JSON.parse(await readFile(path.join(x.freeze.workspace, request.readback.path)));
  const evidencePath = path.join(x.freeze.workspace, ack.evidenceRef.path), evidence = await readFile(evidencePath);
  await writeFile(evidencePath, '{}');
  assert.equal((await runContextTransition(request)).status, 'BLOCKED');
  await writeFile(evidencePath, evidence);
  await writeFile(path.join(x.freeze.workspace, 'ideas.md'), 'Tax forgotten');
  assert.equal((await runContextTransition(request)).status, 'BLOCKED');
  await assert.rejects(readFile(path.join(x.freeze.workspace, 'next-quote.json')), {code: 'ENOENT'});
});
test('public baseline verification refuses a preserved but incorrect implementation', supported, async t => {
  const x = await setup(t);
  await writeFile(path.join(x.freeze.workspace, 'quote.mjs'), "export const quote=quantity=>({currency:'USD',totalCents:1000*quantity});\n");
  await assert.rejects(verifyAdoptionBaseline(x.freeze.workspace), /Command failed/);
});
test('healthy protocol requires NO_CHANGE, leaves memory untouched and executes no commands', supported, async t => {
  const x = await setup(t, true), before = await readFile(path.join(x.freeze.workspace, 'memory.md'));
  const operations = JSON.parse(await readFile(path.join(x.freeze.workspace, 'operations.json')));
  const updater = JSON.parse(await readFile(path.join(x.output, 'updater.json')));
  assert.equal(operations.installation.ok, true);
  assert.equal(operations.installation.installedVersion, updater.doctor.installedVersion);
  assert.deepEqual(operations.installation.activation, x.freeze.activation);
  assert.equal(operations.updateDecision.selectedRuntime, x.freeze.activation.runtime.digest);
  assert.deepEqual(operations.custody.packageInventory, [x.freeze.activation.runtime.digest]);
  assert.match(operations.custody.observationBoundary, /Pre-dispatch/);
  assert.equal(operations.provenance.installedNoticeSha256,
    sha256(await readFile(path.join(x.freeze.workspace, 'docs/VYDYKHAI_NOTICE.md'))));
  assert.ok(x.freeze.frozenSources.rows.some(row => row.id === 'operations' && row.status === 'AVAILABLE'));
  assert.match(await readFile(path.join(x.freeze.workspace, 'state.md'), 'utf8'), /legacy-paused-worker.*lease WAITING/);
  assert.match(await readFile(path.join(x.freeze.workspace, 'state.md'), 'utf8'), /PRESERVE_PAUSED/);
  const result = await runAdoption(x.output, {protocol: true});
  assert.equal(result.status, 'PROTOCOL_PASS_NOT_SEMANTIC', JSON.stringify(result));
  assert.equal(result.healthyNoChange, true); assert.equal(result.actualCalls, 0);
  assert.deepEqual(result.state.health.findings, []); assert.deepEqual(result.state.reservations, {});
  assert.deepEqual(await readFile(path.join(x.freeze.workspace, 'memory.md')), before);
});
test('frozen input drift stops before any native call and retains first failed result', supported, async t => {
  const x = await setup(t);
  await writeFile(path.join(x.freeze.workspace, 'contract.md'), 'changed before run');
  const result = await runAdoption(x.output);
  assert.equal(result.status, 'QUALIFICATION_FAILED'); assert.equal(result.reason, 'FIXTURE_CHANGED');
  assert.equal(result.actualCalls, 0); assert.equal(result.boundary, 'PREFLIGHT');
  const failed = await readFile(path.join(x.output, 'failed-result.json'));
  await runAdoption(x.output); assert.deepEqual(await readFile(path.join(x.output, 'failed-result.json')), failed);
});
test('changed setup budget is refused against the pre-call freeze receipt', supported, async t => {
  const x = await setup(t);
  await writeFile(path.join(x.output, 'setup.json'), JSON.stringify({...x.freeze, budget: {...x.freeze.budget, maxCalls: 99}}));
  const result = await runAdoption(x.output);
  assert.equal(result.reason, 'SETUP_CHANGED'); assert.equal(result.actualCalls, 0);
});
test('separate diagnosis-only allocation cannot spend remaining calls or dispatch repairs',supported,async t=>{
  const x=await setup(t,false,true),before=await readFile(path.join(x.freeze.workspace,'memory.md'));
  assert.equal(x.freeze.budget.maxCalls,1);assert.equal(x.freeze.profile.review.maxCalls,1);
  const result=await runAdoption(x.output,{protocol:true});
  assert.equal(result.status,'PROTOCOL_PASS_NOT_SEMANTIC',JSON.stringify(result));
  assert.equal(result.diagnosisOnly,true);assert.equal(result.actualCalls,0);
  assert.equal(result.state.health.enrollment,'OWNER_DISPOSITION_DUE');assert.equal(result.state.health.disposition,null);
  assert.deepEqual(result.state.reservations,{});
  assert.deepEqual(await readFile(path.join(x.freeze.workspace,'memory.md')),before);
});
