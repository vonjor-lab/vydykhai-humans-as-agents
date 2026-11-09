import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {measureContextUse} from '../scripts/context-cost.mjs';

const roles = ['preparation', 'execution', 'review', 'recovery', 'coordination'];
const sample = role => ({id: role, role, model: 'TerraMedium', effort: 'medium', evidence: 'request', inputTokens: 10, cachedInputTokens: 5, outputTokens: 2});
const input = () => ({schema: 'context.usage.v1', owner: 'owner', taskId: 'task', maxInputTokens: 100, complete: true, unknownCosts: [], samples: [sample('execution')]});

test('omitted roles remain partial without fabricating samples', () => {
  const v = input(), before = structuredClone(v), result = measureContextUse(v);
  assert.equal(result.coverage, 'PARTIAL');
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(result.missingRoles, roles.filter(r => r !== 'execution'));
  assert.deepEqual(Object.keys(result.roles), ['execution']);
  assert.deepEqual(v, before);
});

test('all observed roles or justified inapplicability allow declared completeness', () => {
  const v = input(); v.samples = roles.map(sample);
  assert.equal(measureContextUse(v).coverage, 'DECLARED_COMPLETE');
  v.samples = [sample('execution')];
  v.nonApplicable = roles.filter(r => r !== 'execution').map(role => ({role, reason: 'did not occur'}));
  const result = measureContextUse(v);
  assert.equal(result.coverage, 'DECLARED_COMPLETE');
  assert.deepEqual(result.nonApplicable, v.nonApplicable);
  assert.deepEqual(result.missingRoles, []);
  assert.equal(result.totals.requests, 1);
  v.unknownCosts = ['unmeasured review'];
  assert.equal(measureContextUse(v).coverage, 'PARTIAL');
  v.unknownCosts = []; v.complete = false;
  assert.equal(measureContextUse(v).coverage, 'PARTIAL');
  v.complete = true; v.samples = []; v.nonApplicable.push({role: 'execution', reason: 'did not occur'});
  assert.equal(measureContextUse(v).coverage, 'PARTIAL');
});

test('invalid or contradictory declarations and telemetry remain rejected', () => {
  for (const declaration of [null, {}, [{role: 'review', reason: ' '}], [{role: 'other', reason: 'none'}],
    [{role: 'review', reason: 'none'}, {role: 'review', reason: 'none'}], [{role: 'execution', reason: 'none'}],
    [{role: 'review', reason: 'none', extra: true}]]) {
    const v = input(); v.nonApplicable = declaration;
    assert.throws(() => measureContextUse(v), /USAGE_/);
  }
  const v = input(); v.samples[0].cachedInputTokens = 11;
  assert.throws(() => measureContextUse(v), /USAGE_SAMPLE_INVALID/);
  v.samples = [sample('execution'), {...sample('review'), inputTokens: Number.MAX_SAFE_INTEGER}];
  assert.throws(() => measureContextUse(v), /USAGE_OVERFLOW/);
  v.samples = [{...sample('execution'), inputTokens: 101}];
  assert.equal(measureContextUse(v).status, 'SAFE_BOUNDARY_REFRAME_DUE');
});

test('actual measure CLI reports partial and justified coverage without writes', async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'usage-coverage-'));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  const v = input(), file = path.join(cwd, 'usage.json');
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/vydykhai.mjs', import.meta.url)), 'context-prepare', 'measure', '--input', 'usage.json'], {cwd, encoding: 'utf8'});
  await writeFile(file, JSON.stringify(v));
  let result = run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).coverage, 'PARTIAL');
  v.nonApplicable = roles.filter(r => r !== 'execution').map(role => ({role, reason: 'did not occur'}));
  await writeFile(file, JSON.stringify(v));
  result = run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).coverage, 'DECLARED_COMPLETE');
  assert.deepEqual(await readdir(cwd), ['usage.json']);
});
