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
