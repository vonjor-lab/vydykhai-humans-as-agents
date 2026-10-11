import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {fixture} from "./context-fixture.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {stageProspectiveCycle, validateProspectivePlan} from "../scripts/prospective-control-cycle.mjs";
import {stageCycle} from "../scripts/qualify-control-cycle.mjs";
import {repairCycleFixture} from "../scripts/control-cycle-fixture.mjs";
import {runContextTransition} from "../scripts/context-run.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {inspectControlRuntime} from "../scripts/control-runtime.mjs";

const hash = v => sha256(canonicalJson(v));
const read = async p => JSON.parse(await readFile(p));
const put = (p, v) => writeFile(p, canonicalJson(v) + "\n", {mode: 0o600});
const runtime = "aed7297eccdba2fdb4474a993d5e4d1d69e1427d9ec447cb49dbceba12614840";
async function temp(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "prospective-test-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

// Deliberately synthetic test lineage. No native inference or historical production claims.
async function prior(t) {
  const root = await temp(t), f = await fixture(t, {correction: true, preparation: false});
  const control = path.join(root, "old-control"), probe = path.join(root, "probe");
  await mkdir(control, {mode: 0o700}); await mkdir(probe, {mode: 0o700});
  await mkdir(path.join(control, "host"), {mode: 0o700});
  const producer = {path: "candidate.mjs", sha256: sha256(await readFile(path.join(f.root, "candidate.mjs")))};
  await f.put("execution-packet.md", {consumedProducer: {artifact: producer}});
  const accepted = await f.put("consumer-output.json", "SYNTHETIC_OLD_ACCEPTED_SENTINEL\n");
  await f.put("inventory.json", {root: control, syntheticTestOnly: true});
  const registry = path.join(control, "sources.json");
  await put(registry, {schema: "control.review-sources.v1", workspace: f.root, sources: [
    {id: "execution-packet", path: "execution-packet.md", purpose: "Synthetic test packet"},
    {id: "repair-inventory-2", path: "inventory.json", purpose: "Synthetic test inventory"}]});
  const source = await openReviewSources(registry), snapshot = await source.snapshot();
  const state = {acceptances: {consumer: {acceptance: {artifact: accepted}}}};
  await put(path.join(control, "host", "0000000000.json"), {state, digest: hash(state)});
  const answer = {schema: "control.review-answer.v2", rowGroups: [], newFindings: [], resolutions: []};
  const acquired = await source.read({id: "repair-inventory-2"});
  const output = [{type: "item.completed", item: {type: "mcp_tool_call", server: "vydykhai_review", tool: "read_source",
    status: "completed", result: {content: [{type: "text", text: JSON.stringify(acquired)}]}}},
  {type: "item.completed", item: {type: "agent_message", text: JSON.stringify(answer)}}, {type: "turn.completed"}].map(JSON.stringify).join("\n");
  await put(path.join(probe, "trace.json"), {status: "CLI_EXIT_OK", output});
  const runs = Array.from({length: 28}, (_, i) => ({name: i === 27 ? "source-selection-probe" : `synthetic-prior-${i}`,
    status: i === 5 || i === 6 ? "STOPPED" : "CLI_EXIT_OK", usage: null}));
  await put(path.join(probe, "result.json"), {status: "SOURCE_SELECTION_OBSERVED_NO_ADMISSION", failure: null, runtime,
    stateUnchanged: true, controlAdmission: "NOT_ATTEMPTED_PARTIAL_VERDICT", findingsClosed: 0, productReplayed: false, runs, answer});
  await put(path.join(probe, "allocation.json"), {runtime, priorAttempts: 27, maxCalls: 1, retries: 0,
    stateHash: hash(state), sourceDigest: snapshot.digest});
  return {root, probe, control, workspace: f.root, runs};
}

test("historically pinned prospective staging preserves evidence and refuses changed runtime before staging", async t => {
  const p = await prior(t), original = new Map();
  for (const file of [path.join(p.probe, "result.json"), path.join(p.control, "sources.json"),
    path.join(p.control, "host", "0000000000.json"), path.join(p.workspace, "consumer-output.json")])
    original.set(file, await readFile(file));
  // A nonexistent binary is deliberate: staging must not try to launch it.
  if((await inspectControlRuntime(fileURLToPath(new URL("..",import.meta.url)))).digest!==runtime) {
    await assert.rejects(stageProspectiveCycle({previous:p.probe,output:path.join(p.root,"new"),
      binary:path.join(p.root,"NEVER_EXECUTE"),authHome:path.join(p.root,"NO_AUTH_READ")}),/PROSPECTIVE_RUNTIME_CHANGED/);
    for(const [file,bytes]of original)assert.deepEqual(await readFile(file),bytes);
    assert.equal((await readdir(p.root)).includes("new"),false);
    return;
  }
  const m = await stageProspectiveCycle({previous: p.probe, output: path.join(p.root, "new"),
    binary: path.join(p.root, "NEVER_EXECUTE"), authHome: path.join(p.root, "NO_AUTH_READ")});
  t.after(() => rm(m.workspace, {recursive: true, force: true}));
  assert.equal(validateProspectivePlan(m), m);
  assert.deepEqual(await read(path.join(m.out, "prospective-freeze.json")), m);
  for (const [file, bytes] of original) assert.deepEqual(await readFile(file), bytes);
  assert.deepEqual(m.priorRuns, p.runs); assert.equal(m.totalMaximum, 44);
  assert.equal(m.config.executor, "worker-1"); assert.equal(m.request.readback, null);
  assert.deepEqual(await readdir(path.join(m.root, "host")), []);
  assert.equal(m.modelsLaunched, 0); assert.equal(m.hostAdmissions, 0); assert.equal(m.protectedActions, 0);
  const task = await read(path.join(m.workspace, m.request.task.path));
  assert.equal(task.owner, m.config.executor);
  const deps = await read(path.join(m.workspace, task.dependencies));
  assert.ok(!deps.dependencies.some(d => d.path.includes("consumer-output")));
  assert.deepEqual(await read(path.join(m.workspace, "consumer-input.json")), m.input);
  assert.deepEqual(m.expectedOutput.entries.map(e => e.id), ["Z", "a"]);
  const packet = await read(path.join(m.workspace, "execution-packet.md"));
  assert.equal(packet.acknowledgment, "PENDING_ACTUAL_WORKER");
  assert.equal(packet.semanticApproval, "NOT_ESTABLISHED");
  assert.deepEqual(packet.preparation.map(p => p.status), ["PLAN_READY", "PREPARED", "DELIVERED"]);
  assert.equal(packet.publicAction.input.sha256, sha256(await readFile(path.join(m.workspace, "consumer-input.json"))));
  for (const name of [m.resume, m.preflight, m.accept, "cycle-fixture-repair/readback.json", "consumer-output.json",
    "actual-preparation.json", "actual-worker-readback.json", "cycle-fixture-input/worker-readback.txt"])
    await assert.rejects(readFile(path.join(m.workspace, name)), {code: "ENOENT"});
  const blocked = await runContextTransition(m.request);
  assert.equal(blocked.status, "BLOCKED"); assert.equal(blocked.code, "WORKER_READBACK_REQUIRED");
  assert.equal(blocked.stats.commands, 0);
  const snapshot = await (await openReviewSources(m.registryFile)).snapshot();
  assert.deepEqual(snapshot, m.frozenSources);
  assert.ok(snapshot.rows.every(r => r.status === "AVAILABLE"));
  assert.ok(!snapshot.rows.some(r => r.id === "current-readback" || r.path === "candidate.mjs"));
  const scaffold = await read(path.join(m.out, "freeze.json"));
  assert.notEqual(scaffold.binding.taskSha256, m.binding.taskSha256);
  assert.deepEqual(await read(path.join(m.out, "initial-scaffold/consumer-input.json")), [{id: "b", label: " two "}, {id: "AA", label: " one "}]);

  for (const [name, change, code] of [
    ["wrong order", x => x.order.reverse(), /ORDER/],
    ["refund", x => x.priorRuns.pop(), /HISTORY/],
    ["rewritten prior", x => x.priorRuns[5].usage = {input: 0}, /HISTORY/],
    ["old result dependency", x => x.oldAcceptedResultDependency = true, /OLD_RESULT/],
    ["wrong executor", x => x.config.executor = "worker", /IDENTITY/],
    ["fake ACK", x => x.request.readback = {path: "readback.json"}, /IDENTITY/],
    ["future missing source", x => x.frozenSources.rows.push({id: "current-readback", status: "MISSING"}), /SOURCE/],
    ["source drift allowed", x => x.sourceLifetime.duringPost = "APPEND", /LIFETIME/],
    ["self exemption", x => x.dependencyDecisionRequired = false, /AUTHORITY/],
    ["extra call", x => x.allocation.maxCalls++, /ALLOCATION/]
  ]) await t.test(name, () => { const changed = structuredClone(m); change(changed); assert.throws(() => validateProspectivePlan(changed), code); });

  // Ordinary ACK remains available to a later runner; this synthetic test does not grant execution.
  await put(path.join(m.workspace, "test-only-worker-evidence.json"), {syntheticTestOnly: true});
  const ackProcess = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url)),
    "context-prepare", "ack", "--output", m.packetOutput, "--worker", m.config.executor,
    "--evidence", "test-only-worker-evidence.json"], {cwd: m.workspace, encoding: "utf8", timeout: 15000});
  assert.equal(ackProcess.error, undefined); assert.equal(ackProcess.stderr, "");
  const ack = JSON.parse(ackProcess.stdout);
  assert.equal(ack.status, "ACKNOWLEDGED", JSON.stringify(ack));
  assert.equal((await read(path.join(m.workspace, m.resume))).readback.path, "cycle-fixture-repair/readback.json");
  await assert.rejects(readFile(path.join(m.workspace, "consumer-output.json")), {code: "ENOENT"});
});

