import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, lstat, mkdtemp, realpath, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { validateNativeTrace } from "../scripts/qualify-framework-comparison-native.mjs";
import * as recovery from "../scripts/qualify-framework-comparison-recovery.mjs";
const { verifyComparisonRecovery } = recovery;

const hash = x => sha256(canonicalJson(x));
const raw = x => canonicalJson(x) + "\n";
const put = (files, name, value) => {
  files[name] = typeof value === "string" ? value : raw(value);
  return { path: name, sha256: sha256(files[name]) };
};
// Scripted trace envelopes test custody validation, not native inference or v3 admission.
function bundle(role, number, intent, sources, modelOutput, sequence = 2) {
  const rows = Object.entries(sources).map(([id, text]) => ({ id, path: `published/${sequence}/${id}.txt`,
    status: "AVAILABLE", sha256: sha256(text) }));
  const allocation = { role, arm: "candidate", kind: "ROLE_DISPATCH", number, budgetId: "scripted-budget",
    freezeDigest: hash("scripted-freeze"), allocatedAtMs: number * 1000, timeoutMs: 300000,
    intent, intentSha256: hash(intent), sourceRevision: { sequence, digest: hash(sequence) },
    sourceSnapshot: { rows, digest: hash(rows) } };
  const events = [{ type: "turn.started" }, ...rows.map((r, i) => ({ type: "item.completed", item: {
    id: `read-${i}`, type: "mcp_tool_call", server: "vydykhai_review", tool: "read_source", arguments: { id: r.id },
    status: "completed", result: { content: [{ type: "text", text: raw({ ...r, text: sources[r.id] }) }] } } })),
  { type: "item.completed", item: { type: "agent_message", text: canonicalJson(modelOutput) } },
  { type: "turn.completed", usage: { input_tokens: 0, output_tokens: 0 } }];
  const trace = { status: "CLI_EXIT_OK", state: "CLOSED", code: 0, reason: null, output: events.map(raw).join("") };
  const parsed = validateNativeTrace(trace, allocation);
  const receipt = { status: "RECORDED", role, arm: allocation.arm, number, budgetId: allocation.budgetId,
    allocatedAtMs: allocation.allocatedAtMs, timeoutMs: allocation.timeoutMs,
    allocationSha256: hash(allocation), traceSha256: hash(trace), intentSha256: hash(intent),
    sourceRevision: allocation.sourceRevision, ...parsed };
  return { allocation: raw(allocation), receipt: raw(receipt), trace: raw(trace) };
}
function fixture() {
  const files = {}, workspace = "/synthetic-recovery-workspace";
  const action = { executable: "/fixed/node", args: ["action.mjs"], cwd: "." };
  const classifications = ["S1", "S2", "S4"].map((eventId, i) => ({ sourceId: "history", eventId,
    assertions: [{ id: `old-${i}`, quote: `source quote ${i}`, disposition: "current_constraint" }] }));
  const pkg = { owner: "owner", classifications, task: { action }, module: { boundary: "fixed" } };
  put(files, "native-package.json", pkg); put(files, "recipe.json", { format: "json" });
  for (const name of ["action.mjs", "candidate.mjs", "consumer-input.json", "verify.mjs"]) put(files, name, `unchanged ${name}`);
  const oracle = put(files, "oracle.json", { examples: ["B1", "B2", "N1"].map((id, i) => ({ id,
    sourceAssertionRefs: [`${classifications[i].eventId}:1`] })) });
  const module = put(files, "old/module.json", { oracle, retainedExampleIds: ["B1", "B2"] });
  const review = put(files, "old/review.json", { decision: "approved" });
  const integration = put(files, "old/integration.json", { status: "INTEGRATED" });
  put(files, "old/classifications.json", { records: classifications.map(c => ({ ...c, review, integration })) });
  const task = { id: "fixed-task", owner: "worker", workspace, action, module, newExampleIds: ["N1"],
    identity: null, memoryReview: null, sourceSet: null, dependencies: null,
    classifications: "old/classifications.json", packageApproval: { plan: "old/plan.json", approval: "old/approval.json" },
    memory: { items: classifications.map(c => ({ text: c.assertions[0].quote, sourceAssertionRefs: [c.assertions[0].id] })) } };
  const taskRef = put(files, "old/task.json", task);
  const capsule = put(files, "old/capsule.json", { taskSha256: taskRef.sha256, render: "unchanged meaning",
    sourceDigest: hash("sources"), dependencyDigest: hash("dependencies") });
  const evidenceRef = put(files, "old/worker.txt", "scripted worker readback");
  const readback = put(files, "old/readback.json", { taskSha256: taskRef.sha256, capsuleSha256: capsule.sha256,
    worker: "worker", evidenceRef });
  const request = { operation: "resume", workspace, task: taskRef, capsule, readback, integrationPlan: null };
  const binding = { taskId: task.id, taskSha256: taskRef.sha256, capsuleSha256: capsule.sha256,
    operation: "resume", kind: "dependent", cwd: workspace, executable: action.executable, commandSha256: hash(action),
    sourceDigest: hash("sources"), dependencyDigest: hash("dependencies") };
  const actionResult = { commandSha256: hash(action), cwd: workspace, executable: action.executable, exitCode: 0 };
  const grantId = hash(binding), grant = { binding, bindingSha256: grantId, dependencies: [] };
  const reservation = { reservationId: grantId, grantId, bindingSha256: grantId, dependencies: [], status: "IN_FLIGHT" };
  const states = [0, 1, 2, 3].map(i => ({ configKey: "fixed-config", grants: i ? { [grantId]: grant } : {},
    reservations: i < 2 ? {} : { [grantId]: { ...reservation,
      ...(i === 3 ? { status: "COMPLETED", resultSha256: hash(actionResult) } : {}) } } }));
  const journal = [];
  for (const state of states) { const row = { revision: journal.length,
    parent: journal.length ? JSON.parse(journal.at(-1)).digest : null, state }; journal.push(raw({ ...row, digest: hash(row) })); }
  const command = { requestId: "resume", bindingSha256: grantId, dependenciesSha256: hash([]),
    requestSha256: hash({ ...request, readback: null }) };
  const intent = { task: { id: "task", sha256: taskRef.sha256 }, commands: [command], context: { sourceRoot: workspace } };
  const sources = { task: files[taskRef.path], capsule: files[capsule.path], recipe: files["recipe.json"], package: files["native-package.json"] };
  const reviewer = bundle("readiness-reviewer", 2, intent, sources, { commands: [{ requestId: "resume", decision: "APPROVE" }] });
  const worker = bundle("worker", 3, intent, sources, { commands: [{ requestId: "resume", decision: "AUTHORIZE_SUPERVISOR_ACTION", readback: files[evidenceRef.path] }] });
  put(files, "consumer-output.json", { actual: "scripted output, not execution proof" });
  const observer = bundle("readiness-reviewer", 4, intent, { ...sources, artifact: files["consumer-output.json"] }, { commands: [] }, 3);
  const checkpoint = { schema: "comparison.recovery-checkpoint.v1", workspace, files, request: raw(request),
    stage: raw({ workspace, arm: "candidate", files: Object.fromEntries(["action.mjs", "candidate.mjs", "consumer-input.json", "verify.mjs", "oracle.json"].map(n => [n, sha256(files[n])])) }),
    action: raw({ status: "ACTION_COMPLETED", operation: "resume", enforcement: "controlled-command-boundary", action: actionResult,
      stats: { commands: 1, dependentCommands: 1, verificationCommands: 0 } }),
    verification: raw({ status: "BLOCKED", code: "VERIFICATION_SOURCE_MISSING", actionOutcome: "NOT_INVOKED",
      stats: { commands: 0, verificationCommands: 0 } }), journal, reviewer, worker, observer };
  return input(checkpoint);
}
function input(checkpoint, workspace = checkpoint.workspace) {
  const files = structuredClone(checkpoint.files), old = JSON.parse(checkpoint.request), task = JSON.parse(files[old.task.path]);
  const pkg = JSON.parse(files["native-package.json"]), required = new Set(["S1", "S2", "S4"]);
  const renames = pkg.classifications.filter(c => required.has(c.eventId)).map(c => {
    const a = c.assertions.find(a => ["old-0", "old-1", "old-2", "retained-public-behavior", "duplicate-label-independence", "case-insensitive-preserving-correction"].includes(a.id));
    return { from: a.id, to: `${c.eventId}:1`, sourceId: c.sourceId, eventId: c.eventId, quote: a.quote };
  });
  const rename = new Map(renames.map(r => [r.from, r.to]));
  for (const c of pkg.classifications) for (const a of c.assertions) a.id = rename.get(a.id) ?? a.id;
  const packageRef = put(files, "recovery/package.json", pkg);
  const next = structuredClone(task);
  next.workspace = workspace;
  next.packageApproval = { plan: "recovery/plan.json", approval: "recovery/approval.json" };
  for (const item of next.memory.items) item.sourceAssertionRefs = item.sourceAssertionRefs.map(r => rename.get(r) ?? r);
  const records = JSON.parse(files[task.classifications]);
  for (const c of records.records) for (const a of c.assertions) a.id = rename.get(a.id) ?? a.id;
  put(files, "recovery/classifications.json", records); next.classifications = "recovery/classifications.json";
  const taskRef = put(files, "recovery/task.json", next);
  const capsule = put(files, "recovery/capsule.json", { ...JSON.parse(files[old.capsule.path]), taskSha256: taskRef.sha256 });
  const readback = put(files, "recovery/readback.json", { ...JSON.parse(files[old.readback.path]),
    taskSha256: taskRef.sha256, capsuleSha256: capsule.sha256 });
  const plan = put(files, next.packageApproval.plan, { owner: pkg.owner, workspace, semanticPackage: pkg,
    artifacts: [taskRef], inputFiles: [packageRef] });
  put(files, next.packageApproval.approval, { decision: "approved", owner: pkg.owner, planSha256: plan.sha256 });
  const ownerRecord = bundle("owner", JSON.parse(checkpoint.observer.allocation).allocatedAtMs + 1,
    { task: { id: "task", sha256: old.task.sha256 }, commands: [] }, { task: checkpoint.files[old.task.path],
      package: checkpoint.files["native-package.json"], artifact: checkpoint.files["consumer-output.json"] },
    { decision: "approved", renames, reason: "Scripted ID-only fixture, not a real owner decision" });
  return { checkpoint, expectedCheckpointSha256: hash(checkpoint), currentFiles: structuredClone(checkpoint.files),
    successor: { workspace, files, packagePath: packageRef.path, request: { ...old, workspace, operation: "accept", task: taskRef, capsule, readback },
      ownerRecord, expectedOwnerRecordSha256: hash(ownerRecord) } };
}
function repin(x) { x.expectedCheckpointSha256 = hash(x.checkpoint); return x; }

