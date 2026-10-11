import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, readFile, writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture, hash } from "./context-fixture.mjs";
import { sha256 } from "../scripts/memory-brief.mjs";
import { stageComparisonPreflight, materializeComparisonScenario } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, readTurnSources, publishTurnSources, dispatchRole } from "../scripts/qualify-framework-comparison-native.mjs";
import { nativeCommandAuthenticator } from "../scripts/qualify-framework-comparison-auth.mjs";
import { openComparisonControl } from "../scripts/qualify-framework-comparison-control.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { inspectControlRuntime, stageControlRuntime } from "../scripts/control-runtime.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const options = { skip: process.platform !== "darwin" || !binary, timeout: 60000 };
const actionBody = "import {writeFileSync} from 'node:fs';writeFileSync('consumer-output.json','actual-native-authorized',{flag:'wx'});\n";

// Actual v3 plan/confirm/read, deliberately stopping BEFORE any ack or evidence.
// Package choices are synthetic fixture inputs, not semantic model evidence.
async function pendingFixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-auth-ack-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(sourceRoot, "examples/context-preparation"), root, { recursive: true });
  const json = async name => JSON.parse(await readFile(path.join(root, name), "utf8"));
  const put = async (name, value) => {
    const bytes = typeof value === "string" ? value : JSON.stringify(value) + "\n";
    await writeFile(path.join(root, name), bytes);
    return { path: name, sha256: sha256(bytes) };
  };
  const pkg = await json("package-modular.json"); pkg.schema = "context.package.v3";
  const statements = { goal: "Retain the public bundle behavior.", invariant: "Preserve the public boundary.",
    gap: "Independent N1 rejects case-sensitive duplicate comparison.", acceptance: "Verify B1/B2/N1 through the public entry." };
  await put("architecture.md", Object.values(statements).join("\n") + "\n");
  for (const [id, quote] of Object.entries(statements)) pkg.navigation.references.push({ id, quote,
    path: "architecture.md", purpose: id, appliesTo: "task" });
  pkg.alignment = { goalRef: "goal", invariantRefs: ["invariant"], acceptanceRef: "acceptance", review: null,
    decisions: [{ moduleId: "buildBundle", boundaryChange: false, gapRef: "gap", existingRef: "public-contract",
      rationale: "Synthetic protocol fixture, not semantic approval." }] };
  await put("package.json", pkg); await put("action.mjs", actionBody);
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(sourceRoot, "scripts/vydykhai.mjs"), ...args],
      { cwd: root, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const prepare = (mode, ...args) => cli("context-prepare", mode, "--output", "prepared", ...args);
  assert.equal(prepare("plan", "--input", "package.json").status, "PLAN_READY");
  assert.equal(prepare("confirm", "--owner", pkg.owner, "--decision", "approved").status, "PREPARED");
  assert.equal(prepare("read", "--worker", pkg.task.worker).status, "DELIVERED");
  const request = await json("prepared/awaiting-worker.json"), task = await json(request.task.path);
  return { root, put, json, request, task,
    async prepare() {
      await put("prepare-request.json", { ...request, operation: "prepare", capsule: null });
      return cli("context-run", "--input", "prepare-request.json");
    },
    async ack(text) {
      await put("native-worker.txt", text);
      assert.equal(prepare("ack", "--worker", task.owner, "--evidence", "native-worker.txt").status, "ACKNOWLEDGED");
      return json("prepared/resume.json");
    } };
}

