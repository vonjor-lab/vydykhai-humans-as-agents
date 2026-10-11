import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { initializeComparisonLedger, openComparisonLedger } from "../scripts/qualify-framework-comparison-ledger.mjs";
import { stageComparisonPreflight, materializeComparisonScenario } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, dispatchRole, readTurnSources, readCompletedRoleOutput, openNativeReviewBudget,
  publishTurnSources } from "../scripts/qualify-framework-comparison-native.mjs";
import { inspectControlRuntime, stageControlRuntime } from "../scripts/control-runtime.mjs";
import { openComparisonControl } from "../scripts/qualify-framework-comparison-control.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { controlCheckIds } from "../scripts/control-catalog.mjs";
import { reviewPartitions } from "../scripts/control-review-partitions.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const reserve = (ledger, kind = "ROLE_DISPATCH") => ledger.exclusive(lease => lease.reserve(kind, async () => ({ fixture: true })));
const settle = (ledger, allocation, status = "RECORDED") => ledger.exclusive(lease => lease.settle(allocation, { status, usage: "fixture-only" }));
async function root(t, prefix) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function ledgerFixture(t, maxCalls = 3) {
  const directory = await root(t, "comparison-ledger-");
  for (const arm of ["baseline", "candidate"]) {
    await mkdir(path.join(directory, arm), { mode: 0o700 });
    await mkdir(path.join(directory, arm, "turns"), { mode: 0o700 });
    await initializeComparisonLedger({ directory, expectedDigest: hash("frozen"), arm, maxCalls });
  }
  const options = { directory, expectedDigest: hash("frozen"), arm: "candidate", maxCalls };
  return { options, ledger: await openComparisonLedger(options) };
}

test("role and review share durable monotonically numbered spend, not two budgets", async t => {
  const { options, ledger } = await ledgerFixture(t);
  for (const [i, kind] of ["ROLE_DISPATCH", "POST_ACCEPT_REVIEW", "ROLE_DISPATCH"].entries()) {
    const allocation = await reserve(await openComparisonLedger(options), kind);
    assert.equal(allocation.number, i + 1); assert.equal(allocation.maxCalls, 3);
    await settle(ledger, allocation);
  }
  const reopened = await openComparisonLedger(options), state = await reopened.inspect();
  assert.equal(state.used, 3); assert.equal(state.remaining, 0); assert.equal(state.blocked, false);
  await assert.rejects(reserve(reopened), /NATIVE_ARM_CALL_CAP/);
  assert.equal((await (await openComparisonLedger({ ...options, arm: "baseline" })).inspect()).used, 0);
  await assert.rejects(openComparisonLedger({ ...options, maxCalls: 4 }), /NATIVE_LEDGER_CONFIG_CHANGED/);
  await assert.rejects(initializeComparisonLedger(options), /NATIVE_LEDGER_NOT_EMPTY/);
  await rm(path.join(options.directory, options.arm, "ledger.json"));
  await assert.rejects(openComparisonLedger(options), { code: "ENOENT" });
});

test("interrupted and explicitly unresolved spend survive reopen and never refund or retry", async t => {
  const { options, ledger } = await ledgerFixture(t), allocation = await reserve(ledger, "POST_ACCEPT_REVIEW");
  const restarted = await openComparisonLedger(options);
  assert.equal((await restarted.inspect()).used, 1); assert.equal((await restarted.inspect()).blocked, true);
  await assert.rejects(reserve(restarted), /NATIVE_UNRESOLVED_ALLOCATION/);
  await settle(restarted, allocation, "UNRESOLVED");
  await assert.rejects(reserve(ledger, "POST_ACCEPT_REVIEW"), /NATIVE_PREVIOUS_TURN_FAILED/);
  await assert.rejects(settle(ledger, allocation), /NATIVE_LEDGER_SETTLEMENT_CONFLICT/);
  assert.equal((await ledger.inspect()).used, 1);
});

test("same dispatch lock serializes allocators and is never stolen on restart", async t => {
  const { options, ledger } = await ledgerFixture(t), other = await openComparisonLedger(options);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const first = ledger.exclusive(async lease => { entered(); await wait; return lease.reserve("ROLE_DISPATCH", async () => ({})); });
  await started;
  await assert.rejects(reserve(other, "POST_ACCEPT_REVIEW"), { code: "EEXIST" });
  release(); const allocation = await first;
  assert.equal(allocation.number, 1);
  await settle(ledger, allocation);
  await mkdir(path.join(options.directory, "candidate/.dispatch-lock"));
  await assert.rejects(reserve(await openComparisonLedger(options)), { code: "EEXIST" });
  assert.equal((await ledger.inspect()).used, 1);
});

