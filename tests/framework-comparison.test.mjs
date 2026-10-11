import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, readFile, writeFile, readdir, chmod, cp, rm, symlink, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { fixture } from "./context-fixture.mjs";
import { BASELINE_COMMIT, stageComparisonPreflight, runComparisonPreflight,
  verifyComparisonPreflight, invokeComparisonAdapter, materializeComparisonScenario,
  runSyntheticComparisonTransport } from "../scripts/qualify-framework-comparison.mjs";

const sourceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const probe = path.join(sourceRoot, "scripts/qualify-framework-comparison-probe.mjs");
const commandHelper = path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs");
async function temp(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "framework-comparison-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function stage(t) {
  const output = path.join(await temp(t), "freeze");
  const staged = await stageComparisonPreflight({ sourceRoot, output });
  return { ...staged, expectedDigest: staged.digest };
}
const json = async file => JSON.parse(await readFile(file, "utf8"));
const put = (root, name, value) => writeFile(path.join(root, name), typeof value === "string" ? value : JSON.stringify(value));

test("comparison freezes every live application helper and its runtime dependencies", async t => {
  const parent = await temp(t), local = path.join(parent, "local");
  await cp(path.join(sourceRoot, "scripts"), path.join(local, "scripts"), { recursive: true });
  for (const name of ["vydykhai.json", "LICENSE.md", "NOTICE.md"])
    await cp(path.join(sourceRoot, name), path.join(local, name));
  const adapter = await import(pathToFileURL(path.join(local, "scripts/qualify-framework-comparison.mjs")).href);
  const staged = await adapter.stageComparisonPreflight({ sourceRoot, output: path.join(parent, "freeze") });
  const failures = [];
  for (const name of ["qualify-framework-comparison-auth", "qualify-framework-comparison-owner",
    "qualify-framework-comparison-prepare", "qualify-framework-comparison-control",
    "qualify-framework-comparison-native", "qualify-framework-comparison-ledger",
    "post-accept", "control-review-sources", "context-prepare"]) {
    const file = path.join(local, "scripts", `${name}.mjs`), original = await readFile(file);
    await writeFile(file, Buffer.concat([original, Buffer.from("\n// Isolated freeze drift probe.\n")]));
    try { await adapter.verifyComparisonPreflight(staged.output, staged.digest); failures.push(name); }
    catch (error) { assert.match(error.message, /COMPARISON_ADAPTER_CHANGED/); }
    finally { await writeFile(file, original); }
  }
  assert.deepEqual(failures, [], "all used helpers must invalidate the old freeze");
  await adapter.verifyComparisonPreflight(staged.output, staged.digest);
});

// Deliberately synthetic protocol inputs, not the comparator scenario or semantic evidence.
// Reuse the released example and the aligned-package construction in context-prepare tests.
async function protocolFixture(staged, arm) {
  const root = path.join(staged.output, "workspaces", arm);
  await cp(path.join(staged.output, "baseline", "examples/context-preparation"), root, { recursive: true });
  for (const name of await readdir(root)) await chmod(path.join(root, name), 0o600);
  const pkg = await json(path.join(root, "package-modular.json"));
  pkg.schema = "context.package.v3";
  const statements = {
    goal: "Deliver reusable bundles to independent consumers, retaining accepted behavior.",
    invariant: "Public boundaries preserve ownership, permissions and versioned output.",
    gap: "Independent example N1 rejects the current case-sensitive duplicate comparison.",
    acceptance: "Verify retained B1/B2 and independent N1 through the public consumer entry."
  };
  await put(root, "architecture.md", Object.values(statements).join("\n") + "\n");
  for (const [id, quote] of Object.entries(statements)) pkg.navigation.references.push({ id, quote,
    path: "architecture.md", purpose: id, appliesTo: "task" });
  pkg.alignment = { goalRef: "goal", invariantRefs: ["invariant"], acceptanceRef: "acceptance",
    decisions: [{ moduleId: "buildBundle", boundaryChange: false, gapRef: "gap", existingRef: "public-contract",
      rationale: "Protocol fixture only: use the existing scoped duplicate-comparison example." }], review: null };
  await put(root, "package.json", pkg);
  const call = (operation, options = {}) => invokeComparisonAdapter({ ...staged, arm, operation, ...options });
  const prepare = (...args) => call("prepare", { args: [args[0], "--output", "prepared", ...args.slice(1)] });
  return { root, pkg, call, prepare };
}

