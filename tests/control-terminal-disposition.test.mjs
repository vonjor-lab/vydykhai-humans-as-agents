import test from "node:test";
import assert from "node:assert/strict";
import fs, {mkdtemp, mkdir, realpath, rm, writeFile} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawn, spawnSync} from "node:child_process";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";
import {openControlHost} from "../scripts/control-host.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {controlCheckIds, controlCatalog} from "../scripts/control-catalog.mjs";
import {retentionKinds, validTerminalDisposition, observeTerminalDisposition} from "../scripts/post-accept.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {createReturnSync} from "../scripts/vydykhai.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {reviewPartitions, validateReviewPart, mergeReviewParts} from "../scripts/control-review-partitions.mjs";
import {modelReviewPrompt, validateModelReviewAcquisition} from "../scripts/control-model-review.mjs";
import {openControlService} from "../scripts/control-service.mjs";
import {openControlNotification} from "../scripts/control-notification.mjs";
import {openOwnerDelivery} from "../scripts/control-owner-delivery.mjs";
import {notificationOwner} from "../scripts/control-notification-owner.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {assessControlMigrationRollback} from "../scripts/control-migration.mjs";
import {ownerCodexConfig, dispositionCodexConfig} from "../scripts/control-codex-profile.mjs";

const hash = v => sha256(canonicalJson(v));
async function fixture(t, action, {lateEnrollment = false, registeredEvidence = false, health = false, terminalBody = canonicalJson} = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "control-terminal-")));
  const privateRoot = await realpath(await mkdtemp(path.join(tmpdir(), "control-terminal-private-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  t.after(() => rm(privateRoot, {recursive: true, force: true}));
  const directory = path.join(privateRoot, "host"); await mkdir(directory, {mode: 0o700});
  const config = {workspace: root, policy: sha256("policy"), owner: "owner", executor: "worker", reviewer: "reviewer"};
  const ref = name => ({path: `${name}.md`, sha256: sha256(name)});
  const acceptance = {schema: "work.product-acceptance.v1", id: "accepted", project: "project", task: "task",
    owner: "owner", executor: "worker", status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: ref("return"), artifact: ref("artifact"), technicalProof: ref("proof"), goal: ref("goal"),
    retention: retentionKinds.map(id => ({id, required: true, expected: ref(id)}))};
  for (const name of ["return", "artifact", "proof", "goal", ...retentionKinds])
    await writeFile(path.join(root, `${name}.md`), name);
  const record = {schema: "control.terminal-disposition.v1", acceptanceSha256: hash(acceptance),
    owner: "owner", action, evidence: "fixture: actual owner decision", producerReturn: acceptance.producerReturn,
    ...(action === "WAIT" ? {waitOwner: "dependency-owner", trigger: "Dependency owner publishes accepted input",
      returnCondition: "Owner returns input receipt to task", reviewAt: new Date(Date.now() + 3600000).toISOString()} :
      {acceptedScope: acceptance.goal, dod: acceptance.technicalProof})};
  const body = terminalBody(record), terminalArtifact = {path: "disposition.json", sha256: sha256(body)};
  await writeFile(path.join(root, terminalArtifact.path), body);
  if (registeredEvidence) {
    config.evidenceRegistry = path.join(privateRoot, "sources.json");
    await writeFile(config.evidenceRegistry, canonicalJson({schema: "control.review-sources.v1", workspace: root,
      sources: [{id: "disposition", path: terminalArtifact.path, purpose: "Actual durable owner decision"},
        ...["return", "goal", "proof"].map(id => ({id, path: `${id}.md`, purpose: "Accepted source"}))]}), {mode: 0o600});
  }
  if (health) config.health = {scope: "Fixture health", intervalMs: 60000, maxBranches: 1, maxWorktrees: 1,
    triggerSourceIds: ["goal"], repairTasks: []};
  const host = await openControlHost(directory, config, {createReturnSync}); await host.initialize();
  await host.accept(acceptance, lateEnrollment ? {} : {terminalArtifact});
  if (lateEnrollment) await host.recordTerminalDisposition(acceptance.id, terminalArtifact);
  const offer = await host.claimReview(acceptance.id);
  const verdict = {phase: "POST_ACCEPT", key: offer.key, runId: offer.runId, reviewer: "reviewer",
    observedAt: new Date().toISOString(), findings: [],
    rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: "fixture: independently read sources"})),
    terminalDisposition: {action, recordSha256: terminalArtifact.sha256, evidence: "fixture: independent scope/owner-wait verdict"}};
  const decision = {owner: "owner", action, evidence: "fixture: consumed verdict", recordSha256: terminalArtifact.sha256};
  const review = () => host.review(acceptance.id, offer, verdict);
  const respond = async () => {const owner = ownerControl(host, "owner"); await owner.readVerdict(acceptance.id);
    return owner.respond(acceptance.id, decision);};
  const reopen = () => openControlHost(directory, config, {createReturnSync});
  return {root, privateRoot, directory, config, host, acceptance, record, terminalArtifact, offer, verdict, decision, review, respond, reopen};
}

test("compatibility: closed terminal snapshot is exact durable identity without source reads", async t => {
  const x = await fixture(t, "DONE"); await x.review(); await x.respond();
  const durable = await (await openControlStore(x.directory)).read();
  const read = fs.readFile; let sourceReads = 0;
  const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
    if (typeof file === "string" && file.startsWith(x.root + path.sep)) sourceReads++;
    return read(file, ...args);
  });
  syncBuiltinESMExports(); t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
  const snapshot = await x.host.snapshot();
  assert.equal(hash(snapshot), hash(durable.state));
  assert.deepEqual(snapshot, durable.state);
  assert.equal(sourceReads, 0);
  assert.deepEqual(await (await openControlStore(x.directory)).read(), durable);
});