test("settlement cannot change allocation identity, overwrite a receipt or heal malformed history", async t => {
  const { options, ledger } = await ledgerFixture(t), allocation = await reserve(ledger);
  await assert.rejects(settle(ledger, { ...allocation, kind: "POST_ACCEPT_REVIEW" }), /NATIVE_LEDGER_ALLOCATION_MISMATCH/);
  await settle(ledger, allocation);
  assert.deepEqual(await settle(ledger, allocation), (await ledger.read(1)).receipt);
  await assert.rejects(settle(ledger, allocation, "FAILED"), /NATIVE_LEDGER_SETTLEMENT_CONFLICT/);
  const turns = path.join(options.directory, "candidate/turns");
  await writeFile(path.join(turns, "allocation-2.json"), "{interrupted", { mode: 0o600 });
  await assert.rejects(reserve(ledger));
  assert.equal((await readdir(turns)).includes("allocation-3.json"), false);
});

test("ledger rejects symlink storage before outside reads or writes", async t => {
  const { options } = await ledgerFixture(t), turns = path.join(options.directory, "candidate/turns");
  const outside = path.join(options.directory, "outside"); await mkdir(outside, { mode: 0o700 });
  await rm(turns, { recursive: true }); await symlink(outside, turns);
  await assert.rejects(openComparisonLedger(options), /NATIVE_LEDGER_DIRECTORY_UNSAFE/);
  assert.deepEqual(await readdir(outside), []);
});