test("scripted custody permits only historical evidence, not execution or semantic acceptance", () => {
  const x = fixture(), before = canonicalJson(x), proof = verifyComparisonRecovery(x);
  assert.equal(proof.resumeAllowed, false); assert.equal(proof.freshAdmissionRequired, true);
  assert.equal(proof.semanticAcceptance, "NOT_ESTABLISHED"); assert.equal(canonicalJson(x), before);
  assert.throws(() => verifyComparisonRecovery({ ...x, consumedEvidenceIds: [proof.evidence.id] }), /RECOVERY_ALREADY_CONSUMED/);
});
test("missing and changed current input, recipe, output and producer refuse", () => {
  for (const name of ["consumer-input.json", "recipe.json", "consumer-output.json", "candidate.mjs", "action.mjs"]) {
    const x = fixture(); x.currentFiles[name] += "changed";
    assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_FILE_CHANGED/);
    delete x.currentFiles[name]; assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_FILE_MISSING/);
  }
});
test("checkpoint tampering, missing journal and unresolved action refuse", () => {
  const x = fixture(); x.checkpoint.action += " "; assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_CHECKPOINT_CHANGED/);
  x.checkpoint.journal.pop(); assert.throws(() => verifyComparisonRecovery(repin(x)), /RECOVERY_JOURNAL_INVALID/);
  const y = fixture(); const row = JSON.parse(y.checkpoint.journal.at(-1));
  Object.values(row.state.reservations)[0].status = "IN_FLIGHT";
  row.digest = hash({ revision: row.revision, parent: row.parent, state: row.state }); y.checkpoint.journal[3] = raw(row);
  assert.throws(() => verifyComparisonRecovery(repin(y)), /RECOVERY_RESERVATION_UNRESOLVED/);
});
test("replayed observation, incomplete native turn and wrong owner role refuse", () => {
  const x = fixture(); x.checkpoint.observer = x.checkpoint.reviewer;
  assert.throws(() => verifyComparisonRecovery(repin(x)), /RECOVERY_OUTPUT_NOT_OBSERVED/);
  const y = fixture(); const a = JSON.parse(y.successor.ownerRecord.allocation); a.role = "worker";
  y.successor.ownerRecord.allocation = raw(a); assert.throws(() => verifyComparisonRecovery(y), /RECOVERY_NATIVE_BINDING_INVALID/);
  const z = fixture(); const t = JSON.parse(z.checkpoint.worker.trace); t.status = "TIMEOUT";
  z.checkpoint.worker.trace = raw(t); const r = JSON.parse(z.checkpoint.worker.receipt); r.traceSha256 = hash(t);
  z.checkpoint.worker.receipt = raw(r); assert.throws(() => verifyComparisonRecovery(repin(z)), /NATIVE_TURN_NOT_COMPLETE/);
});
test("changed authored semantics, source shadows and successor resume refuse", () => {
  const x = fixture(); const p = JSON.parse(x.successor.files[x.successor.packagePath]); p.classifications[0].assertions[0].disposition = "deferred";
  x.successor.files[x.successor.packagePath] = raw(p); assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_SEMANTICS_CHANGED/);
  const y = fixture(); y.successor.request.operation = "resume"; assert.throws(() => verifyComparisonRecovery(y), /RECOVERY_ACCEPT_ONLY/);
  const z = fixture(); z.successor.files["recipe.json"] += "different"; assert.throws(() => verifyComparisonRecovery(z), /RECOVERY_SOURCE_SHADOWED/);
});
test("hashless packet reference and fake receipt output refuse", () => {
  const x = fixture(); delete x.successor.request.task.sha256; assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_REF_INVALID/);
  const y = fixture(), r = JSON.parse(y.successor.ownerRecord.receipt); r.modelOutput.decision = "rejected";
  y.successor.ownerRecord.receipt = raw(r); assert.throws(() => verifyComparisonRecovery(y), /RECOVERY_NATIVE_BINDING_INVALID/);
});
test("generated classifications cannot differ from the unchanged old meaning", () => {
  const x = fixture(), name = "recovery/classifications.json", c = JSON.parse(x.successor.files[name]);
  c.records[0].assertions[0].disposition = "deferred"; x.successor.files[name] = raw(c);
  assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_CLASSIFICATIONS_CHANGED/);
});
test("changed action result is not a durable completed reservation", () => {
  const x = fixture(), a = JSON.parse(x.checkpoint.action); a.action.stdoutSha256 = hash("other effect");
  x.checkpoint.action = raw(a); assert.throws(() => verifyComparisonRecovery(repin(x)), /RECOVERY_ACTION_BINDING_INVALID/);
});
test("native owner hash is externally pinned, not merely a self-consistent envelope", () => {
  const x = fixture(); x.successor.expectedOwnerRecordSha256 = hash("different owner record");
  assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_OWNER_RECORD_CHANGED/);
});
test("wrong event mapping, missing rename and reference-bearing packages refuse", () => {
  for (const mutate of [r => { r.renames[0].to = "S2:1"; }, r => { r.renames.pop(); }]) {
    const x = fixture(), original = JSON.parse(x.successor.ownerRecord.receipt).modelOutput;
    mutate(original);
    const a = JSON.parse(x.successor.ownerRecord.allocation), c = x.checkpoint, task = JSON.parse(c.request).task;
    x.successor.ownerRecord = bundle("owner", a.number, a.intent,
      { task: c.files[task.path], package: c.files["native-package.json"], artifact: c.files["consumer-output.json"] }, original);
    x.successor.expectedOwnerRecordSha256 = hash(x.successor.ownerRecord);
    assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_RENAME_INVALID/);
  }
  const x = fixture(), c = x.checkpoint, p = JSON.parse(c.files["native-package.json"]);
  p.otherReference = "old-0"; put(c.files, "native-package.json", p);
  // Re-author the scripted envelopes to reach the unsupported-reference check.
  for (const key of ["reviewer", "worker", "observer"]) {
    const a = JSON.parse(c[key].allocation), r = JSON.parse(c[key].receipt), old = JSON.parse(c.request);
    c[key] = bundle(a.role, a.number, a.intent, { task: c.files[old.task.path], capsule: c.files[old.capsule.path],
      package: c.files["native-package.json"], recipe: c.files["recipe.json"],
      ...(key === "observer" ? { artifact: c.files["consumer-output.json"] } : {}) }, r.modelOutput, a.sourceRevision.sequence);
  }
  assert.throws(() => verifyComparisonRecovery(input(c)), /RECOVERY_REFERENCED_ID_UNSUPPORTED/);
});
test("explicit relocation keeps historical action at its original workspace", () => {
  const x = input(fixture().checkpoint, "/new-recovery-workspace"), before = canonicalJson(x);
  const proof = verifyComparisonRecovery(x);
  assert.equal(proof.evidence.historicalWorkspace, x.checkpoint.workspace);
  assert.equal(proof.evidence.successorWorkspace, x.successor.workspace);
  assert.equal(proof.evidence.relocated, true);
  assert.equal(proof.evidence.semantics.change, "ASSERTION_IDS_ONLY");
  assert.equal(proof.resumeAllowed, false);
  assert.equal(JSON.parse(x.checkpoint.action).action.cwd, x.checkpoint.workspace);
  assert.equal(canonicalJson(x), before);
});
test("pre-ACK inspection shares full checks but cannot import or replace final ACK", () => {
  const complete = input(fixture().checkpoint, "/new-recovery-workspace"), pending = structuredClone(complete);
  pending.successor.request.readback = null;
  delete pending.successor.files[complete.successor.request.readback.path];
  const before = canonicalJson(pending), inspected = recovery.inspectComparisonRecovery(pending);
  assert.equal(inspected.status, "HISTORICAL_LINKAGE_VERIFIED_ACK_PENDING");
  assert.equal(inspected.evidence.phase, "PRE_ACK_INSPECTION");
  assert.equal(inspected.evidence.ackSha256, null);
  assert.equal(inspected.resumeAllowed, false);
  assert.equal(inspected.freshAdmissionRequired, true);
  assert.equal(inspected.semanticAcceptance, "NOT_ESTABLISHED");
  assert.equal(canonicalJson(pending), before);
  assert.throws(() => verifyComparisonRecovery(pending), /RECOVERY_ACK_REQUIRED/);
  assert.throws(() => recovery.inspectComparisonRecovery(complete), /RECOVERY_ACK_MUST_BE_PENDING/);
  const final = verifyComparisonRecovery(complete);
  assert.equal(final.status, "HISTORICAL_LINKAGE_VERIFIED_ACK_BOUND");
  assert.equal(final.evidence.phase, "ACK_VERIFICATION");
  assert.equal(final.evidence.ackSha256, complete.successor.request.readback.sha256);
  assert.notEqual(final.evidence.id, inspected.evidence.id);
  assert.equal(final.evidence.preAckRequestSha256, inspected.evidence.preAckRequestSha256);
  assert.equal(final.evidence.outputLinkage.kind, "POST_ACTION_NATIVE_OBSERVATION");
  const changed = structuredClone(complete), ackRef = changed.successor.request.readback;
  const ack = JSON.parse(changed.successor.files[ackRef.path]);
  ack.evidenceRef = put(changed.successor.files, "recovery/new-worker.txt", "Different scripted readback");
  changed.successor.request.readback = put(changed.successor.files, ackRef.path, ack);
  assert.notEqual(verifyComparisonRecovery(changed).evidence.id, final.evidence.id);
});
test("pre-ACK is not a bypass for unresolved, stale, unauthored or changed-semantic evidence", () => {
  for (const [mutate, error] of [
    [x => { x.currentFiles["consumer-output.json"] += "changed"; }, /RECOVERY_FILE_CHANGED/],
    [x => { x.checkpoint.observer = x.checkpoint.reviewer; repin(x); }, /RECOVERY_OUTPUT_NOT_OBSERVED/],
    [x => { x.successor.expectedOwnerRecordSha256 = hash("forged"); }, /RECOVERY_OWNER_RECORD_CHANGED/],
    [x => { const p = JSON.parse(x.successor.files[x.successor.packagePath]); p.owner = "another";
      x.successor.files[x.successor.packagePath] = raw(p); }, /RECOVERY_SEMANTICS_CHANGED/],
    [x => { const row = JSON.parse(x.checkpoint.journal[3]); Object.values(row.state.reservations)[0].status = "IN_FLIGHT";
      row.digest = hash({ revision: row.revision, parent: row.parent, state: row.state });
      x.checkpoint.journal[3] = raw(row); repin(x); }, /RECOVERY_RESERVATION_UNRESOLVED/]
  ]) {
    const x = fixture(); x.successor.request.readback = null; mutate(x);
    assert.throws(() => recovery.inspectComparisonRecovery(x), error);
  }
});
test("relocation needs an explicit disjoint root, not hidden task or plan changes", () => {
  const x = input(fixture().checkpoint, "/new-recovery-workspace");
  delete x.successor.workspace;
  assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_WORKSPACE_INVALID/);
  for (const workspace of ["relative", "/", "/new/../recovery", "/synthetic-recovery-workspace/child"]) {
    const y = input(fixture().checkpoint, workspace);
    assert.throws(() => verifyComparisonRecovery(y), /RECOVERY_WORKSPACE_INVALID/);
  }
  const y = input(fixture().checkpoint, "/new-recovery-workspace");
  y.successor.workspace = "/other-root";
  assert.throws(() => verifyComparisonRecovery(y), /RECOVERY_WORKSPACE_INVALID/);
});
test("relocated source bytes cannot be changed or omitted, even with old currentFiles supplied", () => {
  for (const name of ["consumer-output.json", "recipe.json", "consumer-input.json", "candidate.mjs", "old/task.json"]) {
    const x = input(fixture().checkpoint, "/new-recovery-workspace");
    x.successor.files[name] += "changed";
    assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_SOURCE_SHADOWED/);
    delete x.successor.files[name];
    assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_FILE_MISSING/);
  }
});

