import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './context-fixture.mjs';

// Ordinary reference admission uses owner-confirmed context. No protected host,
// fabricated independent verdict or provider call is part of these scenarios.
async function ownerPrepared(t, options = {}) {
  const f = await fixture(t, {...options, contextReviewer: 'outcome-owner'});
  await f.prepare();
  return f;
}

test('ordinary owner preparation permits local repair and whole-Candidate technical verification without PRE enrollment', async t => {
  const f = await ownerPrepared(t, {omitInputMember: true});
  assert.equal((await f.run('resume')).status, 'ACTION_COMPLETED');
  const failed = await f.run('accept');
  assert.equal(failed.code, 'BEHAVIOR_MISMATCH');
  // The same executor repairs the local Candidate, retaining the source contract
  // and capsule. A failed internal test is not an independent acceptance event.
  await f.put('candidate.mjs', f.candidateCode);
  const result = await f.run('accept');
  assert.equal(result.status, 'VERIFIED', result.raw);
  assert.equal(result.enforcement, 'reference');
  assert.equal(result.operation, 'accept');
  // VERIFIED is technical evidence for the subsequent fresh whole-outcome review.
  assert.equal(result.review, undefined);
});

test('ordinary whole-Candidate verification refuses missing required behavior evidence', async t => {
  const f = await ownerPrepared(t, {verificationMode: 'missing'});
  const result = await f.run('accept');
  assert.notEqual(result.status, 'VERIFIED');
  assert.equal(result.code, 'BEHAVIOR_EVIDENCE_MISSING', result.raw);
});

test('ordinary admission refuses stale owner evidence before any dependent command', async t => {
  const f = await ownerPrepared(t);
  await f.put('memory-review.json', {decision: 'approved', reviewer: 'outcome-owner'});
  for (const operation of ['resume', 'accept']) {
    const result = await f.run(operation);
    assert.equal(result.code, 'ARTIFACT_HASH_MISMATCH', result.raw);
    assert.equal(result.stats.commands, 0);
  }
  await assert.rejects(readFile(path.join(f.root, 'actions.log')), {code: 'ENOENT'});
});