async function reviewFixture(t, provider = { baseUrl: "http://127.0.0.1:1", requiresAuth: false }, partitioned = false) {
  const base = await root(t, "comparison-shared-review-");
  const comparison = await stageComparisonPreflight({ sourceRoot, output: path.join(base, "comparison") });
  const scenario = await materializeComparisonScenario({ output: comparison.output, expectedDigest: comparison.digest });
  const native = await stageNativeComparison({ comparisonOutput: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(base, "native"), maxCalls: partitioned ? 14 : 3,
    timeoutMs: partitioned ? 300000 : 15000, effort: partitioned ? "high" : "low",
    ...(partitioned ? { reviewProfile: { partitionCount: 3, effort: "low", timeoutMs: 90000 } } : {}) });
  const workspace = path.join(base, "workspace"), controlRoot = path.join(base, "control");
  for (const dir of [workspace, controlRoot]) await mkdir(dir, { mode: 0o700 });
  for (const dir of ["packages", "host", "review", "home", "room"]) await mkdir(path.join(controlRoot, dir), { mode: 0o700 });
  const snapshot = await inspectControlRuntime(sourceRoot);
  const selected = await stageControlRuntime({ sourceRoot, directory: path.join(controlRoot, "packages"), workspace, expectedDigest: snapshot.digest });
  const runtime = { packageRoot: selected.root, expectedDigest: selected.digest };
  const load = name => import(pathToFileURL(path.join(selected.root, "scripts", name)).href);
  const sourceFile = path.join(controlRoot, "sources.json");
  await writeFile(path.join(workspace, "ledger.md"), "Protocol fixture, no semantic or product acceptance claim.");
  await writeFile(sourceFile, JSON.stringify({ schema: "control.review-sources.v1", workspace,
    sources: [{ id: "ledger", path: "ledger.md", purpose: "Scripted protocol source" }] }), { mode: 0o600 });
  const profile = { schema: "control.service.v1", directory: path.join(controlRoot, "host"),
    config: { workspace, owner: "owner", executor: "worker", reviewer: "reviewer", policy: hash("fixture-policy"), evidenceRegistry: sourceFile },
    maxReviewsPerTick: 1, timeoutMs: partitioned ? 275000 : 16000,
    review: { directory: path.join(controlRoot, "review"), controlRoot, reviewer: "reviewer", sourceFile,
      maxCalls: partitioned ? 12 : 3, ...(partitioned ? { partitionCount: 3 } : {}),
      expiresAt: new Date(Date.now() + (partitioned ? 3600000 : 120000)).toISOString(), scope: { kind: "fixture", requiredSourceIds: ["ledger"] },
      native: { binary: binary ?? "/never-launch", workspace: path.join(controlRoot, "room"), home: path.join(controlRoot, "home"),
        model: "gpt-6.1-sol", effort: "low", timeoutMs: partitioned ? 90000 : 15000, provider } } };
  const { openControlService } = await load("control-service.mjs"), { openControlStore } = await load("control-store.mjs");
  const service = await openControlService(profile); await service.host.initialize(); await service.review.initialize();
  const ref = async name => {
    await writeFile(path.join(workspace, `${name}.md`), name);
    return { path: `${name}.md`, sha256: sha256(name) };
  };
  // Host inputs are openly fixture-owned; the test proves allocation/transport only.
  const acceptance = { schema: "work.product-acceptance.v1", id: "accepted", project: "fixture", task: "prior",
    owner: "owner", executor: "worker", status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: await ref("return"), artifact: await ref("artifact"), technicalProof: await ref("proof"), goal: await ref("goal"),
    retention: await Promise.all(["memory", "map", "tracker", "custody"].map(async id => ({ id, required: true, expected: await ref(id) }))) };
  const accept = id => service.host.accept({ ...acceptance, id });
  await accept("accepted");
  const helper = path.join(workspace, ".comparison-command.mjs"), helperBytes = await readFile(path.join(sourceRoot, "scripts/qualify-framework-comparison-command.mjs"));
  await writeFile(helper, helperBytes, { mode: 0o400 });
  const fixed = { workspace, files: {}, recipeSha256: hash("unused") }, helperSha256 = sha256(helperBytes);
  const args = { ...native, runtime, profile, transportSha256: hash({ fixed, helperSha256 }) };
  const budget = await openNativeReviewBudget(args), journal = await openControlStore(profile.review.directory);
  const claim = async (id = "accepted") => {
    const offer = await service.host.claimReview(id), sources = await openReviewSources(sourceFile);
    return { arm: "candidate", kind: "POST_ACCEPT_REVIEW", budgetId: budget.id, maxCalls: budget.maxCalls, calls: partitioned ? 3 : 1,
      runId: offer.runId, offerSha256: hash(offer), runtimeDigest: runtime.expectedDigest,
      sourceRoot: workspace, sourceRegistrySha256: sha256(await readFile(sourceFile)),
      sourceSnapshotDigest: (await sources.snapshot()).digest, transportSha256: args.transportSha256,
      nativeConfigSha256: hash(profile.review.native) };
  };
  const bridge = await openComparisonControl({ runtime, profile, fixed, helper, helperSha256, sharedBudget: budget,
    requests: [{ id: "unused", dependencies: [], request: { workspace, operation: "resume" } }],
    authenticateDispatch: async () => { throw Error("NO_SYNTHETIC_ACTOR_AUTHORITY"); } });
  const dispatchArgs = { ...native, arm: "candidate", role: "owner", binary: binary ?? process.execPath,
    authHome: path.join(controlRoot, "home"), provider,
    sourceRevision: (await readTurnSources({ ...native, arm: "candidate" })).sourceRevision,
    intent: { task: { id: "fixture", sha256: hash("fixture-only") }, commands: [], context: null } };
  return { base, native, service, args, budget, journal, claim, bridge, dispatchArgs, accept };
}

const nativeOptions = { skip: !binary || process.platform !== "darwin", timeout: 60000 };
test("partition batch reserves three calls atomically with respect to capacity and blocks until all settle", async t => {
  const { ledger } = await ledgerFixture(t, 4);
  const slots = await ledger.exclusive(lease => lease.reserveBatch("POST_ACCEPT_REVIEW", 3, async (number, index) => ({ index })));
  assert.deepEqual(slots.map(s => [s.number, s.calls]), [[1, 1], [2, 1], [3, 1]]);
  await settle(ledger, slots[0]); await settle(ledger, slots[1]);
  await assert.rejects(reserve(ledger), /NATIVE_UNRESOLVED_ALLOCATION/);
  await settle(ledger, slots[2]);
  await assert.rejects(ledger.exclusive(lease => lease.reserveBatch("POST_ACCEPT_REVIEW", 3, async () => ({}))), /NATIVE_ARM_CALL_CAP/);
  assert.equal((await ledger.inspect()).used, 3);
  assert.equal((await reserve(ledger)).number, 4);
});

