import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { fixture, hash } from "./context-fixture.mjs";
import { sha256 } from "../scripts/memory-brief.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
const json = async (root, name) => JSON.parse(await readFile(path.join(root, name), "utf8"));
const cli = (root, ...args) => {
  const result = spawnSync(process.execPath, [path.join(runtimeRoot, "scripts/vydykhai.mjs"), ...args],
    { cwd: root, encoding: "utf8", timeout: 15000 });
  assert.equal(result.error, undefined); assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
};
async function staged(t) {
  const f = await fixture(t, { correction: true });
  await f.put("contract.md", "buildBundle at bundle-r2 is the accepted public boundary. Preserve exact id spelling, trim labels, order ids by codepoint, reject case-insensitive duplicates with DUPLICATE_ID. Output schema bundle/v1, entries and count. No preprocessing or producer edits.\n");
  await f.put("decisions.md", "Current D2: bundle-r2 preserves id spelling and casefolds only duplicate comparison. Supersedes D1 consumer lowercasing. Reject keep-last.\n");
  await f.put("success.md", "SL2: retained examples and case-insensitive duplicates. SL0 was assisted. Whole workspace unfinished; new consumer needs actual acceptance.\n");
  for (const name of ["scope", "goal", "map", "ideas"]) await f.put(`${name}.md`, `${name}: synthetic JSON consumer; consume buildBundle@bundle-r2; CSV remains deferred for module-owner.\n`);
  await f.put("consumer-input.json", [{ id: "b", label: " two " }, { id: "AA", label: " one " }]);
  await f.put("recipe.json", { entrypoint: "buildBundle", revision: "bundle-r2", preprocess: "none", format: "json",
    producerEdits: [], rejected: ["keep-last"], idea: { id: "CSV", disposition: "ASK_OWNER_NOT_IMPLEMENT" } });
  await f.prepare();
  await f.put("execution-packet.md", { task: f.task, request: f.request, boundary: "Rejected old packet" });
  const originals = new Map();
  for (const name of ["sources.json", "source-set.json", "classifications.json", "dependencies.json", "oracle.json", "candidate.mjs",
    "module.json", "task.json", "capsule.json", "readback.json", "execution-packet.md"]) originals.set(name, await readFile(path.join(f.root, name)));
  return { ...f, originals };
}
async function repair(f) {
  const { repairCycleFixture } = await import("../scripts/control-cycle-fixture.mjs");
  return repairCycleFixture({ workspace: f.root, runtimeRoot });
}

test("repair compiles current synthetic S8, retains historical assertions and really resumes/accepts the consumer", async t => {
  const f = await staged(t), repaired = await repair(f);
  assert.deepEqual(repaired.preparation.map(p => p.status), ["PLAN_READY", "PREPARED", "DELIVERED", "ACKNOWLEDGED"]);
  assert.equal(repaired.semanticApproval, "NOT_ESTABLISHED");
  const task = await json(f.root, repaired.request.task.path), capsule = await json(f.root, repaired.request.capsule.path);
  assert.equal(task.memory.publicBoundary, "consumeBundle");
  assert.match(capsule.render, /bundle-r2/); assert.doesNotMatch(capsule.render, /Accept buildBundle at bundle-r1|executor may prepare the local fix/);
  const classifications = await json(f.root, task.classifications);
  const assertions = classifications.records.flatMap(r => r.assertions);
  for (const id of ["S1:1", "S4:1"]) assert.equal(assertions.find(a => a.id === id).supersededBy, "S8:1");
  assert.equal(assertions.find(a => a.id === "S1:2").supersededBy, null);
  assert.ok(capsule.render.includes("unfinished")); assert.ok(capsule.render.includes("CSV"));
  assert.equal(assertions.find(a => a.id === "S3:1").ownerGate, "module-owner");
  const ready = cli(f.root, "context-run", "--input", repaired.preflight);
  assert.equal(ready.status, "READY", JSON.stringify(ready));
  assert.equal(ready.coverageBasis.sourceDigest, repaired.binding.sourceDigest);
  assert.equal(ready.coverageBasis.dependencyDigest, repaired.binding.dependencyDigest);
  assert.equal(repaired.binding.commandSha256, hash(task.action));
  const resumed = cli(f.root, "context-run", "--input", repaired.resume);
  assert.equal(resumed.status, "ACTION_COMPLETED", JSON.stringify(resumed));
  assert.deepEqual(await json(f.root, "consumer-output.json"), { schema: "bundle/v1", entries: [{ id: "AA", label: "one" }, { id: "b", label: "two" }], count: 2 });
  const accepted = cli(f.root, "context-run", "--input", repaired.accept);
  assert.equal(accepted.status, "VERIFIED", JSON.stringify(accepted));
  assert.deepEqual(accepted.receipt.observations.map(o => o.id), ["B1", "B2", "N1"]);
  assert.equal(accepted.coverageBasis.moduleAccess, "DECLARED_BOUNDARIES");
  assert.equal(accepted.receipt.productAcceptance, "NOT_ESTABLISHED");
  for (const [name, bytes] of f.originals) {
    const actual = name === "execution-packet.md" ? repaired.originalPacket.path : name;
    assert.deepEqual(await readFile(path.join(f.root, actual)), bytes, name);
  }
});

