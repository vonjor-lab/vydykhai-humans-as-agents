import test from 'node:test';
import assert from 'node:assert/strict';
import {checkScopedNoChange, noChangeOracle} from '../scripts/qualify-adoption-no-change.mjs';

const base = () => ({findings: [], review: {rows: noChangeOracle.requiredPass.map(id => ({id, status: 'PASS', evidence: 'source:fixture:hash'}))}});
const limit = () => ({id: 'legacy-lease', checkId: 'C11.02', status: 'OPEN', blocksResume: false,
  evidence: 'Legacy task remains paused; its lease evidence is unknown and does not affect pricing', owner: 'owner',
  work: 'paused-worker-task', reviewAt: '2026-10-09T00:00:00Z'});
function withLimit() {
  const health = base(), f = limit(); health.findings.push(f);
  health.review.rows.push({id: f.checkId, status: 'UNKNOWN', findingId: f.id, reason: f.evidence, evidence: 'source:paused:hash'});
  return health;
}
test('scoped no-change retains explicit external uncertainty without calling a project pristine', () => {
  assert.equal(checkScopedNoChange(base()).status, 'SCOPED_NO_CHANGE_WITH_RETAINED_LIMITS');
  const h = withLimit(), before = structuredClone(h), result = checkScopedNoChange(h);
  assert.equal(result.retained[0].id, 'legacy-lease');
  assert.match(result.acceptance, /REQUIRES_OWNER_APPLICATION/);
  assert.deepEqual(h, before);
});
test('nonblocking label does not excuse a demonstrated defect or an unproved current boundary', () => {
  const h = withLimit(); h.review.rows.at(-1).status = 'FINDING';
  assert.throws(() => checkScopedNoChange(h), /DEMONSTRATED_DEFECT/);
  for (const id of noChangeOracle.requiredPass) {
    const changed = base(); changed.review.rows.find(row => row.id === id).status = 'UNKNOWN';
    assert.throws(() => checkScopedNoChange(changed), /SCOPE_UNPROVEN/);
  }
});
test('unknowns cannot escape by attribution, missing owner or broadened criteria', () => {
  for (const mutate of [h => {h.findings[0].blocksResume = true;}, h => {h.findings[0].owner = '';},
    h => {h.findings[0].work = 'maintenance';}, h => {h.findings[0].reviewAt = 'later';},
    h => {h.findings[0].checkId = 'C25.01';}, h => {h.review.rows.at(-1).reason = '';},
    h => {h.findings[0].evidence = '';}, h => {h.review.rows.at(-1).status = 'PASS';}]) {
    const h = withLimit(); mutate(h);
    assert.throws(() => checkScopedNoChange(h), /UNOWNED_OR_IN_SCOPE/);
  }
});