test("partitioned shared review charges three real child dispatches and preserves historical settlements", nativeOptions, async t => {
  let x, mode = "role", reviewResponses = 0;
  const parts = reviewPartitions(3);
  const fake = await nativeProvider(t, async n => {
    if (mode === "role") return answerItem({ fixtureOnly: true });
    const response = ++reviewResponses;
    const used = (await x.budget.inspect()).used;
    assert.ok(used === 4 || used === 7, "all slots must exist before any child provider entry");
    return response % 2 ? codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'ledger'}));", `read-${n}`)
      : answerItem({ schema: "control.review-answer.v2", rowGroups: [{ ids: parts[(response / 2 - 1) % 3], status: "PASS",
        sourceIds: ["ledger"], reason: "Scripted partition transport only." }], newFindings: [], resolutions: [] });
  });
  x = await reviewFixture(t, fake.provider, true);
  assert.equal((await dispatchRole(x.dispatchArgs)).number, 1); mode = "review";
  assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  const first = await x.budget.inspect(), reviews = first.slots.slice(1), runId = reviews[0].allocation.runId;
  assert.equal(first.used, 4); assert.equal(first.blocked, false);
  assert.equal(first.slots[0].allocation.effort, "high"); assert.equal(first.slots[0].allocation.timeoutMs, 300000);
  assert.deepEqual(reviews.map(s => s.allocation.partitionIndex), [0, 1, 2]);
  assert.ok(reviews.every(s => s.receipt.sourceJournal.child.trace && s.receipt.status === "RECORDED"));
  const allocation = { ...reviews[0].allocation, calls: 3, allocations: reviews.map(s => s.allocation) };
  const observation = await x.service.review.observe(runId);
  const settled = await x.budget.settle({ allocation, entered: true, observation });
  await x.accept("second");
  assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  const reopened = await openNativeReviewBudget(x.args);
  assert.deepEqual(await reopened.settle({ allocation, entered: true, observation }), settled);
  assert.equal((await reopened.inspect()).used, 7);
  mode = "role"; assert.equal((await dispatchRole(x.dispatchArgs)).number, 8);
  assert.equal(fake.requests.length, 14, "eight CLI turns, including six actual review children; no paid inference");
  const child = reviews[1].receipt.sourceJournal.child, traceFile = path.join(child.directory, child.trace.file);
  const original = await readFile(traceFile); await writeFile(traceFile, "tampered");
  await assert.rejects(reopened.settle({ allocation, entered: true, observation }), /NATIVE_REVIEW_TRACE_MISMATCH|Unexpected token/);
  await writeFile(traceFile, original);
  const swapped = structuredClone(allocation); swapped.allocations[1] = swapped.allocations[0];
  await assert.rejects(reopened.settle({ allocation: swapped, entered: true, observation }), /NATIVE_REVIEW_ALLOCATION_MISMATCH/);
});

test("partial durable batch write stays charged and cannot be retried", async t => {
  const { ledger } = await ledgerFixture(t, 4);
  await assert.rejects(ledger.exclusive(lease => lease.reserveBatch("POST_ACCEPT_REVIEW", 3,
    async (number, index) => ({ padding: index === 1 ? "x".repeat(2 * 1024 * 1024) : "" }))), /NATIVE_LEDGER_CAPACITY/);
  assert.equal((await ledger.inspect()).used, 1); assert.equal((await ledger.inspect()).blocked, true);
  await assert.rejects(reserve(ledger), /NATIVE_UNRESOLVED_ALLOCATION/);
});

test("partition reservation refuses profile mismatch, stale bindings and orphan children before any spend", { skip: process.platform !== "darwin" }, async t => {
  const x = await reviewFixture(t, undefined, true);
  for (const changes of [{ partitionCount: 1 }, { partitionCount: 2 },
    { native: { ...x.args.profile.review.native, effort: "high" } },
    { native: { ...x.args.profile.review.native, timeoutMs: 90001 } }]) {
    const profile = { ...x.args.profile, review: { ...x.args.profile.review, ...changes } };
    await assert.rejects(openNativeReviewBudget({ ...x.args, profile }), /NATIVE_REVIEW_BUDGET_CONFIG_INVALID/);
  }
  await assert.rejects(openNativeReviewBudget({ ...x.args, profile: { ...x.args.profile, timeoutMs: 300000 } }),
    /NATIVE_REVIEW_BUDGET_CONFIG_INVALID/);
  const expected = await x.claim();
  for (const change of [{ calls: 1 }, { sourceSnapshotDigest: hash("wrong") }, { offerSha256: hash("wrong") }])
    await assert.rejects(x.budget.reserve({ ...expected, ...change }), /NATIVE_REVIEW_BINDING_MISMATCH/);
  const orphan = path.join(x.args.profile.review.directory, `${expected.runId}-part-0`);
  await mkdir(orphan, { mode: 0o700 });
  await assert.rejects(x.budget.reserve(expected), /NATIVE_REVIEW_UNCHARGED_CHILD/);
  assert.equal((await x.budget.inspect()).used, 0); assert.deepEqual(await readdir(orphan), []);
});

