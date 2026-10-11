// Independent lifecycle checks; scripted child observations never launch a model.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, realpath, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import {openPartitionModelReview} from "../scripts/control-partition-model-review.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {reviewPartitions, validateReviewPart} from "../scripts/control-review-partitions.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {controlCatalog} from "../scripts/control-catalog.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {inspectControlRuntime, stageControlRuntime} from "../scripts/control-runtime.mjs";
import {activateControl, acquireControlLease} from "../scripts/control-activation.mjs";
import {openControlService} from "../scripts/control-service.mjs";
import {switchControlRuntime} from "../scripts/control-cutover.mjs";
import {inspectControlRecovery} from "../scripts/control-recovery.mjs";

const hash = value => sha256(canonicalJson(value));
async function fixture(t, maxCalls = 6) {
  const temp = await realpath(await mkdtemp(path.join(tmpdir(), "partition-independent-")));
  t.after(() => rm(temp, {recursive: true, force: true}));
  const workspace = path.join(temp, "workspace"), root = path.join(temp, "control");
  for (const dir of [workspace, root, path.join(root, "review"), path.join(root, "room"), path.join(root, "home")])
    await mkdir(dir, {mode: 0o700});
  await writeFile(path.join(workspace, "source.md"), "Frozen synthetic source");
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "source", path: "source.md", purpose: "Independent lifecycle fixture"}]}), {mode: 0o600});
  const sourceEvidence = await (await openReviewSources(sourceFile)).snapshot();
  const options = {directory: path.join(root, "review"), controlRoot: root, sourceFile, reviewer: "reviewer",
    maxCalls, expiresAt: new Date(Date.now() + 60000).toISOString(), partitionCount: 3,
    native: {binary: "/never-launch-model", workspace: path.join(root, "room"), home: path.join(root, "home"),
      model: "no-inference", effort: "low", timeoutMs: 1000}, scope: {requiredSourceIds: ["source"]}};
  const offer = {runId: randomUUID(), key: hash(sourceEvidence), phase: "HEALTH", stateRevision: "fixture",
    input: {sourceEvidence, previousFindings: []}};
  return {temp, root, workspace, sourceFile, sourceEvidence, options, offer};
}

function scriptedChildren(x, {beforeReview, afterObserve, rawAnswer} = {}) {
  const dispatched = [], offers = [];
  const openSingle = async (options, ids) => {
    const index = reviewPartitions(3).findIndex(part => canonicalJson(part) === canonicalJson(ids));
    let observation;
    return {
      async initialize() {},
      async capacity() {return {remaining:1,used:0};},
      async review(offer, {signal} = {}) {
        dispatched.push(index); offers.push(structuredClone(offer));
        const failure = await beforeReview?.({index, offer, signal});
        if (failure) {observation = {state: failure.state}; throw Error(failure.reason);}
        const wireAnswer = rawAnswer ? rawAnswer(index, ids, offer) : {
          schema: "control.review-answer.v2", rowGroups: [{ids: [...ids], status: "NOT_APPLICABLE",
            sourceIds: ["source"], reason: "Protocol-only fixture; no semantic applicability established"}],
          newFindings: [], resolutions: []};
        const observedAt = new Date().toISOString();
        const verdict = validateReviewPart(wireAnswer, ids, {readbacks: x.sourceEvidence.rows, offer,
          reviewer: options.reviewer, observedAt});
        observation = {state: "STOPPED", runId: offer.runId, wireAnswer, verdict,
          readSources: x.sourceEvidence.rows, usage: {input_tokens: 1, output_tokens: 1}};
        return verdict;
      },
      async observe() {await afterObserve?.({index}); return structuredClone(observation);}
    };
  };
  return {openSingle, dispatched, offers};
}

test("complete union retains the exact offer and reserves three slots per review across restart", async t => {
  const x = await fixture(t), children = scriptedChildren(x);
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  const verdict = await review.review(x.offer);
  assert.equal(verdict.rows.length, 87); assert.deepEqual(children.dispatched, [0, 1, 2]);
  for (const offer of children.offers) assert.deepEqual(offer, x.offer);
  const reopened = await openPartitionModelReview(x.options, children.openSingle);
  assert.deepEqual((await reopened.observe(x.offer.runId)).verdict, verdict);
  assert.equal((await reopened.capacity()).remainingNativeCalls, 3);
  await assert.rejects(reopened.review(x.offer), /ALREADY_DISPATCHED/);
  const single = await openModelReview({...x.options, partitionCount: 1});
  await assert.rejects(single.capacity(), /CONFIG_MISMATCH/);
  await reopened.review({...x.offer, runId: randomUUID()});
  assert.equal((await reopened.capacity()).used, 6);
  await assert.rejects(reopened.review({...x.offer, runId: randomUUID()}), /BUDGET_EXHAUSTED/);
  assert.equal(children.dispatched.length, 6);
});

