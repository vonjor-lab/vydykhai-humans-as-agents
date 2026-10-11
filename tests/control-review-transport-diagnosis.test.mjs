// Real CLI, local scripted provider only: separate transport from model latency.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, realpath, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {runControlledWorker} from '../scripts/control-worker-run.mjs';
import {reviewCodexConfig} from '../scripts/control-codex-profile.mjs';
import {nativeProvider, codeItem, answerItem} from './native-provider-fixture.mjs';

const binary = process.env.VYDYKHAI_CODEX_BINARY;
for (const mode of ['completed', 'parent-deadline', 'delayed-completed']) {
  test(`actual reviewer transport ${mode}: final return and caller deadline are distinct`,
    {skip: !binary || process.platform !== 'darwin', timeout: 30000}, async t => {
      const root = await realpath(await mkdtemp(path.join(tmpdir(), 'review-transport-diagnosis-')));
      t.after(() => rm(root, {recursive: true, force: true}));
      const workspace = path.join(root, 'workspace'), control = path.join(root, 'control');
      const home = path.join(control, 'home'), sourceFile = path.join(control, 'sources.json');
      for (const dir of [workspace, control, home]) await mkdir(dir, {mode: 0o700});
      await writeFile(path.join(workspace, 'contract.md'), 'Retained public contract, synthetic transport probe.\n');
      await writeFile(sourceFile, JSON.stringify({schema: 'control.review-sources.v1', workspace,
        sources: [{id: 'contract', path: 'contract.md', purpose: 'Read-only acquisition'}]}), {mode: 0o600});
      const profile = reviewCodexConfig({workspace, endpointFile: sourceFile});
      assert.equal(profile['features.multi_agent'], false);
      assert.equal(profile['features.multi_agent_v2'], false);
      assert.equal(profile['agents.enabled'], false);
      let finalDelivered = false;
      const fake = await nativeProvider(t, async n => {
        if (n === 1) return codeItem("const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[t.name]({id:'contract'}));");
        assert.equal(n, 2);
        if (mode !== 'completed') await delay(6000);
        finalDelivered = true;
        return answerItem({probe: 'COMPLETED_SCRIPTED_RETURN', meaning: 'transport only, not semantic approval'});
      });
      const result = await runControlledWorker({binary, workspace, endpointFile: sourceFile, home, authHome: home,
        role: 'review', model: 'gpt-6.1-sol', effort: 'low',
        timeoutMs: mode === 'parent-deadline' ? 5000 : 20000,
        provider: fake.provider, prompt: 'Read contract, then return the scripted JSON. No work or mutation.'});
      const events = result.output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      assert.equal(fake.requests.length, 2);
      assert.equal(events.filter(e => e.type === 'item.completed' && e.item?.tool === 'read_source' &&
        e.item.status === 'completed' && !e.item.result?.isError).length, 1);
      assert.equal(events.some(e => /subagent/.test(e.item?.type ?? '')), false);
      if (mode === 'parent-deadline') {
        assert.equal(result.reason, 'TIMEOUT');
        assert.equal(result.signal, 'SIGKILL');
        assert.equal(result.state, 'CLOSED');
        assert.equal(finalDelivered, false);
        assert.equal(events.some(e => e.type === 'turn.completed'), false);
      } else {
        assert.equal(result.status, 'CLI_EXIT_OK', result.errors);
        assert.equal(result.reason, null);
        assert.equal(result.signal, null);
        assert.equal(finalDelivered, true);
        assert.equal(events.filter(e => e.type === 'turn.completed').length, 1);
        const answer = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1);
        assert.equal(JSON.parse(answer.item.text).probe, 'COMPLETED_SCRIPTED_RETURN');
      }
      t.diagnostic(JSON.stringify({mode, elapsedMs: result.timing.elapsedMs,
        lastStdoutMs: result.timing.lastStdoutMs, reason: result.reason,
        providerCalls: fake.requests.length, completedTurn: events.some(e => e.type === 'turn.completed'),
        inferenceCalls: 0, limit: 'Scripted local protocol; no conclusion about real inference latency'}));
    });
}
