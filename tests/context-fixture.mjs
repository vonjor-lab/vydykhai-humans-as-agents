import assert from "node:assert/strict";
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

async function fixture(t, { correction = false, verificationMode = "normal", actionBody = null, atomic = false, omitInputMember = false,
  sourceRoot = null, preparation = true } = {}) {
  assert.ok(sourceRoot === null || path.isAbsolute(sourceRoot));
  assert.equal(typeof preparation, "boolean");
  const selectedCli = sourceRoot === null ? cli : path.join(sourceRoot, "scripts/vydykhai.mjs");
  const fixtureEvents = sourceRoot === null ? events : JSON.parse(await readFile(path.join(sourceRoot, "tests/fixtures/retained-progress/events.json"), "utf8")).events;
  const fixtureFrozen = sourceRoot === null ? frozen : JSON.parse(await readFile(path.join(sourceRoot, "tests/fixtures/retained-progress/expectations.json"), "utf8"));
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-context-run-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, value) => {
    const bytes = typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
    await writeFile(path.join(root, name), bytes);
    return { path: name, sha256: sha256(bytes) };
  };
  const exported = { schema: "context.events.v1", complete: true, events: fixtureEvents.slice(0, correction ? 4 : 3).map(e => ({
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
  const evidence = preparation ? await put("owner-evidence.json", { reviewed: "Synthetic source meaning; no real human or model evaluation claimed." }) : null;
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
  if (preparation) for (const e of fixtureEvents.slice(0, correction ? 4 : 3)) await addRecord(e);
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
  if (preparation) await approvePlan(integrationPlan);
  const planRef = preparation ? await put("initial-plan.json", integrationPlan) : null;
  initialIntegration = preparation ? await put("initial-integration.json", { schema: "context.integration.v1", plan: planRef,
    sourceBindings: integrationPlan.sourceBindings, artifacts: integrationPlan.artifacts }) : null;
  for (const c of classifications.records) c.integration = initialIntegration;
  if (preparation) await put("classifications.json", classifications);
  const identity = preparation ? await put("workspace-identity.json", { id: "synthetic-workspace" }) : null;
  const candidateCode = `export function buildBundle(input) {
  const entries = input.map(e => ({ id: e.id, label: e.label.trim() }));
  const seen = new Set();
  for (const e of entries) { const key = e.id.toLowerCase(); if (seen.has(key)) throw new Error('DUPLICATE_ID'); seen.add(key); }
  entries.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { schema: 'bundle/v1', entries, count: entries.length };
}\n`;
  await put("candidate.mjs", omitInputMember ? candidateCode.replace("entries, count:", "entries: entries.slice(0, 1), count:") : candidateCode);
  await put("action.mjs", actionBody ?? "import { appendFileSync } from 'node:fs'; appendFileSync('actions.log', 'called\\n');\n");
  const oracle = await put("oracle.json", { schema: "context.oracle.v1", examples: fixtureFrozen.examples.map(e => ({
    id: e.id, sourceAssertionRefs: e.sourceAssertions, input: e.input, expected: e.expectedError ? { error: e.expectedError } : e.expected })) });
  const verifier = await put("verify.mjs", `import { readFileSync, appendFileSync } from 'node:fs';
import { buildBundle } from './candidate.mjs';
const oracle = JSON.parse(readFileSync('oracle.json', 'utf8'));
const ids = JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES);
appendFileSync('verifications.log', ids.join(',') + '\\n');
const observations = ids.filter(id => (${JSON.stringify(verificationMode)} !== 'missing' || id !== 'B2') &&
  (${JSON.stringify(verificationMode)} !== 'retained-only' || id !== 'N1')).map(id => {
  const example = oracle.examples.find(e => e.id === id);
  let observed; try { observed = buildBundle(example.input); } catch (e) { observed = { error: e.message }; }
  return { id, observed };
});
if (${JSON.stringify(verificationMode)} === 'mutate-candidate') appendFileSync('candidate.mjs', '\\n// changed during verification\\n');
if (${JSON.stringify(verificationMode)} === 'mutate-dependency') appendFileSync('routes.json', ' ');
if (${JSON.stringify(verificationMode)} === 'mutate-task') appendFileSync('task.json', ' ');
if (${JSON.stringify(verificationMode)} === 'mutate-source') appendFileSync('sources.json', ' ');
if (${JSON.stringify(verificationMode)} === 'mutate-unrelated') appendFileSync('theme.json', ' ');
for (const name of ['module', 'memory-review', 'capsule', 'readback', 'owner-evidence']) {
  if (${JSON.stringify(verificationMode)} === 'mutate-' + name) appendFileSync(name + '.json', ' ');
}
console.log(JSON.stringify({ schema: 'context.observations.v1',
candidateSha256: ${JSON.stringify(verificationMode)} === 'stale-candidate' ? '0'.repeat(64) : process.env.VYDYKHAI_CANDIDATE_SHA256,
oracleSha256: ${JSON.stringify(verificationMode)} === 'stale-fixture' ? '0'.repeat(64) : process.env.VYDYKHAI_ORACLE_SHA256,
observations }));\n`);
  const command = script => ({ executable: process.execPath, args: [script], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
  const module = { schema: "context.module.v1", publicBoundary: "buildBundle", implementationFiles: ["candidate.mjs"],
    retainedExampleIds: ["B1", "B2"], oracle, verificationScript: verifier, verificationCommand: command("verify.mjs") };
  // Asset-only mode never writes approvals, classifications, task/capsule or worker readback.
  if (!preparation) return { root, put, module, candidateCode, cli: selectedCli };
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
    const sourceText = Object.fromEntries(fixtureEvents.flatMap(e => e.assertions.map(a => [a.id, a.text])));
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
    const processResult = spawnSync(process.execPath, [selectedCli, "context-run", "--input", path.join(root, "request.json")], { encoding: "utf8", timeout: 10000 });
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

export { fixture, cli, events, frozen, hash, sourceBytes, expectedBytes };