// Opt-in READ-ONLY local evidence test. Its successor/owner are explicitly
// scripted; passing does not establish live repair approval or v3 preparation.
async function savedCheckpoint(root) {
  const workspace = path.join(root, "comparison/workspaces/candidate");
  const read = p => readFile(path.join(root, p), "utf8"), files = {};
  async function collect(relative = "") {
    for (const entry of await readdir(path.join(workspace, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name), info = await lstat(path.join(workspace, name));
      assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) await collect(name);
      else { assert.ok(info.isFile()); files[name] = await readFile(path.join(workspace, name), "utf8"); }
    }
  }
  await collect();
  const native = async number => ({ allocation: await read(`native/candidate/turns/allocation-${number}.json`),
    receipt: await read(`native/candidate/turns/receipt-${number}.json`), trace: await read(`native/candidate/turns/trace-${number}.json`) });
  const journal = [];
  for (let i = 0; i < 4; i++) journal.push(await read(`candidate/host/${String(i).padStart(10, "0")}.json`));
  return { schema: "comparison.recovery-checkpoint.v1", workspace, files,
    stage: await read("native/candidate/preparation-application/stage.json"), request: files["native-prepared/resume.json"],
    action: await read("candidate/action.json"), verification: await read("candidate/verification.json"), journal,
    reviewer: await native(2), worker: await native(3), observer: await native(4) };
}
test("saved predecessor journal/native evidence with scripted successor", {
  skip: !process.env.COMPARISON_RECOVERY_EVIDENCE_ROOT
}, async () => {
  assert.equal(verifyComparisonRecovery(input(await savedCheckpoint(process.env.COMPARISON_RECOVERY_EVIDENCE_ROOT))).historicalActionOnly, true);
});
for (const runtime of ["archived", "current"]) test(`actual ${runtime} v3 moved preparation preserves saved output; changed copy refuses`, {
  skip: !process.env.COMPARISON_RECOVERY_EVIDENCE_ROOT
}, async t => {
  const root = process.env.COMPARISON_RECOVERY_EVIDENCE_ROOT, checkpoint = await savedCheckpoint(root);
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-recovery-moved-")));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  for (const [name, bytes] of Object.entries(checkpoint.files)) {
    await mkdir(path.dirname(path.join(workspace, name)), { recursive: true });
    await writeFile(path.join(workspace, name), bytes, { flag: "wx", mode: 0o600 });
  }
  const x = input(checkpoint, workspace), packagePath = "moved-package.json";
  // This delta and ACK are scripted test inputs, never attributed to a model.
  await writeFile(path.join(workspace, packagePath), x.successor.files[x.successor.packagePath], { flag: "wx", mode: 0o600 });
  const runtimeDigest = JSON.parse(checkpoint.worker.allocation).intent.context.runtimeDigest;
  const cli = runtime === "archived" ? path.join(root, "candidate/packages", runtimeDigest, "scripts/vydykhai.mjs")
    : fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url));
  for (const [mode, extra, wanted] of [["plan", ["--input", packagePath], "PLAN_READY"],
    ["confirm", ["--owner", "owner", "--decision", "approved"], "PREPARED"],
    ["read", ["--worker", "worker"], "DELIVERED"],
    ["ack", ["--worker", "worker", "--evidence", "moved-worker.txt"], "ACKNOWLEDGED"]]) {
    if (mode === "ack") await writeFile(path.join(workspace, "moved-worker.txt"), "Scripted moved packet readback, not native worker evidence", { flag: "wx", mode: 0o600 });
    const result = spawnSync(process.execPath, [cli, "context-prepare", mode, "--output", "moved-prepared", ...extra],
      { cwd: workspace, encoding: "utf8", timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.status, wanted, result.stdout);
    if (observed.stats) assert.equal(observed.stats.commands, 0);
    if (mode === "read") {
      const pendingFiles = { ...checkpoint.files };
      for (const name of await readdir(path.join(workspace, "moved-prepared")))
        pendingFiles[`moved-prepared/${name}`] = await readFile(path.join(workspace, "moved-prepared", name), "utf8");
      pendingFiles[packagePath] = await readFile(path.join(workspace, packagePath), "utf8");
      const pending = structuredClone(x);
      pending.successor = { ...pending.successor, files: pendingFiles, packagePath,
        request: { ...JSON.parse(pendingFiles["moved-prepared/awaiting-worker.json"]), operation: "accept" } };
      assert.equal(pending.successor.request.readback, null);
      assert.equal(recovery.inspectComparisonRecovery(pending).status, "HISTORICAL_LINKAGE_VERIFIED_ACK_PENDING");
      assert.throws(() => verifyComparisonRecovery(pending), /RECOVERY_ACK_REQUIRED/);
    }
  }
  const successorFiles = {};
  async function collect(relative = "") {
    for (const e of await readdir(path.join(workspace, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, e.name);
      if (e.isDirectory()) await collect(name);
      else successorFiles[name] = await readFile(path.join(workspace, name), "utf8");
    }
  }
  await collect();
  x.successor = { ...x.successor, files: successorFiles, packagePath,
    request: JSON.parse(successorFiles["moved-prepared/accept.json"]) };
  x.currentFiles = Object.fromEntries(Object.keys(checkpoint.files).map(name => [name, successorFiles[name]]));
  const proof = verifyComparisonRecovery(x);
  assert.equal(proof.evidence.historicalWorkspace, checkpoint.workspace);
  assert.equal(proof.evidence.successorWorkspace, workspace);
  assert.equal(proof.artifactSha256, sha256(checkpoint.files["consumer-output.json"]));
  for (const [name, original] of Object.entries(checkpoint.files)) assert.equal(successorFiles[name], original, name);
  await writeFile(path.join(workspace, "consumer-output.json"), "changed copy");
  x.currentFiles["consumer-output.json"] = await readFile(path.join(workspace, "consumer-output.json"), "utf8");
  assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_FILE_CHANGED/);
  assert.equal((await savedCheckpoint(root)).files["consumer-output.json"], checkpoint.files["consumer-output.json"]);
});