test("synthetic transport validates arm, freeze and canonical workspace before writing anything", async t => {
  const staged = await stage(t), scenario = await materializeComparisonScenario(staged);
  const parent = path.dirname(staged.output), workspace = path.join(staged.output, "workspaces/baseline");
  const before = await readdir(parent), beforeWorkspace = await readdir(workspace);
  await assert.rejects(runSyntheticComparisonTransport({ ...staged, ...scenario, arm: "../.." }), /COMPARISON_ARM_INVALID/);
  assert.deepEqual(await readdir(parent), before);
  await assert.rejects(runSyntheticComparisonTransport({ ...staged, ...scenario, arm: "baseline", expectedDigest: "0".repeat(64) }), /COMPARISON_FREEZE_MISMATCH/);
  assert.deepEqual(await readdir(workspace), beforeWorkspace);
  const outside = path.join(parent, "outside");
  await rename(workspace, outside);
  await symlink(outside, workspace);
  await assert.rejects(runSyntheticComparisonTransport({ ...staged, ...scenario, arm: "baseline" }), /COMPARISON_DIRECTORY_UNSAFE/);
  assert.deepEqual(await readdir(outside), beforeWorkspace);
});

test("real archive and current candidate are distinct frozen trees; zero-inference probes load their own APIs", async t => {
  const output = path.join(await temp(t), "freeze");
  const report = await runComparisonPreflight({ sourceRoot, output });
  assert.equal(report.status, "PARTIAL_ZERO_INFERENCE_PREFLIGHT_PASS");
  assert.equal(report.modelsLaunched, 0);
  assert.equal(report.wholeChainComparatorReady, false);
  assert.equal(report.semanticComparison, "NOT_RUN");
  assert.equal(report.policyApplication, "NOT_OBSERVED");
  const freeze = await verifyComparisonPreflight(output, report.digest);
  assert.equal(freeze.baseline.commit, BASELINE_COMMIT);
  assert.equal(freeze.baseline.archiveSha256, "0d64642922a031b58956296ef16e19d23508e735ad2aa61e230b11235ad5183d");
  assert.notEqual(freeze.baseline.digest, freeze.candidate.digest);
  for (const name of ["scripts/context-prepare.mjs", "scripts/context-run.mjs", "docs/AGENTS_CORE.md"]) {
    const old = spawnSync("git", ["--no-replace-objects", "show", `${BASELINE_COMMIT}:${name}`], { cwd: sourceRoot });
    assert.equal(old.status, 0);
    assert.equal(freeze.baseline.files[name], sha256(old.stdout));
    assert.equal(freeze.candidate.files[name], sha256(await readFile(path.join(sourceRoot, name))));
  }
  for (const [name, digest] of Object.entries(freeze.inputs)) {
    assert.equal(sha256(await readFile(path.join(output, "candidate", name))), digest);
  }
  for (const arm of ["baseline", "candidate"]) {
    const observed = report.arms[arm];
    assert.deepEqual(observed.before, {});
    assert.deepEqual(observed.after, {});
    assert.equal(observed.result.unprepared.status, "BLOCKED");
    assert.equal(observed.result.unprepared.stats.commands, 0);
    assert.equal(observed.result.emptyOutbox.returnCount, 0);
    assert.equal(observed.semanticEvidence, false);
    assert.equal(observed.callerIdentity, "UNAUTHENTICATED_MAINTAINER_INPUT");
    assert.equal(observed.neutralAdapter.supervisor, freeze.adapter.supervisor);
    assert.ok(observed.loaded.every(name => Object.hasOwn(freeze[arm].files, name)));
  }
  assert.ok(!report.arms.baseline.loaded.some(name => name.includes("control-host") || name.includes("control-service")));
  assert.ok(report.arms.candidate.loaded.includes("scripts/control-host.mjs"));
  assert.ok(report.arms.candidate.loaded.includes("scripts/control-service.mjs"));
  assert.equal(freeze.adapter.supervisor, sha256(await readFile(commandHelper)));
  for (const arm of ["baseline", "candidate"]) {
    const result = report.transport[arm];
    assert.equal(result.status, "SYNTHETIC_TRANSPORT_PASS");
    assert.equal(result.semanticEvidence, false);
    assert.equal(result.modelCalls, 0);
    assert.equal(result.wholeChainComparatorReady, false);
    assert.equal(result.candidateControl, arm === "baseline" ? "NOT_INJECTED" : "NOT_WIRED_REFERENCE_ROUTE_ONLY");
    assert.deepEqual(result.steps.flatMap(step => step.commands.map(c => c.script)), ["action.mjs", "verify.mjs", "continuation.mjs"]);
    const accepted = result.steps.find(s => s.name === "accept").result;
    assert.equal(accepted.status, "VERIFIED");
    assert.equal(accepted.receipt.productAcceptance, "NOT_ESTABLISHED");
    assert.deepEqual(accepted.receipt.observations.map(o => o.id).sort(), ["B1", "B2", "N1"]);
    const workspace = path.join(output, "workspaces", arm);
    assert.equal(await readFile(path.join(workspace, "return.md"), "utf8"), accepted.returnSync);
    assert.equal(result.steps.find(s => s.name === "return-read").result.parsed.routedCount, 0);
    assert.equal(result.steps.find(s => s.name === "return-consumed").result.parsed.routedCount, 1);
    assert.equal(result.steps.find(s => s.name === "integrate").result.status, "VERIFIED");
    assert.deepEqual(await json(path.join(workspace, "continued.json")), { used: ["AA", "b"] });
    assert.equal(sha256(await readFile(path.join(workspace, "consumer-output.json"))), result.acceptedOutputSha256);
    assert.equal(sha256(await readFile(path.join(workspace, "candidate.mjs"))), report.scenario.files["candidate.mjs"]);
    for (const step of result.steps) assert.ok(step.loaded.every(name => Object.hasOwn(freeze[arm].files, name)));
    if (arm === "baseline") assert.ok(result.steps.every(step => !step.loaded.includes("scripts/control-host.mjs")));
    const replay = await invokeComparisonAdapter({ output, expectedDigest: report.digest, scenarioDigest: report.scenario.scenarioDigest,
      arm, operation: "context", file: "next/resume.json" });
    assert.equal(replay.result.status, "BLOCKED");
    assert.deepEqual(replay.commands, []);
    assert.equal(await readFile(path.join(workspace, "return.md"), "utf8"), accepted.returnSync);
  }
  assert.equal(report.transport.baseline.acceptedOutputSha256, report.transport.candidate.acceptedOutputSha256);
  await assert.rejects(stageComparisonPreflight({ sourceRoot, output }), { code: "EEXIST" });
});

