import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, readFile, writeFile, rm, chmod, symlink, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture, hash } from "./context-fixture.mjs";
import { sha256 } from "../scripts/memory-brief.mjs";
import { inspectControlRuntime, stageControlRuntime } from "../scripts/control-runtime.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { comparisonSandboxLaunch, openComparisonControl } from "../scripts/qualify-framework-comparison-control.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";
import { controlCheckIds } from "../scripts/control-catalog.mjs";

const source = fileURLToPath(new URL("..", import.meta.url));
const helperSource = path.join(source, "scripts/qualify-framework-comparison-command.mjs");
const darwin = { skip: process.platform !== "darwin", timeout: 30000 };
const actionBody = "import {writeFileSync} from 'node:fs'; writeFileSync('consumer-output.json',JSON.stringify({actual:true}),{flag:'wx'});\n";

// Actual v3 protocol with explicitly synthetic semantic inputs, never model proof.
async function ackFixture(t, corrected = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-ack-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(source, "examples/context-preparation"), root, { recursive: true });
  const json = async name => JSON.parse(await readFile(path.join(root, name), "utf8"));
  const put = async (name, value) => {
    const bytes = typeof value === "string" ? value : JSON.stringify(value) + "\n";
    await writeFile(path.join(root, name), bytes);
    return { path: name, sha256: sha256(bytes) };
  };
  // The positive lifecycle starts from an already correct fixture implementation.
  // This edit is fixture setup, never attributed to a model or the tested worker.
  if (corrected) await put("candidate.mjs", (await readFile(path.join(root, "candidate.mjs"), "utf8"))
    .replace("const key = entry.id;", "const key = entry.id.toLowerCase();"));
  const pkg = await json("package-modular.json"); pkg.schema = "context.package.v3";
  const statements = { goal: "Deliver reusable bundles to independent consumers, retaining accepted behavior.",
    invariant: "Public boundaries preserve ownership, permissions and versioned output.",
    gap: "Independent example N1 rejects the current case-sensitive duplicate comparison.",
    acceptance: "Verify retained B1/B2 and independent N1 through the public consumer entry." };
  await put("architecture.md", Object.values(statements).join("\n") + "\n");
  for (const [id, quote] of Object.entries(statements)) pkg.navigation.references.push({ id, quote,
    path: "architecture.md", purpose: id, appliesTo: "task" });
  pkg.alignment = { goalRef: "goal", invariantRefs: ["invariant"], acceptanceRef: "acceptance",
    decisions: [{ moduleId: "buildBundle", boundaryChange: false, gapRef: "gap", existingRef: "public-contract",
      rationale: "Protocol fixture only: preserve the accepted boundary." }], review: null };
  await put("package.json", pkg); await put("action.mjs", actionBody);
  const prepare = (mode, expected, ...args) => {
    const result = spawnSync(process.execPath, [path.join(source, "scripts/vydykhai.mjs"), "context-prepare", mode,
      "--output", "prepared", ...args], { cwd: root, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).status, expected, result.stdout);
  };
  prepare("plan", "PLAN_READY", "--input", "package.json");
  prepare("confirm", "PREPARED", "--owner", pkg.owner, "--decision", "approved");
  prepare("read", "DELIVERED", "--worker", pkg.task.worker);
  await put("worker.txt", "Read the delivered bundle boundary; preserve retained behavior and leave CSV deferred.\n");
  prepare("ack", "ACKNOWLEDGED", "--worker", pkg.task.worker, "--evidence", "worker.txt");
  const request = await json("prepared/preflight.json"), task = await json(request.task.path);
  return { root, put, request, task, module: await json(task.module.path) };
}

