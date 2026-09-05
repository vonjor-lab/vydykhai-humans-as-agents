import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkPreparedContext, sha256, canonicalJson, compileExecutableBrief } from "../scripts/memory-brief.mjs";

const cli = fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url));
const sourceBytes = await readFile(new URL("./fixtures/retained-progress/events.json", import.meta.url), "utf8");
const expectedBytes = await readFile(new URL("./fixtures/retained-progress/expectations.json", import.meta.url), "utf8");
const events = JSON.parse(sourceBytes).events, frozen = JSON.parse(expectedBytes);
const hash = value => sha256(canonicalJson(value));
const sorted = values => [...values].sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);

async function fixture(t, { correction = false, verificationMode = "normal", actionBody = null, atomic = false } = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-context-run-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, value) => {
    const bytes = typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
    await writeFile(path.join(root, name), bytes);
    return { path: name, sha256: sha256(bytes) };
  };
  const exported = { schema: "context.events.v1", complete: true, events: events.slice(0, correction ? 4 : 3).map(e => ({
    id: e.id, authorKind: "human", body: e.assertions.map(a => a.text).join("\n") })) };
  const registry = { schema: "context.sources.v1", sources: [
    { id: "SOURCE-BUNDLE", path: "sources.json", scope: ["bundle"], kind: "events" },
    { id: "SOURCE-THEME", path: "theme-sources.json", scope: ["theme"], kind: "events" },
  ] };
  await put("sources.json", exported);
  await put("theme-sources.json", { schema: "context.events.v1", complete: true, events: [] });
  await put("source-set.json", registry);
  const routeBytes = '{"incoming":[],"outgoing":["consumer"]}\n';
  await put("routes.json", routeBytes);
  await put("theme.json", "unrelated theme\n");
  const dependencies = { schema: "context.dependencies.v1", dependencies: [
    { id: "routes-both-directions", path: "routes.json", scope: ["bundle"] },
    { id: "theme", path: "theme.json", scope: ["theme"] },
  ] };
  await put("dependencies.json", dependencies);
  const segment = "<!-- bundle:start -->\nAccepted buildBundle and source obligations.\n<!-- bundle:end -->";
  await put("shared.md", segment + "\nOther theme state.\n");
  const sharedRef = { path: "shared.md", sha256: sha256(segment), startMarker: "<!-- bundle:start -->", endMarker: "<!-- bundle:end -->" };
  const evidence = await put("owner-evidence.json", { reviewed: "Synthetic source meaning; no real human or model evaluation claimed." });
  let initialIntegration = null;
  const classifications = { schema: "context.classifications.v1", records: [] };
  const reviewRecord = async c => {
    const { review, integration, ...body } = c;
    c.review = await put(`source-review-${c.eventId}.json`, { schema: "context.source-review.v1",
      classificationSha256: hash(body), reviewer: "synthetic-reviewer", decision: "approved" });
  };
  const addRecord = async (e, integration = initialIntegration, localOwner = null) => {
    let offset = 0;
    const assertions = e.assertions.map(a => {
      const start = offset; offset += Buffer.byteLength(a.text) + 1;
      return { id: a.id, disposition: e.id === "S3" ? "deferred" : e.id === "S1" ? "accepted_capability" : "current_constraint",
        scope: ["bundle"], targetRef: "module:buildBundle", reason: "Source-derived synthetic fixture",
        supersededBy: null, ownerGate: e.id === "S3" ? "module-owner" : null, trigger: e.id === "S3" ? "module returns to scope" : null,
        sourceRange: { start, end: start + Buffer.byteLength(a.text), sha256: sha256(a.text) } };
    });
    const c = { sourceId: "SOURCE-BUNDLE", eventId: e.id, sourceSha256: hash(exported.events.find(x => x.id === e.id)),
      eventDisposition: "assertions", assertions, reason: "Reviewed source assertion inventory", localOwner,
      localTask: localOwner ? "TASK-1" : null, review: null, integration };
    await reviewRecord(c); classifications.records.push(c); return c;
  };
  for (const e of events.slice(0, correction ? 4 : 3)) await addRecord(e);
  const binding = c => {
    const { review, integration, ...body } = c;
    return { sourceId: c.sourceId, eventId: c.eventId, sha256: c.sourceSha256,
      classificationSha256: hash(body), reviewSha256: review.sha256 };
  };
  const approvePlan = async plan => {
    const { reviewRef, ...body } = plan;
    plan.reviewRef = await put(`integration-review-${hash(body)}.json`, { schema: "context.integration-review.v1",
      planSha256: hash(body), reviewer: "synthetic-reviewer", decision: "approved" });
  };
  const integrationPlan = { schema: "context.integration-plan.v1", owner: "orchestrator", reviewRef: null,
    sourceBindings: classifications.records.map(binding), artifacts: [sharedRef] };
  await approvePlan(integrationPlan);
  const planRef = await put("initial-plan.json", integrationPlan);
  initialIntegration = await put("initial-integration.json", { schema: "context.integration.v1", plan: planRef,
    sourceBindings: integrationPlan.sourceBindings, artifacts: integrationPlan.artifacts });
  for (const c of classifications.records) c.integration = initialIntegration;
  await put("classifications.json", classifications);
  const identity = await put("workspace-identity.json", { id: "synthetic-workspace" });
  const candidateCode = `export function buildBundle(input) {
  const entries = input.map(e => ({ id: e.id, label: e.label.trim() }));
  const seen = new Set();
  for (const e of entries) { const key = e.id.toLowerCase(); if (seen.has(key)) throw new Error('DUPLICATE_ID'); seen.add(key); }
  entries.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { schema: 'bundle/v1', entries, count: entries.length };
}\n`;
  await put("candidate.mjs", candidateCode);
  await put("action.mjs", actionBody ?? "import { appendFileSync } from 'node:fs'; appendFileSync('actions.log', 'called\\n');\n");
  const oracle = await put("oracle.json", { schema: "context.oracle.v1", examples: frozen.examples.map(e => ({
    id: e.id, sourceAssertionRefs: e.sourceAssertions, input: e.input, expected: e.expectedError ? { error: e.expectedError } : e.expected })) });
  const verifier = await put("verify.mjs", `import { readFileSync, appendFileSync } from 'node:fs';
import { buildBundle } from './candidate.mjs';
const oracle = JSON.parse(readFileSync('oracle.json', 'utf8'));
const ids = JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES);
appendFileSync('verifications.log', ids.join(',') + '\\n');
const observations = ids.filter(id => ${JSON.stringify(verificationMode)} !== 'missing' || id !== 'B2').map(id => {
  const example = oracle.examples.find(e => e.id === id);
  let observed; try { observed = buildBundle(example.input); } catch (e) { observed = { error: e.message }; }
  return { id, observed };
});
if (${JSON.stringify(verificationMode)} === 'mutate-candidate') appendFileSync('candidate.mjs', '\\n// changed during verification\\n');
console.log(JSON.stringify({ schema: 'context.observations.v1',
candidateSha256: ${JSON.stringify(verificationMode)} === 'stale-candidate' ? '0'.repeat(64) : process.env.VYDYKHAI_CANDIDATE_SHA256,
oracleSha256: ${JSON.stringify(verificationMode)} === 'stale-fixture' ? '0'.repeat(64) : process.env.VYDYKHAI_ORACLE_SHA256,
observations }));\n`);
  const command = script => ({ executable: process.execPath, args: [script], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
  const module = { schema: "context.module.v1", publicBoundary: "buildBundle", implementationFiles: ["candidate.mjs"],
    retainedExampleIds: ["B1", "B2"], oracle, verificationScript: verifier, verificationCommand: command("verify.mjs") };
  const moduleRef = await put("module.json", module);
  const task = { schema: "context.task.v1", id: "TASK-1", owner: "worker-1", workspace: root, identity,
    requiredCapabilities: ["retained-progress-v1"], enforcement: "reference", scope: ["bundle"], sourceSet: "source-set.json",
    classifications: "classifications.json", dependencies: "dependencies.json", module: moduleRef,
    memory: { publicBoundary: "buildBundle", items: [], atomicInput: null }, memoryReview: null,
    action: command("action.mjs"), newExampleIds: correction ? ["N1"] : [], candidateFiles: ["candidate.mjs"], allowLocalOverlay: false };
  const request = { schema: "context.request.v1", operation: "prepare", workspace: root, task: null, capsule: null, readback: null, integrationPlan: null };
  const extraInventory = [];
  const refresh = async () => {
    const all = classifications.records.flatMap(c => c.assertions).filter(a => a.disposition !== "evidence_only");
    const sourceText = Object.fromEntries(events.flatMap(e => e.assertions.map(a => [a.id, a.text])));
    task.memory.items = all.map((a, i) => ({ id: `ITEM-${i}`, text: sourceText[a.id], sourceAssertionRefs: [a.id] }));
    if (atomic) {
      task.memory.atomicInput = { authorityReceipt: { activeGraphId: "SYNTHETIC", activeGraphBodySha256: hash("graph"),
        retrievalSnapshotId: "REVIEW", retrievalSnapshotSha256: hash("review"), sourceRefs: ["SOURCE-BUNDLE"] },
        ordinaryPromptSha256: hash("task"), atomicItems: [{ id: "ATOMIC", kind: "ordered_action", atomic: true, allowFactoring: false,
          position: "before action", sourceRefs: ["SOURCE-BUNDLE"], clauses: all.map((a, i) => ({ id: `CLAUSE-${i}`, text: sourceText[a.id], sourceRefs: [a.id] })) }] };
      task.memory.items = [];
    }
    const atomicRender = task.memory.atomicInput ? compileExecutableBrief(task.memory.atomicInput).atomicRender : "";
    const advisory = task.memory.items.map(i => `<!-- context:item ${i.id} -->\n${i.text}\n<!-- context:item:end -->`).join("\n\n");
    const inventory = [...exported.events.map(e => ({ sourceId: "SOURCE-BUNDLE", eventId: e.id, sha256: hash(e), scope: registry.sources.find(s => s.id === "SOURCE-BUNDLE").scope })), ...extraInventory];
    const ranges = [];
    for (const s of registry.sources.filter(s => s.scope.includes("bundle"))) ranges.push({ sourceId: s.id, sha256: sha256(await readFile(path.join(root, s.path))) });
    const meaning = classifications.records.map(({ review, integration, ...c }) => c);
    task.memoryReview = await put("memory-review.json", { schema: "context.memory-review.v1", reviewer: "synthetic-reviewer", decision: "approved",
      sourceDigest: hash({ events: sorted(inventory), ranges: sorted(ranges) }), meaningDigest: hash(sorted(meaning)), contentDigest: sha256([atomicRender, advisory].filter(Boolean).join("\n\n")), publicBoundary: "buildBundle" });
    await put("classifications.json", classifications);
    request.task = await put("task.json", task);
  };
  await refresh();
  const run = async (operation = "prepare", extra = {}) => {
    const current = { ...request, operation, ...extra };
    await put("request.json", current);
    const processResult = spawnSync(process.execPath, [cli, "context-run", "--input", path.join(root, "request.json")], { encoding: "utf8", timeout: 10000 });
    assert.equal(processResult.error, undefined);
    assert.equal(processResult.stderr, "");
    const output = JSON.parse(processResult.stdout);
    return { ...output, exit: processResult.status, raw: processResult.stdout };
  };
  const prepare = async () => {
    const result = await run(); assert.equal(result.status, "PREPARED", result.raw);
    request.capsule = await put("capsule.json", result.capsule);
    request.readback = await put("readback.json", { schema: "context.readback.v1", worker: task.owner, taskSha256: request.task.sha256,
      capsuleSha256: request.capsule.sha256, capability: "retained-progress-v1", evidenceRef: evidence });
    return result;
  };
  return { root, put, run, prepare, refresh, reviewRecord, addRecord, task, request, module, registry, dependencies,
    exported, classifications, sharedRef, evidence, integrationPlan, candidateCode, extraInventory, binding, approvePlan };
}

const noAction = async f => assert.rejects(readFile(path.join(f.root, "actions.log")), { code: "ENOENT" });

test("supersession refuses dangling, self, cyclic, unresolved and partial-scope replacements before dispatch", async t => {
  for (const [mode, code] of [["dangling", "SUPERSESSION_SOURCE_MISSING"], ["self", "SUPERSESSION_CYCLE"],
    ["cycle", "SUPERSESSION_CYCLE"], ["unresolved", "SUPERSESSION_UNRESOLVED"], ["partial", "SUPERSESSION_SCOPE_GAP"]]) {
    const f = await fixture(t, { correction: true });
    const old = f.classifications.records.find(c => c.eventId === "S2");
    const next = f.classifications.records.find(c => c.eventId === "S4");
    old.assertions[0].disposition = "superseded";
    old.assertions[0].supersededBy = mode === "dangling" ? "SOURCE-THAT-DOES-NOT-EXIST" : mode === "self" ? "S2:1" : "S4:1";
    if (mode === "cycle") { next.assertions[0].disposition = "superseded"; next.assertions[0].supersededBy = "S2:1"; }
    if (mode === "unresolved") next.assertions[0].disposition = "unresolved";
    if (mode === "partial") {
      f.registry.sources[0].scope = ["bundle", "theme"]; old.assertions[0].scope = ["bundle", "theme"];
      await f.put("source-set.json", f.registry);
    }
    // Local reviewed revisions exercise the supersession gate independently of stale integration.
    f.task.allowLocalOverlay = true;
    for (const c of [old, next]) {
      c.integration = null; c.localOwner = f.task.owner; c.localTask = f.task.id; await f.reviewRecord(c);
    }
    await f.refresh();
    const result = await f.run();
    assert.equal(result.code, mode === "unresolved" ? "SOURCE_UNRESOLVED" : code, result.raw);
    assert.equal(result.stats.dependentCommands, 0); await noAction(f);
  }
});

test("reviewed full-scope supersession integrates and retains the replacement while omitting the old assertion", async t => {
  const f = await fixture(t, { correction: true });
  const old = f.classifications.records.find(c => c.eventId === "S2");
  old.assertions[0].disposition = "superseded"; old.assertions[0].supersededBy = "S4:1";
  await f.reviewRecord(old); await f.refresh();
  assert.equal((await f.run()).code, "INTEGRATION_SOURCE_MISMATCH");
  const segment = "<!-- bundle:start -->\nS2:1 superseded by source-backed S4:1 for bundle; retain case-insensitive duplicate rejection.\n<!-- bundle:end -->";
  await f.put("shared.md", segment);
  const plan = { ...f.integrationPlan, sourceBindings: f.classifications.records.map(f.binding), artifacts: [{ ...f.sharedRef, sha256: sha256(segment) }] };
  await f.approvePlan(plan);
  const integrated = await f.run("integrate", { integrationPlan: await f.put("new-plan.json", plan) });
  assert.equal(integrated.status, "VERIFIED", integrated.raw);
  const receipt = await f.put("new-integration.json", integrated.receipt);
  for (const c of f.classifications.records) c.integration = receipt;
  await f.refresh();
  f.task.memory.items = f.task.memory.items.filter(i => !i.sourceAssertionRefs.includes("S2:1"));
  const review = JSON.parse(await readFile(path.join(f.root, f.task.memoryReview.path), "utf8"));
  review.contentDigest = sha256(f.task.memory.items.map(i => `<!-- context:item ${i.id} -->\n${i.text}\n<!-- context:item:end -->`).join("\n\n"));
  f.task.memoryReview = await f.put("memory-review.json", review); f.request.task = await f.put("task.json", f.task);
  const p = await f.prepare();
  assert.ok(!p.coverageBasis.requiredAssertionIds.includes("S2:1"));
  assert.ok(p.coverageBasis.requiredAssertionIds.includes("S4:1"));
  assert.equal((await f.run("resume")).status, "ACTION_COMPLETED");
});

test("new reviewed classification cannot reuse an old integration receipt or old plan", async t => {
  const f = await fixture(t);
  const c = f.classifications.records.find(c => c.eventId === "S3");
  const before = await readFile(path.join(f.root, "shared.md"));
  c.assertions[0].trigger = "Only after a new explicit shaping decision";
  c.assertions[0].reason = "New reviewed interpretation, not yet integrated";
  await f.reviewRecord(c); await f.refresh();
  for (const operation of ["prepare", "resume"]) {
    const result = await f.run(operation);
    assert.equal(result.code, "INTEGRATION_SOURCE_MISMATCH", result.raw); assert.equal(result.stats.commands, 0);
  }
  const result = await f.run("integrate", { integrationPlan: await f.put("old-plan.json", f.integrationPlan) });
  assert.equal(result.code, "INTEGRATION_SOURCE_MISMATCH"); assert.equal(result.stats.commands, 0);
  assert.deepEqual(await readFile(path.join(f.root, "shared.md")), before); await noAction(f);
});

test("integration requires approved exact-plan review, rejecting empty, missing, foreign and stale approvals", async t => {
  for (const mode of ["empty", "missing", "foreign", "rejected", "stale-artifact", "stale-classification", "stale-review"]) {
    const f = await fixture(t);
    const plan = structuredClone(f.integrationPlan);
    if (mode === "empty") plan.reviewRef = await f.put("bad-review.json", {});
    if (mode === "missing") plan.reviewRef = { path: "missing.json", sha256: "0".repeat(64) };
    if (["foreign", "rejected"].includes(mode)) {
      const { reviewRef, ...body } = plan;
      plan.reviewRef = await f.put("bad-review.json", { schema: "context.integration-review.v1", reviewer: "synthetic-reviewer",
        decision: mode === "rejected" ? "rejected" : "approved", planSha256: mode === "foreign" ? "0".repeat(64) : hash(body) });
    }
    if (mode === "stale-artifact") plan.artifacts[0].sha256 = "0".repeat(64);
    if (mode === "stale-classification") plan.sourceBindings[0].classificationSha256 = "0".repeat(64);
    if (mode === "stale-review") plan.sourceBindings[0].reviewSha256 = "0".repeat(64);
    const planRef = await f.put("bad-plan.json", plan);
    const result = await f.run("integrate", { integrationPlan: planRef });
    assert.equal(result.status, "BLOCKED", mode); assert.equal(result.stats.commands, 0); assert.equal(result.receipt, undefined);
    if (!["empty", "missing"].includes(mode)) assert.equal(result.code, "INTEGRATION_REVIEW_MISMATCH", result.raw);
    // A hand-assembled receipt cannot bypass the same approval gate on prepare.
    const receipt = await f.put("bad-integration.json", { schema: "context.integration.v1", plan: planRef,
      sourceBindings: plan.sourceBindings, artifacts: plan.artifacts });
    for (const c of f.classifications.records) c.integration = receipt;
    await f.refresh();
    const prepared = await f.run(); assert.equal(prepared.status, "BLOCKED", mode); assert.equal(prepared.stats.commands, 0);
    await noAction(f);
  }
});

test("frozen source events and behavioral expectations retain their original hashes", () => {
  assert.equal(sha256(sourceBytes), "57df457e379d3d3181bb0fe88c928c08a133d007a917477aeafa4d002729b030");
  assert.equal(sha256(expectedBytes), "6f7b87202d542126ce95408f88808326ecf181e668829ba27547c75fef76951b");
});

test("prepared context rejects an absent independent source inventory", () => {
  const result = checkPreparedContext({});
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.code, "CONTEXT_SCHEMA_INVALID");
});

