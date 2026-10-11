// Independent bounded probes: synthetic host state and local fake provider only.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, readFile, writeFile} from "node:fs/promises";
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
import {controlCatalog, controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {cycleAnswer} from "../scripts/qualify-control-cycle.mjs";

const hash = value => sha256(canonicalJson(value));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const ownerScript = fileURLToPath(new URL("../scripts/control-owner-mcp.mjs", import.meta.url));

async function closedFixture(t) {
  const x = await endpointFixture(t);
  await x.approve();
  const binding = Object.values((await x.host.snapshot()).grants)[0].binding;
  const directory = path.join(x.privateRoot, "independent-state");
  await mkdir(directory, {mode: 0o700});
  const sourceFile = path.join(x.privateRoot, "independent-sources.json");
  await x.f.put("public-contract.md", "CURRENT public contract v2");
  const registry = {schema: "control.review-sources.v1", workspace: x.f.root,
    sources: [{id: "contract", path: "public-contract.md", purpose: "Public contract"}]};
  await writeFile(sourceFile, JSON.stringify(registry), {mode: 0o600});
  const config = {...x.profile.config, evidenceRegistry: sourceFile};
  const host = await openControlHost(directory, config, endpointServices);
  await host.initialize();
  const ref = name => x.f.put(`independent-${name}.md`, name === "memory" ?
    "AT ACCEPTANCE: control pending; persistence unestablished" : name);
  const acceptance = {schema: "work.product-acceptance.v1", id: "selected", project: "synthetic",
    task: "previous", owner: config.owner, executor: config.executor, status: "ACCEPTED",
    acceptedAt: new Date().toISOString(), producerReturn: await ref("return"), artifact: await ref("artifact"),
    technicalProof: await ref("proof"), goal: await ref("goal"), retention: []};
  for (const id of retentionKinds) acceptance.retention.push({id, required: true, expected: await ref(id)});
  await host.accept(acceptance);
  const offer = await host.claimReview("selected"), now = new Date().toISOString();
  const finding = {id: "debt", checkId: "C12.01", area: "C12",
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C12.01").criterion,
    evidence: `${x.privateRoot}/PRIVATE_EVIDENCE`, owner: "maintenance", work: "cleanup",
    status: "OPEN", firstSeen: now, reviewAt: new Date(Date.now() + 3600000).toISOString(),
    attempts: 0, blocksResume: false};
  const verdict = {phase: "POST_ACCEPT", key: offer.key, reviewer: config.reviewer, runId: offer.runId,
    observedAt: now, findings: [finding], rows: controlCheckIds.map(id => id === finding.checkId ?
      {id, status: "FINDING", findingId: finding.id, reason: "Owned debt", evidence: "synthetic"} :
      {id, status: "PASS", evidence: "synthetic"})};
  await host.review("selected", offer, verdict);
  await host.disposition("selected", {owner: config.owner, action: "CONTINUE", nextAction: x.f.task.id,
    reviewKey: hash(verdict), evidence: "synthetic owner readback"}, [{owner: finding.owner, work: finding.work,
    state: "PREPARED", reviewAt: finding.reviewAt, checkpoint: `${x.privateRoot}/PRIVATE_CHECKPOINT`,
    evidence: "PRIVATE_LEASE_TOKEN"}]);
  await host.approveCommand(binding, {reviewer: config.reviewer, reviewReceipt: "synthetic independent proof",
    dependencies: ["selected"], expiresAt: Date.now() + 120000});
  assert.equal((await runControlledContextTransition({...x.f.request, operation: "resume"},
    {...endpointServices, control: host.control})).status, "ACTION_COMPLETED");
  await host.close("selected");
  const profile = {schema: "control.owner-endpoint.v1", capability: "CONTROL_READ_ONLY",
    directory, config, acceptanceIds: ["selected"]};
  const controlEndpointFile = path.join(x.privateRoot, "independent-control.json");
  await writeFile(controlEndpointFile, JSON.stringify(profile), {mode: 0o600});
  const home = path.join(x.privateRoot, "independent-home"), workspace = path.join(x.privateRoot, "independent-room");
  await mkdir(home, {mode: 0o700}); await mkdir(workspace, {mode: 0o700});
  return {...x, host, binding, directory, acceptance, finding, registry, sourceFile, config, profile,
    controlEndpointFile, native: {binary, workspace, home, authHome: home, endpointFile: sourceFile,
      controlEndpointFile, role: "preparation", model: "gpt-6.1-sol", effort: "low", timeoutMs: 20000,
      prompt: "Read the public contract and actual current control status. No execution."}};
}
const retained = async x => (await openControlStore(x.directory)).read();

test("independent current-recall helper must parse verified preparation without rejecting its new status", () => {
  const answer = {current: {controlEnrollment: "CLOSED", executionAuthorized: false}};
  const run = {status: "PREPARATION_STATUS_VERIFIED", nativeStatus: "CLI_EXIT_OK",
    preparation: {status: "VERIFIED", semanticAcceptance: "NOT_ESTABLISHED"},
    output: [{type: "item.completed", item: {type: "agent_message", text: JSON.stringify(answer)}},
      {type: "turn.completed", usage: {input_tokens: 1, output_tokens: 1}}].map(JSON.stringify).join("\n")};
  // qualifyCurrentRecall passes run directly to this legacy parser.
  assert.deepEqual(cycleAnswer(run), answer);
});

test("independent closed readback preserves open debt, history, private authority and scoped stability", async t => {
  const x = await closedFixture(t), before = await retained(x), receipt = await x.host.preparationStatus(["selected"]);
  assert.equal(receipt.rows[0].currentControl.enrollment, "CLOSED");
  assert.equal(receipt.rows[0].findings[0].status, "OPEN");
  assert.equal(receipt.rows[0].historicalAcceptance.temporalScope, "AT_ACCEPTANCE_NOT_CURRENT_CONTROL");
  assert.equal(receipt.mutationAuthorized, false);
  for (const secret of [x.privateRoot, x.f.root, "PRIVATE_EVIDENCE", "PRIVATE_CHECKPOINT", "PRIVATE_LEASE_TOKEN", "grants", "binding"])
    assert.ok(!canonicalJson(receipt).includes(secret), secret);
  assert.match(await readFile(path.join(x.f.root, "independent-memory.md"), "utf8"), /control pending/);
  assert.deepEqual(await retained(x), before);
  await x.host.accept({...x.acceptance, id: "unrelated", task: "other"});
  assert.equal((await x.host.preparationStatus(["selected"], {expectedDigest: receipt.digest})).digest, receipt.digest);
});

for (const outcome of ["in-flight", "unknown"])
  test(`independent ${outcome} overdue review must not inherit old CONTROL_CONFIRMED assessment`, async t => {
    const x = await closedFixture(t);
    t.mock.timers.enable({apis: ["Date"], now: Date.parse(x.finding.reviewAt) + 1});
    const offer = await x.host.claimReview("selected");
    if (outcome === "unknown") await x.host.reviewFailure("selected", offer.runId);
    const receipt = await x.host.preparationStatus(["selected"]), current = receipt.rows[0].currentControl;
    assert.equal(current.enrollment, outcome === "unknown" ? "REVIEW_RECONCILIATION_REQUIRED" : "REVIEW_IN_FLIGHT");
    assert.equal(current.reviewInFlight, true);
    assert.equal(current.repairReviewOverdue, true);
    const newBinding = {...x.binding, commandSha256: sha256("independent next reviewed command")};
    await x.host.approveCommand(newBinding, {reviewer: x.config.reviewer, reviewReceipt: "synthetic independent command review",
      dependencies: ["selected"], expiresAt: Date.now() + 60000});
    await assert.rejects(x.host.control.authorize(newBinding), /REVIEW_PENDING/);
    assert.notEqual(current.assessedAction, "CONTROL_CONFIRMED", "Old consumed verdict cannot certify current pending review");
  });

test("independent actor strings cannot widen read-only owner MCP or selected IDs", async t => {
  const x = await closedFixture(t), before = await retained(x);
  const capability = preparationControl(x.host, ["selected"]);
  for (const args of [{owner: "owner"}, {reviewer: "reviewer"}, {acceptanceIds: ["other"]}, {capability: "CONTROL_DISPOSITION_ONLY"}])
    await assert.rejects(capability.readStatus(args), /OWNER_ARGUMENT_INVALID/);
  const messages = [{method: "tools/list"}, ...["respond", "execute_registered", "record_retention_repair"].map(name =>
    ({method: "tools/call", params: {name, arguments: {id: "selected", owner: "owner", reviewer: "reviewer"}}}))];
  const run = spawnSync(process.execPath, [ownerScript, x.controlEndpointFile, "CONTROL_READ_ONLY", hash(x.profile)],
    {input: messages.map((m, i) => JSON.stringify({jsonrpc: "2.0", id: i + 1, ...m})).join("\n") + "\n",
      encoding: "utf8", timeout: 10000});
  assert.equal(run.status, 0, run.stderr);
  const replies = run.stdout.trim().split("\n").map(JSON.parse);
  assert.deepEqual(replies[0].result.tools.map(tool => tool.name), ["read_status"]);
  for (const reply of replies.slice(1)) assert.equal(reply.error.code, -32601);
  assert.deepEqual(await retained(x), before);
});

for (const mode of ["no-status-read", "profile-drift", "source-drift", "separate-source-drift"])
  test(`independent native fake-provider ${mode}`, {skip: !binary || process.platform !== "darwin", timeout: 40000}, async t => {
    const x = await closedFixture(t), before = await retained(x);
    let endpointFile = x.sourceFile;
    if (mode === "separate-source-drift") {
      await x.f.put("alternate-contract.md", "Public separately registered contract v1");
      endpointFile = path.join(x.privateRoot, "alternate-sources.json");
      await writeFile(endpointFile, JSON.stringify({...x.registry,
        sources: [{id: "contract", path: "alternate-contract.md", purpose: "Separate public contract"}]}), {mode: 0o600});
    }
    const provider = await nativeProvider(t, async n => {
      if (n === 1) return codeItem(`const s=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.endsWith('read_source'));text(await tools[s.name]({id:'contract'}));
        ${mode !== "no-status-read" ? "const c=ALL_TOOLS.find(t=>t.name.includes('vydykhai_owner')&&t.name.endsWith('read_status'));text(await tools[c.name]({}));" : ""}`);
      if (mode === "profile-drift") await writeFile(x.controlEndpointFile, JSON.stringify({...x.profile, capability: "CONTROL_DISPOSITION_ONLY"}));
      if (mode === "source-drift") await x.f.put("public-contract.md", "Public contract v3 after acquired readback");
      if (mode === "separate-source-drift") await x.f.put("alternate-contract.md", "Public separately registered contract v2 after acquired readback");
      return answerItem({current: "CLOSED", executionAuthorized: false});
    });
    const run = await runControlledWorker({...x.native, endpointFile, provider: provider.provider});
    assert.equal(run.nativeStatus, "CLI_EXIT_OK", run.errors);
    assert.equal(provider.requests.length, 2);
    assert.deepEqual(await retained(x), before);
    assert.equal(await readFile(path.join(x.f.root, "actions.log"), "utf8"), "called\n");
    const reason = {"no-status-read": "PREPARATION_STATUS_NOT_ACQUIRED", "profile-drift": "PREPARATION_CONTROL_PROFILE_CHANGED",
      "source-drift": "PREPARATION_STATUS_STALE"}[mode];
    if (reason) {
      assert.equal(run.status, "PREPARATION_UNVERIFIED");
      assert.equal(run.preparation.reason, reason);
    } else {
      // This route verifies current control only; separate public-source freshness is explicitly caller-owned.
      assert.equal(run.status, "PREPARATION_STATUS_VERIFIED");
      assert.equal(run.preparation.sourceAcquisition, "CALLER_CHECK_REQUIRED");
      assert.equal(run.preparation.semanticAcceptance, "NOT_ESTABLISHED");
    }
  });