const scriptedPartitions = t => nativeProvider(t, async n => n % 2
  ? codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'ledger'}));", `read-${n}`)
  : answerItem({ schema: "control.review-answer.v2", rowGroups: [{ ids: reviewPartitions(3)[(n / 2 - 1) % 3], status: "PASS",
    sourceIds: ["ledger"], reason: "Scripted transport only." }], newFindings: [], resolutions: [] }));

test("partition preused parent and child spend cannot be imported into a fresh arm ledger", nativeOptions, async t => {
  const fake = await scriptedPartitions(t), x = await reviewFixture(t, fake.provider, true);
  assert.equal((await x.service.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  await x.accept("second"); const expected = await x.claim("second"), before = await x.journal.read();
  await assert.rejects(x.budget.reserve(expected), /NATIVE_REVIEW_UNCHARGED_HISTORY/);
  assert.equal((await x.budget.inspect()).used, 0); assert.deepEqual(await x.journal.read(), before);
  assert.equal(fake.requests.length, 6);
});

test("partition UNRESOLVED receipts cannot heal after late child completion and no reserved slot is refunded", nativeOptions, async t => {
  const fake = await scriptedPartitions(t), x = await reviewFixture(t, fake.provider, true), expected = await x.claim();
  const allocation = await x.budget.reserve(expected), observation = await x.service.review.observe(expected.runId);
  const original = await x.budget.settle({ allocation, entered: false, observation });
  assert.equal(original.outcome, "UNRESOLVED");
  const before = await x.budget.inspect();
  assert.equal(before.used, 3); assert.ok(before.slots.every(s => s.receipt.usage === "UNKNOWN"));
  const offer = { ...await x.service.host.reviewInput("accepted"), runId: expected.runId };
  await x.service.review.review(offer); // Deliberate late-effect injection, never a supported retry.
  const reopened = await openNativeReviewBudget(x.args);
  assert.deepEqual(await reopened.settle({ allocation, entered: false, observation: await x.service.review.observe(expected.runId) }), original);
  await assert.rejects(reopened.settle({ allocation, entered: true, observation }), /NATIVE_REVIEW_SETTLEMENT_MISMATCH/);
  assert.deepEqual(await reopened.inspect(), before);
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_PREVIOUS_TURN_FAILED/);
  assert.equal(fake.requests.length, 6);
});

test("failed first partition keeps all three slots held and unknown unstarted usage", nativeOptions, async t => {
  const fake = await nativeProvider(t, async n => n === 1
    ? codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'ledger'}));")
    : answerItem({ invalidFixtureVerdict: true }));
  const x = await reviewFixture(t, fake.provider, true);
  await x.bridge.tick();
  const state = await x.budget.inspect(), run = Object.values((await x.journal.read()).state.runs)[0];
  assert.equal(state.used, 3); assert.equal(state.blocked, true);
  assert.ok(state.slots.every(s => s.receipt.status === "UNRESOLVED"));
  assert.equal(run.actualDispatches, 1); assert.equal(run.parts.length, 0);
  assert.equal(state.slots[1].receipt.usage, "UNKNOWN"); assert.equal(state.slots[2].receipt.usage, "UNKNOWN");
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_PREVIOUS_TURN_FAILED/);
  assert.equal(fake.requests.length, 2);
});