test("saved actual owner correction and actual pre-ACK successor inspect without a new dispatch", {
  skip: !process.env.COMPARISON_RECOVERY_REPAIR_ROOT
}, async () => {
  const root = process.env.COMPARISON_RECOVERY_REPAIR_ROOT;
  const checkpoint = JSON.parse(await readFile(path.join(root, "checkpoint.json"), "utf8"));
  const workspace = path.join(root, "comparison/workspaces/candidate"), files = {};
  async function collect(relative = "") {
    for (const e of await readdir(path.join(workspace, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, e.name);
      assert.equal(e.isSymbolicLink(), false);
      if (e.isDirectory()) await collect(name);
      else { assert.ok(e.isFile()); files[name] = await readFile(path.join(workspace, name), "utf8"); }
    }
  }
  await collect();
  const ownerRecord = {};
  for (const type of ["allocation", "receipt", "trace"])
    ownerRecord[type] = await readFile(path.join(root, `native/candidate/turns/${type}-1.json`), "utf8");
  const request = { ...JSON.parse(files["native-verification-recovery/awaiting-worker.json"]), operation: "accept" };
  assert.equal(request.readback, null);
  const x = { checkpoint, expectedCheckpointSha256: hash(checkpoint), currentFiles: files,
    successor: { workspace, request, files, packagePath: "native-verification-recovery-package.json",
      ownerRecord, expectedOwnerRecordSha256: hash(ownerRecord) } };
  const observed = recovery.inspectComparisonRecovery(x);
  assert.equal(observed.status, "HISTORICAL_LINKAGE_VERIFIED_ACK_PENDING");
  assert.equal(observed.evidence.ownerRecordSha256, hash(ownerRecord));
  assert.equal(observed.artifactSha256, sha256(checkpoint.files["consumer-output.json"]));
  assert.throws(() => verifyComparisonRecovery(x), /RECOVERY_ACK_REQUIRED/);
});