test("actual CLI prepares and reuses a context before invoking the accepted local command", async t => {
  const f = await fixture(t); const first = await f.prepare();
  assert.equal(first.stats.commands, 0);
  const resumed = await f.run("resume");
  assert.equal(resumed.status, "ACTION_COMPLETED", resumed.raw);
  assert.equal(resumed.stats.compiles, 0);
  assert.equal(resumed.stats.dependentCommands, 1);
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
});

test("raw source omitted before compilation stays pending even without a graph node", async t => {
  const f = await fixture(t);
  f.classifications.records = f.classifications.records.filter(c => c.eventId !== "S2");
  await f.put("classifications.json", f.classifications);
  const result = await f.run();
  assert.equal(result.code, "SOURCE_RANGE_PENDING"); assert.equal(result.stats.commands, 0); await noAction(f);
});

test("complete inventory with an omitted advisory assertion cannot prepare", async t => {
  const f = await fixture(t);
  f.task.memory.items = f.task.memory.items.filter(i => !i.sourceAssertionRefs.includes("S2:1"));
  f.request.task = await f.put("task.json", f.task);
  assert.equal((await f.run()).code, "BRIEF_ASSERTION_MISSING"); await noAction(f);
});

test("actual compiler output is checked for a source dropped from the atomic input", async t => {
  const f = await fixture(t, { atomic: true });
  f.task.memory.atomicInput.atomicItems[0].clauses = f.task.memory.atomicInput.atomicItems[0].clauses.filter(c => !c.sourceRefs.includes("S2:1"));
  f.request.task = await f.put("task.json", f.task);
  const result = await f.run(); assert.equal(result.code, "BRIEF_ASSERTION_MISSING");
  assert.equal(result.stats.compiles, 1); await noAction(f);
});