test("asset-only fixture and capture preserve exact common bytes without preparation; fixture defaults still work", async t => {
  const staged = await stage(t);
  const materialized = await materializeComparisonScenario(staged);
  assert.equal(materialized.approvalsWritten, false);
  assert.equal(materialized.preparationExecuted, false);
  for (const arm of ["baseline", "candidate"]) {
    const root = path.join(staged.output, "workspaces", arm);
    assert.deepEqual((await readdir(root)).sort(), Object.keys(materialized.files).sort());
    assert.ok(!(await readdir(root)).some(name => /approval|readback|classif|review|capsule|task|plan/.test(name)));
    for (const [name, digest] of Object.entries(materialized.files))
      assert.equal(sha256(await readFile(path.join(root, name))), digest);
  }
  const f = await fixture(t, { correction: true, preparation: false, sourceRoot: path.join(staged.output, "baseline") });
  assert.equal(f.cli, path.join(staged.output, "baseline/scripts/vydykhai.mjs"));
  assert.equal(f.prepare, undefined);
  assert.ok(!(await readdir(f.root)).some(name => /approval|readback|classif|review|capsule|task|plan|integration/.test(name)));
  for (const name of ["candidate.mjs", "oracle.json", "verify.mjs", "sources.json"])
    assert.equal(sha256(await readFile(path.join(f.root, name))), materialized.files[name]);
  const defaults = await fixture(t, { correction: true });
  assert.equal((await defaults.prepare()).status, "PREPARED");
  assert.ok((await readdir(defaults.root)).includes("readback.json"));
  const archived = await fixture(t, { correction: true, sourceRoot: path.join(staged.output, "baseline") });
  assert.equal((await archived.prepare()).status, "PREPARED");
});

