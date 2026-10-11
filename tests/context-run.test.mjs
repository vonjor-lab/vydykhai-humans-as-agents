import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkPreparedContext, sha256, canonicalJson, compileExecutableBrief } from "../scripts/memory-brief.mjs";

import {fixture, cli, events, frozen, hash, sourceBytes, expectedBytes} from "./context-fixture.mjs";

const noAction = async f => assert.rejects(readFile(path.join(f.root, "actions.log")), { code: "ENOENT" });

test("direct runtime cannot waive change or legacy baselines by omitting retained cases", async t => {
  for (const intent of [null, "change", "create"]) {
    const f = await fixture(t, { correction: true });
    f.module.retainedExampleIds = [];
    if (intent) f.module.access = { schema: "context.module-access.v1", modules: [
      { id: "buildBundle", intent, contractFiles: ["public.md"], privatePaths: ["candidate.mjs"], release: null },
      { id: "other", intent: "create", contractFiles: ["other.md"], privatePaths: ["other"], release: null }
    ] };
    f.task.module = await f.put("module.json", f.module); await f.refresh();
    if (intent === "create") {
      assert.equal((await f.run()).status, "PREPARED");
      f.task.newExampleIds = []; await f.refresh();
    }
    const result = await f.run();
    assert.equal(result.code, "MODULE_EXAMPLES_INVALID", result.raw);
    assert.equal(result.stats.dependentCommands, 0); await noAction(f);
  }
});

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

test("passing retained examples cannot discharge a promised new-case obligation", async t => {
  // This checks an owner-pinned obligation, not automatic discovery of adequate coverage.
  const f = await fixture(t, { correction: true, verificationMode: "retained-only" });
  await f.prepare();
  const result = await f.run("accept");
  assert.equal(result.code, "BEHAVIOR_EVIDENCE_MISSING");
  assert.equal(result.receipt, undefined);
  assert.equal(result.stats.dependentCommands, 0);
});

test("successful processing cannot hide a required input member from a source-derived oracle", async t => {
  const f = await fixture(t, { omitInputMember: true });
  await f.prepare();
  const result = await f.run("accept");
  assert.equal(result.code, "BEHAVIOR_MISMATCH");
  assert.equal(result.receipt, undefined);
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
  assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
  assert.equal(result.replayRequiresReconciliation, true);
});

test("resume reconciles changed meaning after the invoked action without claiming completion", async t => {
  const f = await fixture(t, { actionBody: "import { appendFileSync } from 'node:fs'; appendFileSync('sources.json', ' ');\n" });
  await f.prepare();
  const result = await f.run("resume");
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.code, "CONTEXT_CHANGED_DURING_ACTION");
  assert.equal(result.stats.dependentCommands, 1);
  assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
  assert.equal(result.replayRequiresReconciliation, true);
});

test("reference process access is explicitly unisolated, even after all context checks pass", async t => {
  // Prove the limit with harmless synthetic data; this is not a sandbox escape test.
  const f = await fixture(t);
  const outside = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-outside-")));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const target = path.join(outside, "marker.txt");
  await writeFile(target, "synthetic marker");
  await f.put("action.mjs", `import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync('outside-read.txt', readFileSync(${JSON.stringify(target)}));\n`);
  await f.prepare();
  const result = await f.run("resume");
  assert.equal(result.status, "ACTION_COMPLETED");
  assert.equal(await readFile(path.join(f.root, "outside-read.txt"), "utf8"), "synthetic marker");
  assert.equal(result.coverageBasis.processIsolation, "NOT_ENFORCED");
  assert.equal(result.coverageBasis.replayProtection, "CALLER_OWNED");
});

test("verification cannot accept changed task, source or relevant conditions even when behavior passes", async t => {
  for (const [mode, code] of [
    ["mutate-dependency", "CONTEXT_CHANGED_DURING_VERIFICATION"],
    ["mutate-task", "TASK_CHANGED_DURING_VERIFICATION"],
    ["mutate-source", "CONTEXT_CHANGED_DURING_VERIFICATION"],
  ]) {
    const f = await fixture(t, { verificationMode: mode }); await f.prepare();
    const result = await f.run("accept");
    assert.equal(result.status, "BLOCKED", `${mode}: ${result.raw}`);
    assert.equal(result.code, code, result.raw);
    assert.equal(result.stats.verificationCommands, 1);
    assert.equal(result.receipt, undefined); assert.equal(result.returnSync, undefined);
    await noAction(f);
  }
  const control = await fixture(t, { verificationMode: "mutate-unrelated" }); await control.prepare();
  assert.equal((await control.run("accept")).status, "VERIFIED");
});