async function setup(t, options = {}) {
  // These are explicitly fixture-owned inputs and dispatch records, never native provenance.
  const { v3Ack = false, lifecycle = false, ...fixtureOptions } = options;
  const f = v3Ack ? await ackFixture(t, lifecycle) : await fixture(t, { correction: true, actionBody, ...fixtureOptions });
  await f.put("recipe.json", { fixture: "actual caller bytes, not a semantic oracle" });
  const helper = path.join(f.root, ".comparison-command.mjs"), bytes = await readFile(helperSource);
  await writeFile(helper, bytes, { mode: 0o400 });
  const fixed = { workspace: f.root, files: {}, recipeSha256: sha256(await readFile(path.join(f.root, "recipe.json"))) };
  for (const name of ["candidate.mjs", "oracle.json", "verify.mjs", "action.mjs"])
    fixed.files[name] = sha256(await readFile(path.join(f.root, name)));
  if (lifecycle) {
    const body = "import {readFileSync,writeFileSync} from 'node:fs'; const value=JSON.parse(readFileSync('consumer-output.json')); if(value.actual!==true)throw Error('MISSING_PRIOR'); writeFileSync('continued.json',JSON.stringify({retained:value.actual}),{flag:'wx'});\n";
    await f.put("continuation.mjs", body); fixed.files["continuation.mjs"] = sha256(body);
  }
  if (!v3Ack) await f.prepare();
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-control-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ["packages", "host", "review"]) await mkdir(path.join(root, name), { mode: 0o700 });
  const snapshot = await inspectControlRuntime(source);
  const selected = await stageControlRuntime({ sourceRoot: source, directory: path.join(root, "packages"),
    workspace: f.root, expectedDigest: snapshot.digest });
  const runtime = { packageRoot: selected.root, expectedDigest: selected.digest };
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({ schema: "control.review-sources.v1", workspace: f.root,
    sources: [{ id: "sources", path: "sources.json", purpose: "Fixture source input" }] }), { mode: 0o600 });
  const profile = { schema: "control.service.v1", directory: path.join(root, "host"),
    config: { workspace: f.root, policy: hash("fixture-policy"), owner: "owner", executor: f.task.owner,
      reviewer: "reviewer", evidenceRegistry: sourceFile }, maxReviewsPerTick: 0, timeoutMs: 2000,
    review: { directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      maxCalls: 1, expiresAt: new Date(Date.now() + 300000).toISOString(), scope: { kind: "fixture" },
      native: { timeoutMs: 1000, binary: "/never-launch-model" } } };
  const ctx = await import(pathToFileURL(path.join(selected.root, "scripts/context-run.mjs")).href);
  const preflight = await ctx.runContextTransition({ ...f.request, operation: "preflight" });
  assert.equal(preflight.status, "READY");
  const requests = ["resume", "accept"].map(operation => ({ id: operation, request: { ...f.request, operation }, dependencies: [] }));
  const records = new Map();
  const sourceSnapshotDigest = (await (await openReviewSources(sourceFile)).snapshot()).digest;
  for (const { id, request } of requests) {
    const command = id === "resume" ? f.task.action : f.module.verificationCommand;
    const binding = { operation: id, taskId: f.task.id, taskSha256: request.task.sha256,
      capsuleSha256: request.capsule.sha256, sourceDigest: preflight.coverageBasis.sourceDigest,
      dependencyDigest: preflight.coverageBasis.dependencyDigest,
      ...(id === "accept" ? { candidateSha256: hash({ workspace: f.root,
        files: await Promise.all([...f.task.candidateFiles].sort().map(async name => ({ path: name,
          sha256: sha256(await readFile(path.join(f.root, name))) }))) }) } : {}),
      commandSha256: hash(command), cwd: f.root, executable: await realpath(process.execPath),
      kind: id === "resume" ? "dependent" : "verification" };
    const common = { arm: "candidate", runtimeDigest: runtime.expectedDigest, bindingSha256: hash(binding), dependenciesSha256: hash([]),
      sourceRoot: f.root, sourceRegistrySha256: sha256(await readFile(sourceFile)),
      sourceSnapshotDigest, transportSha256: hash({ fixed, helperSha256: sha256(bytes) }),
      expiresAt: Date.now() + 120000, traceSha256: hash("fixture-only-trace") };
    records.set(`review-${id}`, { ...common, id: `review-${id}`, role: "readiness-reviewer", state: "COMPLETED",
      requestSha256: hash({ ...request, readback: null }), decision: "APPROVE" });
    const readbackReceipt = JSON.parse(await readFile(path.resolve(f.root, request.readback.path), "utf8"));
    records.set(`worker-${id}`, { ...common, id: `worker-${id}`, role: "worker", state: "COMPLETED",
      decision: "AUTHORIZE_SUPERVISOR_ACTION", requestSha256: hash(request), request: structuredClone(request),
      readback: await readFile(path.resolve(f.root, readbackReceipt.evidenceRef.path), "utf8") });
  }
  const optionsForBridge = { runtime, profile, fixed, helper, helperSha256: sha256(bytes), requests, initialize: true,
    authenticateDispatch: async id => records.get(id) };
  const open = patch => openComparisonControl({ ...optionsForBridge, ...patch });
  const args = id => ({ requestId: id, reviewDispatchId: `review-${id}`, workerDispatchId: `worker-${id}` });
  return { f, root, records, profile, runtime, fixed, helper, optionsForBridge, open, args };
}

test("registry refuses FIFO before reading bytes instead of hanging admission", darwin, async t => {
  const x = await setup(t);
  await rm(x.profile.review.sourceFile);
  assert.equal(spawnSync("/usr/bin/mkfifo", ["-m", "600", x.profile.review.sourceFile]).status, 0);
  const url = new URL("../scripts/qualify-framework-comparison-control.mjs", import.meta.url).href;
  const probe = `import {openComparisonControl} from ${JSON.stringify(url)};
    try { await openComparisonControl({...${JSON.stringify(x.optionsForBridge)}, authenticateDispatch:async()=>null});
      process.exitCode=2;
    } catch(error) { console.log(error.message); process.exitCode=error.message==='CONTROL_CONFIG_UNSAFE'?0:3; }`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe],
    { encoding: "utf8", timeout: 2000, killSignal: "SIGKILL" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CONTROL_CONFIG_UNSAFE/);
});