async function setup(t, postAck = false) {
  // Prepared facts are a fixture, not model-authored discovery. The two actual CLI
  // turns and their exact outputs/read receipts are the provenance under test.
  const f = postAck ? await pendingFixture(t) : await fixture(t, { correction: true, actionBody });
  const prepared = await f.prepare();
  await f.put("recipe.json", { scope: "native-auth-transport-only" });
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-auth-")));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const comparison = await stageComparisonPreflight({ sourceRoot, output: path.join(parent, "comparison") });
  const scenario = await materializeComparisonScenario({ output: comparison.output, expectedDigest: comparison.digest });
  const native = await stageNativeComparison({ comparisonOutput: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(parent, "native"), maxCalls: 2, timeoutMs: 15000 });
  const controlRoot = path.join(parent, "control"); await mkdir(controlRoot, { mode: 0o700 });
  for (const name of ["packages", "host", "review", "auth"]) await mkdir(path.join(controlRoot, name), { mode: 0o700 });
  const runtimeIdentity = await inspectControlRuntime(sourceRoot);
  const staged = await stageControlRuntime({ sourceRoot, directory: path.join(controlRoot, "packages"), workspace: f.root,
    expectedDigest: runtimeIdentity.digest });
  const runtime = { packageRoot: staged.root, expectedDigest: staged.digest };
  const sourceFile = path.join(controlRoot, "sources.json");
  await writeFile(sourceFile, JSON.stringify({ schema: "control.review-sources.v1", workspace: f.root, sources: [
    { id: "task", path: f.request.task.path, purpose: "Actual prepared task" },
    { id: "delivery", path: f.request.capsule.path, purpose: "Actual current capsule" },
    ...(postAck ? [
      { id: "ack", path: "prepared/readback.json", purpose: "Future actual machine ack" },
      { id: "evidence", path: "native-worker.txt", purpose: "Future exact worker-authored text" },
      { id: "output", path: "consumer-output.json", purpose: "Future output, never an allowed ack delta" },
      { id: "unrelated", path: "unrelated.txt", purpose: "Unrelated missing source" }
    ] : [
      { id: "ack", path: f.request.readback.path, purpose: "Preexisting synthetic receipt, not a new self-delta" },
      { id: "evidence", path: f.evidence.path, purpose: "Preexisting synthetic evidence" }
    ])
  ] }), { mode: 0o600 });
  const initial = await readTurnSources({ ...native, arm: "candidate" });
  const rows = [];
  for (const [id, ref] of [["task", f.request.task], ["delivery", f.request.capsule]]) {
    const text = await readFile(path.join(f.root, ref.path), "utf8");
    rows.push({ id, purpose: id, text,
      origin: { kind: "parent-protocol-result", arm: "candidate", operation: "prepared-fixture", sha256: sha256(text) } });
  }
  const published = await publishTurnSources({ ...native, arm: "candidate", expectedSourceRevision: initial.sourceRevision, artifacts: rows });
  const helper = path.join(f.root, ".comparison-command.mjs"), helperBytes = await readFile(path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs"));
  await writeFile(helper, helperBytes, { mode: 0o400 });
  const helperSha256 = sha256(helperBytes);
  const fixed = { workspace: f.root, recipeSha256: sha256(await readFile(path.join(f.root, "recipe.json"))), files: {} };
  for (const name of ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs"])
    fixed.files[name] = sha256(await readFile(path.join(f.root, name)));
  const request = { ...f.request, operation: "resume" };
  const binding = { operation: "resume", taskId: f.task.id, taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
    sourceDigest: prepared.coverageBasis.sourceDigest, dependencyDigest: prepared.coverageBasis.dependencyDigest,
    commandSha256: hash(f.task.action), cwd: f.root, executable: await realpath(process.execPath), kind: "dependent" };
  const sourceBefore = await (await openReviewSources(sourceFile)).snapshot();
  const context = { runtimeDigest: staged.digest, sourceRoot: f.root, sourceRegistrySha256: sha256(await readFile(sourceFile)),
    sourceSnapshotDigest: sourceBefore.digest, transportSha256: hash({ fixed, helperSha256 }) };
  const intent = { task: { id: "task", sha256: request.task.sha256 }, context,
    commands: [{ requestId: "resume", requestSha256: hash({ ...request, readback: null }), bindingSha256: hash(binding), dependenciesSha256: hash([]) }] };
  const workerText = postAck ? "Scripted worker-authored evidence, emitted before the actual ack.\n" :
    await readFile(path.join(f.root, f.evidence.path), "utf8");
  const fake = await nativeProvider(t, async number => number % 2 === 1
    ? codeItem("const tool=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));" +
      "for(const id of ['task','delivery'])text(await tools[tool.name]({id}));", `read-${number}`)
    : answerItem({ role: "owner-is-not-authority", commands: [{ requestId: "resume",
      decision: number === 2 ? "APPROVE" : "AUTHORIZE_SUPERVISOR_ACTION", ...(number === 4 ? { readback: workerText } : {}) }] }));
  const outputs = [];
  for (const role of ["readiness-reviewer", "worker"]) outputs.push(await dispatchRole({ ...native, arm: "candidate", role, binary,
    authHome: path.join(controlRoot, "auth"), provider: fake.provider, sourceRevision: published.sourceRevision,
    intent, prompt: "Read task and delivery. Return your own explicit command decision. This is scripted transport qualification." }));
  if (postAck) {
    assert.equal(request.readback, null);
    for (const name of ["prepared/readback.json", "native-worker.txt"])
      await assert.rejects(readFile(path.join(f.root, name)), { code: "ENOENT" });
    Object.assign(request, await f.ack(outputs[1].modelOutput.commands[0].readback));
  }
  const bindings = [
    { id: "review-1", number: 1, requestId: "resume", request, dependencies: [],
      ...(postAck ? { sourceBefore, workerNumber: 2, delivery: { id: "delivery", sha256: request.capsule.sha256 } } : {}) },
    { id: "worker-2", number: 2, requestId: "resume", request, dependencies: [], delivery: { id: "delivery", sha256: request.capsule.sha256 },
      ...(postAck ? { sourceBefore } : {}) }
  ];
  const config = { ...native, workspace: f.root, sourceFile, runtimeDigest: staged.digest, fixed, helperSha256, bindings };
  const authenticateDispatch = nativeCommandAuthenticator(config);
  const profile = { schema: "control.service.v1", directory: path.join(controlRoot, "host"),
    config: { workspace: f.root, policy: hash("native-auth-fixture"), owner: "owner", executor: f.task.owner,
      reviewer: "reviewer", evidenceRegistry: sourceFile }, maxReviewsPerTick: 0, timeoutMs: 2000,
    review: { directory: path.join(controlRoot, "review"), controlRoot, reviewer: "reviewer", sourceFile,
      maxCalls: 1, expiresAt: new Date(Date.now() + 300000).toISOString(), scope: { kind: "fixture" },
      native: { timeoutMs: 1000, binary: "/never-launch" } } };
  const bridge = await openComparisonControl({ runtime, profile, fixed, helper, helperSha256,
    requests: [{ id: "resume", request, dependencies: [] }], authenticateDispatch, initialize: true });
  const args = { requestId: "resume", reviewDispatchId: "review-1", workerDispatchId: "worker-2" };
  return { f, native, config, authenticateDispatch, bridge, args, binding, request, workerText, bindings, sourceBefore, sourceFile };
}

test("real native role records authorize one actual controlled command, not callback expectations", options, async t => {
  const { f, native, config, authenticateDispatch, bridge, args, binding, request, workerText, bindings, sourceBefore } = await setup(t);
  const reviewer = await authenticateDispatch("review-1", { role: "owner", bindingSha256: "forged" });
  assert.equal(reviewer.role, "readiness-reviewer"); assert.equal(reviewer.bindingSha256, hash(binding));
  const worker = await authenticateDispatch("worker-2");
  assert.equal(worker.role, "worker"); assert.equal(worker.state, "COMPLETED");
  assert.equal(worker.readback, workerText); assert.equal(worker.requestSha256, hash(request));
  assert.equal(worker.sourceDelta, null);
  const priorAck = nativeCommandAuthenticator({ ...config, bindings: [{ ...bindings[1], sourceBefore }] });
  await assert.rejects(priorAck("worker-2"), { message: "NATIVE_AUTH_SOURCE_DELTA_INVALID" });
  const result = await bridge.execute(args);
  assert.equal(result.status, "ACTION_COMPLETED", JSON.stringify(result));
  assert.equal(await readFile(path.join(f.root, "consumer-output.json"), "utf8"), "actual-native-authorized");
  assert.equal((await bridge.execute(args)).status, "BLOCKED");
  await assert.rejects(authenticateDispatch("invented"), /NATIVE_AUTH_DISPATCH_UNREGISTERED/);
  const wrongDelivery = nativeCommandAuthenticator({ ...config, bindings: [bindings[0], { ...bindings[1], delivery: { id: "unread", sha256: request.capsule.sha256 } }] });
  await assert.rejects(wrongDelivery("worker-2"), /NATIVE_AUTH_DELIVERY_NOT_ACQUIRED/);
  const taskIsNotDelivery = nativeCommandAuthenticator({ ...config, bindings: [bindings[0],
    { ...bindings[1], delivery: { id: "task", sha256: request.task.sha256 } }] });
  await assert.rejects(taskIsNotDelivery("worker-2"), /NATIVE_AUTH_DELIVERY_NOT_ACQUIRED/);
  const original = await readFile(path.join(f.root, f.evidence.path));
  await writeFile(path.join(f.root, f.evidence.path), "changed authored evidence");
  await assert.rejects(authenticateDispatch("worker-2"), { message: "NATIVE_AUTH_CONTEXT_CHANGED" });
  await writeFile(path.join(f.root, f.evidence.path), original);
  const outputPath = path.join(native.directory, "candidate/turns/model-output-2.json");
  await writeFile(outputPath, '{"commands":[{"requestId":"resume","decision":"APPROVE"}]}');
  await assert.rejects(authenticateDispatch("worker-2"), /NATIVE_OUTPUT_BINDING_MISMATCH/);
});

test("actual post-output ack permits only its exact machine receipt and worker evidence self-delta", options, async t => {
  const x = await setup(t, true);
  const reviewer = await x.authenticateDispatch("review-1"), worker = await x.authenticateDispatch("worker-2");
  assert.equal(reviewer.role, "readiness-reviewer");
  assert.equal(Object.hasOwn(reviewer, "readback"), false);
  assert.equal(worker.readback, x.workerText);
  assert.notEqual(worker.sourceSnapshotDigest, x.sourceBefore.digest);
  assert.equal(worker.sourceSnapshotDigest, reviewer.sourceSnapshotDigest);
  assert.deepEqual(worker.sourceDelta, reviewer.sourceDelta);
  assert.equal(worker.sourceDelta.workerNumber, 2);
  assert.equal(worker.sourceDelta.kind, "ACK_EVIDENCE_ONLY");
  assert.equal(worker.sourceDelta.sourceBeforeDigest, x.sourceBefore.digest);
  assert.equal(worker.sourceDelta.refs[0].sha256, x.request.readback.sha256);
  assert.equal(worker.sourceDelta.refs[1].sha256, sha256(x.workerText));
  assert.deepEqual(await nativeCommandAuthenticator(x.config)("worker-2"), worker);

  await t.test("original snapshot, dependencies and reviewer-to-worker linkage stay pinned", async () => {
    const deny = async (entry, code) => assert.rejects(nativeCommandAuthenticator({ ...x.config, bindings: [entry] })(entry.id), { message: code });
    const workerEntry = x.bindings[1], reviewEntry = x.bindings[0];
    await deny({ ...workerEntry, sourceBefore: undefined }, "NATIVE_AUTH_CONTEXT_CHANGED");
    await deny({ ...workerEntry, sourceBefore: { ...x.sourceBefore, digest: "0".repeat(64) } }, "NATIVE_AUTH_SOURCE_BEFORE_INVALID");
    const forged = structuredClone(x.sourceBefore); forged.rows[0].purpose = "Forged prior state"; forged.digest = hash(forged.rows);
    await deny({ ...workerEntry, sourceBefore: forged }, "NATIVE_AUTH_SOURCE_BEFORE_INVALID");
    await deny({ ...workerEntry, dependencies: ["unallocated"] }, "NATIVE_AUTH_COMMAND_NOT_BOUND");
    await deny({ ...reviewEntry, workerNumber: undefined }, "NATIVE_AUTH_ACK_WORKER_REQUIRED");
    await deny({ ...reviewEntry, workerNumber: 1 }, "NATIVE_AUTH_ACK_WORKER_REQUIRED");
    await deny({ ...workerEntry, workerNumber: 1 }, "NATIVE_AUTH_ACK_WORKER_INVALID");
    await deny({ ...reviewEntry, delivery: { id: "task", sha256: x.request.task.sha256 } }, "NATIVE_AUTH_DELIVERY_NOT_ACQUIRED");
  });
  await t.test("other missing sources, available sources and registry bytes cannot drift", async () => {
    await x.f.put("unrelated.txt", "Not an ack artifact");
    await assert.rejects(x.authenticateDispatch("worker-2"), { message: "NATIVE_AUTH_SOURCE_DELTA_INVALID" });
    await rm(path.join(x.f.root, "unrelated.txt"));
    const capsule = path.join(x.f.root, x.request.capsule.path), original = await readFile(capsule);
    await writeFile(capsule, "Changed delivery");
    await assert.rejects(x.authenticateDispatch("worker-2"), { message: "NATIVE_AUTH_REFERENCE_CHANGED" });
    await writeFile(capsule, original);
    const registry = await readFile(x.sourceFile);
    await writeFile(x.sourceFile, Buffer.concat([registry, Buffer.from("\n")]));
    await assert.rejects(x.authenticateDispatch("worker-2"), { message: "NATIVE_AUTH_CONTEXT_CHANGED" });
    await writeFile(x.sourceFile, registry);
  });
  await t.test("ack must reference the same task, worker, capsule and exact authored evidence", async () => {
    const receiptFile = path.join(x.f.root, x.request.readback.path), bytes = await readFile(receiptFile), receipt = JSON.parse(bytes);
    for (const patch of [{ worker: "other-worker" }, { taskSha256: "0".repeat(64) }, { capsuleSha256: "0".repeat(64) },
      { capability: "invented" }]) {
      const ref = await x.f.put(x.request.readback.path, { ...receipt, ...patch });
      const auth = nativeCommandAuthenticator({ ...x.config, bindings: [{ ...x.bindings[1], request: { ...x.request, readback: ref } }] });
      await assert.rejects(auth("worker-2"), { message: "NATIVE_AUTH_ACK_MISMATCH" });
    }
    await writeFile(receiptFile, bytes);
    const evidence = await x.f.put(receipt.evidenceRef.path, "Different worker text");
    const ref = await x.f.put(x.request.readback.path, { ...receipt, evidenceRef: evidence });
    const auth = nativeCommandAuthenticator({ ...x.config, bindings: [{ ...x.bindings[1], request: { ...x.request, readback: ref } }] });
    await assert.rejects(auth("worker-2"), { message: "NATIVE_AUTH_WORKER_EVIDENCE_MISMATCH" });
    await x.f.put(receipt.evidenceRef.path, x.workerText); await writeFile(receiptFile, bytes);
    assert.deepEqual(await x.authenticateDispatch("worker-2"), worker);
  });
  const result = await x.bridge.execute(x.args);
  assert.equal(result.status, "ACTION_COMPLETED", JSON.stringify(result));
  assert.equal(await readFile(path.join(x.f.root, "consumer-output.json"), "utf8"), "actual-native-authorized");
  // Actual output is NOT an ack delta, even though this controlled command wrote it.
  await assert.rejects(x.authenticateDispatch("worker-2"), { message: "NATIVE_AUTH_SOURCE_DELTA_INVALID" });
});