test("fixed supervisor refuses shell, undeclared arguments, recipe drift and repeated effects for the precise reason", async t => {
  const staged = await stage(t), materialized = await materializeComparisonScenario(staged);
  const root = path.join(staged.output, "workspaces/baseline"), scenario = await json(path.join(staged.output, "scenario.json"));
  await put(root, "recipe.json", canonicalJson(scenario.oracle.recipe) + "\n");
  const fixed = { workspace: root, files: materialized.files, recipeSha256: sha256(await readFile(path.join(root, "recipe.json"))) };
  const check = (binary, args) => spawnSync(process.execPath, ["--permission", "--allow-child-process", `--allow-fs-read=${root}`,
    `--allow-fs-read=${commandHelper}`, "--input-type=module", "-e", `
      import cp from 'node:child_process';
      import {installFixedComparisonCommands} from ${JSON.stringify(pathToFileURL(commandHelper).href)};
      installFixedComparisonCommands(${JSON.stringify(fixed)}, []);
      try { cp.spawn(${JSON.stringify(binary)}, ${JSON.stringify(args)}, {cwd:process.cwd(),shell:false,detached:process.platform!=='win32',env:{}}); process.exitCode=2; }
      catch(e) { console.log(e.message); }
    `], { cwd: root, encoding: "utf8", timeout: 5000, env: { PATH: "/usr/bin:/bin" } });
  for (const [binary, args] of [["/bin/sh", ["-c", "exit 0"]], [process.execPath, ["-e", "process.exit(0)"]],
    [process.execPath, ["action.mjs", "extra"]], [process.execPath, ["../action.mjs"]]]) {
    const r = check(binary, args); assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "COMPARISON_COMMAND_NOT_DECLARED");
  }
  await put(root, "recipe.json", "{}\n");
  let r = check(process.execPath, ["action.mjs"]);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "COMPARISON_COMMAND_RECIPE_DRIFT");
  await put(root, "recipe.json", canonicalJson(scenario.oracle.recipe) + "\n");
  await put(root, "consumer-output.json", "existing effect\n");
  r = check(process.execPath, ["action.mjs"]);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "COMPARISON_COMMAND_EFFECT_ALREADY_EXISTS");
  await put(root, "action.mjs", "throw Error('must not run');\n");
  await assert.rejects(invokeComparisonAdapter({ ...staged, ...materialized, arm: "baseline", operation: "capabilities" }), /COMPARISON_SCENARIO_DRIFT:action.mjs/);
});

test("fixture command child rejects imports outside the pinned producer entry, even when readable", async t => {
  const root = await temp(t);
  await put(root, "escape.mjs", "throw Error('ESCAPED');\n");
  await put(root, "action.mjs", "import './escape.mjs';\n");
  const r = spawnSync(process.execPath, ["--permission", `--allow-fs-read=${root}`, `--allow-fs-read=${commandHelper}`,
    commandHelper, "--fixture-command", root, "action.mjs"], { cwd: root, encoding: "utf8", timeout: 5000 });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /COMPARISON_IMPORT_ESCAPE/);
  assert.doesNotMatch(r.stderr, /ERR_ACCESS_DENIED|Error: ESCAPED/);
});

