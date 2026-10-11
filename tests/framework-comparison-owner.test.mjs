import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, readFile, writeFile, readdir, rm, symlink, chmod } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture, hash } from "./context-fixture.mjs";
import { sha256, canonicalJson } from "../scripts/memory-brief.mjs";
import { inspectControlRuntime, stageControlRuntime } from "../scripts/control-runtime.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { openComparisonControl } from "../scripts/qualify-framework-comparison-control.mjs";
import { stageComparisonPreflight, materializeComparisonScenario, runSyntheticComparisonTransport,
  invokeComparisonAdapter, verifyComparisonPreflight, openNativeBaselineExecution } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, readTurnSources, publishTurnSources, dispatchRole, readCompletedRoleOutput } from "../scripts/qualify-framework-comparison-native.mjs";
import { applyNativeOwnerAcceptance, readNativeOwnerApplication, readNativeOwnerDisposition,
  applyNativeBaselineOwner, validateBaselineOwnerExecution } from "../scripts/qualify-framework-comparison-owner.mjs";
import { nativeCommandAuthenticator } from "../scripts/qualify-framework-comparison-auth.mjs";
import { controlCatalog, controlCheckIds } from "../scripts/control-catalog.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const encode = value => canonicalJson(value) + "\n";
const options = { skip: process.platform !== "darwin" || !binary, timeout: 90000 };