for (const phase of [undefined, "POST_ACCEPT", "HEALTH"])
  test(`complete partition verdict persists with host phase ${phase ?? "omitted"}`, async t => {
    const x = await fixture(t, 3);
    // Real POST_ACCEPT host offers omit phase. Keep the observed 87-row/six-finding
    // shape, but use only synthetic source text and scripted child observations.
    delete x.offer.phase;
    if (phase !== undefined) x.offer.phase = phase;
    const raw = reviewPartitions(3).map((ids, index) => ({schema: "control.review-answer.v2",
      rowGroups: ids.map((id, position) => position < 2 ? {
        ids: [id], status: "UNKNOWN", sourceIds: ["source"], findingId: `gap-${index}-${position}`,
        reason: "Synthetic retained coverage limit"
      } : {ids: [id], status: "PASS", sourceIds: ["source"]}),
      newFindings: ids.slice(0, 2).map((checkId, position) => ({id: `gap-${index}-${position}`,
        checkId, sourceIds: ["source"], evidence: "Synthetic retained coverage limit", owner: "owner",
        work: "Resolve the scoped evidence gap", reviewAt: "2099-01-01T00:00:00Z", blocksResume: false})),
      resolutions: []}));
    const children = scriptedChildren(x, {rawAnswer: index => structuredClone(raw[index])});
    const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
    const verdict = await review.review(x.offer);
    assert.equal(verdict.phase, phase === "HEALTH" ? "HEALTH" : "POST_ACCEPT");
    assert.doesNotThrow(() => canonicalJson(verdict));
    assert.equal(verdict.rows.length, 87); assert.equal(verdict.findings.length, 6);
    assert.ok(verdict.findings.every(f => f.status === "OPEN"));
    const reopened = await openPartitionModelReview(x.options, children.openSingle);
    const observed = await reopened.observe(x.offer.runId);
    assert.equal(observed.state, "STOPPED"); assert.equal(observed.reason, null);
    assert.deepEqual(observed.verdict, verdict);
    assert.deepEqual(observed.parts.map(part => part.observation.wireAnswer), raw);
    assert.equal((await reopened.capacity()).used, 3);
    await assert.rejects(reopened.review(x.offer), /ALREADY_DISPATCHED/);
    assert.deepEqual(children.dispatched, [0, 1, 2]);
  });

for (const state of ["STOPPED", "UNKNOWN"]) test(`failed second part ${state} never publishes a partial verdict or retries`, async t => {
  const x = await fixture(t), children = scriptedChildren(x, {
    beforeReview: ({index}) => index === 1 ? {state, reason: "SCRIPTED_PART_FAILURE"} : null});
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  await assert.rejects(review.review(x.offer), /SCRIPTED_PART_FAILURE/);
  assert.deepEqual(children.dispatched, [0, 1]);
  const row = (await (await openControlStore(x.options.directory)).read()).state.runs[x.offer.runId];
  assert.equal(row.state, state); assert.equal(row.verdict, undefined); assert.equal(row.completedParts, 1);
  assert.equal((await review.capacity()).used, 3);
  const reopened = await openPartitionModelReview(x.options, children.openSingle);
  assert.equal((await reopened.observe(x.offer.runId)).verdict, undefined);
  await assert.rejects(reopened.review(x.offer), /ALREADY_DISPATCHED/);
});

for (const mode of ["source", "registry"]) test(`${mode} drift between parts prevents subsequent dispatch and admission`, async t => {
  const x = await fixture(t);
  const children = scriptedChildren(x, {afterObserve: async ({index}) => {
    if (index !== 0) return;
    if (mode === "source") await writeFile(path.join(x.workspace, "source.md"), "Changed synthetic source");
    else {
      const registry = JSON.parse(await readFile(x.sourceFile, "utf8"));
      registry.sources[0].purpose = "Changed registry meaning";
      await writeFile(x.sourceFile, JSON.stringify(registry));
    }
  }});
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  await assert.rejects(review.review(x.offer), /SOURCE_DRIFT|REGISTRY_CHANGED/);
  assert.deepEqual(children.dispatched, [0]);
  assert.equal((await review.observe(x.offer.runId)).verdict, undefined);
});