test("partition settlement requires current sources and the exact protected child configuration", nativeOptions, async t => {
  const fake = await scriptedPartitions(t), x = await reviewFixture(t, fake.provider, true), expected = await x.claim();
  const allocation = await x.budget.reserve(expected);
  await x.service.review.review({ ...await x.service.host.reviewInput("accepted"), runId: expected.runId });
  const observation = await x.service.review.observe(expected.runId);
  const source = path.join(x.args.profile.config.workspace, "ledger.md"), original = await readFile(source);
  await writeFile(source, "changed after child completion");
  await assert.rejects(x.budget.settle({ allocation, entered: true, observation }), /NATIVE_REVIEW_SOURCE_CHANGED/);
  assert.ok((await x.budget.inspect()).slots.every(s => s.receipt === null));
  await writeFile(source, original); // Restore only our injected test corruption.
  const { openControlStore } = await import(pathToFileURL(path.join(x.args.runtime.packageRoot, "scripts/control-store.mjs")).href);
  const child = await openControlStore(allocation.allocations[1].childDirectory);
  await child.transact(state => ({ ...state, configKey: hash("foreign-profile") }));
  await assert.rejects(x.budget.settle({ allocation, entered: true, observation }), /NATIVE_REVIEW_CHILD_CONFIG_MISMATCH/);
  assert.equal((await x.budget.inspect()).used, 3);
  assert.ok((await x.budget.inspect()).slots.every(s => s.receipt === null));
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_UNRESOLVED_ALLOCATION/);
  assert.equal(fake.requests.length, 6);
});

test("extra runs in an already charged child journal cannot hide behind the parent settlement", nativeOptions, async t => {
  const fake = await scriptedPartitions(t), x = await reviewFixture(t, fake.provider, true);
  assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  const before = await x.budget.inspect(), a = before.slots[0].allocation;
  const { openControlStore } = await import(pathToFileURL(path.join(x.args.runtime.packageRoot, "scripts/control-store.mjs")).href);
  const child = await openControlStore(a.childDirectory);
  await child.transact(state => { state.calls++; state.runs.foreign = { state: "STOPPED" }; return state; });
  await x.accept("second"); const expected = await x.claim("second");
  await assert.rejects(x.budget.reserve(expected), /NATIVE_REVIEW_UNCHARGED_CHILD/);
  assert.deepEqual(await x.budget.inspect(), before);
  assert.equal(fake.requests.length, 6);
});

const scriptedReviewer = t => nativeProvider(t, async n => n % 2
  ? codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'ledger'}));", `read-${n}`)
  : answerItem({ schema: "control.review-answer.v2", rowGroups: [{ ids: [...controlCheckIds], status: "PASS",
    sourceIds: ["ledger"], reason: "Scripted transport-only evidence, not semantic qualification." }], newFindings: [], resolutions: [] }));

test("P2 preused review journal with uncharged runs rejects reservation without importing or resetting spend", nativeOptions, async t => {
  const fake = await scriptedReviewer(t), x = await reviewFixture(t, fake.provider);
  // Deliberately execute one selected REVIEW without the comparison bridge.
  const old = await x.service.tick();
  assert.equal(old.results[0].action, "OWNER_DISPOSITION_DUE");
  const journalBefore = await x.journal.read();
  assert.equal(journalBefore.state.calls, 1); assert.equal((await x.budget.inspect()).used, 0);
  await x.accept("next"); const expected = await x.claim("next");
  const reopened = await openNativeReviewBudget(x.args);
  await assert.rejects(reopened.reserve(expected), { message: "NATIVE_REVIEW_UNCHARGED_HISTORY" });
  assert.equal((await reopened.inspect()).used, 0);
  assert.deepEqual(await x.journal.read(), journalBefore);
  assert.equal(fake.requests.length, 2);
});

