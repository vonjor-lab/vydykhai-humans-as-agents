import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = file => readFile(new URL('../'+file, import.meta.url), 'utf8');

test('foreground readiness never requires a fabricated incident or model receipt', async () => {
  const launch = await read('docs/workflows/project-launch.md');
  assert.match(launch, /NOOP.*sufficient on the healthy path/);
  assert.match(launch, /HEALTHY.*only after an actual semantic incident/);
  assert.match(launch, /PROJECT_READY_WITH_LIMITS/);
  assert.match(launch, /no model call or fabricated anomaly/);
  assert.match(await read('BOOTSTRAP.md'), /Healthy NOOP needs no model/);
});

test('explicit V2 entry and policy priority preserve legacy compatibility', async () => {
  const manifest = JSON.parse(await read('vydykhai.json'));
  assert.deepEqual(manifest.updateChannels, {'1':'main','2':'release/2.x'});
  assert.match(manifest.compatibilityNotes['agentRoutingPolicy.profiles'], /effortPolicy.*authoritative/);
  assert.equal(manifest.agentRoutingPolicy.effortPolicy.orchestrator.default, 'low');
  assert.equal(manifest.defaultAgentProfile.reasoningEffort, 'xhigh');
  assert.match(await read('README.md'), /tree\/release\/2\.x/);
});

test('short adoption entry points retain conditional obligations and scoped evidence keys', async () => {
  const manifest = JSON.parse(await read('vydykhai.json'));
  for (const id of ['own-transition','prepared-work']) {
    const r = manifest.adoptionRequirements.find(r => r.id === id);
    assert.ok(r.action.length < 2200);
    assert.equal(r.since, '1.30.0'); assert.ok(r.reuseBy.includes('targetBundle'));
    assert.match(r.action, /pending/); assert.match(r.action, /conditional-/);
  }
  const workflow = await read('docs/workflows/framework-activation.md');
  for (const phrase of ['full catalog union','same-projection owner application',
    'incomplete tool calls, corrupt traces and unknown outcomes are not resumable',
    'Protected multipart recall requires uniquely registered whole parts',
    'Unresolved historical applicability stays PROVISIONAL/PARTIAL',
    'No secret values, new access grant', 'unhinted retrieval/application'])
    assert.ok(workflow.includes(phrase), phrase);
});