test("compatibility: v2 closed terminal snapshot passes actual migration compatible-reader comparison", async t => {
  const x = await fixture(t, "DONE", {registeredEvidence: true, health: true}); await x.review(); await x.respond();
  const store = await openControlStore(x.directory), durable = await store.read();
  assert.equal(durable.state.acceptances.accepted.enrollment, "CLOSED");
  const result = await assessControlMigrationRollback({directory: x.directory, config: x.config,
    expectedJournalDigest: durable.digest, compatibleReader: async (dir, config) =>
      (await openControlHost(dir, config, {createReturnSync})).snapshot()});
  assert.equal(result.action, "COMPATIBLE_READER_CONFIRMED");
  assert.equal(result.stateRollbackAllowed, false);
  assert.deepEqual(await store.read(), durable);
});

for (const action of ["WAIT", "DONE"])
test(`compatibility: public owner observes ${action} historical closure and current source-drift attention`, async t => {
  const x = await fixture(t, action); await x.review(); await x.respond();
  const owner = ownerControl(x.host, "owner");
  assert.deepEqual(await owner.inbox(), []);
  await writeFile(path.join(x.root, "goal.md"), "external source change after historical closure");
  assert.equal((await x.host.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
  assert.deepEqual(await x.host.due(), [{id: x.acceptance.id, action: "REVIEW_DUE"}]);
  const inbox = await owner.inbox();
  assert.equal(inbox.length, 1); assert.equal(inbox[0].action, "REVIEW_DUE");
  const endpointFile = path.join(x.privateRoot, "owner.json");
  await writeFile(endpointFile, canonicalJson({schema: "control.owner-endpoint.v1", capability: "CONTROL_DISPOSITION_ONLY",
    directory: x.directory, config: x.config}), {mode: 0o600});
  const messages = [{method: "initialize"}, {method: "tools/list"},
    {method: "tools/call", params: {name: "inbox", arguments: {}}},
    {method: "tools/call", params: {name: "read_control", arguments: {acceptanceIds: [x.acceptance.id]}}},
    {method: "tools/call", params: {name: "respond", arguments: {id: x.acceptance.id,
      decision: {action, evidence: "read_control is not READ_VERDICT", recordSha256: x.terminalArtifact.sha256}}}}];
  const store = await openControlStore(x.directory), before = await store.read();
  const child = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/control-owner-mcp.mjs", import.meta.url)), endpointFile],
    {input: messages.map((message, i) => JSON.stringify({jsonrpc: "2.0", id: i + 1, ...message})).join("\n") + "\n",
      encoding: "utf8", timeout: 10000});
  assert.equal(child.status, 0, child.stderr);
  const replies = child.stdout.trim().split("\n").map(JSON.parse);
  assert.ok(replies[1].result.tools.some(tool => tool.name === "read_control"));
  const body = reply => {assert.equal(reply.error, undefined); assert.equal(reply.result.isError, undefined);
    return JSON.parse(reply.result.content[0].text);};
  assert.equal(body(replies[2])[0].action, "REVIEW_DUE");
  const receipt = body(replies[3]), control = receipt.rows[0].currentControl;
  assert.deepEqual(receipt.acceptanceIds, [x.acceptance.id]);
  assert.equal(receipt.receipt, "DOES_NOT_GRANT_EXECUTION"); assert.equal(receipt.mutationAuthorized, false);
  assert.equal(control.enrollment, "CLOSED"); assert.equal(control.assessedAction, "POST_ACCEPT_REVIEW_DUE");
  assert.equal(control.historicalClosure.temporalScope, "HISTORICAL_CLOSURE_AT_READBACK_NOT_CURRENT_CONTROL");
  assert.equal(control.historicalClosure.sourceKey, x.verdict.key);
  assert.equal(replies[4].result.isError, true);
  assert.deepEqual(await store.read(), before);
  for (const profile of [ownerCodexConfig, dispositionCodexConfig])
    assert.ok(profile({workspace: x.root, endpointFile})["mcp_servers.vydykhai_owner"].enabled_tools.includes("read_control"));
});

test("owner selected control readback stays bounded, digest-fresh, owned and non-authorizing", async t => {
  const x = await fixture(t, "DONE"); await x.review(); await x.respond();
  const owner = ownerControl(x.host, "owner"), before = await x.host.snapshot();
  const receipt = await owner.readControl([x.acceptance.id]);
  assert.equal(receipt.rows.length, 1);
  assert.equal((await owner.readControl([x.acceptance.id], {expectedDigest: receipt.digest})).digest, receipt.digest);
  for (const ids of [[], ["accepted", "accepted"], Array(33).fill("accepted"), ["__proto__"]])
    await assert.rejects(owner.readControl(ids), /PREPARATION_ACCEPTANCE_IDS_INVALID/);
  await assert.rejects(owner.readControl(["absent"]), /OWNER_CONTROL_NOT_AVAILABLE/);
  await assert.rejects(ownerControl(x.host, "foreign-owner").readControl([x.acceptance.id]), /OWNER_CONTROL_NOT_AVAILABLE/);
  await assert.rejects(owner.readControl([x.acceptance.id], {unbounded: true}), /OWNER_ARGUMENT_INVALID/);
  await assert.rejects(owner.respond(x.acceptance.id, x.decision), /OWNER_VERDICT_READBACK_REQUIRED/);
  assert.deepEqual(await x.host.snapshot(), before);
  await x.host.pause(true);
  assert.equal((await owner.readControl([x.acceptance.id])).rows[0].currentControl.assessedAction, "PRESERVE_PAUSE");
  assert.equal((await owner.inbox())[0].action, "PRESERVE_PAUSE");
  await x.host.pause(false);
  await writeFile(path.join(x.root, "goal.md"), "changed");
  await assert.rejects(owner.readControl([x.acceptance.id], {expectedDigest: receipt.digest}), /PREPARATION_STATUS_STALE/);
  await x.host.claimReview(x.acceptance.id);
  assert.equal((await owner.readControl([x.acceptance.id])).rows[0].currentControl.assessedAction, "REVIEW_PENDING");
  assert.equal((await owner.inbox())[0].action, "REVIEW_IN_FLIGHT");
  assert.deepEqual((await x.host.snapshot()).grants, {});
});

test("closed owner inbox retains unknown readback attention instead of hiding the task", async t => {
  const x = await fixture(t, "DONE"); await x.review(); await x.respond();
  t.mock.method(x.host, "preparationStatus", async () => {throw Error("PREPARATION_STATUS_CHANGED");});
  const owner = ownerControl(x.host, "owner"), before = await x.host.snapshot();
  assert.equal((await owner.inbox())[0].action, "OBSERVATION_UNKNOWN");
  await assert.rejects(owner.readControl([x.acceptance.id]), /PREPARATION_STATUS_CHANGED/);
  assert.deepEqual(await x.host.snapshot(), before);
});

test("normal owner MCP declares exact selected read_control schema and refuses unowned or unbounded selectors", async t => {
  const x = await fixture(t, "DONE"); await x.review(); await x.respond();
  const store = await openControlStore(x.directory);
  await store.transact(s => {
    s.acceptances.foreign = structuredClone(s.acceptances.accepted);
    s.acceptances.foreign.acceptance.id = "foreign";
    s.acceptances.foreign.acceptance.owner = "another-owner";
    return s;
  });
  const endpointFile = path.join(x.privateRoot, "normal-owner.json");
  await writeFile(endpointFile, canonicalJson({schema: "control.owner-endpoint.v1", directory: x.directory,
    config: x.config}), {mode: 0o600});
  const invalid = [{acceptanceIds: ["foreign"]}, {acceptanceIds: ["accepted", "foreign"]},
    {acceptanceIds: []}, {acceptanceIds: ["accepted", "accepted"]}, {acceptanceIds: Array(33).fill("accepted")},
    {acceptanceIds: ["__proto__"]}, {acceptanceIds: ["accepted"], all: true},
    {acceptanceIds: ["accepted"], expectedDigest: "invalid"},
    {acceptanceIds: ["accepted"], expectedDigest: sha256("stale readback")}];
  const messages = [{method: "initialize"}, {method: "tools/list"},
    {method: "tools/call", params: {name: "read_control", arguments: {acceptanceIds: ["accepted"]}}},
    ...invalid.map(arguments_ => ({method: "tools/call", params: {name: "read_control", arguments: arguments_}}))];
  const before = await store.read();
  const child = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/control-owner-mcp.mjs", import.meta.url)), endpointFile],
    {input: messages.map((message, i) => JSON.stringify({jsonrpc: "2.0", id: i + 1, ...message})).join("\n") + "\n",
      encoding: "utf8", timeout: 10000});
  assert.equal(child.status, 0, child.stderr);
  const replies = child.stdout.trim().split("\n").map(JSON.parse);
  const tool = replies[1].result.tools.find(tool => tool.name === "read_control");
  assert.deepEqual(tool.inputSchema, {type: "object", properties: {
    acceptanceIds: {type: "array", minItems: 1, maxItems: 32, uniqueItems: true,
      items: {type: "string", maxLength: 100, pattern: "^[A-Za-z0-9_-]+$"}},
    expectedDigest: {type: "string", pattern: "^[a-f0-9]{64}$"}}, required: ["acceptanceIds"], additionalProperties: false});
  assert.deepEqual(tool.annotations, {readOnlyHint: true});
  assert.equal(replies[2].result.isError, undefined);
  assert.deepEqual(JSON.parse(replies[2].result.content[0].text).acceptanceIds, ["accepted"]);
  for (const reply of replies.slice(3)) assert.equal(reply.result.isError, true);
  assert.deepEqual(await store.read(), before);
});