test("P2 old review settlement replays its original journal revision after the next review and reopen", nativeOptions, async t => {
  const fake = await scriptedReviewer(t), x = await reviewFixture(t, fake.provider);
  assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  const first = (await x.budget.inspect()).slots[0];
  const originalObservation = await x.service.review.observe(first.allocation.runId);
  const original = await x.budget.settle({ allocation: first.allocation, entered: true, observation: originalObservation });
  await x.accept("second");
  assert.equal((await x.bridge.tick()).results[0].action, "OWNER_DISPOSITION_DUE");
  const journalBefore = await x.journal.read(), ledgerBefore = await x.budget.inspect();
  assert.equal(journalBefore.state.calls, 2); assert.equal(ledgerBefore.used, 2);
  const currentObservation = await x.service.review.observe(first.allocation.runId);
  assert.notDeepEqual(currentObservation, originalObservation, "observation evidence includes the current journal digest");
  const reopened = await openNativeReviewBudget(x.args);
  assert.deepEqual(await reopened.settle({ allocation: first.allocation, entered: true, observation: currentObservation }), original);
  assert.deepEqual(await reopened.settle({ allocation: first.allocation, entered: true, observation: originalObservation }), original);
  await assert.rejects(reopened.settle({ allocation: first.allocation, entered: true,
    observation: { ...originalObservation, usage: "caller-invented" } }), { message: "NATIVE_REVIEW_OBSERVATION_MISMATCH" });
  await assert.rejects(reopened.settle({ allocation: first.allocation, entered: false, observation: originalObservation }),
    { message: "NATIVE_REVIEW_SETTLEMENT_MISMATCH" });
  const traceFile = path.join(x.args.profile.review.directory, first.receipt.sourceJournal.trace.file), traceBytes = await readFile(traceFile);
  await writeFile(traceFile, "changed historical trace");
  await assert.rejects(reopened.settle({ allocation: first.allocation, entered: true, observation: originalObservation }),
    { message: "NATIVE_REVIEW_TRACE_MISMATCH" });
  await writeFile(traceFile, traceBytes);
  assert.deepEqual(await reopened.inspect(), ledgerBefore);
  assert.deepEqual(await x.journal.read(), journalBefore);
  assert.equal(fake.requests.length, 4);
});

test("unresolved settlement stays spent and unchanged when its selected reviewer completes later", nativeOptions, async t => {
  const fake = await scriptedReviewer(t), x = await reviewFixture(t, fake.provider), expected = await x.claim();
  const allocation = await x.budget.reserve(expected), observation = await x.service.review.observe(expected.runId);
  const original = await x.budget.settle({ allocation, entered: false, observation });
  assert.equal(original.outcome, "UNRESOLVED");
  const receiptBefore = (await x.budget.inspect()).slots[0].receipt;
  // A late completion cannot retrospectively turn the original unknown receipt
  // into success, recover capacity, or erase its source-journal checkpoint.
  await x.service.review.review({ ...await x.service.host.reviewInput("accepted"), runId: expected.runId });
  const reopened = await openNativeReviewBudget(x.args);
  assert.deepEqual(await reopened.settle({ allocation, entered: false,
    observation: await x.service.review.observe(expected.runId) }), original);
  assert.deepEqual(await reopened.settle({ allocation, entered: false, observation }), original);
  await assert.rejects(reopened.settle({ allocation, entered: true,
    observation: await x.service.review.observe(expected.runId) }), { message: "NATIVE_REVIEW_SETTLEMENT_MISMATCH" });
  const state = await reopened.inspect();
  assert.equal(state.used, 1); assert.equal(state.blocked, true); assert.deepEqual(state.slots[0].receipt, receiptBefore);
  await assert.rejects(dispatchRole(x.dispatchArgs), { message: "NATIVE_PREVIOUS_TURN_FAILED" });
  assert.equal((await x.journal.read()).state.calls, 1); assert.equal(fake.requests.length, 2);
});

test("review reservation requires actual host claim and current bindings before consuming one arm slot", { skip: process.platform !== "darwin" }, async t => {
  const x = await reviewFixture(t);
  await assert.rejects(x.budget.reserve({ runId: "not-claimed" }), /NATIVE_REVIEW_CLAIM_REQUIRED/);
  const expected = await x.claim();
  for (const patch of [{ offerSha256: hash("wrong") }, { sourceSnapshotDigest: hash("wrong") }, { arm: "baseline" }, { maxCalls: 4 }])
    await assert.rejects(x.budget.reserve({ ...expected, ...patch }), /NATIVE_REVIEW_BINDING_MISMATCH/);
  assert.equal((await x.budget.inspect()).used, 0);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(x.budget.reserve(expected, { signal: abort.signal }), /NATIVE_REVIEW_CANCELLED/);
  const allocation = await x.budget.reserve(expected);
  assert.equal(allocation.number, 1); assert.equal((await x.journal.read()).state.calls, 0);
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_UNRESOLVED_ALLOCATION/);
  const reopened = await openNativeReviewBudget(x.args);
  await assert.rejects(reopened.settle({ allocation, entered: true, observation: { runId: expected.runId, state: "STOPPED", verdict: {} } }),
    /NATIVE_REVIEW_OBSERVATION_MISMATCH/);
  assert.equal((await reopened.inspect()).used, 1); assert.equal((await reopened.inspect()).blocked, true);
  const result = await reopened.settle({ allocation, entered: false, observation: await x.service.review.observe(expected.runId) });
  assert.equal(result.outcome, "UNRESOLVED"); assert.equal(result.armCallsUsed, 1);
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_PREVIOUS_TURN_FAILED/);
  assert.equal((await x.journal.read()).state.calls, 0);
});