test("atomic capsule continuation does not recompile its preserved v1 envelope", async t => {
  const f = await fixture(t, { atomic: true }); assert.equal((await f.prepare()).stats.compiles, 1);
  const result = await f.run("resume"); assert.equal(result.status, "ACTION_COMPLETED", result.raw); assert.equal(result.stats.compiles, 0);
});

test("unrelated source, dependency and shared-document edits preserve reuse", async t => {
  const f = await fixture(t); await f.prepare();
  await f.put("theme-sources.json", "not even a usable unrelated export");
  await f.put("theme.json", "changed unrelated dependency");
  const shared = await readFile(path.join(f.root, "shared.md"), "utf8");
  await f.put("shared.md", shared + "Unrelated section changed.\n");
  const result = await f.run("resume"); assert.equal(result.status, "ACTION_COMPLETED", result.raw); assert.equal(result.stats.compiles, 0);
});

test("new incoming consumer, source membership and source revision invalidate only the relevant context", async t => {
  for (const change of ["consumer", "membership", "revision"]) {
    const f = await fixture(t); await f.prepare();
    if (change === "consumer") await f.put("routes.json", { incoming: ["new-consumer"], outgoing: ["consumer"] });
    if (change === "membership") {
      f.registry.sources.push({ id: "NEW-SOURCE", path: "new-source.json", scope: ["bundle"], kind: "events" });
      await f.put("new-source.json", { schema: "context.events.v1", complete: true, events: [] }); await f.put("source-set.json", f.registry);
    }
    if (change === "revision") { f.exported.events[1].body += " Changed."; await f.put("sources.json", f.exported); }
    const result = await f.run("resume");
    assert.equal(result.status, "BLOCKED", change); assert.equal(result.stats.commands, 0); await noAction(f);
  }
});

