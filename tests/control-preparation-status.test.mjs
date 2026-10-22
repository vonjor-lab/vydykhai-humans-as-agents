// No inference: host/readback regressions and native local fake-provider probes.
import test from "node:test";
import assert from "node:assert/strict";
import fs, {mkdir, readFile, writeFile, unlink} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {endpointFixture, endpointServices} from "./control-endpoint-fixture.mjs";
import {nativeProvider, codeItem, answerItem} from "./native-provider-fixture.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {preparationControl} from "../scripts/control-owner.mjs";
import {runControlledWorker} from "../scripts/control-worker-run.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {preparationCodexConfig, ownerCodexConfig, dispositionCodexConfig} from "../scripts/control-codex-profile.mjs";
import {controlCatalog, controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {sha256, canonicalJson} from "../scripts/memory-brief.mjs";

const hash = v => sha256(canonicalJson(v));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const ownerScript = fileURLToPath(new URL("../scripts/control-owner-mcp.mjs", import.meta.url));
async function setup(t) {
  const x = await endpointFixture(t), directory = path.join(x.privateRoot, "preparation-host");
  await x.approve();
  const binding = Object.values((await x.host.snapshot()).grants)[0].binding;
  await mkdir(directory, {mode: 0o700});
  const sourceFile = path.join(x.privateRoot, "sources.json");
  await x.f.put("contract.md", "Public boundary: buildBundle@bundle-r2; no producer edits.");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace: x.f.root,
    sources: [{id: "contract", path: "contract.md", purpose: "Public contract"},
      {id: "memory", path: "memory.md", purpose: "Historical acceptance snapshot"}]}), {mode: 0o600});
  const config = {...x.profile.config, evidenceRegistry: sourceFile};
  const host = await openControlHost(directory, config, endpointServices); await host.initialize();
  const ref = name => x.f.put(`${name}.md`, name === "memory" ? "Independent control pending; persistence not yet observed at acceptance." : name);
  const acceptance = {schema: "work.product-acceptance.v1", id: "selected", project: "fixture", task: "previous",
    owner: config.owner, executor: config.executor, status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: await ref("return"), artifact: await ref("artifact"), technicalProof: await ref("proof"),
    goal: await ref("goal"), retention: []};
  for (const id of retentionKinds) acceptance.retention.push({id, required: true, expected: await ref(id)});
  await host.accept(acceptance);
  const offer = await host.claimReview("selected"), now = new Date().toISOString();
  const finding = {id: "owned-debt", checkId: "C12.01", area: "C12",
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C12.01").criterion,
    evidence: `private evidence ${x.privateRoot}/do-not-disclose`, owner: "maintenance", work: "cleanup",
    status: "OPEN", firstSeen: now, reviewAt: new Date(Date.now() + 3600000).toISOString(), attempts: 0, blocksResume: false};
  const verdict = {phase: "POST_ACCEPT", key: offer.key, reviewer: config.reviewer, runId: offer.runId,
    resultUse:{status:"ALLOW",acceptanceSha256:hash(acceptance),evidence:"fixture:independent-result",findingIds:[]},
    observedAt: now, findings: [finding], rows: controlCheckIds.map(id => id === finding.checkId ?
      {id, status: "FINDING", findingId: finding.id, reason: "Owned debt", evidence: "fixture"} :
      {id, status: "PASS", evidence: "fixture"})};
  await host.review("selected", offer, verdict);
  const lease = {owner: finding.owner, work: finding.work, state: "PREPARED", reviewAt: finding.reviewAt,
    checkpoint: `${x.privateRoot}/private-checkpoint`, evidence: "private-lease-token"};
  await host.disposition("selected", {owner: config.owner, action: "CONTINUE", nextAction: x.f.task.id,
    reviewKey: hash(verdict), evidence: "fixture: applied verdict"}, [lease]);
  await host.approveCommand(binding, {reviewer: config.reviewer, reviewReceipt: "fixture: independent preparation",
    dependencies: ["selected"], expiresAt: Date.now() + 120000});
  const actual = await runControlledContextTransition({...x.f.request, operation: "resume"}, {...endpointServices, control: host.control});
  assert.equal(actual.status, "ACTION_COMPLETED");
  await host.close("selected");
  await host.accept({...acceptance, id: "unrelated", task: "DO_NOT_LEAK_UNRELATED_TASK"});
  const controlEndpointFile = path.join(x.privateRoot, "read-only-owner.json");
  const profile = {schema: "control.owner-endpoint.v1", capability: "CONTROL_READ_ONLY", directory, config, acceptanceIds: ["selected"]};
  await writeFile(controlEndpointFile, JSON.stringify(profile), {mode: 0o600});
  const home = path.join(x.privateRoot, "preparer-home"), workspace = path.join(x.privateRoot, "preparer-room");
  await mkdir(home, {mode: 0o700}); await mkdir(workspace, {mode: 0o700});
  return {...x, host, config, directory, sourceFile, acceptance, finding, lease, profile, controlEndpointFile,
    native: {binary: binary ?? "/usr/bin/false", workspace, home, authHome: home, endpointFile: sourceFile,
      controlEndpointFile, role: "preparation", model: "gpt-6.1-sol", effort: "low", timeoutMs: 20000,
      prompt: "Prepare from the public sources and current read-only control status. Do not execute."}};
}
const durable = async x => (await openControlStore(x.directory)).read();
function rpc(file, messages, extraArgs = []) {
  const run = spawnSync(process.execPath, [ownerScript, file, ...extraArgs], {encoding: "utf8", timeout: 15000,
    input: messages.map((m, i) => JSON.stringify({jsonrpc: "2.0", id: i + 1, ...m})).join("\n") + "\n"});
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim().split("\n").map(JSON.parse);
}
const readStatus = args => ({method: "tools/call", params: {name: "read_status", arguments: args ?? {}}});