for (const arm of ["baseline", "candidate"]) test(`${arm}: actual v3 owner/worker transport preserves supplied bytes and stops before actions`, async t => {
  const staged = await stage(t), w = await protocolFixture(staged, arm);
  const planned = await w.prepare("plan", "--input", "package.json");
  assert.equal(planned.result.status, "PLAN_READY", JSON.stringify(planned.result));
  assert.deepEqual(await readdir(path.join(w.root, "prepared")), ["plan.json"]);
  const plan = await json(path.join(w.root, "prepared/plan.json"));
  assert.deepEqual(plan.semanticPackage, w.pkg);
  assert.equal(plan.owner, w.pkg.owner);
  assert.equal((await w.prepare("confirm", "--owner", "wrong-owner", "--decision", "approved")).result.code, "PACKAGE_APPROVAL_REQUIRED");
  await assert.rejects(readFile(path.join(w.root, "prepared/approval.json")), { code: "ENOENT" });
  const confirmed = await w.prepare("confirm", "--owner", w.pkg.owner, "--decision", "approved");
  assert.equal(confirmed.result.status, "PREPARED", JSON.stringify(confirmed.result));
  const approval = await json(path.join(w.root, "prepared/approval.json"));
  assert.equal(approval.owner, w.pkg.owner);
  assert.equal(approval.planSha256, sha256(await readFile(path.join(w.root, "prepared/plan.json"))));
  for (const name of ["source-review-0.json", "memory-review.json", "integration-review.json"])
    assert.equal((await json(path.join(w.root, "prepared", name))).reviewer, w.pkg.owner,
      "native owner-derived records are not independent reviews");
  const integrated = await json(path.join(w.root, "prepared/integration.json"));
  assert.equal(integrated.artifacts[0].sha256, sha256(await readFile(path.join(w.root, "shared.md"))));
  assert.equal((await w.prepare("read", "--worker", "wrong-worker")).result.status, "BLOCKED");
  await assert.rejects(readFile(path.join(w.root, "prepared/readback.json")), { code: "ENOENT" });
  assert.equal((await w.prepare("ack", "--worker", w.pkg.task.worker, "--evidence", "worker.txt")).result.status, "BLOCKED");
  assert.equal((await w.prepare("read", "--worker", w.pkg.task.worker)).result.status, "DELIVERED");
  const original = "TEST FIXTURE ONLY. This exact worker-authored byte payload is not model comprehension.\n";
  await put(w.root, "worker.txt", original);
  const ack = await w.prepare("ack", "--worker", w.pkg.task.worker, "--evidence", "worker.txt");
  assert.equal(ack.result.status, "ACKNOWLEDGED", JSON.stringify(ack.result));
  const readback = await json(path.join(w.root, "prepared/readback.json"));
  assert.equal(readback.worker, w.pkg.task.worker);
  assert.deepEqual(readback.evidenceRef, { path: "worker.txt", sha256: sha256(original) });
  assert.equal(await readFile(path.join(w.root, "worker.txt"), "utf8"), original);
  const ready = await w.call("context", { file: "prepared/preflight.json" });
  assert.equal(ready.result.status, "READY", JSON.stringify(ready.result));
  assert.equal(ready.result.stats.commands, 0);
  assert.equal(ready.semanticEvidence, false);
  assert.equal(ready.wholeChainComparatorReady, false);
  const integrationRequest = { ...await json(path.join(w.root, "prepared/preflight.json")), operation: "integrate", capsule: null, readback: null,
    integrationPlan: { path: "prepared/integration-plan.json", sha256: sha256(await readFile(path.join(w.root, "prepared/integration-plan.json"))) } };
  await put(w.root, "integration-request.json", integrationRequest);
  const readbackIntegration = await w.call("context", { file: "integration-request.json" });
  assert.equal(readbackIntegration.result.status, "VERIFIED", JSON.stringify(readbackIntegration.result));
  assert.equal(readbackIntegration.result.stats.commands, 0);
  assert.deepEqual(readbackIntegration.result.receipt, integrated);
  for (const name of ["resume", "accept"]) await assert.rejects(w.call("context", { file: `prepared/${name}.json` }), /COMPARISON_ACTION_EXECUTION_DISABLED/);
  await assert.rejects(readFile(path.join(w.root, "actions.log")), { code: "ENOENT" });
  await put(w.root, "worker.txt", "Changed after acknowledgement\n");
  assert.equal((await w.call("context", { file: "prepared/preflight.json" })).result.status, "BLOCKED");
});

test("no v1 substitution, missing package fabrication, implicit dispatch, or outbox routing", async t => {
  const staged = await stage(t), root = path.join(staged.output, "workspaces/baseline");
  const call = (operation, options = {}) => invokeComparisonAdapter({ ...staged, arm: "baseline", operation, ...options });
  for (const operation of ["run", "model", "tick", "resume", "accept", "shell"]) await assert.rejects(call(operation), /COMPARISON_OPERATION_REFUSED/);
  await put(root, "package.json", { schema: "context.package.v1" });
  await assert.rejects(call("prepare", { args: ["plan", "--input", "package.json", "--output", "prepared"] }), /COMPARISON_ACTUAL_V3_PACKAGE_REQUIRED/);
  await assert.rejects(call("prepare", { args: ["plan", "--input", "missing.json", "--output", "prepared"] }), /ENOENT/);
  const original = `<!-- vydykhai:return-sync v1 -->
# Return Sync
Status: BLOCKED
Return receipt id: synthetic-test-return
Return lifecycle: WRITTEN
Task / context / PR / commit / artifact: synthetic-test-only
Memory candidates: Unresolved; no semantic run
Artifact disposition: Preserved test input
Recommended orchestrator next action: Await actual owner decision
<!-- vydykhai:return-sync:end -->`;
  await put(root, "return.md", original);
  const outbox = await call("outbox", { file: "return.md" });
  assert.equal(outbox.result.parsed.returnCount, 1);
  assert.equal(outbox.result.parsed.returns[0].valid, true);
  assert.deepEqual(outbox.result.parsed.pendingReturnIds, ["synthetic-test-return"]);
  assert.equal(outbox.result.parsed.routedCount, 0);
  assert.equal(outbox.before["return.md"], sha256(original));
  assert.deepEqual(outbox.before, outbox.after);
  await assert.rejects(call("outbox", { file: "../candidate/return.md" }), /COMPARISON_INPUT_PATH_INVALID/);
});