for (const action of ["WAIT", "DONE"]) {
  test(`honest accepted ${action} closes with durable independent readback and no product command`, async t => {
    const x = await fixture(t, action);
    assert.deepEqual(x.offer.input.terminalObservation.record, x.record);
    await x.review();
    assert.equal((await x.respond()).action, `CONTROL_${action}_CONFIRMED`);
    await x.host.close(x.acceptance.id);
    const reopened = await x.reopen(), saved = await reopened.snapshot();
    assert.equal((await reopened.assess(x.acceptance.id)).action, `CONTROL_${action}_CONFIRMED`);
    assert.equal(saved.acceptances.accepted.enrollment, "CLOSED");
    assert.deepEqual(saved.acceptances.accepted.acceptance, x.acceptance);
    assert.deepEqual(saved.reservations, {}); assert.deepEqual(saved.grants, {});
    assert.deepEqual(await reopened.due(), []);
  });

  test(`already accepted task enrolls ${action} once, without repeating acceptance or dropping history`, async t => {
    const x = await fixture(t, action, {lateEnrollment: true}); await x.review(); await x.respond();
    const before = await x.host.snapshot();
    await x.host.recordTerminalDisposition(x.acceptance.id, x.terminalArtifact);
    assert.deepEqual(await x.host.snapshot(), before);
    await x.host.accept(x.acceptance, {terminalArtifact: x.terminalArtifact});
    assert.deepEqual(await x.host.snapshot(), before);
    const other = {path: "other.json", sha256: x.terminalArtifact.sha256};
    await writeFile(path.join(x.root, other.path), canonicalJson(x.record));
    await assert.rejects(x.host.accept(x.acceptance, {terminalArtifact: other}), /ACCEPTANCE_ID_CONFLICT/);
    await assert.rejects(x.host.recordTerminalDisposition(x.acceptance.id, other), /TERMINAL_RECORD_CONFLICT/);
    assert.deepEqual(await x.host.snapshot(), before);
  });

  test(`${action} rejects incomplete, wrong-scope or fabricated typed records and host evidence`, async t => {
    const x = await fixture(t, action);
    const patches = [{owner: "worker"}, {acceptanceSha256: sha256("wrong acceptance")},
      {producerReturn: x.acceptance.artifact}, {evidence: ""}, {continuationEvidence: "fabricated"},
      ...(action === "WAIT" ? [{waitOwner: ""}, {trigger: ""}, {returnCondition: ""}, {reviewAt: "unknown"}] :
        [{acceptedScope: x.acceptance.artifact}, {dod: x.acceptance.artifact}])];
    for (const patch of patches) assert.equal(validTerminalDisposition({...x.record, ...patch}, x.acceptance), false);
    await x.review();
    for (const patch of [{terminalEvidence: `host-terminal:${x.terminalArtifact.sha256}`}, {continuationEvidence: "fabricated"}])
      await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict), ...patch}), /HOST_OBSERVATION_REQUIRED/);
    const wrong = {...x.decision, reviewKey: hash(x.verdict), recordSha256: sha256("unreviewed record")};
    await assert.rejects(x.host.disposition(x.acceptance.id, wrong), /TERMINAL_VERDICT_REQUIRED/);
  });

  for (const source of ["disposition.json", "goal.md", "proof.md", "return.md", "memory.md"])
    test(`${action} closure reobserves ${source} and preserves original acceptance`, async t => {
      const x = await fixture(t, action); await x.review(); await x.respond(); await x.host.close(x.acceptance.id);
      await writeFile(path.join(x.root, source), "changed");
      const reopened = await x.reopen();
      assert.equal((await reopened.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
      await assert.rejects(reopened.close(x.acceptance.id), /CONTROL_NOT_COMPLETE/);
      assert.deepEqual(await reopened.due(), [{id: x.acceptance.id, action: "REVIEW_DUE"}]);
      assert.deepEqual((await reopened.snapshot()).acceptances.accepted.acceptance, x.acceptance);
    });

  test(`${action} pending review cannot consume a changed terminal artifact`, async t => {
    const x = await fixture(t, action);
    await rm(path.join(x.root, x.terminalArtifact.path));
    assert.equal((await observeTerminalDisposition(x.root, x.acceptance, x.terminalArtifact)).status, "MISSING");
    await assert.rejects(x.review(), /REVIEW_SOURCE_CHANGED/);
    await assert.rejects(x.host.close(x.acceptance.id), /REVIEW_PENDING/);
  });

  test(`${action} refuses an ordinary green verdict without independent typed disposition`, async t => {
    const x = await fixture(t, action); delete x.verdict.terminalDisposition; await x.review();
    await assert.rejects(x.respond(), /TERMINAL_VERDICT_REQUIRED/);
    await assert.rejects(x.host.close(x.acceptance.id), /CONTROL_NOT_COMPLETE/);
  });

  test(`${action} reobserves durable disposition and accepted sources before consuming verdict`, async t => {
    const x = await fixture(t, action); await x.review();
    await writeFile(path.join(x.root, x.terminalArtifact.path), canonicalJson({...x.record, evidence: "changed"}));
    await assert.rejects(x.respond(), /POST_ACCEPT_SOURCE_CHANGED/);
    await assert.rejects(x.host.close(x.acceptance.id), /CONTROL_NOT_COMPLETE/);
  });

  test(`${action} cannot override blocking findings, pending review, pause or UNKNOWN effect`, async t => {
    const x = await fixture(t, action);
    await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict)}), /REVIEW_PENDING/);
    await x.review(); await x.host.pause(true);
    await assert.rejects(x.respond(), /CONTROL_PAUSED/); await x.host.pause(false);
    const binding = {taskId: x.acceptance.task};
    await x.host.approveCommand(binding, {reviewer: "reviewer", reviewReceipt: "fixture: command review",
      dependencies: [x.acceptance.id], expiresAt: Date.now() + 60000});
    await assert.rejects(x.host.control.authorize(binding), /POST_ACCEPT_CONTROL_PENDING/);
    // A real in-flight accepted-task reservation, not a fabricated terminal observation.
    const historical = {taskId: x.acceptance.task, operation: "accept", kind: "verification"};
    await x.host.approveCommand(historical, {reviewer: "reviewer", reviewReceipt: "fixture: historical review",
      dependencies: [], expiresAt: Date.now() + 60000});
    await x.host.control.reserve(await x.host.control.authorize(historical));
    await assert.rejects(x.respond(), /POST_ACCEPT_SOURCE_CHANGED/);
    const fresh = await x.host.claimReview(x.acceptance.id);
    const v = {...x.verdict, key: fresh.key, runId: fresh.runId, observedAt: new Date().toISOString()};
    await x.host.review(x.acceptance.id, fresh, v);
    await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(v)}), /TERMINAL_OUTCOME_UNKNOWN/);
  });

  test(`${action} preserves blocking owned findings`, async t => {
    const x = await fixture(t, action), checkId = "C12.01";
    const finding = {id: "debt", checkId, area: "C12", criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === checkId).criterion,
      owner: "repair-owner", work: "repair", status: "OPEN", evidence: "fixture: debt", attempts: 0,
      firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 3600000).toISOString(), blocksResume: true};
    x.verdict.findings = [finding]; Object.assign(x.verdict.rows.find(r => r.id === checkId),
      {status: "FINDING", findingId: finding.id, reason: "fixture: debt"});
    await x.review();
    const leases = [{owner: finding.owner, work: finding.work, state: "WORKING", checkpoint: "independent readback",
      evidence: "fixture: owned", reviewAt: finding.reviewAt}];
    await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict)}, leases), /POST_ACCEPT_REPAIR_REQUIRED/);
    assert.deepEqual((await x.host.snapshot()).acceptances.accepted.findings, [finding]);
  });

  test(`${action} retains nonblocking debt and requires its actual owner lease`, async t => {
    const x = await fixture(t, action), checkId = "C12.01";
    const finding = {id: "debt", checkId, area: "C12", criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === checkId).criterion,
      owner: "repair-owner", work: "repair", status: "OPEN", evidence: "fixture: debt", attempts: 0,
      firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 3600000).toISOString(), blocksResume: false};
    x.verdict.findings = [finding]; Object.assign(x.verdict.rows.find(r => r.id === checkId),
      {status: "FINDING", findingId: finding.id, reason: "fixture: debt"});
    await x.review();
    await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict)}), /POST_ACCEPT_REPAIR_OWNER_REQUIRED/);
    await x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict)},
      [{owner: finding.owner, work: finding.work, state: "WORKING", checkpoint: "independent readback",
        evidence: "fixture: owned", reviewAt: finding.reviewAt}]);
    assert.deepEqual((await x.host.assess(x.acceptance.id)).remainingDebt, [finding.id]);
    await x.host.close(x.acceptance.id);
    const reopened = await x.reopen();
    assert.deepEqual((await reopened.snapshot()).acceptances.accepted.findings, [finding]);
    t.mock.method(Date, "now", () => Date.parse(finding.reviewAt) + 1);
    assert.ok((await reopened.due()).length > 0);
    const attention = (await ownerControl(reopened, "owner").inbox())[0];
    assert.equal(attention.action, action === "WAIT" ? "REVIEW_DUE" : "REPAIR_REVIEW_DUE");
    assert.equal(attention.currentControl.repairReviewOverdue, true);
  });
}