test("concurrent offers cannot reserve more than the finite native allocation", async t => {
  const x = await fixture(t, 3), children = scriptedChildren(x);
  const a = await openPartitionModelReview(x.options, children.openSingle); await a.initialize();
  const b = await openPartitionModelReview(x.options, children.openSingle);
  const results = await Promise.allSettled([a.review(x.offer), b.review({...x.offer, runId: randomUUID()})]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.match(results.find(r => r.status === "rejected").reason.message, /BUDGET_EXHAUSTED/);
  assert.equal(children.dispatched.length, 3); assert.equal((await a.capacity()).used, 3);
});

test("cancellation after the final native result must prevent aggregate verdict publication", async t => {
  const x = await fixture(t), abort = new AbortController();
  const children = scriptedChildren(x, {afterObserve: ({index}) => {if (index === 2) abort.abort();}});
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  await assert.rejects(review.review(x.offer, {signal: abort.signal}), /CANCELLED/);
  assert.equal((await review.observe(x.offer.runId)).verdict, undefined);
});

test("cancellation during asynchronous final journal publication must not return success", async t => {
  const x = await fixture(t), abort = new AbortController(), children = scriptedChildren(x);
  let checks = 0;
  const signal = new Proxy(abort.signal, {get(target, key) {
    if (key === "aborted") {
      const value = target.aborted;
      // Initial check, two per part, final basis check, publication callback.
      // Deliver a real abort at its next await, without falsifying signal state.
      if (++checks === 9) queueMicrotask(() => abort.abort());
      return value;
    }
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  await assert.rejects(review.review(x.offer, {signal}), /CANCELLED/);
  assert.equal(abort.signal.aborted, true);
  assert.deepEqual(children.dispatched,[0,1,2]);
  assert.equal((await review.observe(x.offer.runId)).verdict, undefined);
});

test("aggregate root retains the source digest used by retained-review repair checks", async t => {
  const x = await fixture(t), children = scriptedChildren(x);
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  await review.review(x.offer);
  assert.equal((await review.observe(x.offer.runId)).sourceDigest, x.sourceEvidence.digest);
});

test("failed finding history survives all parts; closure without an independent retry remains rejected", async t => {
  const x = await fixture(t), parts = reviewPartitions(3), id = parts[0][0];
  const check = controlCatalog.flatMap(g => g.checks).find(c => c.id === id);
  const old = {id: "failed-original", checkId: id, area: id.split(".")[0], criterion: check.criterion,
    evidence: "Original immutable evidence", owner: "owner", work: "maintenance", status: "OPEN",
    firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 60000).toISOString(),
    blocksResume: true, attempts: 1, lastResult: "FAILED"};
  x.offer.input.previousFindings = [old];
  const children = scriptedChildren(x, {rawAnswer: (index, ids) => ({schema: "control.review-answer.v2",
    rowGroups: [...(index === 0 ? [{ids: [id], status: "FINDING", sourceIds: ["source"],
      reason: "Failed original repair remains open", findingId: old.id}] : []),
    {ids: ids.filter(c => c !== id), status: "NOT_APPLICABLE", sourceIds: ["source"],
      reason: "Protocol-only fixture; no semantic applicability established"}], newFindings: [], resolutions: []})});
  const review = await openPartitionModelReview(x.options, children.openSingle); await review.initialize();
  assert.deepEqual((await review.review(x.offer)).findings, [old]);
  const answer = {schema: "control.review-answer.v2", rowGroups: [{ids: [...parts[0]], status: "PASS",
    sourceIds: ["source"]}], newFindings: [], resolutions: [{id: old.id, sourceIds: ["source"], proof: "Claimed repair"}]};
  assert.throws(() => validateReviewPart(answer, parts[0], {offer: x.offer, readbacks: x.sourceEvidence.rows,
    reviewer: "reviewer", observedAt: new Date().toISOString()}), /EXPLICIT_RETRY/);
  assert.throws(() => validateReviewPart({...answer, rowGroups: [{ids: [...parts[1]], status: "PASS",
    sourceIds: ["source"]}]}, parts[1], {offer: x.offer, readbacks: x.sourceEvidence.rows,
    reviewer: "reviewer", observedAt: new Date().toISOString()}), /RESOLUTION_UNASSIGNED/);
});

test("partition journal remains readable by recovery and cutover reaches target validation with unused budget",
  {skip: process.platform !== "darwin", timeout: 30000}, async t => {
    const x = await fixture(t), packages = path.join(x.temp, "packages"); await mkdir(packages, {mode: 0o700});
    const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
    const observed = await inspectControlRuntime(sourceRoot);
    const staged = await stageControlRuntime({sourceRoot, directory: packages, workspace: x.workspace,
      expectedDigest: observed.digest});
    const profile = {schema: "control.service.v1", directory: path.join(x.root, "host"),
      config: {workspace: x.workspace, policy: sha256("policy"), owner: "owner", executor: "worker",
        reviewer: "reviewer", evidenceRegistry: x.sourceFile, health: {scope: "Independent synthetic cutover",
          intervalMs: 60000, maxBranches: 1, maxWorktrees: 1, triggerSourceIds: ["source"], repairTasks: ["maintenance"]}},
      review: x.options, timeoutMs: 4000, maxReviewsPerTick: 0};
    const descriptor = await activateControl({sourceRoot: staged.root, root: x.root,
      expectedDigest: staged.digest, profile});
    const service = await openControlService(profile); await service.host.pause(true);
    const release = await acquireControlLease(x.root);
    try {assert.equal((await inspectControlRecovery(descriptor.descriptorFile)).unknownRuns, 0);}
    finally {await release();}
    const before = await readFile(descriptor.descriptorFile);
    // An intentionally invalid target must be rejected AFTER current-budget
    // compatibility, not because partition capacity changed the native units.
    await assert.rejects(switchControlRuntime({descriptorFile: descriptor.descriptorFile,
      expectedOldDigest: staged.digest, packageRoot: staged.root, expectedDigest: sha256("invalid target digest"),
      actor: "operator", evidence: "Synthetic no-inference cutover check", noRacingSchedulerOperators: true},
    {readSchedule: async plan => ({state: "CLOSED", code: 113, output: "",
      errors: `Could not find service "${plan.label}" in domain for user gui: ${process.getuid()}`})}),
    /CONTROL_RUNTIME_DIGEST_MISMATCH/);
    assert.deepEqual(await readFile(descriptor.descriptorFile), before);
  });

function reasonWire(status = "FINDING") {
  const id = "C02.03", options = {readbacks: [
    {id: "current", status: "AVAILABLE", sha256: "a".repeat(64)},
    {id: "other", status: "AVAILABLE", sha256: "b".repeat(64)}],
  offer: {key: "c".repeat(64), input: {previousFindings: []}}, reviewer: "reviewer",
  observedAt: "2026-10-07T10:00:00Z"};
  const answer = {schema: "control.review-answer.v2", rowGroups: [
    {ids: [id], status, sourceIds: ["current"], findingId: "current-gap"}],
  newFindings: [{id: "current-gap", checkId: id, sourceIds: ["current"],
    evidence: "Deferred commitment lacks its recall owner and return condition.", owner: "owner", work: "tax-recall",
    reviewAt: "2026-10-08T10:00:00Z", blocksResume: false}], resolutions: []};
  return {id, options, answer};
}

test("wire reason derivation retains nonpassing status, current finding and explicit reason without mutation", () => {
  for (const status of ["FINDING", "UNKNOWN", "DEFERRED"]) {
    const {id, options, answer} = reasonWire(status), original = structuredClone(answer);
    const decoded = validateReviewPart(answer, [id], options);
    assert.equal(decoded.rows[0].reason, answer.newFindings[0].evidence);
    assert.equal(decoded.rows[0].status, status);
    assert.equal(decoded.findings[0].status, "OPEN");
    assert.equal(decoded.findings[0].blocksResume, false);
    assert.deepEqual(answer, original);
    answer.rowGroups[0].reason = "Explicit assessment must remain unchanged.";
    assert.equal(validateReviewPart(answer, [id], options).rows[0].reason, answer.rowGroups[0].reason);
  }
});

test("wire reason derivation rejects wrong identity, criterion, sources, old findings, exclusions and missing ownership", () => {
  for (const mutate of [
    a => {a.rowGroups[0].findingId = "different-finding";},
    a => {a.newFindings[0].checkId = "C02.02";},
    a => {a.newFindings[0].sourceIds = ["other"];},
    a => {a.newFindings[0].sourceIds = ["current", "other"];},
    a => {a.newFindings[0].sourceIds = ["unread"];},
    a => {a.newFindings[0].evidence = " ";},
    a => {delete a.newFindings[0].owner;},
    a => {delete a.newFindings[0].work;},
    a => {a.newFindings = [];},
    a => {a.rowGroups[0].status = "NOT_APPLICABLE";},
    a => {a.rowGroups[0].status = "PASS";}
  ]) {
    const {id, options, answer} = reasonWire(); mutate(answer);
    assert.throws(() => validateReviewPart(answer, [id], options));
  }
  const {id, options, answer} = reasonWire();
  options.offer.input.previousFindings = validateReviewPart(answer, [id], options).findings;
  answer.newFindings = [];
  assert.throws(() => validateReviewPart(answer, [id], options), /MISSING_REASON/);
});

test("wire reason derivation does not replace an explicit malformed reason with finding evidence", () => {
  for (const reason of [null, 0, false, {}, []]) {
    const {id, options, answer} = reasonWire(); answer.rowGroups[0].reason = reason;
    assert.throws(() => validateReviewPart(answer, [id], options), /MISSING_REASON/);
  }
});
