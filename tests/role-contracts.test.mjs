import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const roles = [
  'framework-orchestrator',
  'context-preparation',
  'task-context-handoff-template',
  'independent-control',
];
const fields = ['Purpose', 'Inputs', 'Actions and boundaries', 'Output and recipient', 'Evidence', 'Failure and exit'];

test('safe-boundary context choice preserves meaning without forced restart or extra review', () => {
  const route = read('docs/workflows/context-routing.md');
  assert.match(route, /completed meaningful stage before entering the next increment/);
  assert.match(route, /A local failed test or ordinary clarification is not automatically/);
  assert.match(route, /Keep the physical context when its history remains directly useful/);
  assert.match(route, /decisions and their reasons, rejected approaches, constraints, dependency\/consumer route and known gaps/);
  assert.match(route, /old owner is quiescent/);
  assert.match(route, /Keep profile, required review and proven Return delivery unchanged/);
  assert.match(route, /Unsupported host reduction stays LIMITED/);
  assert.match(route, /first positive request input, or UNKNOWN/);
  assert.match(route, /No additional reviewer-of-handoff or replay of unchanged tests/);
  assert.match(route, /only an observed supported host operation changes active history/);
  assert.match(read('.agents/skills/start-work/SKILL.md'), /meaningful completed-stage boundaries/);
  assert.match(read('docs/workflows/task-context-handoff-template.md'), /actual readback or LIMITED/);
  assert.match(read('docs/workflows/accept-work.md'), /same acceptance, include transition\/recovery costs/);
  const manifest = JSON.parse(read('vydykhai.json'));
  assert.equal(manifest.adoptionRequirements.filter(r => r.id === 'context-routing').length, 1);
});

test('control evidence stays separate from content inspection without weakening review', () => {
  const contract = read('docs/workflows/framework-orchestrator.md');
  assert.match(contract, /decision-ready evidence: DOD coverage, artifact identity\/link, independent verdict/);
  assert.match(contract, /Executors inspect and present images, code, detailed logs and calculations/);
  assert.match(contract, /required independent reviewers inspect original artifacts separately/);
  assert.match(contract, /explicit human request or a named contradiction unresolved by evidence/);
  assert.match(contract, /never substitute an author's summary for required review/);
  assert.match(read('.agents/skills/framework-orchestrator/SKILL.md'), /role-contract/);
});

// Structural guard only: semantics and actual role behavior require separate evidence.
for (const role of roles) {
  test(role + ' has one navigable role contract', () => {
    const path = 'docs/workflows/' + role + '.md';
    const text = read(path);
    assert.equal(text.split('## Role contract').length - 1, 1);
    const contract = text.split('## Role contract')[1].split('\n## ')[0];
    for (const field of fields) assert.ok(contract.includes('**' + field + ':**'), field);
    assert.ok(read('docs/TOOLKIT.md').includes('workflows/' + role + '.md#role-contract'));
  });
}