test("registered public packet resolves original/current revisions and denies producer reads on real routes", async t => {
  const f = await staged(t), repaired = await repair(f);
  const registryRoot = await realpath(await mkdtemp(path.join(tmpdir(), "cycle-fixture-registry-")));
  t.after(() => rm(registryRoot, { recursive: true, force: true }));
  const registry = path.join(registryRoot, "sources.json");
  await writeFile(registry, JSON.stringify({ schema: "control.review-sources.v1", workspace: f.root,
    sources: [{ id: "execution-packet", path: "execution-packet.md", purpose: "Current execution packet" }, ...repaired.sources] }), { mode: 0o600 });
  const sources = await openReviewSources(registry);
  const packet = JSON.parse((await sources.read({ id: "execution-packet" })).text);
  assert.deepEqual(packet.original.classifications.record, JSON.parse(f.originals.get("classifications.json")));
  assert.deepEqual(packet.original.eventSources[0].record, JSON.parse(f.originals.get("sources.json")));
  for (const row of packet.publicBindings) {
    const observed = await sources.read({ id: row.id });
    assert.equal(observed.sha256, row.sha256, row.id); assert.equal(observed.path, row.path);
  }
  assert.equal(packet.publicAction.script.sha256, sha256(packet.publicAction.script.text));
  assert.equal(packet.publicAction.input.sha256, sha256(packet.publicAction.input.text));
  assert.equal(packet.current.sourceDigest, repaired.binding.sourceDigest);
  assert.equal(packet.current.dependencyDigest, repaired.binding.dependencyDigest);
  const text = JSON.stringify(packet);
  assert.doesNotMatch(text, /const seen|const key = e.id.toLowerCase|entries.sort/);
  await assert.rejects(sources.read({ id: "candidate.mjs" }), /REVIEW_SOURCE_NOT_REGISTERED/);
  const pkg = await json(f.root, repaired.package);
  pkg.navigation.references.push({ id: "producer-leak", path: "candidate.mjs", quote: "export function", purpose: "Inspection", appliesTo: "preparation" });
  await f.put("attack.json", pkg);
  const denied = cli(f.root, "context-prepare", "plan", "--input", "attack.json", "--output", "attack");
  assert.equal(denied.code, "CONSUMED_MODULE_CONTEXT_FORBIDDEN");
  pkg.navigation.references.pop();
  pkg.task.candidateFiles.push("candidate.mjs");
  await f.put("attack-mutation.json", pkg);
  assert.equal(cli(f.root, "context-prepare", "plan", "--input", "attack-mutation.json", "--output", "attack-mutation").code,
    "CONSUMED_MODULE_MUTATION_FORBIDDEN");
  await assert.rejects(readFile(path.join(f.root, "consumer-output.json")), { code: "ENOENT" });
});

test("repaired preparation refuses actual producer, current source and exact input drift before action", async t => {
  for (const name of ["candidate.mjs", "sources.json", "consumer-input.json", "contract.md", "decisions.md"]) {
    await t.test(name, async t => {
      const f = await staged(t), repaired = await repair(f);
      await writeFile(path.join(f.root, name), Buffer.concat([await readFile(path.join(f.root, name)), Buffer.from("\n")]));
      const result = cli(f.root, "context-run", "--input", repaired.resume);
      assert.equal(result.status, "BLOCKED", JSON.stringify(result));
      assert.equal(result.stats.commands, 0);
      await assert.rejects(readFile(path.join(f.root, "consumer-output.json")), { code: "ENOENT" });
    });
  }
});

test("invalid current recipe fails without rewriting the rejected packet or inventing r2 authority", async t => {
  const f = await staged(t);
  const recipe = await json(f.root, "recipe.json"); recipe.revision = "bundle-r1";
  await f.put("recipe.json", recipe);
  await assert.rejects(repair(f), /CYCLE_FIXTURE_RECIPE_INVALID/);
  assert.deepEqual(await readFile(path.join(f.root, "execution-packet.md")), f.originals.get("execution-packet.md"));
});