test("freeze mismatch, extra files, policy drift and symlinks fail closed before probing", async t => {
  const staged = await stage(t);
  await assert.rejects(verifyComparisonPreflight(staged.output, "0".repeat(64)), /COMPARISON_FREEZE_MISMATCH/);
  await assert.rejects(invokeComparisonAdapter({ ...staged, arm: "unknown" }), /COMPARISON_ARM_INVALID/);
  const extra = path.join(staged.output, "baseline/scripts/control-host.mjs");
  await writeFile(extra, "throw Error('must not execute');\n");
  await assert.rejects(invokeComparisonAdapter({ ...staged, arm: "baseline" }), /COMPARISON_ARM_DRIFT:baseline/);
  await rm(extra);
  const policy = path.join(staged.output, "candidate/docs/AGENTS_CORE.md");
  await chmod(policy, 0o600); const bytes = await readFile(policy);
  await writeFile(policy, "changed policy\n");
  await assert.rejects(invokeComparisonAdapter({ ...staged, arm: "candidate" }), /COMPARISON_ARM_DRIFT:candidate/);
  await writeFile(policy, bytes);
  await rm(policy); await symlink(path.join(sourceRoot, "docs/AGENTS_CORE.md"), policy);
  await assert.rejects(verifyComparisonPreflight(staged.output, staged.digest), /COMPARISON_SYMLINK_REFUSED/);
});

test("probe has no ambient preload, candidate import escape or child-process authority", async t => {
  const staged = await stage(t), root = path.join(staged.output, "baseline"), cwd = path.join(staged.output, "workspaces/baseline");
  const prior = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = "--import=/nonexistent/must-not-load.mjs";
  try { assert.equal((await invokeComparisonAdapter({ ...staged, arm: "baseline" })).modelsLaunched, 0); }
  finally { if (prior === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = prior; }
  // Direct child probes intentionally bypass parent hash validation to test defense in depth.
  const direct = () => spawnSync(process.execPath, ["--permission", `--allow-fs-read=${root}`, `--allow-fs-read=${cwd}`,
    `--allow-fs-read=${path.join(staged.output, "candidate")}`, `--allow-fs-read=${commandHelper}`,
    `--allow-fs-read=${path.join(sourceRoot, "scripts/local-control-sandbox.mjs")}`,
    `--allow-fs-read=${probe}`, `--allow-fs-write=${cwd}`, probe, root, "baseline"],
  { cwd, input: JSON.stringify({ operation: "capabilities" }), encoding: "utf8", timeout: 10000, env: { PATH: "/usr/bin:/bin" } });
  const target = path.join(root, "scripts/context-prepare.mjs"), original = await readFile(target);
  await chmod(target, 0o600);
  await writeFile(target, "import '../../candidate/scripts/control-host.mjs';\n" + original);
  let result = direct(); assert.notEqual(result.status, 0); assert.match(result.stderr, /COMPARISON_IMPORT_ESCAPE/);
  await writeFile(target, "import {spawnSync} from 'node:child_process'; spawnSync(process.execPath,['--version']);\n" + original);
  result = direct(); assert.notEqual(result.status, 0); assert.match(result.stderr, /permission: 'ChildProcess'/);
  await writeFile(target, "import 'node:https';\n" + original);
  result = direct(); assert.notEqual(result.status, 0); assert.match(result.stderr, /COMPARISON_NETWORK_DISABLED/);
});