test("missing, forged and old worker readback cannot invoke a dependent command", async t => {
  const f = await fixture(t); await f.prepare();
  assert.equal((await f.run("resume", { readback: null })).code, "WORKER_READBACK_REQUIRED");
  f.request.readback = await f.put("readback.json", { schema: "context.readback.v1", worker: f.task.owner,
    taskSha256: f.request.task.sha256, capsuleSha256: f.request.capsule.sha256, capability: "older-contract", evidenceRef: f.evidence });
  assert.equal((await f.run("resume")).code, "WORKER_READBACK_MISMATCH"); await noAction(f);
});

test("request flags cannot downgrade a pinned capability or self-promote the file adapter to host", async t => {
  const f = await fixture(t);
  assert.equal((await f.run("prepare", { skipGate: true })).code, "CONTEXT_SCHEMA_INVALID");
  for (const enforcement of ["host", "workflow"]) {
    f.task.enforcement = enforcement; f.request.task = await f.put("task.json", f.task);
    const result = await f.run(); assert.equal(result.status, "LIMITED"); assert.equal(result.exit, 2); assert.equal(result.stats.commands, 0);
  }
  await noAction(f);
});

test("bad pin, traversal, symlink, workspace identity and malformed source refs fail without commands or source dumping", async t => {
  const f = await fixture(t);
  assert.equal((await f.run("prepare", { task: { ...f.request.task, sha256: "0".repeat(64) } })).code, "ARTIFACT_HASH_MISMATCH");
  assert.equal((await f.run("prepare", { task: { ...f.request.task, path: "../task.json" } })).code, "ARTIFACT_PATH_INVALID");
  await symlink(path.join(f.root, "task.json"), path.join(f.root, "alias.json"));
  assert.equal((await f.run("prepare", { task: { ...f.request.task, path: "alias.json" } })).code, "ARTIFACT_SYMLINK_UNSUPPORTED");
  await f.put("workspace-identity.json", "changed");
  assert.equal((await f.run()).code, "WORKSPACE_IDENTITY_MISMATCH"); await noAction(f);
});