test("current closed readback is separate from unchanged historical acceptance and cannot grant execution", async t => {
  const x = await setup(t), before = await durable(x), historical = await readFile(path.join(x.f.root, "memory.md"), "utf8");
  const receipt = await preparationControl(x.host, ["selected"]).readStatus();
  assert.equal(receipt.receipt, "DOES_NOT_GRANT_EXECUTION"); assert.equal(receipt.mutationAuthorized, false);
  assert.equal(receipt.paused, false); assert.deepEqual(receipt.acceptanceIds, ["selected"]);
  const row = receipt.rows[0];
  assert.equal(row.historicalAcceptance.temporalScope, "AT_ACCEPTANCE_NOT_CURRENT_CONTROL");
  assert.equal(row.historicalAcceptance.digest, hash(x.acceptance));
  assert.equal(row.currentControl.enrollment, "CLOSED"); assert.equal(row.currentControl.assessedAction, "CONTROL_CONFIRMED");
  assert.equal(row.currentControl.continuationObserved, true);
  assert.equal(row.retention.complete, true); assert.ok(row.retention.rows.every(r => r.status === "MATCH"));
  assert.ok(row.sources.every(r => r.status === "MATCH"));
  assert.equal(row.findings[0].id, "owned-debt"); assert.equal(row.findings[0].status, "OPEN");
  assert.equal(row.repairLeases[0].state, "PREPARED");
  const encoded = canonicalJson(receipt);
  for (const secret of [x.privateRoot, x.f.root, "DO_NOT_LEAK_UNRELATED_TASK", "private-lease-token", "continuationEvidence", "grants", "reservations"])
    assert.ok(!encoded.includes(secret), secret);
  assert.equal(historical, await readFile(path.join(x.f.root, "memory.md"), "utf8"));
  assert.match(historical, /Independent control pending/);
  assert.deepEqual(await durable(x), before);
  assert.equal((await x.host.preparationStatus(["selected"], {expectedDigest: receipt.digest})).digest, receipt.digest);
});

for (const change of ["missing-retention", "changed-retention", "changed-source", "paused"])
  test(`current projection reports ${change}, not stale closed readiness`, async t => {
    const x = await setup(t);
    if (change === "missing-retention") await unlink(path.join(x.f.root, "memory.md"));
    if (change === "changed-retention") await x.f.put("memory.md", "Changed retained history");
    if (change === "changed-source") await x.f.put("artifact.md", "Changed accepted artifact");
    if (change === "paused") await x.host.pause(true);
    const before = await durable(x), receipt = await x.host.preparationStatus(["selected"]), row = receipt.rows[0];
    assert.equal(row.currentControl.enrollment, "CLOSED");
    assert.notEqual(row.currentControl.assessedAction, "CONTROL_CONFIRMED");
    if (change === "paused") {assert.equal(receipt.paused, true); assert.equal(row.currentControl.assessedAction, "PRESERVE_PAUSE");}
    if (change.includes("retention")) assert.equal(row.retention.complete, false);
    if (change === "missing-retention") assert.equal(row.retention.rows.find(r => r.id === "memory").status, "MISSING");
    if (change === "changed-source") assert.equal(row.sources.find(r => r.id === "artifact").status, "MISMATCH");
    assert.deepEqual(await durable(x), before);
  });