test("WAIT checkpoint expires into independent review, never DONE or execution permission", async t => {
  const x = await fixture(t, "WAIT"); await x.review(); await x.respond(); await x.host.close(x.acceptance.id);
  t.mock.method(Date, "now", () => Date.parse(x.record.reviewAt) + 1);
  const reopened = await x.reopen();
  assert.equal((await reopened.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
  assert.deepEqual(await reopened.due(), [{id: x.acceptance.id, action: "REVIEW_DUE"}]);
  assert.equal((await ownerControl(reopened, "owner").inbox())[0].action, "REVIEW_DUE");
  await assert.rejects(reopened.close(x.acceptance.id), /CONTROL_NOT_COMPLETE/);
  const offer = await reopened.claimReview(x.acceptance.id);
  assert.equal(offer.input.terminalObservation.record.waitOwner, x.record.waitOwner);
  assert.equal(offer.input.terminalObservation.record.trigger, x.record.trigger);
  assert.equal(offer.input.terminalObservation.record.returnCondition, x.record.returnCondition);
});

test("owned WAIT can become DONE only through a new durable record and fresh independent verdict", async t => {
  const x = await fixture(t, "WAIT"); await x.review(); await x.respond(); await x.host.close(x.acceptance.id);
  const record = {schema: "control.terminal-disposition.v1", acceptanceSha256: hash(x.acceptance),
    owner: "owner", action: "DONE", evidence: "fixture: owner return received; accepted scope finished",
    producerReturn: x.acceptance.producerReturn, acceptedScope: x.acceptance.goal, dod: x.acceptance.technicalProof};
  const body = canonicalJson(record), artifact = {path: "done.json", sha256: sha256(body)};
  await writeFile(path.join(x.root, artifact.path), body);
  await x.host.recordTerminalDisposition(x.acceptance.id, artifact);
  assert.equal((await x.host.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
  await assert.rejects(x.host.disposition(x.acceptance.id, {...x.decision, reviewKey: hash(x.verdict)}), /REVIEW_PENDING/);
  const offer = await x.host.claimReview(x.acceptance.id);
  assert.notEqual(offer.key, x.offer.key);
  const verdict = {...x.verdict, runId: offer.runId, key: offer.key, observedAt: new Date().toISOString(),
    terminalDisposition: {action: "DONE", recordSha256: artifact.sha256, evidence: "fixture: independent return and DOD readback"}};
  await x.host.review(x.acceptance.id, offer, verdict);
  await x.host.disposition(x.acceptance.id, {owner: "owner", action: "DONE", reviewKey: hash(verdict),
    evidence: "fixture: owner consumes current verdict", recordSha256: artifact.sha256});
  await x.host.close(x.acceptance.id);
  const reopened = await x.reopen();
  assert.equal((await reopened.assess(x.acceptance.id)).action, "CONTROL_DONE_CONFIRMED");
  await assert.rejects(reopened.recordTerminalDisposition(x.acceptance.id, x.terminalArtifact), /TERMINAL_RECORD_CONFLICT/);
  assert.deepEqual((await reopened.snapshot()).acceptances.accepted.acceptance, x.acceptance);
  assert.deepEqual((await reopened.snapshot()).reservations, {});
});

function acquiredSources(x) {
  const sourceIds = x.offer.input.sourceEvidence.rows.map(r => r.id);
  const messages = sourceIds.map((id, i) => ({jsonrpc: "2.0", id: i + 1, method: "tools/call",
    params: {name: "read_source", arguments: {id}}}));
  const result = spawnSync(process.execPath,
    [fileURLToPath(new URL("../scripts/control-review-mcp.mjs", import.meta.url)), x.config.evidenceRegistry],
    {input: messages.map(m => JSON.stringify(m)).join("\n") + "\n", encoding: "utf8", timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n").map(line => {
    const response = JSON.parse(line); assert.equal(response.result.isError, undefined);
    return JSON.parse(response.result.content[0].text);
  });
}
const wireAnswer = (action, ids = controlCheckIds) => ({schema: "control.review-answer.v2",
  rowGroups: [{ids: [...ids], status: "PASS", sourceIds: ["return", "goal", "proof", "disposition"]}],
  newFindings: [], resolutions: [], ...(ids.includes("C20.03") ? {terminalDisposition:
    {action, sourceIds: ["disposition", "return", "goal", "proof"], evidence: "Protocol fixture: explicitly checked owner wait or accepted DOD"}} : {})});

for (const action of ["WAIT", "DONE"]) {
  test(`actual source MCP -> v2 decoder -> service.owner carries explicit ${action} without executing native/model`, async t => {
    const x = await fixture(t, action, {registeredEvidence: true});
    for (const name of ["review", "room", "home"]) await mkdir(path.join(x.privateRoot, name), {mode: 0o700});
    const service = await openControlService({schema: "control.service.v1", directory: x.directory, config: x.config,
      maxReviewsPerTick: 1, timeoutMs: 2000, review: {directory: path.join(x.privateRoot, "review"),
        controlRoot: x.privateRoot, reviewer: "reviewer", sourceFile: x.config.evidenceRegistry,
        maxCalls: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), scope: {},
        native: {binary: "/not-executed", workspace: path.join(x.privateRoot, "room"),
          home: path.join(x.privateRoot, "home"), model: "not-executed", effort: "low", timeoutMs: 1000}}});
    await service.review.initialize();
    await service.review.preflight(x.offer);
    const readbacks = acquiredSources(x);
    validateModelReviewAcquisition(x.offer.input.sourceEvidence, readbacks, [], undefined);
    const decoded = decodeReviewAnswer(wireAnswer(action), {readbacks, offer: x.offer, reviewer: "reviewer",
      observedAt: new Date().toISOString()});
    assert.equal(decoded.terminalDisposition.action, action);
    assert.equal(decoded.terminalDisposition.recordSha256, x.terminalArtifact.sha256);
    assert.match(decoded.terminalDisposition.evidence, /source:disposition:/);
    assert.equal(decoded.rows.length, 87);
    await service.host.review(x.acceptance.id, x.offer, {...x.verdict, ...decoded});
    await service.owner.readVerdict(x.acceptance.id);
    assert.equal((await service.owner.respond(x.acceptance.id, x.decision)).action, `CONTROL_${action}_CONFIRMED`);
    await service.host.close(x.acceptance.id);
    assert.equal((await service.review.capacity()).used, 0);
    assert.deepEqual((await service.host.snapshot()).reservations, {});
  });

  test(`partitioned ${action} transports only the C20 part's verdict, never partial or all87 bypass`, async t => {
    const x = await fixture(t, action, {registeredEvidence: true}), readbacks = acquiredSources(x);
    const options = {readbacks, offer: x.offer, reviewer: "reviewer", observedAt: new Date().toISOString()};
    const parts = reviewPartitions(4), answers = parts.map(ids => wireAnswer(action, ids));
    for (let i = 0; i < parts.length; i++) validateReviewPart(answers[i], parts[i], options);
    const decoded = decodeReviewAnswer(mergeReviewParts(answers, parts), options);
    assert.equal(decoded.rows.length, 87); assert.equal(decoded.terminalDisposition.action, action);
    const index = parts.findIndex(ids => ids.includes("C20.03"));
    const partial = validateReviewPart(answers[index], parts[index], options);
    await assert.rejects(x.host.review(x.acceptance.id, x.offer, {...x.verdict, ...partial}), /REVIEW_INVALID/);
    const wrongPart = (index + 1) % parts.length;
    answers[wrongPart].terminalDisposition = answers[index].terminalDisposition;
    assert.throws(() => mergeReviewParts(answers, parts), /TERMINAL_UNASSIGNED/);
    assert.throws(() => validateReviewPart(answers[wrongPart], parts[wrongPart], options), /TERMINAL_UNASSIGNED/);
    assert.match(modelReviewPrompt(x.offer, {}, parts[index]), /terminalDisposition/);
    assert.match(modelReviewPrompt(x.offer, {}, parts[wrongPart]), /Do not emit terminalDisposition/);
  });

  test(`public owner MCP consumes READ_VERDICT then ${action}; existing delivery notice observes host closure`, {timeout: 10000}, async t => {
    const x = await fixture(t, action, {registeredEvidence: true}), readbacks = acquiredSources(x);
    const decoded = decodeReviewAnswer(wireAnswer(action), {readbacks, offer: x.offer, reviewer: "reviewer",
      observedAt: new Date().toISOString()});
    const verdict = {...x.verdict, ...decoded}; await x.host.review(x.acceptance.id, x.offer, verdict);
    const notificationConfig = {directory: path.join(x.privateRoot, "notifications"), transportActor: "transport"};
    const deliveryDirectory = path.join(x.privateRoot, "delivery");
    await mkdir(notificationConfig.directory, {mode: 0o700}); await mkdir(deliveryDirectory, {mode: 0o700});
    const notifications = await openControlNotification({...notificationConfig, owner: "owner"}); await notifications.initialize();
    await notifications.enqueueObservation({complete: true,
      receipt: {schema: "control.observer-readback.v1", owner: "owner", status: "ONE_TICK_OBSERVED"},
      actionable: [{id: x.acceptance.id, action: "OWNER_DISPOSITION_DUE", reviewKey: hash(verdict)}]});
    const delivery = await openOwnerDelivery({directory: deliveryDirectory, maxCalls: 1,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      endpoint: {schema: "control.owner-endpoint.v1", capability: "CONTROL_DISPOSITION_ONLY",
        directory: x.directory, config: x.config, notifications: notificationConfig},
      delegation: {mode: "NATIVE_CONTROL_DISPOSITION", owner: "owner", authorizedBy: "owner",
        evidence: "Protocol fixture: public disposition only", nextAction: x.acceptance.task},
      native: {binary: "/not-executed", timeoutMs: 1000}}, {host: x.host, notifications});
    await delivery.initialize();
    const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/control-owner-mcp.mjs", import.meta.url)),
      path.join(x.privateRoot, "owner-endpoint.json")], {stdio: ["pipe", "pipe", "pipe"]});
    t.after(() => {if (child.exitCode === null) child.kill();});
    const closed = new Promise((resolve, reject) => {child.once("error", reject); child.once("close", resolve);});
    const reader = createInterface({input: child.stdout}), replies = reader[Symbol.asyncIterator]();
    let id = 0;
    const request = async (method, params = {}) => {
      const current = ++id; child.stdin.write(JSON.stringify({jsonrpc: "2.0", id: current, method, params}) + "\n");
      const line = await replies.next(); assert.equal(line.done, false);
      const response = JSON.parse(line.value); assert.equal(response.id, current); assert.equal(response.error, undefined);
      return response.result;
    };
    const call = (name, args = {}) => request("tools/call", {name, arguments: args});
    const body = result => {assert.equal(result.isError, undefined); return JSON.parse(result.content[0].text);};
    await request("initialize");
    const listed = await request("tools/list");
    assert.ok(listed.tools.find(tool => tool.name === "respond").inputSchema.properties.decision.properties.action.enum.includes(action));
    assert.ok(!listed.tools.some(tool => ["record_retention_repair", "execute_registered"].includes(tool.name)));
    const before = await x.host.snapshot();
    assert.equal((await call("respond", {id: x.acceptance.id, decision: {action, evidence: "unread",
      recordSha256: x.terminalArtifact.sha256}})).isError, true);
    assert.deepEqual(await x.host.snapshot(), before);
    const notices = body(await call("read_notices"));
    for (const n of notices) body(await call("acknowledge_notice", {id: n.notice.id, deliveryToken: n.deliveryToken}));
    const acquired = body(await call("read_verdict", {id: x.acceptance.id}));
    assert.deepEqual(acquired.terminalDisposition, decoded.terminalDisposition);
    const applied = body(await call("respond", {id: x.acceptance.id,
      decision: {action: acquired.terminalDisposition.action, recordSha256: acquired.terminalDisposition.recordSha256,
        evidence: "Protocol fixture: consume exact explicit independent verdict"}}));
    assert.equal(applied.action, `CONTROL_${action}_CONFIRMED`);
    assert.equal((await x.host.snapshot()).acceptances.accepted.enrollment, "CLOSED");
    assert.equal((await notifications.snapshot()).pendingOwnerApplication, 0);
    assert.equal((await delivery.capacity()).used, 0);
    assert.deepEqual((await x.host.snapshot()).reservations, {});
    child.stdin.end(); assert.equal(await closed, 0); reader.close();
  });
}

test("terminal wire rejects unread or crossed source bindings, forged hashes and UNKNOWN terminal criterion", async t => {
  const x = await fixture(t, "DONE", {registeredEvidence: true}), readbacks = acquiredSources(x);
  const options = {readbacks, offer: x.offer, reviewer: "reviewer", observedAt: new Date().toISOString()};
  for (const mutate of [
    a => a.terminalDisposition.sourceIds = ["return", "goal", "proof"],
    a => a.terminalDisposition.sourceIds = ["unread"],
    a => a.terminalDisposition.recordSha256 = x.terminalArtifact.sha256,
    a => a.terminalDisposition.action = "WAIT",
    a => a.terminalDisposition.evidence = "",
    a => a.rowGroups[0].status = "UNKNOWN"
  ]) {const a = wireAnswer("DONE"); mutate(a); assert.throws(() => decodeReviewAnswer(a, options), /MODEL_REVIEW/);}
  const crossed = structuredClone(options);
  crossed.offer.input.sourceEvidence.rows.find(r => r.id === "disposition").path = "unrelated.json";
  assert.throws(() => decodeReviewAnswer(wireAnswer("DONE"), crossed), /TERMINAL_SOURCE_UNREAD/);
  const drift = structuredClone(options); drift.readbacks.find(r => r.id === "proof").sha256 = sha256("stale");
  assert.throws(() => decodeReviewAnswer(wireAnswer("DONE"), drift), /TERMINAL_SOURCE_DRIFT/);
  const absent = structuredClone(options); delete absent.offer.input.terminalObservation;
  assert.throws(() => decodeReviewAnswer(wireAnswer("DONE"), absent), /TERMINAL_INVALID/);
});

test("durable terminal record has a 16384-byte cap, with no execution grant", async t => {
  const x = await fixture(t, "WAIT");
  await x.review();
  const oversized = canonicalJson({...x.record, evidence: "x".repeat(16384)});
  await writeFile(path.join(x.root, "oversized.json"), oversized);
  await assert.rejects(x.host.recordTerminalDisposition(x.acceptance.id,
    {path: "oversized.json", sha256: sha256(oversized)}), /TERMINAL_ARTIFACT_INVALID/);
  assert.deepEqual((await x.host.snapshot()).grants, {});
});

for (const hook of ["public snapshot", "fourth latest revision read"])
test(`P2 notice application retains the current return when goal changes during ${hook}`, async t => {
  const x = await fixture(t, "DONE"); await x.review();
  const directory = path.join(x.privateRoot, "notices"); await mkdir(directory, {mode: 0o700});
  const notifications = await openControlNotification({directory, owner: "owner", transportActor: "transport"});
  await notifications.initialize();
  const packet = await notifications.enqueueObservation({complete: true,
    receipt: {schema: "control.observer-readback.v1", owner: "owner", status: "ONE_TICK_OBSERVED"},
    actionable: [{id: x.acceptance.id, action: "OWNER_DISPOSITION_DUE", reviewKey: hash(x.verdict)}]});
  const api = notificationOwner({notifications, host: x.host, owner: "owner", transportActor: "transport"});
  const [notice] = await api.readNotices();
  await api.acknowledge({id: notice.notice.id, deliveryToken: notice.deliveryToken});
  await x.respond();
  let fired = false;
  if (hook === "public snapshot") {
    const snapshot = x.host.snapshot.bind(x.host); let snapshots = 0;
    t.mock.method(x.host, "snapshot", async (...args) => {
      const current = await snapshot(...args);
      if (++snapshots === 2) {
        await writeFile(path.join(x.root, "goal.md"), "changed during final snapshot"); fired = true;
      }
      return current;
    });
  } else {
    const latest = (await fs.readdir(x.directory)).filter(name => /^\d{10}\.json$/.test(name)).sort().at(-1);
    const target = path.join(x.directory, latest), read = fs.readFile; let reads = 0;
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      const bytes = await read(file, ...args);
      if (file === target && ++reads === 4) {
        await writeFile(path.join(x.root, "goal.md"), "changed during fourth latest revision read"); fired = true;
      }
      return bytes;
    });
    syncBuiltinESMExports(); t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
  }
  assert.deepEqual(await api.recordApplications(), []);
  assert.equal(fired, true);
  const retained = await notifications.snapshot();
  assert.equal(retained.pendingOwnerApplication, 1);
  assert.ok(!retained.state.notices.find(n => n.body.id === packet.notice.body.id).ownerApplied);
  assert.equal((await x.host.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
});

test("P2 later external write leaves only historical closure and visible current due, never atomic readiness", async t => {
  const x = await fixture(t, "DONE"); await x.review();
  const read = fs.readFile; let custodyReads = 0, fired = false;
  const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
    const bytes = await read(file, ...args);
    if (file === path.join(x.root, "custody.md") && ++custodyReads === 3) {
      await writeFile(path.join(x.root, "goal.md"), "external write after last close source sample"); fired = true;
    }
    return bytes;
  });
  syncBuiltinESMExports(); t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
  const response = await x.respond(); assert.equal(fired, true);
  assert.equal(response.action, "POST_ACCEPT_REVIEW_DUE");
  assert.equal(response.temporalScope, "AT_READBACK_NOT_CURRENT_CONTROL_OR_EXECUTION_PERMISSION");
  const snapshot = await x.host.snapshot(), row = snapshot.acceptances.accepted;
  assert.equal(row.enrollment, "CLOSED");
  assert.equal(row.closure.temporalScope, "HISTORICAL_CLOSURE_AT_READBACK_NOT_CURRENT_CONTROL");
  assert.equal(row.closure.sourceKey, x.verdict.key);
  const receipt = await ownerControl(x.host, "owner").readControl([x.acceptance.id]);
  assert.equal(receipt.rows[0].currentControl.assessedAction, "POST_ACCEPT_REVIEW_DUE");
  assert.deepEqual(receipt.rows[0].currentControl.historicalClosure, row.closure);
  assert.equal(receipt.receipt, "DOES_NOT_GRANT_EXECUTION");
  assert.deepEqual(await x.host.due(), [{id: x.acceptance.id, action: "REVIEW_DUE"}]);
  const offer = await x.host.claimReview(x.acceptance.id);
  assert.equal((await x.host.snapshot()).acceptances.accepted.enrollment, "REVIEW_IN_FLIGHT");
  assert.deepEqual(offer.input.acceptance, x.acceptance);
  assert.deepEqual((await x.host.snapshot()).grants, {});
});