test("default repair caller still creates its explicitly synthetic ACK", async t => {
  const root = await temp(t), out = path.join(root, "default");
  const s = await stageCycle({output: out, binary: "/never-launch", authHome: "/never-read", terminal: true});
  t.after(() => rm(s.workspace, {recursive: true, force: true}));
  const f = await read(path.join(out, "freeze.json"));
  await put(path.join(f.workspace, "recipe.json"), {entrypoint: "buildBundle", revision: "bundle-r2", preprocess: "none",
    format: "json", producerEdits: [], rejected: ["keep-last"], idea: {id: "CSV", disposition: "ASK_OWNER_NOT_IMPLEMENT"}});
  const repaired = await repairCycleFixture({workspace: f.workspace, runtimeRoot: f.runtime.root});
  assert.equal(repaired.preparation.at(-1).status, "ACKNOWLEDGED");
  assert.ok(repaired.request.readback);
  assert.equal((await read(path.join(f.workspace, repaired.resume))).operation, "resume");
  await assert.rejects(readFile(path.join(f.workspace, "consumer-output.json")), {code: "ENOENT"});
});

test("changed parent journal or refunded probe fails before creating output", async t => {
  for (const mutation of ["journal", "refund"]) await t.test(mutation, async t => {
    const p = await prior(t), output = path.join(p.root, "denied");
    if (mutation === "journal") {
      const file = path.join(p.control, "host", "0000000000.json"), v = await read(file);
      v.state.changed = true; await put(file, v);
    } else {
      const file = path.join(p.probe, "result.json"), v = await read(file); v.runs.pop(); await put(file, v);
    }
    await assert.rejects(stageProspectiveCycle({previous: p.probe, output, binary: "/never", authHome: "/no-auth"}), /PROSPECTIVE_PRIOR/);
    await assert.rejects(readdir(output), {code: "ENOENT"});
  });
});