test("explicit selection refuses empty, duplicate, over-limit, unknown and unregistered acceptance IDs", async t => {
  const x = await setup(t), before = await durable(x);
  for (const ids of [[], ["selected", "selected"], Array.from({length: 33}, (_, i) => `id${i}`), ["__proto__"], ["../private"], [null]])
    await assert.rejects(x.host.preparationStatus(ids), /PREPARATION_ACCEPTANCE_IDS_INVALID/);
  await assert.rejects(x.host.preparationStatus(["selected", "unknown"]), /ACCEPTANCE_NOT_FOUND/);
  const capability = preparationControl(x.host, ["selected"]);
  assert.deepEqual(Object.keys(capability), ["readStatus"]);
  await assert.rejects(capability.readStatus({acceptanceIds: ["unrelated"]}), /OWNER_ARGUMENT_INVALID/);
  await assert.rejects(capability.readStatus({expectedDigest: "not-a-digest"}), /PREPARATION_DIGEST_INVALID/);
  assert.deepEqual(await durable(x), before);
});

for (const change of ["source", "retention", "host"])
  test(`freshness assertion refuses intervening ${change}`, async t => {
    const x = await setup(t), receipt = await x.host.preparationStatus(["selected"]);
    if (change === "source") await x.f.put("contract.md", "New public contract");
    if (change === "retention") await x.f.put("memory.md", "Updated history");
    if (change === "host") await x.host.pause(true);
    const before = await durable(x);
    await assert.rejects(x.host.preparationStatus(["selected"], {expectedDigest: receipt.digest}), /PREPARATION_STATUS_STALE/);
    assert.deepEqual(await durable(x), before);
  });

test("unrelated host journal changes do not invalidate selected current status", async t => {
  const x = await setup(t), receipt = await x.host.preparationStatus(["selected"]);
  await x.host.accept({...x.acceptance, id: "another", task: "other-task"});
  assert.equal((await x.host.preparationStatus(["selected"], {expectedDigest: receipt.digest})).digest, receipt.digest);
});

test("current selected command authority changes invalidate preparation without exposing grants", async t => {
  const x = await setup(t), receipt = await x.host.preparationStatus(["selected"]);
  const binding = Object.values((await x.host.snapshot()).grants)[0].binding;
  await x.host.approveCommand({...binding, commandSha256: sha256("another exact approved command")},
    {reviewer: x.config.reviewer, reviewReceipt: "fixture: bounded independent authority",
      dependencies: ["selected"], expiresAt: Date.now() + 120000});
  await assert.rejects(x.host.preparationStatus(["selected"], {expectedDigest: receipt.digest}), /PREPARATION_STATUS_STALE/);
  assert.ok(!canonicalJson(await x.host.preparationStatus(["selected"])).includes("binding"));
});

for (const outcome of ["in-flight", "unknown", "paused-in-flight"])
  test(`current projection prioritizes ${outcome} review over historical confirmed verdict`, async t => {
    const x = await setup(t), original = await x.host.preparationStatus(["selected"]);
    const binding = Object.values((await x.host.snapshot()).grants)[0].binding;
    t.mock.timers.enable({apis: ["Date"], now: Date.parse(x.finding.reviewAt) + 1});
    const offer = await x.host.claimReview("selected");
    if (outcome === "unknown") await x.host.reviewFailure("selected", offer.runId);
    if (outcome === "paused-in-flight") await x.host.pause(true);
    const before = await durable(x), receipt = await x.host.preparationStatus(["selected"]), current = receipt.rows[0].currentControl;
    assert.equal(current.enrollment, outcome === "unknown" ? "REVIEW_RECONCILIATION_REQUIRED" : "REVIEW_IN_FLIGHT");
    assert.equal(current.reviewInFlight, true);
    assert.equal(current.assessedAction, outcome === "paused-in-flight" ? "PRESERVE_PAUSE" : "REVIEW_PENDING");
    assert.equal(current.repairReviewOverdue, true);
    assert.equal(receipt.rows[0].historicalAcceptance.digest, original.rows[0].historicalAcceptance.digest);
    assert.equal(receipt.rows[0].retention.complete, true);
    assert.equal(receipt.rows[0].findings[0].status, "OPEN");
    await assert.rejects(x.host.preparationStatus(["selected"], {expectedDigest: original.digest}), /PREPARATION_STATUS_STALE/);
    assert.deepEqual(await durable(x), before);
    const nextBinding = {...binding, commandSha256: sha256("next independently reviewed command")};
    await x.host.approveCommand(nextBinding, {reviewer: x.config.reviewer, reviewReceipt: "fixture: reviewed next command",
      dependencies: ["selected"], expiresAt: Date.now() + 60000});
    await assert.rejects(x.host.control.authorize(nextBinding), outcome === "paused-in-flight" ? /CONTROL_PAUSED/ : /REVIEW_PENDING/);
  });