test("source ranges and semantic review pins are checked against the actual files", async t => {
  const f = await fixture(t);
  f.classifications.records[0].assertions[0].sourceRange.sha256 = "0".repeat(64);
  await f.put("classifications.json", f.classifications);
  assert.equal((await f.run()).code, "SOURCE_ASSERTION_RANGE_MISMATCH"); await noAction(f);
});

test("source visibility LIMITED never calls commands", async t => {
  const f = await fixture(t); f.exported.complete = false; await f.put("sources.json", f.exported);
  const result = await f.run(); assert.equal(result.status, "LIMITED"); assert.equal(result.stats.commands, 0); await noAction(f);
});

test("verification runs through CLI on the actual candidate and checks retained plus new observations", async t => {
  const f = await fixture(t, { correction: true }); await f.prepare();
  const result = await f.run("accept");
  assert.equal(result.status, "VERIFIED", result.raw); assert.equal(result.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.equal(result.stats.verificationCommands, 1); assert.equal(result.stats.dependentCommands, 0);
  assert.deepEqual(result.receipt.observations.map(o => o.id), ["B1", "B2", "N1"]);
  assert.equal(await readFile(path.join(f.root, "verifications.log"), "utf8"), "B1,B2,N1\n");
  assert.match(result.returnSync, /vydykhai:return-sync v1/);
});

test("internal-stage candidate cannot pass the accepted full-module behavior oracle", async t => {
  const f = await fixture(t); await f.put("candidate.mjs", "export function buildBundle(input) { return input.map(e => ({...e, label:e.label.trim()})); }\n");
  await f.prepare(); const result = await f.run("accept"); assert.equal(result.code, "BEHAVIOR_MISMATCH");
  assert.equal(result.stats.verificationCommands, 1); await noAction(f);
});

test("candidate cannot replace the accepted public module binding with an internal pass", async t => {
  const f = await fixture(t); f.task.memory.publicBoundary = "normalizeEntries"; f.request.task = await f.put("task.json", f.task);
  assert.equal((await f.run()).code, "PUBLIC_BOUNDARY_MISMATCH"); await noAction(f);
});

test("missing retained observations and stale candidate/fixture bindings cannot create an acceptance receipt", async t => {
  for (const [mode, code] of [["missing", "BEHAVIOR_EVIDENCE_MISSING"], ["stale-candidate", "CANDIDATE_EVIDENCE_BINDING_MISMATCH"], ["stale-fixture", "CANDIDATE_EVIDENCE_BINDING_MISMATCH"]]) {
    const f = await fixture(t, { verificationMode: mode }); await f.prepare(); const result = await f.run("accept");
    assert.equal(result.code, code); assert.equal(result.receipt, undefined); assert.equal(result.stats.dependentCommands, 0);
  }
});

test("verification script and oracle pin changes fail before verification execution", async t => {
  for (const name of ["verify.mjs", "oracle.json"]) {
    const f = await fixture(t); await f.prepare(); await f.put(name, "changed input");
    const result = await f.run("accept"); assert.equal(result.status, "BLOCKED"); assert.equal(result.stats.commands, 0);
  }
});

test("timeout, output cap and failing commands return structured errors without raw output", async t => {
  for (const [body, expected] of [
    ["setInterval(() => {}, 1000);", "COMMAND_TIMEOUT"],
    ["process.stdout.write('SYNTHETIC-SENSITIVE-MARKER'.repeat(10000));", "COMMAND_OUTPUT_LIMIT"],
    ["console.error('SYNTHETIC-SENSITIVE-MARKER'); process.exit(1);", "COMMAND_FAILED"],
  ]) {
    const f = await fixture(t, { actionBody: body }); f.task.action.timeoutMs = expected === "COMMAND_TIMEOUT" ? 500 : 3000; f.task.action.maxOutputBytes = 1024;
    f.request.task = await f.put("task.json", f.task); await f.prepare(); const result = await f.run("resume");
    assert.equal(result.code, expected, result.raw); assert.doesNotMatch(result.raw, /SYNTHETIC-SENSITIVE-MARKER/);
    assert.equal(result.stats.dependentCommands, 1); // Command ran; failure does not erase the invocation.
    assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN"); assert.equal(result.replayRequiresReconciliation, true);
  }
});

test("assertion applicability cannot escape the independently declared source scope", async t => {
  const f = await fixture(t);
  const record = f.classifications.records.find(c => c.eventId === "S2");
  record.assertions[0].scope = ["theme"];
  record.integration = null; record.localOwner = f.task.owner; record.localTask = f.task.id; f.task.allowLocalOverlay = true;
  await f.reviewRecord(record); await f.refresh();
  const result = await f.run(); assert.equal(result.code, "ASSERTION_SCOPE_OUTSIDE_SOURCE");
  assert.equal(result.stats.commands, 0); await noAction(f);
});

test("duplicate JSON keys and interpreted shell commands are rejected before invocation", async t => {
  const f = await fixture(t);
  await f.put("duplicate.json", JSON.stringify({ ...f.request, operation: "prepare" }).replace('"operation":"prepare"', '"operation":"prepare","operation":"resume"'));
  const processResult = spawnSync(process.execPath, [cli, "context-run", "--input", path.join(f.root, "duplicate.json")], { encoding: "utf8" });
  assert.equal(JSON.parse(processResult.stdout).code, "JSON_DUPLICATE_KEY");
  f.task.action.executable = "/bin/sh"; f.task.action.args = ["-c", "touch should-not-exist"];
  f.request.task = await f.put("task.json", f.task);
  assert.equal((await f.run()).code, "SHELL_COMMAND_UNSUPPORTED"); await noAction(f);
});

test("verification cannot accept a candidate modified while its command runs", async t => {
  const f = await fixture(t, { verificationMode: "mutate-candidate" }); await f.prepare();
  const result = await f.run("accept"); assert.equal(result.code, "CANDIDATE_CHANGED_DURING_VERIFICATION");
  assert.equal(result.stats.verificationCommands, 1); assert.equal(result.receipt, undefined);
});

test("an explicitly reviewed NO_CHANGE advances source accounting without a shared artifact rewrite", async t => {
  const f = await fixture(t);
  const sharedBefore = await readFile(path.join(f.root, "shared.md"), "utf8");
  const e = { id: "CONTROL", authorKind: "artifact", body: "No semantic change; the accepted bundle and all its requirements are unchanged." };
  f.exported.events.push(e); await f.put("sources.json", f.exported);
  const c = { sourceId: "SOURCE-BUNDLE", eventId: e.id, sourceSha256: hash(e), eventDisposition: "no_change",
    assertions: [], reason: "Explicit reviewed no-change receipt", localOwner: null, localTask: null, review: null, integration: null };
  await f.reviewRecord(c); f.classifications.records.push(c); await f.refresh();
  const result = await f.prepare(); assert.equal(result.status, "PREPARED");
  assert.deepEqual(result.sourceReceipt.classifiedPrefixes[0].eventIds, ["S1", "S2", "S3", "CONTROL"]);
  assert.equal(await readFile(path.join(f.root, "shared.md"), "utf8"), sharedBefore);
});

test("owning correction verifies through CLI; Return and approved shared readback unblock the next task", async t => {
  const f = await fixture(t);
  const s4 = events.find(e => e.id === "S4");
  f.exported.events.push({ id: s4.id, authorKind: "human", body: s4.assertions.map(a => a.text).join("\n") });
  await f.put("sources.json", f.exported);
  let result = await f.run();
  assert.equal(result.code, "SOURCE_RANGE_PENDING");
  assert.deepEqual(result.sourceReceipt.classifiedPrefixes[0].eventIds, ["S1", "S2", "S3"]);
  const correction = await f.addRecord(s4, null, "worker-1");
  f.task.allowLocalOverlay = true; f.task.newExampleIds = ["N1"];
  await f.refresh();
  // A different task using the same worker cannot inherit the local exception.
  f.task.id = "TASK-2"; f.request.task = await f.put("task.json", f.task);
  assert.equal((await f.run()).code, "SHARED_INTEGRATION_PENDING");
  f.task.id = "TASK-1"; f.request.task = await f.put("task.json", f.task);
  await f.prepare();
  const accepted = await f.run("accept");
  assert.equal(accepted.status, "VERIFIED", accepted.raw);
  assert.deepEqual(accepted.receipt.pendingIntegrationSources.map(s => s.eventId), ["S4"]);
  assert.match(accepted.returnSync, /SOURCE-BUNDLE\/S4/);
  await f.put("return.md", accepted.returnSync);
  const returnId = accepted.returnSync.match(/^Return receipt id: (.+)$/m)[1];
  f.registry.sources.push({ id: "TASK-RETURN", path: "return.md", scope: ["bundle"], kind: "return" });
  await f.put("source-set.json", f.registry);
  f.task.id = "TASK-2"; f.task.allowLocalOverlay = false;
  f.request.task = await f.put("task.json", f.task);
  f.request.capsule = null; f.request.readback = null;
  assert.equal((await f.run()).code, "SOURCE_RANGE_PENDING");
  const returned = { sourceId: "TASK-RETURN", eventId: returnId,
    sourceSha256: hash({ id: returnId, authorKind: "worker", body: accepted.returnSync }), eventDisposition: "evidence_only",
    assertions: [], reason: "Returned verification and correction S4; source meaning remains independently classified",
    localOwner: null, localTask: null, review: null, integration: null };
  await f.reviewRecord(returned); f.classifications.records.push(returned);
  f.extraInventory.push({ sourceId: returned.sourceId, eventId: returnId, sha256: returned.sourceSha256, scope: ["bundle"] });
  await f.refresh();
  result = await f.run(); assert.equal(result.code, "SHARED_INTEGRATION_PENDING"); assert.equal(result.reference, "SOURCE-BUNDLE/S4");
  const updatedSegment = "<!-- bundle:start -->\nAccepted buildBundle; S4 supersedes case-sensitive duplicate detection.\n<!-- bundle:end -->";
  const updatedRef = { ...f.sharedRef, sha256: sha256(updatedSegment) };
  const plan = { schema: "context.integration-plan.v1", owner: "orchestrator", reviewRef: null,
    sourceBindings: f.classifications.records.filter(c => c.sourceId === "SOURCE-BUNDLE").map(f.binding), artifacts: [updatedRef] };
  await f.approvePlan(plan);
  const planRef = await f.put("integration-plan.json", plan);
  result = await f.run("integrate", { integrationPlan: planRef });
  assert.equal(result.code, "INTEGRATION_READBACK_MISMATCH");
  await f.put("shared.md", updatedSegment + "\nUnrelated state.\n"); // Orchestrator-owned write, never CLI/executor.
  result = await f.run("integrate", { integrationPlan: planRef });
  assert.equal(result.status, "VERIFIED", result.raw); assert.equal(result.stats.commands, 0);
  const integrated = await f.put("integrated.json", result.receipt);
  for (const c of f.classifications.records.filter(c => c.sourceId === "SOURCE-BUNDLE")) c.integration = integrated;
  await f.refresh();
  const next = await f.prepare();
  assert.ok(next.coverageBasis.requiredAssertionIds.includes("S4:1"));
  assert.deepEqual(next.sourceReceipt.classifiedPrefixes[0].eventIds, ["S1", "S2", "S3", "S4"]);
  result = await f.run("resume"); assert.equal(result.status, "ACTION_COMPLETED", result.raw);
  assert.equal(correction.sourceSha256, hash(f.exported.events.at(-1))); // Supersession source retained.
});