async function baselineOwnerFixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "baseline-owner-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const staged = await stageComparisonPreflight({ sourceRoot, output: path.join(root, "comparison") });
  const base = { output: staged.output, expectedDigest: staged.digest };
  const scenario = await materializeComparisonScenario(base);
  // Initial package/ACK are a disclosed synthetic protocol prelude. Subsequent
  // command and owner authorization use actual acquired scripted-native records.
  await runSyntheticComparisonTransport({ ...base, ...scenario, arm: "baseline", prepareOnly: true });
  const workspace = path.join(staged.output, "workspaces/baseline"), controlRoot = path.join(root, "private");
  await mkdir(controlRoot, { mode: 0o700 });
  const applicationRoot = path.join(controlRoot, "applications"), authHome = path.join(controlRoot, "auth");
  await mkdir(applicationRoot, { mode: 0o700 }); await mkdir(authHome, { mode: 0o700 });
  const put = async (name, value) => writeFile(path.join(workspace, name), typeof value === "string" ? value : encode(value), { flag: "wx", mode: 0o600 });
  const ref = async (id, name) => ({ id, path: name, sha256: sha256(await readFile(path.join(workspace, name))) });
  const helper = path.join(workspace, ".comparison-command.mjs");
  const helperBytes = await readFile(path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs"));
  await writeFile(helper, helperBytes, { mode: 0o400, flag: "wx" });
  const helperSha256 = sha256(helperBytes), recipeSha256 = sha256(await readFile(path.join(workspace, "recipe.json")));
  const nativeExecution = { helper, helperSha256, recipeSha256, controlRoot };
  const fixed = { workspace, recipeSha256, files: {} };
  for (const name of ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"])
    fixed.files[name] = sha256(await readFile(path.join(workspace, name)));
  const entries = [];
  for (const operation of ["resume", "accept"]) {
    const file = `prepared/${operation}.json`, request = JSON.parse(await readFile(path.join(workspace, file)));
    entries.push({ id: operation, file, request, dependencies: [], bindingSha256: hash({ operation, task: request.task }) });
  }
  const request = entries[0].request;
  const ack = JSON.parse(await readFile(path.join(workspace, request.readback.path)));
  const readback = await readFile(path.join(workspace, ack.evidenceRef.path), "utf8");
  const sourceFile = path.join(controlRoot, "sources.json");
  const paths = { "baseline-task": request.task.path, "baseline-capsule": request.capsule.path,
    ack: request.readback.path, worker: ack.evidenceRef.path, output: "consumer-output.json",
    "original-return": "original-return.md", "actual-result": "actual-result.json", "retain-scope": "retain-scope.json",
    retained: "retained-memory.md", "route-scope": "route-scope.json", "next-request": "next-request.json",
    "integration-request": "integration-request.json", integration: "integration.json", "route-input": "route-input.json", outbox: "routed-outbox.md",
    "next-task": "next/task.json", "next-capsule": "next/capsule.json", "next-evidence": "next-worker.txt", "next-ack": "next/readback.json" };
  await writeFile(sourceFile, encode({ schema: "control.review-sources.v1", workspace,
    sources: Object.entries(paths).map(([id, path]) => ({ id, path, purpose: `Scripted baseline transport ${id}` })) }), { mode: 0o600 });
  const native = await stageNativeComparison({ comparisonOutput: staged.output, expectedDigest: staged.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(root, "native"), maxCalls: 5, timeoutMs: 15000 });
  const args = { ...native, arm: "baseline" }, freeze = await verifyComparisonPreflight(base.output, base.expectedDigest);
  const publish = async refs => {
    const current = await readTurnSources(args), artifacts = [];
    for (const item of refs) {
      const text = await readFile(path.join(workspace, item.path), "utf8");
      assert.equal(sha256(text), item.sha256);
      artifacts.push({ id: item.id, text, purpose: "Actual source bytes; scripted transport, not semantic proof",
        origin: { kind: "parent-protocol-result", arm: "baseline", operation: "owner-input", sha256: item.sha256 } });
    }
    return publishTurnSources({ ...args, expectedSourceRevision: current.sourceRevision, artifacts });
  };
  const taskRef = await ref("baseline-task", request.task.path), capsuleRef = await ref("baseline-capsule", request.capsule.path);
  await publish([taskRef, capsuleRef]);
  const context = async () => ({ runtimeDigest: freeze.baseline.digest, sourceRoot: workspace,
    sourceRegistrySha256: sha256(await readFile(sourceFile)), sourceSnapshotDigest: (await (await openReviewSources(sourceFile)).snapshot()).digest,
    transportSha256: hash({ fixed, helperSha256 }) });
  const turn = async (role, refs, modelOutput, commands = [], selectedTask = taskRef) => {
    const provider = await nativeProvider(t, async n => n === 1 ? codeItem(
      "const tool=ALL_TOOLS.find(x=>x.name.includes('vydykhai_review')&&x.name.includes('read_source'));" +
      `for(const id of ${JSON.stringify(refs.map(row => row.id))})text(await tools[tool.name]({id}));`)
      : answerItem(modelOutput));
    const sources = await readTurnSources(args);
    return dispatchRole({ ...args, role, binary, authHome, provider: provider.provider, sourceRevision: sources.sourceRevision,
      intent: { task: { id: selectedTask.id, sha256: selectedTask.sha256 }, context: await context(), commands },
      prompt: "Acquire the pinned inputs and return the scripted authorization. This is a transport test, not semantic inference proof." });
  };
  const resolvers = new Map();
  const driver = await openNativeBaselineExecution({ ...base, scenarioDigest: scenario.scenarioDigest, nativeExecution,
    directory: path.join(controlRoot, "executions"), requests: entries,
    authenticateDispatch: id => { assert.ok(resolvers.has(id)); return resolvers.get(id)(id); } });
  for (const entry of entries) {
    const record = await turn("worker", [taskRef, capsuleRef], { commands: [{ requestId: entry.id,
      decision: "AUTHORIZE_SUPERVISOR_ACTION", readback }] }, [{ requestId: entry.id,
      requestSha256: hash({ ...entry.request, readback: null }), bindingSha256: entry.bindingSha256, dependenciesSha256: hash([]) }]);
    const id = `worker-${entry.id}`;
    resolvers.set(id, nativeCommandAuthenticator({ ...args, workspace, sourceFile, runtimeDigest: freeze.baseline.digest, fixed, helperSha256,
      bindings: [{ id, number: record.number, requestId: entry.id, request: entry.request, dependencies: [],
        delivery: { id: capsuleRef.id, sha256: capsuleRef.sha256 } }] }));
    const observed = await driver.execute({ requestId: entry.id, dispatchId: id });
    assert.equal(observed.observation.result.status, entry.id === "resume" ? "ACTION_COMPLETED" : "VERIFIED");
    assert.equal(observed.consumerCheck.status, "PASS");
    assert.ok(observed.observation.loaded.every(name => !name.startsWith("scripts/control-")));
  }
  const execution = await driver.readExecution("accept");
  await put("original-return.md", execution.observation.result.returnSync); await put("actual-result.json", execution.observation.result);
  const originals = { taskRef, returnRef: await ref("original-return", "original-return.md"),
    resultRef: await ref("actual-result", "actual-result.json"), artifactRef: await ref("output", "consumer-output.json") };
  const scope = { schema: "comparison.baseline-owner-scope.v1", phase: "retain", owner: "owner", executionId: "accept",
    executionSha256: hash(execution), workerNumber: 2, ...originals, retentionTargets: { memory: "retained-memory.md" } };
  await put("retain-scope.json", scope);
  const scopeRef = await ref("retain-scope", "retain-scope.json");
  await publish([originals.returnRef, originals.resultRef, originals.artifactRef, scopeRef]);
  const retention = { memory: "Scripted native owner retention: preserve the actual public consumer result and original Return.\n" };
  const owner = await turn("owner", [...Object.values(originals), scopeRef], { baselineOwner: { phase: "retain", decision: "ACCEPTED", retention } });
  const apply = { ...args, number: owner.number, scopeRef, applicationRoot, sourceFile, fixed, helperSha256, readExecution: driver.readExecution };
  return { root, workspace, applicationRoot, base, freeze, scenario, args, scope, scopeRef, originals, execution, driver,
    apply, retention, put, ref, publish, turn, sourceFile };
}

test("baseline scripted native owner retains exact bytes and routes immutable Return through archived next integration", options, async t => {
  const x = await baselineOwnerFixture(t);
  const unchanged = async () => {
    assert.deepEqual(await readdir(x.applicationRoot), []);
    await assert.rejects(readFile(path.join(x.workspace, "retained-memory.md")), { code: "ENOENT" });
  };
  await assert.rejects(applyNativeBaselineOwner({ ...x.apply, number: 2 }), { message: "OWNER_NATIVE_ROLE_REQUIRED" }); await unchanged();
  const expected = { id: "accept", sourceFreeze: x.base.expectedDigest, scenarioDigest: x.scenario.scenarioDigest,
    workspace: x.workspace, armDigest: x.freeze.baseline.digest, neutralAdapter: x.freeze.adapter };
  assert.deepEqual(validateBaselineOwnerExecution(x.execution, expected), x.execution);
  for (const patch of [value => { value.consumerCheck.status = "FAIL"; }, value => { value.authorization.role = "owner"; },
    value => { value.observation.after["consumer-output.json"] = "0".repeat(64); value.observationSha256 = hash(value.observation); }]) {
    const changed = structuredClone(x.execution); patch(changed);
    await assert.rejects(applyNativeBaselineOwner({ ...x.apply, readExecution: async () => changed }), /BASELINE_(CONSUMER_PROOF_REQUIRED|EXECUTION_AUTH_INVALID)/);
    await unchanged();
  }
  const outputFile = path.join(x.workspace, x.originals.artifactRef.path), output = await readFile(outputFile);
  await writeFile(outputFile, "output drift");
  await assert.rejects(applyNativeBaselineOwner(x.apply), { message: "OWNER_CONTEXT_CHANGED" });
  await writeFile(outputFile, output); await unchanged();
  const retained = await applyNativeBaselineOwner(x.apply);
  assert.equal(retained.status, "BASELINE_RETENTION_APPLIED"); assert.equal(retained.semanticEvidence, false);
  assert.equal(retained.wholeChainComparatorReady, false); assert.equal(retained.nextExecution, "NOT_PERFORMED");
  assert.equal(await readFile(path.join(x.workspace, "retained-memory.md"), "utf8"), x.retention.memory);
  const pending = await readFile(path.join(x.applicationRoot, "baseline-accept-retain/pending.json"));
  await assert.rejects(applyNativeBaselineOwner(x.apply));
  assert.deepEqual(await readFile(path.join(x.applicationRoot, "baseline-accept-retain/pending.json")), pending);
  const route = await baselineRouteFixture(x, retained);
  const applied = await applyNativeBaselineOwner(route.apply);
  assert.equal(applied.status, "BASELINE_RETURN_ROUTED"); assert.equal(applied.semanticEvidence, false);
  assert.equal(applied.nextExecution, "NOT_PERFORMED");
  assert.deepEqual(JSON.parse(await readFile(path.join(x.workspace, "route-input.json"))), route.authored.route);
  const consumed = await route.call("outbox", { file: "routed-outbox.md" });
  assert.equal(consumed.parsed.routedCount, 1); assert.deepEqual(consumed.parsed.pendingReturnIds, []);
  assert.equal(await readFile(path.join(x.workspace, "original-return.md"), "utf8"), x.execution.observation.result.returnSync);
  assert.deepEqual(await readFile(outputFile), output);
  assert.deepEqual(await readFile(path.join(x.workspace, "next/readback.json")), route.ackBytes);
  await assert.rejects(readFile(path.join(x.workspace, "continued.json")), { code: "ENOENT" });
  await assert.rejects(applyNativeBaselineOwner(route.apply));
  assert.deepEqual((await readdir(x.applicationRoot)).sort(), ["baseline-accept-retain", "baseline-accept-route"]);
});

async function baselineRouteFixture(x, retained, { acknowledge = true } = {}) {
  // Next preparation is explicitly test-authored, not attributed to either native
  // owner. Archived confirm creates real integration; no next-worker ACK is faked.
  const pkg = JSON.parse(await readFile(path.join(x.workspace, "prepared-package.json")));
  pkg.task.id = "next-consumer"; pkg.navigation.taskId = pkg.task.id;
  pkg.task.action = { ...pkg.task.action, args: ["continuation.mjs"] }; pkg.task.candidateFiles = ["continuation.mjs"];
  pkg.module.implementationFiles = ["continuation.mjs"];
  pkg.sharedArtifacts = ["retained-memory.md", "original-return.md"];
  pkg.dependencies.push({ id: "accepted-output", path: "consumer-output.json", scope: ["bundle"] });
  await x.put("next-package.json", pkg);
  const call = async (operation, rest) => {
    const observed = await invokeComparisonAdapter({ ...x.base, arm: "baseline", operation, ...rest });
    assert.deepEqual(observed.commands, []); assert.ok(!observed.loaded.includes("scripts/control-host.mjs"));
    return observed.result;
  };
  for (const [mode, extra, status] of [["plan", ["--input", "next-package.json"], "PLAN_READY"],
    ["confirm", ["--owner", "owner", "--decision", "approved"], "PREPARED"], ["read", ["--worker", "worker"], "DELIVERED"]]) {
    const result = await call("prepare", { args: [mode, "--output", "next", ...extra] });
    assert.equal(result.status, status, JSON.stringify(result));
  }
  let nextRequest = { ...JSON.parse(await readFile(path.join(x.workspace, "next/awaiting-worker.json"))), operation: "resume" };
  let ackBytes = null;
  if (acknowledge) {
    const nextTask = await x.ref("next-task", nextRequest.task.path), nextCapsule = await x.ref("next-capsule", nextRequest.capsule.path);
    await x.publish([nextTask, nextCapsule]);
    const worker = await x.turn("worker", [nextTask, nextCapsule],
      { readback: "Scripted native next-worker readback of the actual prepared task and capsule; no execution authority.\n" }, [], nextTask);
    const actual = await readCompletedRoleOutput({ ...x.args, number: worker.number });
    assert.equal(actual.role, "worker");
    await x.put("next-worker.txt", actual.modelOutput.readback);
    const ack = await call("prepare", { args: ["ack", "--output", "next", "--worker", "worker", "--evidence", "next-worker.txt"] });
    assert.equal(ack.status, "ACKNOWLEDGED", JSON.stringify(ack));
    nextRequest = JSON.parse(await readFile(path.join(x.workspace, "next/resume.json")));
    ackBytes = await readFile(path.join(x.workspace, nextRequest.readback.path));
    const receipt = JSON.parse(ackBytes);
    assert.equal(receipt.taskSha256, nextTask.sha256); assert.equal(receipt.capsuleSha256, nextCapsule.sha256);
    assert.equal(sha256(actual.modelOutput.readback), receipt.evidenceRef.sha256);
  } else assert.equal(nextRequest.readback, null);
  await x.put("next-request.json", nextRequest);
  const planRef = await x.ref("integration-plan", "next/integration-plan.json");
  await x.put("integration-request.json", { ...nextRequest, operation: "integrate", capsule: null, readback: null,
    integrationPlan: { path: planRef.path, sha256: planRef.sha256 } });
  const integrated = await call("context", { file: "integration-request.json" });
  assert.equal(integrated.status, "VERIFIED", JSON.stringify(integrated)); await x.put("integration.json", integrated.receipt);
  const retentionRefs = [await x.ref("retained", "retained-memory.md")];
  const scope = { ...x.scope, phase: "route", retentionApplicationSha256: retained.applicationSha256, retentionRefs,
    nextRequestRef: await x.ref("next-request", "next-request.json"), integrationRequestRef: await x.ref("integration-request", "integration-request.json"),
    integrationRef: await x.ref("integration", "integration.json"), routeInputPath: "route-input.json", outboxPath: "routed-outbox.md" };
  await x.put("route-scope.json", scope); const scopeRef = await x.ref("route-scope", "route-scope.json");
  await x.publish([...retentionRefs, scope.nextRequestRef, scope.integrationRequestRef, scope.integrationRef, scopeRef]);
  const original = await call("outbox", { file: "original-return.md" });
  const route = { returnReceiptId: original.parsed.returns[0].id, consumer: "owner",
    routedNextAction: "Route the retained output to next-consumer; a fresh post-route authorization is still required before execution.",
    evidence: "original-return.md; retained-memory.md; consumer-output.json; integration.json" };
  const authored = { baselineOwner: { phase: "route", decision: "ROUTE", nextTaskId: "next-consumer", route } };
  const record = await x.turn("owner", [...Object.values(x.originals), ...retentionRefs,
    scope.nextRequestRef, scope.integrationRequestRef, scope.integrationRef, scopeRef], authored);
  return { apply: { ...x.apply, number: record.number, scopeRef }, call, authored: authored.baselineOwner, ackBytes };
}

test("P2 baseline owner rejects unregistered recipe drift after dispatch before retention", options, async t => {
  const x = await baselineOwnerFixture(t);
  const recipePath = path.join(x.workspace, "recipe.json"), recipe = JSON.parse(await readFile(recipePath));
  await writeFile(recipePath, encode({ ...recipe, rationale: "Changed after owner dispatch outside registered source universe" }));
  await assert.rejects(applyNativeBaselineOwner(x.apply), { message: "BASELINE_OWNER_TRANSPORT_CHANGED" });
  assert.deepEqual(await readdir(x.applicationRoot), []);
  await assert.rejects(readFile(path.join(x.workspace, "retained-memory.md")), { code: "ENOENT" });
});

test("P2 baseline owner rejects true next integration without an actual next-worker ACK", options, async t => {
  const x = await baselineOwnerFixture(t), retained = await applyNativeBaselineOwner(x.apply);
  const route = await baselineRouteFixture(x, retained, { acknowledge: false });
  await assert.rejects(applyNativeBaselineOwner(route.apply), { message: "BASELINE_OWNER_NEXT_PREFLIGHT_REQUIRED" });
  assert.deepEqual(await readdir(x.applicationRoot), ["baseline-accept-retain"]);
  for (const name of ["route-input.json", "routed-outbox.md", "continued.json"])
    await assert.rejects(readFile(path.join(x.workspace, name)), { code: "ENOENT" });
});

test("baseline owner unknown after retention effect holds the attempt and never replays", options, async t => {
  const x = await baselineOwnerFixture(t), retainedPath = path.join(x.workspace, "retained-memory.md");
  let observedEffect = false;
  const readExecution = async id => {
    try { await readFile(retainedPath); observedEffect = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (observedEffect) throw Error("TEST_READBACK_UNKNOWN_AFTER_RETENTION");
    return x.driver.readExecution(id);
  };
  await assert.rejects(applyNativeBaselineOwner({ ...x.apply, readExecution }), { message: "TEST_READBACK_UNKNOWN_AFTER_RETENTION" });
  assert.equal(observedEffect, true);
  const pendingPath = path.join(x.applicationRoot, "baseline-accept-retain/pending.json"), pending = await readFile(pendingPath);
  assert.equal(await readFile(retainedPath, "utf8"), x.retention.memory);
  await assert.rejects(readFile(path.join(x.applicationRoot, "baseline-accept-retain/applied.json")), { code: "ENOENT" });
  await assert.rejects(applyNativeBaselineOwner(x.apply));
  assert.deepEqual(await readFile(pendingPath), pending); assert.equal(await readFile(retainedPath, "utf8"), x.retention.memory);
  assert.equal(await readFile(path.join(x.workspace, "original-return.md"), "utf8"), x.execution.observation.result.returnSync);
});

async function setup(t, { disposition = false } = {}) {
  const f = await fixture(t, { correction: true, actionBody:
    "import {writeFileSync} from 'node:fs';writeFileSync('consumer-output.json','owner-fixture-output',{flag:'wx'});\n" });
  await f.prepare();
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-owner-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ["packages", "host", "review", "applications", "auth"]) await mkdir(path.join(root, name), { mode: 0o700 });
  const applicationRoot = path.join(root, "applications"), sourceFile = path.join(root, "sources.json");
  const retentionTargets = { memory: "retained-memory.md", map: "retained-map.md", tracker: "retained-tracker.md", custody: "retained-custody.md" };
  const sourcePaths = { task: f.request.task.path, producerReturn: "producer-return.md", artifact: "consumer-output.json",
    technicalProof: "technical-proof.json", goal: "goal.md", scope: "owner-scope.json", ...retentionTargets,
    unrelated: "unrelated.txt" };
  await writeFile(sourceFile, encode({ schema: "control.review-sources.v1", workspace: f.root,
    sources: Object.entries(sourcePaths).map(([id, path]) => ({ id, path, purpose: `Public fixture ${id}` })) }), { mode: 0o600 });
  const identity = await inspectControlRuntime(sourceRoot);
  const staged = await stageControlRuntime({ sourceRoot, directory: path.join(root, "packages"), workspace: f.root, expectedDigest: identity.digest });
  const runtime = { packageRoot: staged.root, expectedDigest: staged.digest };
  const helperBytes = await readFile(path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs"));
  const helper = path.join(f.root, ".comparison-command.mjs"), helperSha256 = sha256(helperBytes);
  await writeFile(helper, helperBytes, { mode: 0o400 });
  await f.put("recipe.json", { scope: "owner-scripted-transport-only" });
  const fixed = { workspace: f.root, recipeSha256: sha256(await readFile(path.join(f.root, "recipe.json"))), files: {} };
  for (const name of ["candidate.mjs", "oracle.json", "verify.mjs", "action.mjs"]) fixed.files[name] = sha256(await readFile(path.join(f.root, name)));
  const profile = { schema: "control.service.v1", directory: path.join(root, "host"),
    config: { workspace: f.root, policy: hash("fixture-only"), owner: "owner", executor: f.task.owner,
      reviewer: "reviewer", evidenceRegistry: sourceFile }, maxReviewsPerTick: 0, timeoutMs: 3000,
    review: { directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      maxCalls: 1, expiresAt: new Date(Date.now() + 300000).toISOString(), scope: { kind: "fixture" },
      native: { timeoutMs: 1000, binary: "/never-launch" } } };
  const requests = ["resume", "accept"].map(id => ({ id, request: { ...f.request, operation: id }, dependencies: [] }));
  const records = new Map(), dispositionResolvers = new Map(); let applied, ownerOptions;
  const bridge = await openComparisonControl({ runtime, profile, fixed, helper, helperSha256, requests, initialize: true,
    authenticateDispatch: async dispatchId => dispatchId === "owner-accept"
      ? readNativeOwnerApplication({ ...ownerOptions, applicationSha256: applied.applicationSha256 })
      : dispositionResolvers.has(dispatchId) ? dispositionResolvers.get(dispatchId)() : records.get(dispatchId) });
  const ctx = await import(pathToFileURL(path.join(staged.root, "scripts/context-run.mjs")).href);
  const preflight = await ctx.runContextTransition({ ...f.request, operation: "preflight" });
  assert.equal(preflight.status, "READY");
  const hostContext = async () => ({ runtimeDigest: staged.digest, sourceRoot: f.root,
    sourceRegistrySha256: sha256(await readFile(sourceFile)), sourceSnapshotDigest: (await (await openReviewSources(sourceFile)).snapshot()).digest,
    transportSha256: hash({ fixed, helperSha256 }) });
  // These admission records are explicitly synthetic fixture authority. Only the
  // later owner path is bound to real native CLI traces; neither proves semantics.
  let verification;
  for (const { id, request } of requests) {
    const binding = { operation: id, taskId: f.task.id, taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
      sourceDigest: preflight.coverageBasis.sourceDigest, dependencyDigest: preflight.coverageBasis.dependencyDigest,
      ...(id === "accept" ? { candidateSha256: hash({ workspace: f.root, files: await Promise.all(f.task.candidateFiles.slice().sort()
        .map(async name => ({ path: name, sha256: sha256(await readFile(path.join(f.root, name))) }))) }) } : {}),
      commandSha256: hash(id === "resume" ? f.task.action : f.module.verificationCommand), cwd: f.root,
      executable: await realpath(process.execPath), kind: id === "resume" ? "dependent" : "verification" };
    const common = { ...await hostContext(), arm: "candidate", bindingSha256: hash(binding), dependenciesSha256: hash([]),
      expiresAt: Date.now() + 120000, traceSha256: hash("SYNTHETIC_COMMAND_ADMISSION_NOT_NATIVE_PROOF") };
    records.set(`review-${id}`, { ...common, id: `review-${id}`, role: "readiness-reviewer", state: "COMPLETED",
      requestSha256: hash({ ...request, readback: null }), decision: "APPROVE" });
    const receipt = JSON.parse(await readFile(path.join(f.root, request.readback.path)));
    records.set(`worker-${id}`, { ...common, id: `worker-${id}`, role: "worker", state: "COMPLETED",
      requestSha256: hash(request), request, decision: "AUTHORIZE_SUPERVISOR_ACTION", readback: await readFile(path.join(f.root, receipt.evidenceRef.path), "utf8") });
    const result = await bridge.execute({ requestId: id, reviewDispatchId: `review-${id}`, workerDispatchId: `worker-${id}` });
    assert.equal(result.status, id === "resume" ? "ACTION_COMPLETED" : "VERIFIED", JSON.stringify(result));
    if (id === "accept") verification = result;
  }
  const base = { id: "consumer", project: "owner-transport-fixture", task: f.task.id, owner: "owner", executor: f.task.owner,
    producerReturn: await f.put("producer-return.md", verification.returnSync),
    technicalProof: await f.put("technical-proof.json", verification.receipt),
    artifact: { path: "consumer-output.json", sha256: sha256(await readFile(path.join(f.root, "consumer-output.json"))) },
    goal: await f.put("goal.md", "Transport-only goal; no semantic outcome or savings claim.\n"), taskRef: f.request.task };
  const scopeRef = await f.put("owner-scope.json", { schema: "comparison.owner-scope.v1", verificationRequestId: "accept",
    verificationSha256: hash(verification), base, retentionTargets });
  const comparison = await stageComparisonPreflight({ sourceRoot, output: path.join(root, "comparison") });
  const scenario = await materializeComparisonScenario({ output: comparison.output, expectedDigest: comparison.digest });
  const native = await stageNativeComparison({ comparisonOutput: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(root, "native"), maxCalls: disposition ? 7 : 3, timeoutMs: 15000 });
  const initial = await readTurnSources({ ...native, arm: "candidate" });
  const ids = ["task", "producerReturn", "artifact", "technicalProof", "goal", "scope"], artifacts = [];
  for (const id of ids) {
    const text = await readFile(path.join(f.root, sourcePaths[id]), "utf8");
    artifacts.push({ id, purpose: `Public fixture ${id}`, text,
      origin: { kind: "parent-protocol-result", arm: "candidate", operation: "actual-verification-fixture", sha256: sha256(text) } });
  }
  const published = await publishTurnSources({ ...native, arm: "candidate", expectedSourceRevision: initial.sourceRevision, artifacts });
  const intent = { task: { id: "task", sha256: f.request.task.sha256 }, commands: [], context: await hostContext() };
  const authored = { acceptance: { decision: "ACCEPTED", reason: "Scripted transport fixture, not intelligence or semantic acceptance.",
    retention: { memory: "Exact authored memory bytes.\n", map: "Exact authored map bytes.\n",
      tracker: "Exact authored tracker bytes.\n", custody: "Exact authored custody bytes.\n" } } };
  const fake = await nativeProvider(t, async n => n % 2 ? codeItem(
    `const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));for(const id of ${JSON.stringify(ids)}.filter(id=>${n === 5 ? "id!=='scope'" : "true"}))text(await tools[t.name]({id}));`, `read-${n}`) : answerItem(authored));
  for (const role of ["owner", "worker", "owner"]) await dispatchRole({ ...native, arm: "candidate", role, binary,
    authHome: path.join(root, "auth"), provider: fake.provider, sourceRevision: published.sourceRevision, intent,
    prompt: "Read the registered scope and original proof. Return the acceptance decision and retention. Scripted transport fixture only." });
  ownerOptions = { ...native, number: 1, dispatchId: "owner-accept", workspace: f.root, applicationRoot, sourceFile,
    runtimeDigest: staged.digest, fixed, helperSha256, verificationRequestId: "accept", verification, base, retentionTargets, scopeRef };
  return { f, root, native, ownerOptions, authored, bridge, intent, runtime, profile, dispositionResolvers,
    setApplied(value) { applied = value; } };
}

test("native-scripted owner application binds scope, exact retention and real original verification through acceptOwned", options, async t => {
  const x = await setup(t), o = x.ownerOptions;
  const noWrites = async () => {
    assert.deepEqual(await readdir(o.applicationRoot), []);
    for (const name of Object.values(o.retentionTargets)) await assert.rejects(readFile(path.join(x.f.root, name)), { code: "ENOENT" });
  };
  await noWrites();
  await t.test("wrong role, expiry, context, scope and unread scope cannot write", async () => {
    for (const [patch, message] of [
      [{ number: 2 }, "OWNER_NATIVE_ROLE_REQUIRED"], [{ number: 3 }, "OWNER_SCOPE_NOT_ACQUIRED"],
      [{ runtimeDigest: "0".repeat(64) }, "OWNER_CONTEXT_CHANGED"],
      [{ base: { ...o.base, owner: "someone-else" } }, "OWNER_SCOPE_MISMATCH"],
      [{ retentionTargets: { ...o.retentionTargets, memory: "retained-other.md" } }, "OWNER_SCOPE_MISMATCH"],
      [{ verification: { ...o.verification, returnSync: "replaced Return" } }, "OWNER_SCOPE_MISMATCH"]
    ]) {
      await assert.rejects(applyNativeOwnerAcceptance({ ...o, ...patch }), { message }); await noWrites();
    }
    const record = await readCompletedRoleOutput({ ...x.native, arm: "candidate", number: 1 });
    const clock = t.mock.method(Date, "now", () => record.allocatedAtMs + record.timeoutMs + 300001);
    try { await assert.rejects(applyNativeOwnerAcceptance(o), { message: "OWNER_NATIVE_AUTH_EXPIRED" }); }
    finally { clock.mock.restore(); }
    await noWrites();
  });
  await t.test("changed original Return and receipt reject before application writes", async () => {
    for (const kind of ["producerReturn", "technicalProof"]) {
      const name = path.join(x.f.root, o.base[kind].path), original = await readFile(name);
      await writeFile(name, "Changed original proof");
      await assert.rejects(applyNativeOwnerAcceptance(o), { message: "OWNER_CONTEXT_CHANGED" });
      await noWrites(); await writeFile(name, original);
    }
  });
  await t.test("symlink application root and pending-only replay never write retention", async () => {
    const alias = path.join(x.root, "application-alias"); await symlink(o.applicationRoot, alias);
    await assert.rejects(applyNativeOwnerAcceptance({ ...o, applicationRoot: alias }), { message: "OWNER_APPLICATION_ROOT_UNSAFE" });
    await noWrites();
    const pendingRoot = path.join(o.applicationRoot, o.dispatchId); await mkdir(pendingRoot, { mode: 0o700 });
    await writeFile(path.join(pendingRoot, "pending.json"), "incomplete", { mode: 0o600 });
    await assert.rejects(applyNativeOwnerAcceptance(o), { message: "OWNER_APPLICATION_EXISTS" });
    assert.equal(await readFile(path.join(pendingRoot, "pending.json"), "utf8"), "incomplete");
    await rm(pendingRoot, { recursive: true }); await noWrites();
  });
  const result = await applyNativeOwnerAcceptance(o); x.setApplied(result);
  const readOptions = { ...o, applicationSha256: result.applicationSha256 };
  const auth = await readNativeOwnerApplication(readOptions);
  assert.equal(auth.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
  assert.equal(auth.payload.originalReturn, o.verification.returnSync);
  assert.equal(auth.payload.verificationSha256, hash(o.verification));
  for (const [id, name] of Object.entries(o.retentionTargets)) assert.equal(await readFile(path.join(x.f.root, name), "utf8"), x.authored.acceptance.retention[id]);
  assert.notEqual(auth.sourceSnapshotDigest, x.intent.context.sourceSnapshotDigest);
  assert.equal(auth.payload.acceptance.producerReturn.sha256, o.base.producerReturn.sha256);
  assert.equal(auth.payload.acceptance.technicalProof.sha256, o.base.technicalProof.sha256);
  const reopened = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import {readNativeOwnerApplication} from ${JSON.stringify(new URL("../scripts/qualify-framework-comparison-owner.mjs", import.meta.url).href)}; console.log(JSON.stringify(await readNativeOwnerApplication(${JSON.stringify(readOptions)})));`],
    { encoding: "utf8", timeout: 10000 });
  assert.equal(reopened.status, 0, reopened.stderr); assert.deepEqual(JSON.parse(reopened.stdout), auth);
  await assert.rejects(applyNativeOwnerAcceptance(o), { message: "OWNER_CONTEXT_CHANGED" });
  await t.test("readback rejects changed output, unrelated delta and application payload even with a replacement external hash", async () => {
    const file = result.applicationRef, bytes = await readFile(file), applied = JSON.parse(bytes);
    const pendingFile = path.join(o.applicationRoot, o.dispatchId, "pending.json"), pendingBytes = await readFile(pendingFile), pending = JSON.parse(pendingBytes);
    const editApplied = async value => { const next = encode(value); await writeFile(file, next); return { ...readOptions, applicationSha256: sha256(next) }; };
    const modified = structuredClone(applied); modified.auth.payload.acceptance.owner = "forged"; modified.auth.payloadSha256 = hash(modified.auth.payload);
    await assert.rejects(readNativeOwnerApplication(await editApplied(modified)), { message: "OWNER_APPLICATION_BINDING_MISMATCH" });
    const changedPending = structuredClone(pending); changedPending.binding.runtimeDigest = "0".repeat(64);
    const nextPending = encode(changedPending); await writeFile(pendingFile, nextPending);
    await assert.rejects(readNativeOwnerApplication(await editApplied({ ...applied, pendingSha256: sha256(nextPending) })), { message: "OWNER_CONTEXT_CHANGED" });
    await writeFile(pendingFile, pendingBytes); await writeFile(file, bytes);
    await x.f.put("retained-memory.md", "Changed retention");
    await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_RETENTION_DELTA_INVALID" });
    await x.f.put("retained-memory.md", x.authored.acceptance.retention.memory);
    await x.f.put("unrelated.txt", "Not authorized retention");
    await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_RETENTION_DELTA_INVALID" });
    await rm(path.join(x.f.root, "unrelated.txt"));
    for (const kind of ["producerReturn", "technicalProof"]) {
      const name = path.join(x.f.root, o.base[kind].path), original = await readFile(name);
      await writeFile(name, "Changed original proof after application");
      await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_REFERENCE_CHANGED" });
      await writeFile(name, original);
    }
    await chmod(pendingFile, 0o644);
    await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_REFERENCE_INVALID" });
    await chmod(pendingFile, 0o600);
    await rm(file); await symlink(pendingFile, file);
    await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_REFERENCE_INVALID" });
    await rm(file); await writeFile(file, bytes, { mode: 0o600 });
    await rm(pendingFile);
    assert.equal(spawnSync("/usr/bin/mkfifo", ["-m", "600", pendingFile]).status, 0);
    const fifoRead = spawnSync(process.execPath, ["--input-type=module", "-e",
      `import {readNativeOwnerApplication} from ${JSON.stringify(new URL("../scripts/qualify-framework-comparison-owner.mjs", import.meta.url).href)}; try {await readNativeOwnerApplication(${JSON.stringify(readOptions)});process.exitCode=2;} catch(e) {console.log(e.message);process.exitCode=e.message==='OWNER_REFERENCE_INVALID'?0:3;}`],
      { encoding: "utf8", timeout: 3000 });
    assert.equal(fifoRead.error, undefined); assert.equal(fifoRead.status, 0, fifoRead.stderr || fifoRead.stdout);
    await rm(pendingFile); await writeFile(pendingFile, pendingBytes, { mode: 0o600 });
    assert.deepEqual(await readNativeOwnerApplication(readOptions), auth);
    const clock = t.mock.method(Date, "now", () => auth.expiresAt + 1);
    try { await assert.rejects(readNativeOwnerApplication(readOptions), { message: "OWNER_NATIVE_AUTH_EXPIRED" }); }
    finally { clock.mock.restore(); }
  });
  const accepted = await x.bridge.acceptOwned({ dispatchId: o.dispatchId, verificationRequestId: "accept", acceptance: result.acceptance });
  assert.equal(accepted.status, "ACCEPTED_REVIEW_DUE");
  assert.equal(accepted.acceptance.enrollment, "REVIEW_DUE");
  assert.equal(accepted.wholeChainComparatorReady, false);
  const replay = await x.bridge.acceptOwned({ dispatchId: o.dispatchId, verificationRequestId: "accept", acceptance: result.acceptance });
  assert.deepEqual(replay, accepted);
  const applied = JSON.parse(await readFile(result.applicationRef));
  assert.equal(applied.semanticEvidence, false); assert.equal(applied.wholeChainComparatorReady, false);
  assert.equal(applied.status, "RETENTION_APPLIED_HOST_ACCEPTANCE_PENDING");
});

test("native owner disposition authenticates exact sources and authored leases; only selected host applies it", options, async t => {
  const x = await setup(t, { disposition: true }), o = x.ownerOptions;
  const applied = await applyNativeOwnerAcceptance(o); x.setApplied(applied);
  await x.bridge.acceptOwned({ dispatchId: o.dispatchId, verificationRequestId: "accept", acceptance: applied.acceptance });
  const serviceModule = await import(pathToFileURL(path.join(x.runtime.packageRoot, "scripts/control-service.mjs")).href);
  const service = await serviceModule.openControlService(x.profile);
  // Synthetic reviewer prelude through the actual host API, not a native REVIEW
  // or budget claim. Only the following owner turns prove native authorization.
  const offer = await service.host.claimReview("consumer"), now = new Date().toISOString();
  const finding = { id: "owned-gap", checkId: "C15.01", area: "C15",
    criterion: controlCatalog.flatMap(group => group.checks).find(row => row.id === "C15.01").criterion,
    evidence: "Scripted unresolved obligation, no semantic product finding", owner: "owner", work: "repair",
    status: "OPEN", firstSeen: now, reviewAt: new Date(Date.now() + 180000).toISOString(), attempts: 0, blocksResume: true };
  const verdict = { phase: "POST_ACCEPT", key: offer.key, reviewer: "reviewer", runId: offer.runId,
    observedAt: now, findings: [finding], rows: controlCheckIds.map(id => id === finding.checkId
      ? { id, status: "FINDING", evidence: "Scripted transport only", reason: "Owned repair", findingId: finding.id }
      : { id, status: "PASS", evidence: "Scripted transport only" }) };
  await service.host.review("consumer", offer, verdict);
  const packet = await x.bridge.readOwnerVerdict("consumer");
  const context = { ...x.intent.context,
    sourceSnapshotDigest: (await (await openReviewSources(o.sourceFile)).snapshot()).digest };
  const verdictRef = { ...await x.f.put("disposition-verdict.json", packet), id: "disposition-verdict" };
  const scope = { schema: "comparison.owner-disposition-scope.v1", acceptanceId: "consumer", owner: "owner",
    taskRef: o.base.taskRef, verdictRef, context };
  const scopeRef = { ...await x.f.put("disposition-scope.json", scope), id: "disposition-scope" };
  const initial = await readTurnSources({ ...x.native, arm: "candidate" });
  const artifacts = [];
  for (const ref of [verdictRef, scopeRef]) {
    const text = await readFile(path.join(x.f.root, ref.path), "utf8");
    artifacts.push({ id: ref.id, text, purpose: "Exact host transport copy, not a new host review input",
      origin: { kind: "parent-protocol-result", arm: "candidate", operation: "owner-disposition", sha256: sha256(text) } });
  }
  const published = await publishTurnSources({ ...x.native, arm: "candidate", expectedSourceRevision: initial.sourceRevision, artifacts });
  const repairLeases = [{ owner: "owner", work: "repair", state: "PREPARED", checkpoint: "Actual repair Return required",
    reviewAt: finding.reviewAt, evidence: "Scripted owner authored assignment, not completed repair" }];
  const decision = { owner: "owner", reviewKey: packet.reviewKey, action: "CONTINUE", nextAction: "next-task",
    evidence: "Scripted attempted continuation; host must reject unresolved finding" };
  const answers = [
    { disposition: { decision, repairLeases } },
    { disposition: { decision: { ...decision, action: "REPAIR", evidence: "Own unresolved work; no closure claim" }, repairLeases } }
  ];
  const fake = await nativeProvider(t, async n => n % 2 ? codeItem(
    `const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));for(const id of ${JSON.stringify(n === 5 ? ["task", verdictRef.id] : ["task", verdictRef.id, scopeRef.id])})text(await tools[t.name]({id}));`, `disposition-read-${n}`)
    : answerItem(answers[n === 2 ? 0 : 1]));
  for (let i = 0; i < 3; i++) await dispatchRole({ ...x.native, arm: "candidate", role: "owner", binary,
    authHome: path.join(x.root, "auth"), provider: fake.provider, sourceRevision: published.sourceRevision,
    intent: { task: x.intent.task, commands: [], context },
    prompt: "Read exact task, disposition-verdict and disposition-scope; author decision and repairLeases. Scripted transport only." });
  const args = { ...o, dispatchId: "owner-disposition", number: 4, acceptanceId: "consumer", owner: "owner",
    taskRef: o.base.taskRef, verdictRef, scopeRef, readVerdict: id => x.bridge.readOwnerVerdict(id) };
  const before = await x.bridge.snapshot(), artifact = await readFile(path.join(x.f.root, "consumer-output.json"));
  const auth = await readNativeOwnerDisposition(args);
  assert.deepEqual(auth.payload, { acceptanceId: "consumer", verdictSha256: hash(packet), ...answers[0].disposition });
  assert.equal(auth.purpose, "CONTROL_DISPOSITION");
  assert.equal(auth.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
  assert.equal(auth.evidenceLevel, "NATIVE_OUTPUT_BOUND_NOT_SEMANTIC_APPROVAL");
  assert.deepEqual(await x.bridge.snapshot(), before);
  assert.deepEqual(await readNativeOwnerDisposition(args), auth);
  for (const [patch, message] of [
    [{ number: 2 }, "OWNER_NATIVE_ROLE_REQUIRED"], [{ number: 6 }, "OWNER_DISPOSITION_SOURCE_NOT_ACQUIRED"],
    [{ runtimeDigest: "0".repeat(64) }, "OWNER_CONTEXT_CHANGED"], [{ owner: "impostor" }, "OWNER_DISPOSITION_SCOPE_MISMATCH"],
    [{ scopeRef: { ...scopeRef, id: "not-acquired" } }, "OWNER_DISPOSITION_SOURCE_NOT_ACQUIRED"],
    [{ readVerdict: async () => ({ ...packet, reviewKey: "0".repeat(64) }) }, "OWNER_DISPOSITION_VERDICT_CHANGED"]
  ]) await assert.rejects(readNativeOwnerDisposition({ ...args, ...patch }), { message });
  const file = path.join(x.f.root, verdictRef.path), original = await readFile(file);
  await x.f.put(verdictRef.path, { ...packet, productAcceptance: "FAKE" });
  await assert.rejects(readNativeOwnerDisposition(args), { message: "OWNER_REFERENCE_CHANGED" });
  await writeFile(file, original);
  await x.f.put("unrelated.txt", "Host source drift after dispatch");
  await assert.rejects(readNativeOwnerDisposition(args), { message: "OWNER_CONTEXT_CHANGED" });
  await rm(path.join(x.f.root, "unrelated.txt"));
  const outputFile = path.join(x.native.directory, "candidate/turns/model-output-4.json"), outputBytes = await readFile(outputFile);
  await writeFile(outputFile, encode({ disposition: { ...answers[0].disposition, decision: { ...decision, action: "REPAIR" } } }));
  await assert.rejects(readNativeOwnerDisposition(args), { message: "NATIVE_OUTPUT_BINDING_MISMATCH" });
  await writeFile(outputFile, outputBytes);
  const clock = t.mock.method(Date, "now", () => auth.expiresAt + 1);
  try { await assert.rejects(readNativeOwnerDisposition(args), { message: "OWNER_NATIVE_AUTH_EXPIRED" }); }
  finally { clock.mock.restore(); }
  x.dispositionResolvers.set(args.dispatchId, () => readNativeOwnerDisposition(args));
  const request = { dispatchId: args.dispatchId, acceptanceId: "consumer", ...auth.payload };
  await assert.rejects(x.bridge.applyOwnerDisposition({ ...request, decision: { ...decision, action: "REPAIR" } }),
    { message: "COMPARISON_DISPATCH_UNVERIFIED" });
  await assert.rejects(x.bridge.applyOwnerDisposition({ ...request, repairLeases: [] }), { message: "COMPARISON_DISPATCH_UNVERIFIED" });
  await assert.rejects(x.bridge.applyOwnerDisposition(request), { message: "POST_ACCEPT_REPAIR_REQUIRED" });
  assert.deepEqual(await x.bridge.snapshot(), before);
  const repairArgs = { ...args, number: 5, dispatchId: "owner-disposition-repair" };
  x.dispositionResolvers.set(repairArgs.dispatchId, () => readNativeOwnerDisposition(repairArgs));
  const repairAuth = await readNativeOwnerDisposition(repairArgs);
  assert.deepEqual(repairAuth.payload.decision, answers[1].disposition.decision);
  assert.equal((await x.bridge.applyOwnerDisposition({ dispatchId: repairArgs.dispatchId, ...repairAuth.payload })).action, "REPAIR_REQUIRED");
  const row = (await x.bridge.snapshot()).acceptances.consumer;
  assert.equal(row.findings[0].status, "OPEN"); assert.deepEqual(row.repairLeases, repairLeases);
  await assert.rejects(readNativeOwnerDisposition(repairArgs), { message: "OWNER_VERDICT_NOT_AVAILABLE" });
  await assert.rejects(x.bridge.applyOwnerDisposition({ dispatchId: repairArgs.dispatchId, ...repairAuth.payload }),
    { message: "OWNER_VERDICT_NOT_AVAILABLE" });
  assert.deepEqual(await readFile(path.join(x.f.root, "consumer-output.json")), artifact);
  await assert.rejects(x.bridge.close("consumer"), { message: "CONTROL_NOT_COMPLETE" });
  // Separate clean acceptance is synthetic host prelude, not a repair/closure of
  // the original finding. The native owner must consume its different packet.
  const cleanId = "clean-consumer";
  await service.host.accept({ ...applied.acceptance, id: cleanId });
  const cleanOffer = await service.host.claimReview(cleanId);
  await service.host.review(cleanId, cleanOffer, { ...verdict, key: cleanOffer.key, runId: cleanOffer.runId,
    observedAt: new Date().toISOString(), findings: [], rows: controlCheckIds.map(id => ({ id, status: "PASS", evidence: "Synthetic clean prelude" })) });
  const cleanPacket = await x.bridge.readOwnerVerdict(cleanId);
  const cleanVerdictRef = { ...await x.f.put("clean-verdict.json", cleanPacket), id: "clean-verdict" };
  const cleanScopeRef = { ...await x.f.put("clean-scope.json", { ...scope, acceptanceId: cleanId, verdictRef: cleanVerdictRef }), id: "clean-scope" };
  const cleanArtifacts = [];
  for (const ref of [cleanVerdictRef, cleanScopeRef]) {
    const text = await readFile(path.join(x.f.root, ref.path), "utf8");
    cleanArtifacts.push({ id: ref.id, text, purpose: "Clean synthetic host packet; native owner authorization only",
      origin: { kind: "parent-protocol-result", arm: "candidate", operation: "owner-disposition", sha256: sha256(text) } });
  }
  const cleanSources = await publishTurnSources({ ...x.native, arm: "candidate", expectedSourceRevision: published.sourceRevision, artifacts: cleanArtifacts });
  const cleanDecision = { ...decision, reviewKey: cleanPacket.reviewKey, evidence: "Scripted clean verdict disposition; next execution still unproven" };
  const cleanProvider = await nativeProvider(t, async n => n === 1 ? codeItem(
    "const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));for(const id of ['task','clean-verdict','clean-scope'])text(await tools[t.name]({id}));", "clean-read")
    : answerItem({ disposition: { decision: cleanDecision, repairLeases: [] } }));
  await dispatchRole({ ...x.native, arm: "candidate", role: "owner", binary, authHome: path.join(x.root, "auth"),
    provider: cleanProvider.provider, sourceRevision: cleanSources.sourceRevision, intent: { task: x.intent.task, commands: [], context },
    prompt: "Read task, clean-verdict and clean-scope; author disposition. Scripted transport only." });
  const cleanArgs = { ...args, number: 7, dispatchId: "owner-clean", acceptanceId: cleanId, verdictRef: cleanVerdictRef, scopeRef: cleanScopeRef };
  x.dispositionResolvers.set(cleanArgs.dispatchId, () => readNativeOwnerDisposition(cleanArgs));
  const cleanAuth = await readNativeOwnerDisposition(cleanArgs);
  const continued = await x.bridge.applyOwnerDisposition({ dispatchId: cleanArgs.dispatchId, ...cleanAuth.payload });
  assert.equal(continued.action, "VERIFY_CONTINUATION");
  const final = await x.bridge.snapshot();
  assert.deepEqual(final.acceptances[cleanId].disposition, cleanDecision);
  assert.equal(final.acceptances.consumer.findings[0].status, "OPEN");
  await assert.rejects(readNativeOwnerDisposition(cleanArgs), { message: "OWNER_VERDICT_NOT_AVAILABLE" });
  await assert.rejects(readFile(path.join(x.f.root, "continued.json")), { code: "ENOENT" });
  t.diagnostic("Command admission and reviewer verdict are synthetic prelude. Real native CLI owner output authenticates transport only; host retains the unresolved finding.");
});