for (const change of ["source", "host"])
  test(`projection refuses torn readback during concurrent ${change} mutation`, async t => {
    const x = await setup(t), originalRead = fs.readFile; let changed = false;
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      const bytes = await originalRead(file, ...args);
      if (!changed && file === path.join(x.f.root, "memory.md")) {
        changed = true;
        if (change === "source") await x.f.put("memory.md", "Concurrent retained update");
        else await x.host.pause(true);
      }
      return bytes;
    });
    syncBuiltinESMExports();
    t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
    await assert.rejects(x.host.preparationStatus(["selected"]), /PREPARATION_STATUS_CHANGED/);
    assert.equal(changed, true);
  });

test("read-only owner MCP offers only read_status and refuses direct mutation or alternate selection", async t => {
  const x = await setup(t), before = await durable(x);
  const replies = rpc(x.controlEndpointFile, [{method: "initialize"}, {method: "tools/list"}, readStatus(),
    ...["respond", "acknowledge_notice", "record_retention_repair", "request_health_repair_review", "inbox", "read_verdict"]
      .map(name => ({method: "tools/call", params: {name, arguments: {id: "selected"}}})),
    readStatus({acceptanceIds: ["unrelated"]})]);
  assert.deepEqual(replies[1].result.tools.map(t => t.name), ["read_status"]);
  const receipt = JSON.parse(replies[2].result.content[0].text);
  assert.equal(receipt.rows[0].currentControl.enrollment, "CLOSED");
  for (const reply of replies.slice(3, -1)) assert.equal(reply.error?.code, -32601);
  assert.equal(replies.at(-1).result.isError, true);
  const fresh = rpc(x.controlEndpointFile, [readStatus({expectedDigest: receipt.digest})]);
  assert.equal(fresh[0].result.isError, undefined);
  await x.f.put("memory.md", "Changed after acquired receipt");
  assert.equal(rpc(x.controlEndpointFile, [readStatus({expectedDigest: receipt.digest})])[0].result.isError, true);
  assert.deepEqual(await durable(x), before);
});

test("preparation profile requires both servers, no execute capability, and preserves other profiles", () => {
  const options = {workspace: "/tmp/room", endpointFile: "/tmp/private/sources.json", controlEndpointFile: "/tmp/private/owner.json"};
  assert.throws(() => preparationCodexConfig({...options, controlEndpointFile: undefined}), /PREPARATION_CONTROL_ENDPOINT_REQUIRED/);
  const config = preparationCodexConfig(options);
  assert.equal(config["mcp_servers.vydykhai_review"].required, true);
  assert.equal(config["mcp_servers.vydykhai_owner"].required, true);
  assert.deepEqual(config["mcp_servers.vydykhai_owner"].enabled_tools, ["read_status"]);
  assert.equal(config["mcp_servers.vydykhai_control"], undefined);
  assert.ok(ownerCodexConfig(options)["mcp_servers.vydykhai_owner"].enabled_tools.includes("record_retention_repair"));
  assert.ok(dispositionCodexConfig(options)["mcp_servers.vydykhai_owner"].enabled_tools.includes("respond"));
});

test("worker preflight refuses omitted, unsafe, unknown-ID and mismatched preparation endpoints before dispatch",
  {skip: process.platform !== "darwin"}, async t => {
    const x = await setup(t), before = await durable(x);
    await assert.rejects(runControlledWorker({...x.native, controlEndpointFile: undefined}), /PREPARATION_CONTROL_ENDPOINT_REQUIRED/);
    for (const capability of [undefined, "CONTROL_DISPOSITION_ONLY", "CONTROL_OTHER"])
      {await writeFile(x.controlEndpointFile, JSON.stringify({...x.profile, capability}));
        await assert.rejects(runControlledWorker(x.native), /PREPARATION_CONTROL_PROFILE_INVALID/);}
    for (const acceptanceIds of [[], ["selected", "selected"], ["unknown"]]) {
      await writeFile(x.controlEndpointFile, JSON.stringify({...x.profile, acceptanceIds}));
      await assert.rejects(runControlledWorker(x.native), /PREPARATION_CONTROL_PROFILE_INVALID|ACCEPTANCE_NOT_FOUND/);
    }
    await writeFile(x.controlEndpointFile, JSON.stringify({...x.profile, config: {...x.config, workspace: x.native.workspace}}));
    await assert.rejects(runControlledWorker(x.native), /PREPARATION_CONTROL_WORKSPACE_MISMATCH/);
    assert.deepEqual(await durable(x), before);
  });