test("selected host gates actual composed resume and accept, retains Return, and refuses replay", darwin, async t => {
  const x = await setup(t), bridge = await x.open();
  assert.equal(bridge.scope.status, "INCOMPLETE");
  assert.equal(bridge.scope.nativeDispatchAccounting, "SHARED_ARM_LEDGER_AND_SELECTED_REVIEW_JOURNAL");
  assert.equal(bridge.scope.nativeProvenance, "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS");
  assert.equal((await bridge.execute(x.args("resume"))).status, "ACTION_COMPLETED");
  const accepted = await bridge.execute(x.args("accept"));
  assert.equal(accepted.status, "VERIFIED", JSON.stringify(accepted));
  assert.equal(accepted.application, "SUPERVISOR_APPLICATION_OF_COMPLETED_WORKER_REQUEST");
  assert.equal(accepted.nativeProvenance, "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS");
  assert.equal(accepted.wholeChainComparatorReady, false);
  assert.equal(accepted.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.match(accepted.returnSync, /vydykhai:return-sync/);
  const state = await bridge.snapshot();
  assert.deepEqual(Object.values(state.reservations).map(r => r.status), ["COMPLETED", "COMPLETED"]);
  assert.equal(Object.values(state.grants).filter(g => g.binding.kind === "verification").length, 1);
  assert.deepEqual(state.acceptances, {});
  const reopened = await x.open({ initialize: false });
  assert.equal((await reopened.execute(x.args("resume"))).status, "BLOCKED");
  assert.equal(await readFile(path.join(x.f.root, "consumer-output.json"), "utf8"), '{"actual":true}');
  assert.equal(await readFile(path.join(x.f.root, "verifications.log"), "utf8"), "B1,B2,N1\n");
});

test("reopening never initializes missing review history or clears existing host state", darwin, async t => {
  const x = await setup(t), bridge = await x.open();
  assert.equal((await bridge.execute(x.args("resume"))).status, "ACTION_COMPLETED");
  const before = await bridge.snapshot();
  const journal = path.join(x.profile.review.directory, "0000000000.json");
  await rm(journal);
  await assert.rejects(x.open({ initialize: false }), /MODEL_REVIEW_CONFIG_MISMATCH/);
  assert.deepEqual(await bridge.snapshot(), before);
  await assert.rejects(readFile(journal), { code: "ENOENT" });
});

test("private dispatch callback refuses unknown, incomplete, wrong role and stale provenance before grants", darwin, async t => {
  const x = await setup(t), bridge = await x.open(), key = "review-resume", saved = structuredClone(x.records.get(key));
  const mutations = [null, { state: "UNKNOWN" }, { state: "IN_FLIGHT" }, { role: "owner" }, { arm: "baseline" },
    { requestSha256: "0".repeat(64) }, { bindingSha256: "0".repeat(64) }, { sourceSnapshotDigest: "0".repeat(64) },
    { runtimeDigest: "0".repeat(64) }, { transportSha256: "0".repeat(64) },
    { sourceRoot: x.root }, { sourceRegistrySha256: "0".repeat(64) },
    { expiresAt: 1 }, { decision: "REPAIR" }, { traceSha256: null }];
  for (const patch of mutations) {
    x.records.set(key, patch === null ? null : { ...saved, ...patch });
    const r = await bridge.execute(x.args("resume"));
    assert.equal(r.code, "CONTROL_ADMISSION_FAILED", JSON.stringify(patch));
    assert.equal(r.stats.commands, 0);
    assert.deepEqual((await bridge.snapshot()).grants, {});
    assert.deepEqual((await bridge.snapshot()).reservations, {});
  }
  x.records.set(key, saved);
  x.records.set("worker-resume", { ...x.records.get("worker-resume"), readback: { path: "invented", sha256: "0".repeat(64) } });
  assert.equal((await bridge.execute(x.args("resume"))).stats.commands, 0);
  await assert.rejects(bridge.execute({ ...x.args("resume"), actor: "reviewer" }), /EXECUTION_ARGUMENTS_INVALID/);
  await assert.rejects(readFile(path.join(x.f.root, "consumer-output.json")), { code: "ENOENT" });
});

test("provenance revoked between authorize and reserve cannot execute", darwin, async t => {
  const x = await setup(t); let reads = 0;
  const bridge = await x.open({ authenticateDispatch: async id => {
    reads++;
    return reads >= 3 ? { ...x.records.get(id), state: "UNKNOWN" } : x.records.get(id);
  } });
  const r = await bridge.execute(x.args("resume"));
  assert.equal(r.code, "CONTROL_ADMISSION_FAILED"); assert.equal(r.stats.commands, 0);
  assert.equal(Object.keys((await bridge.snapshot()).grants).length, 1);
  assert.deepEqual((await bridge.snapshot()).reservations, {});
});

test("late authenticated callback after admission timeout cannot issue a grant or an effect", darwin, async t => {
  const x = await setup(t); let release, completed;
  const done = new Promise(resolve => { completed = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const bridge = await x.open({ authenticateDispatch: async id => {
    await wait;
    if (id.startsWith("worker")) completed();
    return x.records.get(id);
  } });
  const r = await bridge.execute(x.args("resume"));
  assert.equal(r.code, "CONTROL_ADMISSION_FAILED"); assert.equal(r.stats.commands, 0);
  release(); await done;
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual((await bridge.snapshot()).grants, {});
  assert.deepEqual((await bridge.snapshot()).reservations, {});
  await assert.rejects(readFile(path.join(x.f.root, "consumer-output.json")), { code: "ENOENT" });
});

test("current source drift and runtime drift are not excused by private provenance", darwin, async t => {
  const x = await setup(t), bridge = await x.open();
  await x.f.put("sources.json", "changed sources");
  assert.equal((await bridge.execute(x.args("resume"))).status, "BLOCKED");
  assert.deepEqual((await bridge.snapshot()).grants, {});
  const file = path.join(x.runtime.packageRoot, "scripts/controlled-context-run.mjs");
  await chmod(file, 0o600); await writeFile(file, "throw Error('must not load');\n");
  await assert.rejects(bridge.execute(x.args("resume")), /CONTROL_RUNTIME_FILE_MISMATCH/);
});

test("post-dispatch failure retains IN_FLIGHT and the real effect, with no replay", darwin, async t => {
  const x = await setup(t, { actionBody: actionBody + "throw Error('lost after effect');\n" }), bridge = await x.open();
  const r = await bridge.execute(x.args("resume"));
  assert.equal(r.status, "BLOCKED");
  assert.equal(Object.values((await bridge.snapshot()).reservations)[0].status, "IN_FLIGHT");
  const before = await readFile(path.join(x.f.root, "consumer-output.json"), "utf8");
  assert.equal((await bridge.execute(x.args("resume"))).stats.commands, 0);
  assert.equal(await readFile(path.join(x.f.root, "consumer-output.json"), "utf8"), before);
});

test("shared OS plus fixed Node launch denies protected reads, extra writes, processes and arbitrary wrappers", darwin, async t => {
  const x = await setup(t);
  const secret = path.join(x.root, "secret.txt"); await writeFile(secret, "private");
  const body = `import {readFileSync,writeFileSync} from 'node:fs';
    const denied=[];
    for(const [name,permission,fn] of [['read','FileSystemRead',()=>readFileSync(${JSON.stringify(secret)})],['write','FileSystemWrite',()=>writeFileSync('extra.txt','bad')]]) {
      try{fn();throw Error('ESCAPED');}catch(e){
        if(e.code!=='ERR_ACCESS_DENIED'||e.permission!==permission)throw e;
        denied.push({name,code:e.code,permission:e.permission});
      }
    }
    try{await import('node:child_process');throw Error('ESCAPED');}catch(e){
      if(e.message!=='COMPARISON_COMMAND_BUILTIN_REFUSED')throw e;
      denied.push({name:'process',message:e.message});
    }
    writeFileSync('consumer-output.json',JSON.stringify(denied),{flag:'wx'});\n`;
  await x.f.put("action.mjs", body); x.fixed.files["action.mjs"] = sha256(body);
  const launch = await comparisonSandboxLaunch({ ...x.optionsForBridge, fixed: x.fixed, controlRoot: x.root });
  for (const executable of ["/bin/sh", "/usr/bin/sandbox-exec"])
    assert.throws(() => launch({ executable, args: ["action.mjs"], cwd: x.f.root }), /COMMAND_NOT_DECLARED/);
  const spec = launch({ executable: process.execPath, args: ["action.mjs"], cwd: x.f.root });
  assert.equal(spec.executable, "/usr/bin/sandbox-exec");
  assert.ok(spec.args.includes("--permission"));
  const result = spawnSync(spec.executable, spec.args, { cwd: x.f.root, env: { PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(path.join(x.f.root, "consumer-output.json"))), [
    { name: "read", code: "ERR_ACCESS_DENIED", permission: "FileSystemRead" },
    { name: "write", code: "ERR_ACCESS_DENIED", permission: "FileSystemWrite" },
    { name: "process", message: "COMPARISON_COMMAND_BUILTIN_REFUSED" }
  ]);
  await assert.rejects(readFile(path.join(x.f.root, "extra.txt")), { code: "ENOENT" });
  assert.equal(await readFile(secret, "utf8"), "private");
});

test("helper must be pinned, canonical and excluded from the model source registry", darwin, async t => {
  const x = await setup(t);
  await assert.rejects(x.open({ helperSha256: "0".repeat(64) }), /COMPARISON_HELPER_UNSAFE/);
  const file = x.profile.review.sourceFile, config = JSON.parse(await readFile(file));
  config.sources.push({ id: "helper", path: path.basename(x.helper), purpose: "must not expose" });
  await writeFile(file, JSON.stringify(config));
  await assert.rejects(x.open(), /COMPARISON_PRIVATE_SOURCE_EXPOSED/);
  config.sources.pop(); await writeFile(file, JSON.stringify(config));
  const link = path.join(x.f.root, "linked.mjs"); await symlink(x.helper, link);
  await assert.rejects(x.open({ helper: link }), /COMPARISON_HELPER_UNSAFE/);
});

test("alternate registry root cannot expose the pinned helper", darwin, async t => {
  const x = await setup(t), alternate = path.join(x.f.root, "nested");
  await mkdir(alternate);
  const helper = path.join(alternate, path.basename(x.helper));
  await writeFile(helper, await readFile(x.helper), { mode: 0o400 });
  await writeFile(x.profile.review.sourceFile, JSON.stringify({ schema: "control.review-sources.v1", workspace: alternate,
    sources: [{ id: "hidden-helper", path: path.basename(helper), purpose: "Alternate-root regression" }] }));
  const sources = await openReviewSources(x.profile.review.sourceFile);
  assert.equal((await sources.read({ id: "hidden-helper" })).sha256, x.optionsForBridge.helperSha256);
  await assert.rejects(x.open({ helper }), { message: "COMPARISON_PRIVATE_SOURCE_EXPOSED" });
});

test("registry bytes and actual root stay bound even with identical entries and source bytes", darwin, async t => {
  const x = await setup(t), bridge = await x.open(), file = x.profile.review.sourceFile;
  const original = await readFile(file), config = JSON.parse(original);
  await writeFile(file, Buffer.concat([original, Buffer.from("\n")]));
  await assert.rejects(bridge.execute(x.args("resume")), { message: "COMPARISON_REGISTRY_CHANGED" });
  const alternate = path.join(x.f.root, "public-copy"); await mkdir(alternate);
  await writeFile(path.join(alternate, "sources.json"), await readFile(path.join(x.f.root, "sources.json")));
  await writeFile(file, JSON.stringify({ ...config, workspace: alternate }));
  assert.equal((await (await openReviewSources(file)).snapshot()).digest, x.records.get("review-resume").sourceSnapshotDigest);
  await assert.rejects(bridge.execute(x.args("resume")), { message: "COMPARISON_REGISTRY_CHANGED" });
  assert.deepEqual((await bridge.snapshot()).grants, {});
  assert.deepEqual((await bridge.snapshot()).reservations, {});
  await assert.rejects(readFile(path.join(x.f.root, "consumer-output.json")), { code: "ENOENT" });
});

test("registry mutation during callback cannot issue a grant", darwin, async t => {
  const x = await setup(t), file = x.profile.review.sourceFile, original = await readFile(file);
  const bridge = await x.open({ authenticateDispatch: async id => {
    if (id === "worker-resume") await writeFile(file, Buffer.concat([original, Buffer.from("\n")]));
    return x.records.get(id);
  } });
  const result = await bridge.execute(x.args("resume"));
  assert.equal(result.code, "CONTROL_ADMISSION_FAILED"); assert.equal(result.stats.commands, 0);
  assert.deepEqual((await bridge.snapshot()).grants, {});
  assert.deepEqual((await bridge.snapshot()).reservations, {});
});

test("only completed worker exact request and authored readback authorize supervisor application", darwin, async t => {
  const x = await setup(t), bridge = await x.open(), key = "worker-resume", saved = structuredClone(x.records.get(key));
  const mutations = [{ state: "ACTIVE" }, { state: "UNKNOWN" }, { role: "owner" }, { decision: "APPROVE" },
    { request: null }, { request: { ...saved.request, operation: "accept" } },
    { readback: saved.request.readback }, { readback: saved.readback + "\n" },
    { readback: await readFile(path.resolve(x.f.root, saved.request.readback.path), "utf8") }];
  for (const patch of mutations) {
    x.records.set(key, { ...saved, ...patch });
    const result = await bridge.execute(x.args("resume"));
    assert.equal(result.code, "CONTROL_ADMISSION_FAILED", JSON.stringify(patch));
    assert.equal(result.stats.commands, 0);
    assert.deepEqual((await bridge.snapshot()).grants, {});
    assert.deepEqual((await bridge.snapshot()).reservations, {});
  }
  x.records.set(key, saved);
  const result = await bridge.execute(x.args("resume"));
  assert.equal(result.status, "ACTION_COMPLETED", JSON.stringify(result));
  assert.equal(result.application, "SUPERVISOR_APPLICATION_OF_COMPLETED_WORKER_REQUEST");
  assert.equal(result.nativeProvenance, "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS");
  assert.equal(bridge.scope.semanticEvidence, false);
  assert.equal(result.wholeChainComparatorReady, false);
});

test("actual v3 ack machine receipt binds separate worker-authored evidence for supervisor admission", darwin, async t => {
  const x = await setup(t, { v3Ack: true }), bridge = await x.open(), worker = x.records.get("worker-resume");
  const receiptBytes = await readFile(path.resolve(x.f.root, worker.request.readback.path));
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.schema, "context.readback.v1");
  assert.equal(sha256(receiptBytes), worker.request.readback.sha256);
  assert.equal(receipt.worker, x.f.task.owner);
  assert.equal(receipt.taskSha256, worker.request.task.sha256);
  assert.equal(receipt.capsuleSha256, worker.request.capsule.sha256);
  assert.equal(sha256(worker.readback), receipt.evidenceRef.sha256);
  assert.notEqual(sha256(worker.readback), worker.request.readback.sha256);
  assert.equal(worker.readback, await readFile(path.join(x.f.root, "worker.txt"), "utf8"));
  x.records.set("worker-resume", { ...worker, readback: receiptBytes.toString("utf8") });
  const rejected = await bridge.execute(x.args("resume"));
  assert.equal(rejected.code, "CONTROL_ADMISSION_FAILED"); assert.equal(rejected.stats.commands, 0);
  assert.deepEqual((await bridge.snapshot()).grants, {});
  x.records.set("worker-resume", worker);
  const result = await bridge.execute(x.args("resume"));
  assert.equal(result.status, "ACTION_COMPLETED", JSON.stringify(result));
  assert.equal(result.nativeProvenance, "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS");
});

test("receipt and evidence are repinned after callback, before any supervisor grant", darwin, async t => {
  const x = await setup(t), worker = x.records.get("worker-resume");
  const receiptFile = path.resolve(x.f.root, worker.request.readback.path), receiptBytes = await readFile(receiptFile);
  const receipt = JSON.parse(receiptBytes), evidenceFile = path.resolve(x.f.root, receipt.evidenceRef.path);
  const evidenceBytes = await readFile(evidenceFile);
  let mutate;
  const bridge = await x.open({ authenticateDispatch: async id => {
    if (id === "worker-resume") await mutate();
    return x.records.get(id);
  } });
  for (const [file, original] of [[receiptFile, receiptBytes], [evidenceFile, evidenceBytes]]) {
    mutate = () => writeFile(file, Buffer.concat([original, Buffer.from("\n")]));
    const result = await bridge.execute(x.args("resume"));
    assert.equal(result.code, "CONTROL_ADMISSION_FAILED"); assert.equal(result.stats.commands, 0);
    assert.deepEqual((await bridge.snapshot()).grants, {});
    assert.deepEqual((await bridge.snapshot()).reservations, {});
    await writeFile(file, original);
  }
  await assert.rejects(readFile(path.join(x.f.root, "consumer-output.json")), { code: "ENOENT" });
});

async function lifecycleFixture(t, { native = null, reserve = null, settle = null } = {}) {
  const x = await setup(t, { lifecycle: true, v3Ack: true });
  for (const name of ["room", "home", "arm-ledger"]) await mkdir(path.join(x.root, name), { mode: 0o700 });
  const profile = structuredClone(x.profile);
  profile.maxReviewsPerTick = 1;
  profile.review.native = { binary: "/never-launch-model", workspace: path.join(x.root, "room"),
    home: path.join(x.root, "home"), model: "gpt-6.1-sol", effort: "low", timeoutMs: 1000, ...native };
  profile.timeoutMs = profile.review.native.timeoutMs + 1000;
  profile.review.scope.requiredSourceIds = ["sources"];
  const allocations = [], settlements = [];
  // A tiny private fixture ledger stands in for the driver's SAME per-arm ledger.
  // It records spend before returning; no refund path and no model in callbacks.
  const sharedBudget = { id: hash("fixture-arm-budget"), maxCalls: 1,
    async reserve(expected, options) {
      if (reserve) return reserve(expected, options, allocations);
      assert.equal(allocations.length, 0, "fixture arm budget exhausted");
      const allocation = { ...expected, allocationId: "review-slot", number: 1, status: "RESERVED", expiresAt: Date.now() + 60000 };
      await writeFile(path.join(x.root, "arm-ledger", "allocation-1.json"), JSON.stringify(allocation), { flag: "wx", mode: 0o600 });
      allocations.push(allocation); return allocation;
    },
    async settle(record) {
      settlements.push(record);
      if (settle) return settle(record);
      await writeFile(path.join(x.root, "arm-ledger", "observation-1.json"), JSON.stringify(record), { flag: "wx", mode: 0o600 });
      return { allocationId: record.allocation.allocationId, status: "RECORDED" };
    } };
  const hooks = {};
  const bridge = await x.open({ profile, sharedBudget, authenticateDispatch: async key => {
    const record = structuredClone(x.records.get(key));
    if (hooks.authenticate) await hooks.authenticate(key);
    return record;
  } });
  const ownerRecord = async (key, purpose, payload) => {
    const common = x.records.get("review-resume");
    const sourceSnapshotDigest = (await (await openReviewSources(profile.review.sourceFile)).snapshot()).digest;
    x.records.set(key, { arm: "candidate", runtimeDigest: x.runtime.expectedDigest,
      sourceRoot: common.sourceRoot, sourceRegistrySha256: common.sourceRegistrySha256,
      sourceSnapshotDigest, transportSha256: common.transportSha256, traceSha256: hash("fixture-owner-trace"),
      expiresAt: Date.now() + 60000, id: key, role: "owner", state: "COMPLETED", purpose,
      payloadSha256: hash(payload), payload: structuredClone(payload) });
  };
  const accept = async () => {
    assert.equal((await bridge.execute(x.args("resume"))).status, "ACTION_COMPLETED");
    const verified = await bridge.execute(x.args("accept")); assert.equal(verified.status, "VERIFIED", JSON.stringify(verified));
    const retention = [], authored = [];
    for (const kind of ["memory", "map", "tracker", "custody"]) {
      const bytes = `Fixture-owned ${kind}: actual retained bytes, not semantic proof.\n`;
      retention.push({ id: kind, required: true, expected: await x.f.put(`retained-${kind}.md`, bytes) });
      authored.push({ id: kind, bytes });
    }
    const acceptance = { schema: "work.product-acceptance.v1", id: "consumer", project: "protocol-fixture", task: x.f.task.id,
      owner: profile.config.owner, executor: x.f.task.owner, status: "ACCEPTED", acceptedAt: new Date().toISOString(),
      producerReturn: await x.f.put("producer-return.md", verified.returnSync),
      technicalProof: await x.f.put("technical-proof.json", verified.receipt),
      artifact: { path: "consumer-output.json", sha256: sha256(await readFile(path.join(x.f.root, "consumer-output.json"))) },
      goal: await x.f.put("goal.md", "Fixture lifecycle only; no effectiveness or semantic acceptance claim."), retention };
    await ownerRecord("accept-owner", "OWNING_ACCEPTANCE", { acceptance, verificationRequestId: "accept",
      verificationSha256: hash(verified), originalReturn: verified.returnSync, retention: authored });
    return { dispatchId: "accept-owner", verificationRequestId: "accept", acceptance };
  };
  return { ...x, bridge, profile, sharedBudget, allocations, settlements, ownerRecord, accept, hooks };
}

test("owning acceptance requires actual verification, original Return and authenticated retained bytes", darwin, async t => {
  const x = await lifecycleFixture(t);
  await assert.rejects(x.bridge.acceptOwned({ dispatchId: "unknown", verificationRequestId: "accept", acceptance: {} }),
    /COMPARISON_VERIFICATION_REQUIRED/);
  const args = await x.accept(), saved = structuredClone(x.records.get("accept-owner"));
  for (const mutation of [{ role: "worker" }, { state: "UNKNOWN" }, { expiresAt: 1 },
    { sourceSnapshotDigest: "0".repeat(64) }, { payload: { ...saved.payload, originalReturn: "owner rewritten Return" } }]) {
    x.records.set("accept-owner", { ...saved, ...mutation });
    await assert.rejects(x.bridge.acceptOwned(args), /COMPARISON_DISPATCH_UNVERIFIED/);
    assert.deepEqual((await x.bridge.snapshot()).acceptances, {});
  }
  x.records.set("accept-owner", saved);
  await assert.rejects(x.bridge.acceptOwned({ ...args, acceptance: { ...args.acceptance,
    producerReturn: await x.f.put("rewritten-return.md", "An owner restatement is not the producer Return.") } }),
  /COMPARISON_ORIGINAL_PROOF_REQUIRED/);
  const retained = args.acceptance.retention[0].expected;
  await x.f.put(retained.path, "retention lost");
  await assert.rejects(x.bridge.acceptOwned(args), /COMPARISON_REQUEST_FILE_CHANGED/);
  await x.f.put(retained.path, saved.payload.retention[0].bytes);
  const candidate = await readFile(path.join(x.f.root, "candidate.mjs"));
  x.hooks.authenticate = async key => {
    if (key === "accept-owner") await x.f.put("candidate.mjs", candidate.toString() + "\n// drift after verification\n");
  };
  await assert.rejects(x.bridge.acceptOwned(args), /COMPARISON_REQUEST_FILE_CHANGED|COMPARISON_VERIFICATION_STALE/);
  assert.deepEqual((await x.bridge.snapshot()).acceptances, {});
  delete x.hooks.authenticate; await x.f.put("candidate.mjs", candidate.toString());
  const accepted = await x.bridge.acceptOwned(args);
  assert.equal(accepted.status, "ACCEPTED_REVIEW_DUE");
  assert.equal(accepted.acceptance.enrollment, "REVIEW_DUE");
  assert.equal(accepted.wholeChainComparatorReady, false);
  await assert.rejects(x.bridge.close("consumer"), { message: "REVIEW_PENDING" });
});

test("spent shared arm slot cannot become a second budget through the selected reviewer journal", darwin, async t => {
  const x = await lifecycleFixture(t);
  await x.bridge.acceptOwned(await x.accept());
  const file = path.join(x.root, "arm-ledger", "allocation-1.json"), prior = '{"kind":"fixture-prior-arm-spend"}\n';
  await writeFile(file, prior, { flag: "wx", mode: 0o600 });
  const serviceModule = await import(pathToFileURL(path.join(x.runtime.packageRoot, "scripts/control-service.mjs")).href);
  const reopened = await serviceModule.openControlService(x.profile);
  assert.deepEqual(await reopened.review.capacity(), { remaining: 1, used: 0 });
  assert.equal((await x.bridge.tick()).results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  assert.deepEqual(await reopened.review.capacity(), { remaining: 1, used: 0 });
  assert.equal(await readFile(file, "utf8"), prior);
  assert.equal((await x.bridge.tick()).calls, 0);
});

test("postaccept tick requires the shared arm allocator and never retries rejected allocation", darwin, async t => {
  let attempts = 0;
  const x = await lifecycleFixture(t, { reserve: async () => { attempts++; throw Error("ARM_BUDGET_EXHAUSTED"); } });
  await assert.rejects(x.open({ profile: x.profile }), /COMPARISON_SHARED_BUDGET_REQUIRED/);
  await assert.rejects(x.open({ profile: { ...x.profile, review: { ...x.profile.review, partitionCount: 2 } }, sharedBudget: x.sharedBudget }),
    /COMPARISON_CONTROL_PARTIAL_ONLY/);
  await x.bridge.acceptOwned(await x.accept());
  const tick = await x.bridge.tick();
  assert.equal(tick.results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  assert.equal(attempts, 1); assert.equal(x.settlements.length, 0);
  const row = (await x.bridge.snapshot()).acceptances.consumer;
  assert.ok(row.reviewLease); assert.equal(row.review, null);
  assert.equal((await x.bridge.tick()).calls, 0); assert.equal(attempts, 1);
});

test("invalid shared allocation stops before review entry and retains accounting", darwin, async t => {
  const x = await lifecycleFixture(t, { reserve: async expected => ({ ...expected,
    allocationId: "bad-slot", number: 2, status: "RESERVED", expiresAt: Date.now() + 60000 }) });
  await x.bridge.acceptOwned(await x.accept());
  const tick = await x.bridge.tick();
  assert.equal(tick.results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  assert.equal(x.settlements.length, 1); assert.equal(x.settlements[0].entered, false);
  assert.equal(x.settlements[0].observation.state, "UNKNOWN");
  assert.equal((await x.bridge.tick()).calls, 0);
});

test("late shared allocation cannot enter selected review after tick timeout", { ...darwin, timeout: 30000 }, async t => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const x = await lifecycleFixture(t, { reserve: async expected => {
    await wait;
    return { ...expected, allocationId: "late-slot", number: 1, status: "RESERVED", expiresAt: Date.now() + 60000 };
  } });
  await x.bridge.acceptOwned(await x.accept());
  assert.equal((await x.bridge.tick()).results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  release();
  for (let i = 0; i < 100 && !x.settlements.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(x.settlements.length, 1); assert.equal(x.settlements[0].entered, false);
  assert.equal(x.settlements[0].observation.state, "UNKNOWN");
  assert.equal((await x.bridge.tick()).calls, 0);
  assert.ok((await x.bridge.snapshot()).acceptances.consumer.reviewLease);
});

async function nextWorkerRequest(x) {
  const pkg = JSON.parse(await readFile(path.join(x.f.root, "package.json")));
  pkg.task.id = "next-task"; pkg.task.action.args = ["continuation.mjs"];
  pkg.navigation.taskId = pkg.task.id;
  await x.f.put("next-package.json", pkg);
  const cli = path.join(x.runtime.packageRoot, "scripts/vydykhai.mjs");
  const prepare = (mode, status, ...args) => {
    const result = spawnSync(process.execPath, [cli, "context-prepare", mode, "--output", "next-prepared", ...args],
      { cwd: x.f.root, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).status, status, result.stdout);
  };
  prepare("plan", "PLAN_READY", "--input", "next-package.json");
  prepare("confirm", "PREPARED", "--owner", pkg.owner, "--decision", "approved");
  prepare("read", "DELIVERED", "--worker", pkg.task.worker);
  await x.f.put("next-worker.txt", "Fixture-only fresh worker evidence: consume the retained public output; do not modify it.\n");
  prepare("ack", "ACKNOWLEDGED", "--worker", pkg.task.worker, "--evidence", "next-worker.txt");
  const request = JSON.parse(await readFile(path.join(x.f.root, "next-prepared/resume.json")));
  const task = JSON.parse(await readFile(path.resolve(x.f.root, request.task.path)));
  const ctx = await import(pathToFileURL(path.join(x.runtime.packageRoot, "scripts/context-run.mjs")).href);
  const preflight = await ctx.runContextTransition({ ...request, operation: "preflight" });
  assert.equal(preflight.status, "READY");
  const binding = { operation: "resume", taskId: task.id, taskSha256: request.task.sha256,
    capsuleSha256: request.capsule.sha256, sourceDigest: preflight.coverageBasis.sourceDigest,
    dependencyDigest: preflight.coverageBasis.dependencyDigest, commandSha256: hash(task.action),
    cwd: x.f.root, executable: await realpath(process.execPath), kind: "dependent" };
  const common = { ...x.records.get("review-resume"), bindingSha256: hash(binding), dependenciesSha256: hash(["consumer"]),
    sourceSnapshotDigest: (await (await openReviewSources(x.profile.review.sourceFile)).snapshot()).digest };
  x.records.set("review-next", { ...common, id: "review-next", requestSha256: hash({ ...request, readback: null }) });
  x.records.set("worker-next", { ...common, id: "worker-next", role: "worker", decision: "AUTHORIZE_SUPERVISOR_ACTION",
    requestSha256: hash(request), request, readback: await readFile(path.join(x.f.root, "next-worker.txt"), "utf8") });
  return { id: "next", request, dependencies: ["consumer"] };
}

test("selected postaccept service, current owning disposition and fresh worker continuation close only the protocol cycle",
  { skip: process.platform !== "darwin" || !process.env.VYDYKHAI_CODEX_BINARY, timeout: 60000 }, async t => {
    const provider = await nativeProvider(t, async n => n === 1 ? codeItem(
      "const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'sources'}));") :
      answerItem({ schema: "control.review-answer.v2", rowGroups: [{ ids: [...controlCheckIds], status: "PASS",
        sourceIds: ["sources"], reason: "Scripted transport-only fixture, not semantic qualification." }], newFindings: [], resolutions: [] }));
    const x = await lifecycleFixture(t, { native: { binary: process.env.VYDYKHAI_CODEX_BINARY, timeoutMs: 15000, provider: provider.provider } });
    await x.bridge.acceptOwned(await x.accept());
    const artifactBefore = await readFile(path.join(x.f.root, "consumer-output.json"));
    const tick = await x.bridge.tick();
    assert.equal(tick.results[0].action, "OWNER_DISPOSITION_DUE", JSON.stringify(x.settlements));
    assert.equal(provider.requests.length, 2, "only the two scripted provider responses, no inference");
    assert.equal(x.allocations.length, 1); assert.equal(x.settlements.length, 1);
    const settled = x.settlements[0];
    assert.equal(settled.entered, true); assert.equal(settled.observation.state, "STOPPED");
    assert.equal(settled.observation.runId, x.allocations[0].runId);
    assert.ok(settled.observation.trace.sha256); assert.ok(settled.observation.usage);
    const packet = await x.bridge.readOwnerVerdict("consumer");
    assert.equal(packet.verdict.rows.length, 87);
    const decision = { owner: x.profile.config.owner, reviewKey: packet.reviewKey, action: "CONTINUE",
      nextAction: "next-task", evidence: "Fixture owner consumes exact scripted verdict; not a native semantic decision." };
    const args = { dispatchId: "disposition-owner", acceptanceId: "consumer", decision, repairLeases: [] };
    await x.ownerRecord(args.dispatchId, "CONTROL_DISPOSITION", { acceptanceId: args.acceptanceId,
      verdictSha256: hash(packet), decision, repairLeases: [] });
    await assert.rejects(x.bridge.applyOwnerDisposition({ ...args, decision: { ...decision, reviewKey: "0".repeat(64) } }),
      /COMPARISON_OWNER_VERDICT_MISMATCH/);
    const owner = x.records.get(args.dispatchId);
    x.records.set(args.dispatchId, { ...owner, payload: { ...owner.payload, verdictSha256: "0".repeat(64) } });
    await assert.rejects(x.bridge.applyOwnerDisposition(args), /COMPARISON_DISPATCH_UNVERIFIED/);
    x.records.set(args.dispatchId, owner);
    assert.equal((await x.bridge.applyOwnerDisposition(args)).action, "VERIFY_CONTINUATION");
    await assert.rejects(x.bridge.close("consumer"), /CONTROL_NOT_COMPLETE/);
    const entry = await nextWorkerRequest(x);
    await assert.rejects(x.bridge.registerContinuation({ ...entry, dependencies: [] }), /COMPARISON_CONTINUATION_REQUIRED/);
    assert.equal((await x.bridge.registerContinuation(entry)).status, "REGISTERED_NOT_AUTHORIZED");
    const worker = x.records.get("worker-next");
    x.records.set("worker-next", { ...worker, readback: x.records.get("worker-resume").readback });
    assert.equal((await x.bridge.execute(x.args("next"))).code, "CONTROL_ADMISSION_FAILED");
    x.records.set("worker-next", worker);
    const selectedService = await import(pathToFileURL(path.join(x.runtime.packageRoot, "scripts/control-service.mjs")).href);
    const reopened = await selectedService.openControlService(x.profile);
    await reopened.host.pause(true);
    assert.equal((await x.bridge.execute(x.args("next"))).stats.commands, 0);
    assert.equal((await x.bridge.snapshot()).paused, true);
    await assert.rejects(readFile(path.join(x.f.root, "continued.json")), { code: "ENOENT" });
    await reopened.host.pause(false);
    assert.equal((await x.bridge.execute(x.args("next"))).status, "ACTION_COMPLETED");
    assert.deepEqual(JSON.parse(await readFile(path.join(x.f.root, "continued.json"))), { retained: true });
    const closed = await x.bridge.close("consumer");
    assert.equal(closed.status, "HOST_CONTROL_CLOSED"); assert.equal(closed.acceptance.enrollment, "CLOSED");
    assert.equal(closed.wholeChainComparatorReady, false);
    assert.equal((await x.bridge.execute(x.args("next"))).status, "BLOCKED");
    assert.equal((await x.bridge.tick()).calls, 0); assert.equal(x.allocations.length, 1);
    assert.deepEqual(await readFile(path.join(x.f.root, "consumer-output.json")), artifactBefore);
    t.diagnostic("All reviewer responses and actor records are fixture-owned; actual host/CLI transport is not semantic adoption.");
  });

test("scripted blocking postaccept finding requires real owner repair lease and never enables continuation",
  { skip: process.platform !== "darwin" || !process.env.VYDYKHAI_CODEX_BINARY, timeout: 60000 }, async t => {
    const reviewAt = new Date(Date.now() + 60000).toISOString();
    const provider = await nativeProvider(t, async n => n === 1 ? codeItem(
      "const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'sources'}));") :
      answerItem({ schema: "control.review-answer.v2", rowGroups: [
        { ids: controlCheckIds.filter(id => id !== "C15.01"), status: "PASS", sourceIds: ["sources"], reason: "Scripted transport fixture only." },
        { ids: ["C15.01"], status: "UNKNOWN", sourceIds: ["sources"], reason: "Scripted unresolved maintenance", findingId: "owned-gap" }],
      newFindings: [{ id: "owned-gap", checkId: "C15.01", evidence: "Scripted missing proof, not an inferred product finding",
        sourceIds: ["sources"], owner: "owner", work: "repair", reviewAt, blocksResume: true }], resolutions: [] }));
    const x = await lifecycleFixture(t, { native: { binary: process.env.VYDYKHAI_CODEX_BINARY, timeoutMs: 15000, provider: provider.provider } });
    await x.bridge.acceptOwned(await x.accept());
    const artifact = await readFile(path.join(x.f.root, "consumer-output.json"));
    assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE", JSON.stringify(x.settlements));
    const packet = await x.bridge.readOwnerVerdict("consumer");
    const repairLeases = [{ owner: "owner", work: "repair", state: "PREPARED", evidence: "Fixture owned assignment, not completed repair",
      checkpoint: "Fresh independent repair readback", reviewAt }];
    let decision = { owner: "owner", reviewKey: packet.reviewKey, action: "CONTINUE", nextAction: "next-task", evidence: "Fixture attempted premature continuation" };
    const args = () => ({ dispatchId: "owner-repair", acceptanceId: "consumer", decision, repairLeases });
    const bind = async leases => x.ownerRecord("owner-repair", "CONTROL_DISPOSITION",
      { acceptanceId: "consumer", verdictSha256: hash(packet), decision, repairLeases: leases });
    await bind(repairLeases);
    await assert.rejects(x.bridge.applyOwnerDisposition(args()), /POST_ACCEPT_REPAIR_REQUIRED/);
    decision = { ...decision, action: "REPAIR", evidence: "Own the unresolved fixture finding; no closure claim" };
    await bind([]);
    await assert.rejects(x.bridge.applyOwnerDisposition({ ...args(), repairLeases: [] }), /POST_ACCEPT_REPAIR_OWNER_REQUIRED/);
    await bind(repairLeases);
    assert.equal((await x.bridge.applyOwnerDisposition(args())).action, "REPAIR_REQUIRED");
    await assert.rejects(x.bridge.close("consumer"), /CONTROL_NOT_COMPLETE/);
    const row = (await x.bridge.snapshot()).acceptances.consumer;
    assert.equal(row.findings[0].status, "OPEN"); assert.deepEqual(row.repairLeases, repairLeases);
    assert.equal((await x.bridge.tick()).calls, 0); assert.equal(x.allocations.length, 1);
    assert.deepEqual(await readFile(path.join(x.f.root, "consumer-output.json")), artifact);
    await assert.rejects(readFile(path.join(x.f.root, "continued.json")), { code: "ENOENT" });
  });
