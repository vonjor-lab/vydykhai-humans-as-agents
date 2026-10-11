import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { stageComparisonPreflight, materializeComparisonScenario, runSyntheticComparisonTransport,
  invokeComparisonAdapter, verifyComparisonPreflight, openNativeBaselineExecution } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, readTurnSources, publishTurnSources, dispatchRole } from "../scripts/qualify-framework-comparison-native.mjs";
import { nativeCommandAuthenticator } from "../scripts/qualify-framework-comparison-auth.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const options = { skip: process.platform !== "darwin", timeout: 30000 };
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const nativeOptions = { skip: process.platform !== "darwin" || !binary, timeout: 60000 };
const hash = value => sha256(canonicalJson(value));
async function setup(t) {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-application-")));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const staged = await stageComparisonPreflight({ sourceRoot, output: path.join(parent, "comparison") });
  const base = { output: staged.output, expectedDigest: staged.digest };
  const scenario = await materializeComparisonScenario(base);
  const call = { ...base, scenarioDigest: scenario.scenarioDigest, arm: "baseline" };
  const preparation = await runSyntheticComparisonTransport({ ...call, prepareOnly: true });
  assert.equal(preparation.status, "SYNTHETIC_PREPARATION_ONLY");
  const workspace = path.join(staged.output, "workspaces/baseline");
  const controlRoot = path.join(parent, "private"); await mkdir(controlRoot, { mode: 0o700 });
  const helper = path.join(workspace, ".comparison-command.mjs");
  const bytes = await readFile(path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs"));
  await writeFile(helper, bytes, { mode: 0o400, flag: "wx" });
  const nativeExecution = { helper, helperSha256: sha256(bytes), controlRoot,
    recipeSha256: sha256(await readFile(path.join(workspace, "recipe.json"))) };
  return { call, workspace, nativeExecution };
}

test("archived baseline runs caller-pinned recipe under the same OS and Node sandbox", options, async t => {
  const x = await setup(t);
  const recipe = JSON.parse(await readFile(path.join(x.workspace, "recipe.json")));
  recipe.rationale = "Caller-owned bytes, not an injected oracle recipe.";
  const bytes = JSON.stringify(recipe) + "\n";
  await writeFile(path.join(x.workspace, "recipe.json"), bytes);
  x.nativeExecution.recipeSha256 = sha256(bytes);
  const actual = await invokeComparisonAdapter({ ...x.call, nativeExecution: x.nativeExecution,
    operation: "context", file: "prepared/resume.json" });
  assert.equal(actual.result.status, "ACTION_COMPLETED");
  assert.equal(actual.actionExecution, "PINNED_CALLER_COMMAND_SHARED_SANDBOX");
  assert.equal(actual.semanticEvidence, false);
  assert.equal(actual.commands.length, 1);
  assert.equal(actual.commands[0].recipeSha256, sha256(bytes));
  assert.ok(actual.commands[0].actualArgs.includes("--permission"));
  assert.ok(actual.commands[0].actualArgs[0] === "-p");
  assert.ok(actual.loaded.every(name => !name.startsWith("scripts/control-") && name !== "scripts/controlled-context-run.mjs"));
  const verified = await invokeComparisonAdapter({ ...x.call, nativeExecution: x.nativeExecution,
    operation: "context", file: "prepared/accept.json" });
  assert.equal(verified.result.status, "VERIFIED");
  const replay = await invokeComparisonAdapter({ ...x.call, nativeExecution: x.nativeExecution,
    operation: "context", file: "prepared/resume.json" });
  assert.equal(replay.result.status, "BLOCKED");
});

test("native path never repairs a wrong caller recipe with the synthetic oracle", options, async t => {
  const x = await setup(t);
  const bytes = '{"entrypoint":"wrong","revision":"bundle-r2","preprocess":"none","format":"json"}\n';
  await writeFile(path.join(x.workspace, "recipe.json"), bytes);
  x.nativeExecution.recipeSha256 = sha256(bytes);
  const actual = await invokeComparisonAdapter({ ...x.call, nativeExecution: x.nativeExecution,
    operation: "context", file: "prepared/resume.json" });
  assert.equal(actual.result.status, "BLOCKED");
  assert.equal(await readFile(path.join(x.workspace, "recipe.json"), "utf8"), bytes);
  await assert.rejects(readFile(path.join(x.workspace, "consumer-output.json")), { code: "ENOENT" });
});

test("candidate bypass, stale helper and wrong recipe hash refuse before command entry", options, async t => {
  const x = await setup(t), invoke = patch => invokeComparisonAdapter({ ...x.call, nativeExecution: x.nativeExecution,
    operation: "context", file: "prepared/resume.json", ...patch });
  await assert.rejects(invoke({ arm: "candidate" }), /COMPARISON_NATIVE_BASELINE_ONLY/);
  await assert.rejects(invoke({ nativeExecution: { ...x.nativeExecution, recipeSha256: "0".repeat(64) } }), /COMPARISON_NATIVE_RECIPE_MISMATCH/);
  await assert.rejects(invoke({ nativeExecution: { ...x.nativeExecution, helperSha256: "0".repeat(64) } }), /COMPARISON_NATIVE_HELPER_MISMATCH/);
  await assert.rejects(readFile(path.join(x.workspace, "consumer-output.json")), { code: "ENOENT" });
});

test("P2 accept-first cannot certify a seeded output without an observed consumer action", options, async t => {
  const x = await setup(t), freeze = await verifyComparisonPreflight(x.call.output, x.call.expectedDigest);
  const scenario = JSON.parse(await readFile(path.join(x.call.output, "scenario.json")));
  await writeFile(path.join(x.workspace, "consumer-output.json"), JSON.stringify(scenario.oracle.retainedOutput));
  const file = "prepared/accept.json", request = JSON.parse(await readFile(path.join(x.workspace, file)));
  const fixed = { workspace: x.workspace, files: {}, recipeSha256: x.nativeExecution.recipeSha256 };
  for (const name of ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"])
    fixed.files[name] = sha256(await readFile(path.join(x.workspace, name)));
  const bindingSha256 = hash("scripted fixture binding, not native authority");
  // Synthetic callback isolates the executor's chronology check, not provenance.
  const driver = await openNativeBaselineExecution({ ...x.call, nativeExecution: x.nativeExecution,
    directory: path.join(x.nativeExecution.controlRoot, "executions"),
    requests: [{ id: "accept", file, request, bindingSha256, dependencies: [] }],
    authenticateDispatch: async id => ({ id, arm: "baseline", role: "worker", state: "COMPLETED",
      decision: "AUTHORIZE_SUPERVISOR_ACTION", runtimeDigest: freeze.baseline.digest,
      sourceRoot: x.workspace, transportSha256: hash({ fixed, helperSha256: x.nativeExecution.helperSha256 }),
      request, requestSha256: hash(request), bindingSha256, dependenciesSha256: hash([]),
      traceSha256: hash("synthetic"), allocationSha256: hash("synthetic"), sourceRegistrySha256: hash("synthetic"),
      sourceSnapshotDigest: hash("synthetic"), expiresAt: 9007199254740000 }) });
  await assert.rejects(driver.execute({ requestId: "accept", dispatchId: "synthetic-worker" }),
    { message: "BASELINE_EXECUTION_ACTION_NOT_OBSERVED" });
  await assert.rejects(driver.readExecution("accept"), { message: "BASELINE_EXECUTION_NOT_OBSERVED" });
  await assert.rejects(readFile(path.join(x.workspace, "verifications.log")), { code: "ENOENT" });
});

test("actual baseline worker authorizes archived execution; only observed verification reaches owning readback", nativeOptions, async t => {
  // Preparation remains a disclosed scripted fixture. Actual role acquisition,
  // authorization, archived execution and immutable readback are under test.
  const x = await setup(t), controlRoot = x.nativeExecution.controlRoot;
  const native = await stageNativeComparison({ comparisonOutput: x.call.output, expectedDigest: x.call.expectedDigest,
    scenarioDigest: x.call.scenarioDigest, candidateSourceRoot: path.resolve(sourceRoot),
    output: path.join(controlRoot, "native"), maxCalls: 2, timeoutMs: 15000 });
  const freeze = await verifyComparisonPreflight(x.call.output, x.call.expectedDigest);
  const requests = [], fixed = { workspace: x.workspace, files: {}, recipeSha256: x.nativeExecution.recipeSha256 };
  for (const name of ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"])
    fixed.files[name] = sha256(await readFile(path.join(x.workspace, name)));
  for (const operation of ["resume", "accept"]) {
    const file = `prepared/${operation}.json`, request = JSON.parse(await readFile(path.join(x.workspace, file)));
    requests.push({ id: operation, file, request, dependencies: [], bindingSha256: hash({ operation, task: request.task }) });
  }
  const request = requests[0].request, receipt = JSON.parse(await readFile(path.join(x.workspace, request.readback.path)));
  const readback = await readFile(path.join(x.workspace, receipt.evidenceRef.path), "utf8");
  const sourceFile = path.join(controlRoot, "sources.json");
  await writeFile(sourceFile, JSON.stringify({ schema: "control.review-sources.v1", workspace: x.workspace, sources: [
    { id: "task", path: request.task.path, purpose: "Actual delivered task" },
    { id: "capsule", path: request.capsule.path, purpose: "Actual delivered capsule" },
    { id: "ack", path: request.readback.path, purpose: "Real machine receipt, scripted initial readback" },
    { id: "worker", path: receipt.evidenceRef.path, purpose: "Readback evidence" },
    { id: "output", path: "consumer-output.json", purpose: "Actual consumer output" }
  ] }), { mode: 0o600 });
  const args = { ...native, arm: "baseline" };
  const initial = await readTurnSources(args), artifacts = [];
  for (const [id, ref] of [["baseline-task", request.task], ["baseline-capsule", request.capsule]]) {
    const text = await readFile(path.join(x.workspace, ref.path), "utf8");
    artifacts.push({ id, text, purpose: "Actual protocol artifact, not model preparation evidence",
      origin: { kind: "parent-protocol-result", arm: "baseline", operation: "prepared", sha256: sha256(text) } });
  }
  let publication = await publishTurnSources({ ...args, expectedSourceRevision: initial.sourceRevision, artifacts });
  await mkdir(path.join(controlRoot, "auth"), { mode: 0o700 });
  const fake = await nativeProvider(t, async n => n % 2 ? codeItem(
    `const tool=ALL_TOOLS.find(x=>x.name.includes('vydykhai_review')&&x.name.includes('read_source'));for(const id of ${JSON.stringify(["baseline-task", "baseline-capsule"])})text(await tools[tool.name]({id}));`, `read-${n}`)
    : answerItem({ commands: [{ requestId: n === 2 ? "resume" : "accept", decision: "AUTHORIZE_SUPERVISOR_ACTION", readback }] }));
  const resolvers = new Map();
  const driver = await openNativeBaselineExecution({ ...x.call, nativeExecution: x.nativeExecution,
    directory: path.join(controlRoot, "executions"), requests,
    authenticateDispatch: id => {
      assert.ok(resolvers.has(id)); return resolvers.get(id)(id);
    } });
  await assert.rejects(driver.readExecution("accept"), { message: "BASELINE_EXECUTION_NOT_OBSERVED" });
  for (const [index, entry] of requests.entries()) {
    const registry = await openReviewSources(sourceFile), state = await registry.snapshot();
    const context = { runtimeDigest: freeze.baseline.digest, sourceRoot: x.workspace,
      sourceRegistrySha256: sha256(await readFile(sourceFile)), sourceSnapshotDigest: state.digest,
      transportSha256: hash({ fixed, helperSha256: x.nativeExecution.helperSha256 }) };
    const intent = { task: { id: "baseline-task", sha256: request.task.sha256 }, context,
      commands: [{ requestId: entry.id, requestSha256: hash({ ...entry.request, readback: null }),
        bindingSha256: entry.bindingSha256, dependenciesSha256: hash([]) }] };
    await dispatchRole({ ...args, role: "worker", binary, authHome: path.join(controlRoot, "auth"), provider: fake.provider,
      sourceRevision: publication.sourceRevision, intent, prompt: "Read actual task and capsule; explicitly authorize the allocated archived command. Scripted transport test." });
    const id = `worker-${index + 1}`;
    resolvers.set(id, nativeCommandAuthenticator({ ...args, workspace: x.workspace, sourceFile,
      runtimeDigest: freeze.baseline.digest, fixed, helperSha256: x.nativeExecution.helperSha256,
      bindings: [{ id, number: index + 1, requestId: entry.id, request: entry.request, dependencies: [],
        delivery: { id: "baseline-capsule", sha256: request.capsule.sha256 } }] }));
    const observed = await driver.execute({ requestId: entry.id, dispatchId: id });
    assert.equal(observed.observation.result.status, index ? "VERIFIED" : "ACTION_COMPLETED");
    assert.equal(observed.consumerCheck.status, "PASS");
    assert.equal(observed.authorization.arm, "baseline");
    assert.ok(observed.observation.loaded.every(name => !name.startsWith("scripts/control-")));
    assert.deepEqual(await driver.readExecution(entry.id), observed);
    await assert.rejects(driver.execute({ requestId: entry.id, dispatchId: id }), { message: "BASELINE_EXECUTION_ALREADY_ATTEMPTED" });
    if (!index) await assert.rejects(resolvers.get(id)(id), { message: "NATIVE_AUTH_CONTEXT_CHANGED" });
  }
  const verified = await driver.readExecution("accept");
  assert.ok(verified.observation.result.returnSync);
  const file = path.join(controlRoot, "executions/accept/result.json");
  await writeFile(file, JSON.stringify({ ...verified, consumerCheck: { status: "FORGED" } }));
  await assert.rejects(driver.readExecution("accept"), { message: "BASELINE_EXECUTION_RECORD_CHANGED" });
});