test("owner MCP rejects a profile replaced between worker preflight and server startup", async t => {
  const x = await setup(t), expected = hash(x.profile), before = await durable(x);
  await writeFile(x.controlEndpointFile, JSON.stringify({...x.profile, acceptanceIds: ["unrelated"]}));
  const result = spawnSync(process.execPath, [ownerScript, x.controlEndpointFile, "CONTROL_READ_ONLY", expected],
    {input: "", encoding: "utf8", timeout: 10000});
  assert.notEqual(result.status, 0); assert.match(result.stderr, /PREPARATION_CONTROL_PROFILE_CHANGED/);
  assert.deepEqual(await durable(x), before);
});

for (const mode of ["acquired", "unread", "changed", "post-call-drift", "unrelated-churn"])
  test(`native preparation two-MCP route ${mode}: actual readback, no mutation or fallback`,
    {skip: !binary || process.platform !== "darwin", timeout: 40000}, async t => {
      const x = await setup(t), before = await durable(x), initial = await x.host.preparationStatus(["selected"]);
      const provider = await nativeProvider(t, async n => {
        if (n === 1) return codeItem(`text(ALL_TOOLS.map(t=>t.name));
          const source=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.endsWith('read_source'));
          text(await tools[source.name]({id:'memory'}));
          ${mode !== "unread" ? "const status=ALL_TOOLS.find(t=>t.name.includes('vydykhai_owner')&&t.name.endsWith('read_status'));text(await tools[status.name]({}));" : ""}`);
        if (n === 2 && mode === "changed") {
          await x.f.put("memory.md", "Changed during preparation");
          return codeItem(`const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_owner')&&t.name.endsWith('read_status'));text(await tools[t.name]({expectedDigest:${JSON.stringify(initial.digest)}}));`, "freshness");
        }
        if (n === 2 && mode === "post-call-drift") await x.f.put("contract.md", "New public contract during preparation");
        if (n === 2 && mode === "unrelated-churn") await x.host.accept({...x.acceptance, id: "another", task: "other-task"});
        return answerItem({fabricatedStatus: "CLOSED", noExecution: true});
      });
      const run = await runControlledWorker({...x.native, provider: provider.provider});
      assert.equal(run.nativeStatus, "CLI_EXIT_OK", run.errors);
      assert.equal(run.status, ["acquired", "unrelated-churn"].includes(mode) ? "PREPARATION_STATUS_VERIFIED" : "PREPARATION_UNVERIFIED", JSON.stringify(run.preparation));
      if (mode === "unread") assert.equal(run.preparation.reason, "PREPARATION_STATUS_NOT_ACQUIRED");
      if (mode === "post-call-drift") assert.equal(run.preparation.reason, "PREPARATION_STATUS_STALE");
      const events = run.output.trim().split("\n").map(JSON.parse);
      const calls = events.filter(e => e.type === "item.completed" && e.item?.type === "mcp_tool_call").map(e => e.item);
      const source = calls.find(c => c.tool === "read_source");
      assert.ok(source, run.output); assert.match(JSON.parse(source.result.content[0].text).text, /Independent control pending/);
      const statuses = calls.filter(c => c.tool === "read_status");
      assert.equal(statuses.length, mode === "unread" ? 0 : mode === "changed" ? 2 : 1);
      if (mode !== "unread") {
        const receipt = JSON.parse(statuses[0].result.content[0].text);
        assert.equal(receipt.digest, initial.digest); assert.equal(receipt.rows[0].currentControl.enrollment, "CLOSED");
        assert.equal(receipt.receipt, "DOES_NOT_GRANT_EXECUTION");
      }
      if (mode === "changed") assert.ok(statuses[1].status === "failed" || statuses[1].result?.isError === true);
      const input = canonicalJson(provider.requests[1]);
      for (const forbidden of ["execute_registered", "acknowledge_notice", "record_retention_repair", "request_health_repair_review"])
        assert.ok(!input.includes(forbidden), forbidden);
      if (mode === "unrelated-churn") {
        const after = await durable(x);
        assert.deepEqual(after.state.acceptances.selected, before.state.acceptances.selected);
        assert.deepEqual(after.state.grants, before.state.grants);
        assert.deepEqual(after.state.reservations, before.state.reservations);
      } else assert.deepEqual(await durable(x), before);
      assert.equal(await readFile(path.join(x.f.root, "actions.log"), "utf8"), "called\n");
      assert.equal(provider.requests.length, mode === "changed" ? 3 : 2);
    });