test("source journal deletion or wrong allocation cannot settle, reset or release spend", { skip: process.platform !== "darwin" }, async t => {
  const x = await reviewFixture(t), expected = await x.claim(), allocation = await x.budget.reserve(expected);
  await assert.rejects(x.budget.settle({ allocation: { ...allocation, runId: "another-run" }, entered: false,
    observation: { state: "UNKNOWN" } }), /NATIVE_REVIEW_ALLOCATION_MISMATCH/);
  await rm(path.join(x.args.profile.review.directory, "0000000000.json"));
  await assert.rejects(x.budget.settle({ allocation, entered: false, observation: { runId: expected.runId, state: "UNKNOWN" } }));
  assert.equal((await x.budget.inspect()).used, 1); assert.equal((await x.budget.inspect()).blocked, true);
});

test("actual native roles and selected service REVIEW consume the same three-slot arm ceiling", {
  skip: !binary || process.platform !== "darwin", timeout: 60000
}, async t => {
  let x;
  const fake = await nativeProvider(t, async n => {
    if (n === 2) {
      const state = await x.budget.inspect();
      assert.equal(state.used, 2); assert.equal(state.slots[1].allocation.kind, "POST_ACCEPT_REVIEW");
      assert.equal(state.slots[1].receipt, null, "shared spend exists before native reviewer entry");
      return codeItem("const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[a.name]({id:'ledger'}));");
    }
    if (n === 3) return answerItem({ schema: "control.review-answer.v2", rowGroups: [{ ids: [...controlCheckIds], status: "PASS",
      sourceIds: ["ledger"], reason: "Scripted transport-only evidence; not semantic qualification." }], newFindings: [], resolutions: [] });
    return answerItem({ fixtureOnly: true });
  });
  x = await reviewFixture(t, fake.provider);
  const first = await dispatchRole(x.dispatchArgs); assert.equal(first.number, 1);
  const tick = await x.bridge.tick();
  assert.equal(tick.results[0].action, "OWNER_DISPOSITION_DUE", JSON.stringify(await x.budget.inspect()));
  const middle = (await x.budget.inspect()).slots[1];
  assert.equal(middle.receipt.status, "RECORDED"); assert.equal(middle.receipt.sourceJournal.runId, middle.allocation.runId);
  assert.ok(middle.receipt.sourceJournal.trace.sha256); assert.ok(middle.receipt.usage);
  assert.equal((await x.service.review.capacity()).used, 1);
  const third = await dispatchRole(x.dispatchArgs); assert.equal(third.number, 3);
  assert.equal((await readCompletedRoleOutput({ ...x.native, arm: "candidate", number: 3 })).role, "owner");
  await assert.rejects(readCompletedRoleOutput({ ...x.native, arm: "candidate", number: 2 }), /NATIVE_RECORD_BINDING_MISMATCH/);
  await assert.rejects(dispatchRole(x.dispatchArgs), /NATIVE_ARM_CALL_CAP/);
  assert.equal(fake.requests.length, 4, "three CLI turns, four scripted provider responses, no inference");
  const reopened = await openNativeReviewBudget(x.args);
  assert.equal((await reopened.inspect()).used, 3); assert.equal((await reopened.inspect()).remaining, 0);
  assert.equal((await x.bridge.tick()).calls, 0);
  // Publications retain their own append-only path and use the same existing lock.
  const ledger = await openComparisonLedger({ ...x.native, arm: "candidate", maxCalls: 3 });
  await ledger.exclusive(async () => {
    await assert.rejects(publishTurnSources({ ...x.native, arm: "candidate", expectedSourceRevision: x.dispatchArgs.sourceRevision,
      artifacts: [{ id: "after", purpose: "Scripted result", text: "after", origin: { kind: "parent-protocol-result",
        arm: "candidate", operation: "fixture", sha256: sha256("after") } }] }), { code: "EEXIST" });
  });
  assert.equal((await readTurnSources({ ...x.native, arm: "candidate" })).sourceRevision.sequence, 0);
  t.diagnostic("Fixture-owned actor outputs and verdict; proves shared durable accounting and selected transport, not semantic adoption.");
});