test("P2 DONE close refuses a torn final readback when goal changes after second custody read", async t => {
  const x = await fixture(t, "DONE"); await x.review();
  const read = fs.readFile; let custodyReads = 0;
  const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
    const bytes = await read(file, ...args);
    if (file === path.join(x.root, "custody.md") && ++custodyReads === 2)
      await writeFile(path.join(x.root, "goal.md"), "changed during DONE close readback");
    return bytes;
  });
  syncBuiltinESMExports();
  t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
  await assert.rejects(x.respond(), /CONTROL_SOURCE_CHANGED|CONTROL_NOT_COMPLETE/);
  assert.ok(custodyReads >= 2);
  const row = (await x.host.snapshot()).acceptances.accepted;
  assert.equal(row.enrollment, "FINAL_READBACK_DUE");
  assert.deepEqual(row.acceptance, x.acceptance);
  assert.deepEqual(row.review, x.verdict);
  assert.equal(row.disposition.action, "DONE");
  assert.equal((await x.host.assess(x.acceptance.id)).action, "POST_ACCEPT_REVIEW_DUE");
});

for (const key of ["action", "\\u0061ction"])
  test(`P2 contradictory raw duplicate ${key} cannot reach v2 decode and owner DONE closure`, async t => {
    await assert.rejects(async () => {
      const x = await fixture(t, "DONE", {registeredEvidence: true,
        terminalBody: record => `{"${key}":"WAIT",${canonicalJson(record).slice(1)}`});
      const readbacks = acquiredSources(x);
      const decoded = decodeReviewAnswer(wireAnswer("DONE"), {readbacks, offer: x.offer, reviewer: "reviewer",
        observedAt: new Date().toISOString()});
      await x.host.review(x.acceptance.id, x.offer, {...x.verdict, ...decoded});
      await x.respond();
      assert.equal((await x.host.snapshot()).acceptances.accepted.enrollment, "CLOSED");
    }, /TERMINAL_RECORD_NOT_OBSERVED/);
  });
