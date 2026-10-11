// No inference: compare sequential and concurrent acquisition through the native client.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {endpointFixture, endpointServices} from "./control-endpoint-fixture.mjs";
import {nativeProvider, codeItem, answerItem} from "./native-provider-fixture.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {sha256} from "../scripts/memory-brief.mjs";

const binary = process.env.VYDYKHAI_CODEX_BINARY;
for (const mode of ["sequential", "concurrent"]) {
  test(`native HEALTH ${mode} eight-source completion reaches provider and v2 admission`,
    {skip: !binary || process.platform !== "darwin", timeout: 30000}, async t => {
      const x = await endpointFixture(t), dirs = {};
      for (const name of ["journal", "room", "home", "health"]) {
        dirs[name] = path.join(x.privateRoot, name);
        await mkdir(dirs[name], {mode: 0o700});
      }
      const sources = [], expected = [];
      for (let i = 1; i <= 8; i++) {
        const id = `source${i}`, text = `Scripted protocol evidence ${i}; not semantic proof`;
        sources.push({id, path: `${id}.md`, purpose: "Concurrent completion protocol fixture"});
        expected.push({id, status: "AVAILABLE", sha256: sha256(text), text});
        await x.f.put(`${id}.md`, text);
      }
      const sourceFile = path.join(x.privateRoot, "review-sources.json");
      await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1",
        workspace: x.f.root, sources}), {mode: 0o600});
      const config = {...x.profile.config, evidenceRegistry: sourceFile, health: {
        scope: "Protocol-only concurrent acquisition", intervalMs: 60000,
        maxBranches: 2, maxWorktrees: 1, triggerSourceIds: sources.map(s => s.id), repairTasks: ["repair"]}};
      const host = await openControlHost(dirs.health, config, endpointServices);
      await host.initialize();
      const answer = {schema: "control.review-answer.v2", rowGroups: [
        {ids: controlCheckIds.filter(id => id !== "C12.01"), status: "NOT_APPLICABLE",
          sourceIds: ["source1"], reason: "Scripted protocol fixture; no semantic applicability established"},
        {ids: ["C12.01"], status: "UNKNOWN", sourceIds: ["source1"],
          reason: "Repository observation unavailable", findingId: "repo-gap"}],
        newFindings: [{id: "repo-gap", checkId: "C12.01", sourceIds: ["source1"],
          evidence: "Repository observation unavailable", owner: "owner", work: "repair",
          reviewAt: new Date(Date.now() + 60000).toISOString(), blocksResume: true}], resolutions: []};
      const ids = JSON.stringify(sources.map(s => s.id));
      const read = `
        const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));
        const ids=${ids};let pending=0,maxPending=0;
        async function acquire(id){
          pending++;maxPending=Math.max(maxPending,pending);
          try{return {id,result:await tools[a.name]({id})};}finally{pending--;}
        }
        const readbacks=[];
        ${mode === "concurrent"
          ? "readbacks.push(...await Promise.all(ids.map(acquire)));"
          : "for(const id of ids)readbacks.push(await acquire(id));"}
        text({schema:'control.concurrent-readback.v1',mode:${JSON.stringify(mode)},maxPending,pending,readbacks});
      `;
      const provider = await nativeProvider(t, async n => {
        assert.ok(n <= 2, "No retry or additional model response expected");
        return n === 1 ? codeItem(read) : answerItem(answer);
      });
      const review = await openModelReview({directory: dirs.journal, controlRoot: x.privateRoot,
        reviewer: "reviewer", sourceFile, native: {binary, workspace: dirs.room, home: dirs.home,
          model: "gpt-6.1-sol", effort: "low", timeoutMs: 15000, provider: provider.provider},
        maxCalls: 1, expiresAt: new Date(Date.now() + 60000).toISOString(),
        scope: {kind: "protocol-only", requiredSourceIds: sources.map(s => s.id)}});
      await review.initialize();
      const tick = await runControlTick(host, {review: (...args) => review.review(...args), timeoutMs: 20000});
      assert.equal(tick.results[0].action, "OWNER_DISPOSITION_DUE", JSON.stringify(tick));
      assert.equal(provider.requests.length, 2, "Post-acquisition request reached the local provider");
      const outputs = provider.requests[1].input.filter(i => i.type === "custom_tool_call_output");
      assert.equal(outputs.length, 1, "Native client returned the completed exec batch");
      assert.ok(Array.isArray(outputs[0].output), "Provider received structured native exec output");
      const batches = outputs[0].output.filter(c => c.type === "input_text").flatMap(c => {
        try {return [JSON.parse(c.text)];} catch {return [];}
      }).filter(value => value?.schema === "control.concurrent-readback.v1");
      assert.equal(batches.length, 1, "Provider received exactly one complete batch record");
      const batch = batches[0];
      assert.equal(batch.mode, mode);
      // Outstanding JS tool promises are deterministic; native event ordering is not.
      assert.equal(batch.maxPending, mode === "concurrent" ? 8 : 1);
      assert.equal(batch.pending, 0);
      assert.equal(batch.readbacks.length, 8);
      const returned = batch.readbacks.map(({id, result}) => {
        assert.ok(!result.isError, `Provider received successful ${id} output`);
        const content = result.content.filter(c => c.type === "text");
        assert.equal(content.length, 1);
        const source = JSON.parse(content[0].text);
        assert.equal(source.id, id);
        assert.equal(sha256(source.text), source.sha256);
        const {status, sha256: digest, text} = source;
        return {id, status, sha256: digest, text};
      });
      assert.deepEqual(returned, expected, "All eight exact source outputs reached the next provider request");
      const health = (await host.snapshot()).health;
      assert.equal(health.review.rows.length, 87);
      assert.equal(health.findings[0].id, "repo-gap");
      assert.equal(health.disposition, null);
      const observed = await review.observe(health.review.runId);
      const trace = JSON.parse(await readFile(path.join(dirs.journal, observed.trace.file), "utf8"));
      const events = trace.output.split("\n").filter(Boolean).map(JSON.parse);
      const reads = events.filter(e => e.item?.type === "mcp_tool_call" && e.item.tool === "read_source");
      const completed = reads.filter(e => e.type === "item.completed");
      assert.equal(completed.length, 8);
      assert.equal(new Set(completed.map(e => e.item.id)).size, 8);
      assert.deepEqual(completed.map(e => e.item.arguments.id).sort(), sources.map(s => s.id).sort());
      for (const event of completed) {
        const started = reads.findIndex(e => e.type === "item.started" && e.item.id === event.item.id);
        assert.ok(started >= 0 && started < reads.indexOf(event), "Each tool call starts before its own completion");
        assert.equal(event.item.status, "completed");
        assert.ok(!event.item.result?.isError);
      }
      assert.equal(events.filter(e => e.type === "turn.completed").length, 1);
    });
}