test("direct human control must be observed; a stale graph cannot clear an unreviewed new instruction", async t => {
  const f = await fixture(t); await f.prepare();
  const sharedBefore = await readFile(path.join(f.root, "shared.md"), "utf8");
  // The caller cannot infer a conversation absent from its declared export.
  const unseen = await f.run("preflight");
  assert.equal(unseen.status, "READY");
  assert.equal(unseen.coverageBasis.unknownHistory, "outside declared exports");
  f.exported.events.push({ id: "HUMAN-CONTROL", authorKind: "human",
    body: "I am directing this experiment in the existing lab. Do not redirect it; ask me before changing that agreement." });
  await f.put("sources.json", f.exported);
  for (const operation of ["preflight", "resume", "accept"]) {
    const result = await f.run(operation);
    assert.equal(result.code, "SOURCE_RANGE_PENDING", result.raw);
    assert.equal(result.stats.commands, 0); assert.equal(result.receipt, undefined);
  }
  assert.equal(await readFile(path.join(f.root, "shared.md"), "utf8"), sharedBefore);
  await noAction(f);
});

test("acceptance also rechecks module authority, memory approval and worker delivery evidence", async t => {
  for (const name of ["module", "memory-review", "capsule", "readback", "owner-evidence"]) {
    const f = await fixture(t, { verificationMode: `mutate-${name}` }); await f.prepare();
    const result = await f.run("accept");
    assert.equal(result.status, "BLOCKED", `${name}: ${result.status}`);
    assert.equal(result.code, "ARTIFACT_HASH_MISMATCH", result.raw);
    assert.equal(result.stats.verificationCommands, 1);
    assert.equal(result.receipt, undefined); assert.equal(result.returnSync, undefined);
  }
});

test("changed declared test conditions cannot reuse proof for the agreed entry path", async t => {
  const agreed = { entry: "existing-lab", mechanism: "accepted-recognizer", providerMode: "enabled",
    source: "original-input", storage: "isolated-snapshot", consumers: ["public-result"] };
  for (const change of [{ entry: "parallel-lab" }, { mechanism: "replacement-parser" },
    { providerMode: "disabled" }, { source: "prepared-fixture" }, { storage: "other-environment" }]) {
    const f = await fixture(t);
    f.dependencies.dependencies.push({ id: "agreed-test-conditions", path: "conditions.json", scope: ["bundle"] });
    await f.put("conditions.json", agreed); await f.put("dependencies.json", f.dependencies);
    await f.prepare();
    await f.put("conditions.json", { ...agreed, ...change });
    for (const operation of ["resume", "accept"]) {
      const result = await f.run(operation);
      assert.equal(result.code, "RELEVANT_CONTEXT_CHANGED", result.raw);
      assert.equal(result.stats.commands, 0); assert.equal(result.receipt, undefined);
    }
    await noAction(f);
  }
});

test("a new fix that breaks retained behavior is rejected; restoring the accepted mechanism permits verification", async t => {
  const f = await fixture(t, { correction: true }); await f.prepare();
  await f.put("candidate.mjs", f.candidateCode.replace("e.label.trim()", "e.label"));
  const broken = await f.run("accept");
  assert.equal(broken.code, "BEHAVIOR_MISMATCH", broken.raw);
  assert.equal(broken.receipt, undefined);
  assert.equal(await readFile(path.join(f.root, "verifications.log"), "utf8"), "B1,B2,N1\n");
  await f.put("candidate.mjs", f.candidateCode);
  const restored = await f.run("accept");
  assert.equal(restored.status, "VERIFIED", restored.raw);
  assert.equal(restored.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.equal(restored.stats.compiles, 0); await noAction(f);
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
