// Independent synthetic fault injection; protocol only, no provider or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, rm, readFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {stageAdoption,isAdoptionPausePreserved,validateAdoptionRestorationHarness} from '../scripts/qualify-control-adoption.mjs';

test('pause checker accepts exact retained shapes without coercion or conflicting control fields', () => {
  const object = {proposal:'PRESERVE_PAUSE',task:'legacy-paused-worker',owner:'owner',executor:'worker',
    lease:'WAITING',stage:'NOT_STARTED_PAUSED',reason:'Existing human gate remains unsatisfied',reviewAt:'Existing checkpoint'};
  const before = structuredClone(object);
  assert.equal(isAdoptionPausePreserved('PRESERVE_PAUSE'),true);
  assert.equal(isAdoptionPausePreserved(object),true);
  assert.equal(isAdoptionPausePreserved({...object,accountableOwner:'owner',sourceDisposition:'PRESERVE_PAUSED',
    reviewBoundary:'Existing checkpoint',effect:'Do not dispatch work'}),true);
  assert.deepEqual(object,before);
  for (const value of [null,undefined,[],{},'preserve_pause',' PRESERVE_PAUSE ',{proposal:'RESUME'},
    {...object,proposal:undefined},{...object,proposal:['PRESERVE_PAUSE']},{...object,action:'RESUME'},
    {...object,executionAuthorized:true},{...object,resume:true},{...object,sourceDisposition:'RESUME'},
    {...object,lease:'WORKING'},{...object,stage:'RUNNING'},{...object,task:'other'},
    {...object,owner:'other'},{...object,effect:{action:'RESUME'}}]) assert.equal(isAdoptionPausePreserved(value),false);
});

test('changed maintainer checker requires explicit independent hash while original frozen hash stays exact', () => {
  const original = 'a'.repeat(64), current = 'b'.repeat(64);
  const binding = {originalSha256:original,frozenSha256:original,currentSha256:current};
  const decision = {decision:'ACCEPT_PRE_RESTORE_APPLICATION',reviewer:'independent-reviewer',noResume:true,
    restorationHarnessSha256:current};
  assert.equal(validateAdoptionRestorationHarness({...binding,currentSha256:original}),true);
  assert.equal(validateAdoptionRestorationHarness({...binding,decision}),true);
  assert.throws(() => validateAdoptionRestorationHarness(binding),/CHECKER_REVIEW_REQUIRED/);
  for (const patch of [{restorationHarnessSha256:original},{restorationHarnessSha256:undefined},{reviewer:'owner'},
    {reviewer:'worker'},{reviewer:'participant'},{reviewer:'owner '},{reviewer:''},{noResume:false},{decision:'REJECT'}])
    assert.throws(() => validateAdoptionRestorationHarness({...binding,decision:{...decision,...patch}}),/CHECKER_REVIEW_REQUIRED/);
  assert.throws(() => validateAdoptionRestorationHarness({...binding,frozenSha256:current,decision}),/ORIGINAL_HARNESS_CHANGED/);
  assert.throws(() => validateAdoptionRestorationHarness({...binding,owner:'independent-reviewer',decision}),/CHECKER_REVIEW_REQUIRED/);
  assert.throws(() => validateAdoptionRestorationHarness({...binding,executor:'independent-reviewer',decision}),/CHECKER_REVIEW_REQUIRED/);
});

test('independent adoption must not certify inherited history modified during installed update',
  {skip: process.platform !== 'darwin', timeout: 60000}, async t => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'adoption-independent-')));
    t.after(() => rm(root, {recursive: true, force: true}));
    const output = path.join(root, 'case'), authHome = path.join(root, 'empty-auth');
    await mkdir(authHome, {mode: 0o700});
    const original = childProcess.execFileSync;
    let injected = false;
    const intercepted = t.mock.method(childProcess, 'execFileSync', (binary, args, options) => {
      const result = original(binary, args, options);
      if (args?.[1] === 'update' && args.includes('--from')) {
        injected = true;
        writeFileSync(path.join(options.cwd, 'history.md'), 'CORRUPTED inherited history during update\n');
      }
      return result;
    });
    syncBuiltinESMExports();
    t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
    await assert.rejects(stageAdoption({output, binary: process.execPath, authHome}),
      {message: 'INSTALL_PRESERVATION_FAILED:history.md'});
    assert.equal(injected, true);
    intercepted.mock.restore(); syncBuiltinESMExports();
    const result = JSON.parse(await readFile(path.join(output, 'setup-failed.json'), 'utf8'));
    assert.equal(result.status, 'SETUP_FAILED');
    assert.equal(result.boundary, 'HISTORICAL_INSTALL_UPDATE');
    assert.equal(result.reason, 'INSTALL_PRESERVATION_FAILED:history.md');
    assert.equal(result.modelsLaunched, 0);
    assert.match(await readFile(path.join(output, 'project/history.md'), 'utf8'), /CORRUPTED inherited history/);
    await assert.rejects(readFile(path.join(output, 'setup.json')), {code: 'ENOENT'});
    await assert.rejects(readFile(path.join(output, 'activation.json')), {code: 'ENOENT'});
  });
