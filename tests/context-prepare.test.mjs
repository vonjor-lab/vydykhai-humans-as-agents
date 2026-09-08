import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { nativeActionCommand, hookEventKey } from "../scripts/context-hook.mjs";
import { classifyGuard, createReturnRoute, evaluateProductionContinuation, readProductionContinuation,
  validateDurableOutbox } from "../scripts/vydykhai.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
async function workspace(t, selectors = false) {
  const root = await mkdtemp(path.join(tmpdir(), "context-preparation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(repository, "examples/context-preparation"), root, { recursive: true });
  const json = async name => JSON.parse(await readFile(path.join(root, name), "utf8"));
  const put = (name, value) => writeFile(path.join(root, name), typeof value === "string" ? value : JSON.stringify(value));
  if (selectors) {
    const pkg = await json("package.json");
    pkg.sharedArtifacts = [{ path: "shared.md", startMarker: "<!-- bundle:start -->", endMarker: "<!-- bundle:end -->" }];
    await put("package.json", pkg);
  }
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(repository, "scripts/vydykhai.mjs"), ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.signal, null, result.stderr);
    assert.ok(result.stdout.trim(), result.stderr);
    return JSON.parse(result.stdout);
  };
  const prepare = (mode, ...args) => cli("context-prepare", mode, "--output", "prepared", ...args);
  const run = name => cli("context-run", "--input", `prepared/${name}.json`);
  const plan = () => prepare("plan", "--input", "package.json");
  const confirm = () => prepare("confirm", "--owner", "module-owner", "--decision", "approved");
  const acknowledge = async () => {
    const delivery = prepare("read", "--worker", "bundle-worker");
    assert.equal(delivery.status, "DELIVERED", JSON.stringify(delivery));
    assert.match(delivery.context, /buildBundle/);
    assert.match(delivery.context, /DUPLICATE_ID/);
    assert.match(delivery.context, /case-insensitively/);
    assert.match(delivery.context, /CSV/);
    await put("worker-evidence.txt", "Read buildBundle boundary: retain schema, label normalization, order and count; preserve duplicate rejection; implement case-insensitive comparison without changing spelling; leave CSV deferred for module-owner decision.");
    assert.equal(prepare("ack", "--worker", "bundle-worker", "--evidence", "worker-evidence.txt").status, "ACKNOWLEDGED");
  };
  const ready = async () => { assert.equal(plan().status, "PLAN_READY"); assert.equal(confirm().status, "PREPARED"); await acknowledge(); };
  return { root, json, put, cli, prepare, run, plan, confirm, acknowledge, ready };
}

test("ordinary package reaches action and acceptance after the worker changes Candidate", async t => {
  const w = await workspace(t);
  assert.equal(w.plan().status, "PLAN_READY");
  assert.equal(w.prepare("confirm", "--owner", "foreign", "--decision", "approved").code, "PACKAGE_APPROVAL_REQUIRED");
  assert.equal(w.confirm().status, "PREPARED");
  assert.equal(w.run("awaiting-worker").status, "BLOCKED");
  await w.acknowledge();
  const taskBeforeRepair = await readFile(path.join(w.root, "prepared/task.json"), "utf8");
  const failedCheck = w.run("accept");
  assert.equal(failedCheck.status, "BLOCKED", "a check verdict is not the task's stop decision");
  assert.equal(failedCheck.code, "BEHAVIOR_MISMATCH", "unfixed Candidate must fail N1");
  assert.equal(failedCheck.stats.verificationCommands, 1);
  assert.equal(failedCheck.stats.dependentCommands, 0);
  assert.equal(failedCheck.actionOutcome, "NOT_INVOKED");
  assert.equal(failedCheck.returnSync, undefined, "a failed local check is not a terminal task return");
  const before = await readFile(path.join(w.root, "candidate.mjs"), "utf8");
  await w.put("candidate.mjs", before.replace("const key = entry.id;", "const key = entry.id.toLowerCase();"));
  assert.ok(!(await w.json("prepared/plan.json")).inputFiles.some(r => r.path === "candidate.mjs"));
  const preflight = w.run("preflight");
  assert.equal(preflight.status, "READY", JSON.stringify(preflight));
  const resumed = w.run("resume");
  assert.equal(resumed.status, "ACTION_COMPLETED", JSON.stringify(resumed));
  assert.equal(await readFile(path.join(w.root, "actions.log"), "utf8"), "called\n");
  const accepted = w.run("accept");
  assert.equal(accepted.status, "VERIFIED", JSON.stringify(accepted));
  assert.equal(await readFile(path.join(w.root, "prepared/task.json"), "utf8"), taskBeforeRepair,
    "local corrective work retains the same accepted task and authority");
  assert.equal(w.plan().status, "PLAN_READY", "Candidate edits must not stale preparation");
});

test("unrelated shared section changes preserve preparation and worker delivery", async t => {
  const w = await workspace(t, true); await w.ready();
  const body = await readFile(path.join(w.root, "shared.md"), "utf8");
  await w.put("shared.md", body.replace("Unrelated module has", "A changed unrelated module has"));
  assert.equal(w.run("preflight").status, "READY");
  assert.equal(w.prepare("read", "--worker", "bundle-worker").status, "DELIVERED");
});

test("selected shared section changes block prepared task", async t => {
  const w = await workspace(t, true); await w.ready();
  await w.put("shared.md", (await readFile(path.join(w.root, "shared.md"), "utf8")).replace("Accepted boundary:", "Changed boundary:"));
  assert.equal(w.run("preflight").code, "PACKAGE_INPUT_OR_ARTIFACT_CHANGED");
  assert.equal(w.prepare("read", "--worker", "bundle-worker").code, "PACKAGE_PLAN_STALE");
});

test("multiple selected sections in one file retain each root binding", async t => {
  const w = await workspace(t, true), pkg = await w.json("package.json");
  pkg.sharedArtifacts.push({ path: "shared.md", startMarker: "<!-- unrelated:start -->", endMarker: "<!-- unrelated:end -->" });
  await w.put("package.json", pkg); await w.ready();
  assert.equal((await w.json("prepared/plan.json")).inputFiles.filter(r => r.path === "shared.md").length, 2);
  await w.put("shared.md", (await readFile(path.join(w.root, "shared.md"), "utf8")).replace("Accepted boundary:", "Changed boundary:"));
  assert.equal(w.run("preflight").code, "PACKAGE_INPUT_OR_ARTIFACT_CHANGED");
});

test("source changes stale confirmation and root approval blocks later use", async t => {
  const w = await workspace(t); await w.ready();
  await w.put("sources.json", (await readFile(path.join(w.root, "sources.json"), "utf8")) + "\n");
  assert.equal(w.confirm().code, "PACKAGE_PLAN_STALE");
  assert.equal(w.run("preflight").code, "PACKAGE_INPUT_OR_ARTIFACT_CHANGED");
});

test("coverage, explicit approval and distinct worker delivery remain mandatory", async t => {
  const w = await workspace(t), pkg = await w.json("package.json");
  pkg.classifications.pop(); await w.put("package.json", pkg);
  assert.equal(w.plan().status, "BLOCKED");
  await cp(path.join(repository, "examples/context-preparation/package.json"), path.join(w.root, "package.json"));
  assert.equal(w.plan().status, "PLAN_READY");
  assert.equal(w.prepare("confirm").status, "BLOCKED");
  assert.equal(w.confirm().status, "PREPARED");
  await w.put("worker-evidence.txt", "read");
  assert.equal(w.prepare("ack", "--worker", "bundle-worker", "--evidence", "worker-evidence.txt").status, "BLOCKED");
  assert.equal(w.prepare("read", "--worker", "foreign").code, "PACKAGE_WORKER_MISMATCH");
});

test("valid packets for the same worker cannot cross pending requests", async t => {
  const w = await workspace(t); await w.ready();
  assert.equal(w.cli("context-prepare", "plan", "--input", "package.json", "--output", "second").status, "PLAN_READY");
  assert.equal(w.cli("context-prepare", "confirm", "--output", "second", "--owner", "module-owner", "--decision", "approved").status, "PREPARED");
  await w.put("prepared/awaiting-worker.json", await w.json("second/awaiting-worker.json"));
  assert.equal(w.prepare("read", "--worker", "bundle-worker").code, "PACKAGE_REQUEST_MISMATCH");
  assert.equal(w.prepare("ack", "--worker", "bundle-worker", "--evidence", "worker-evidence.txt").code, "PACKAGE_REQUEST_MISMATCH");
});

test("generated hook transport requires actual source mapping and retains it on repeated ack", async t => {
  const w = await workspace(t); await w.ready();
  const task = await w.json("prepared/task.json");
  const root = task.workspace, command = nativeActionCommand({ ...task.action, cwd: root });
  const prompt = { cwd: root, session_id: "synthetic-session", turn_id: "turn-1", transcript_path: null,
    hook_event_name: "UserPromptSubmit", prompt: (await w.json("sources.json")).events[0].body };
  const callback = event => {
    const result = spawnSync(process.execPath, [path.join(repository, "scripts/context-hook.mjs"), "--workspace", root,
      "--command", command, "--state", "prepared/hook-state.json", "--metadata", "prepared/hook-metadata"],
    { cwd: root, input: JSON.stringify(event), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return result.stdout ? JSON.parse(result.stdout) : null;
  };
  const tool = { ...prompt, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, tool_use_id: "action-1" };
  assert.equal(callback(prompt), null);
  assert.equal(callback(tool).hookSpecificOutput.permissionDecision, "deny");
  const eventPath = `prepared/hook-metadata/event-${hookEventKey(prompt)}.json`;
  assert.equal(w.prepare("bind", "--owner", "module-owner", "--event", eventPath).status, "BOUND");
  await w.acknowledge();
  assert.equal((await w.json("prepared/hook-state.json")).eventBindings.length, 1);
  assert.equal(callback(tool), null);
  await assert.rejects(readFile(path.join(root, "actions.log")), { code: "ENOENT" });
  const next = { ...prompt, turn_id: "turn-2", prompt: "A different source body needing review." };
  callback(next);
  assert.equal(w.prepare("bind", "--owner", "module-owner", "--event", `prepared/hook-metadata/event-${hookEventKey(next)}.json`).code, "HOOK_SOURCE_BODY_MISMATCH");
  assert.equal(callback({ ...tool, turn_id: "turn-2", tool_use_id: "action-2" }).hookSpecificOutput.permissionDecision, "deny");
});

test("the ordinary prepared path rejects owner approval revoked during passing verification", async t => {
  const w = await workspace(t);
  const verifier = await readFile(path.join(w.root, "verify.mjs"), "utf8");
  await w.put("verify.mjs", verifier + `
import { writeFileSync } from "node:fs";
const approval = JSON.parse(readFileSync("prepared/approval.json", "utf8"));
approval.decision = "revoked";
writeFileSync("prepared/approval.json", JSON.stringify(approval));
`);
  await w.ready();
  await w.put("candidate.mjs", (await readFile(path.join(w.root, "candidate.mjs"), "utf8"))
    .replace("const key = entry.id;", "const key = entry.id.toLowerCase();"));
  const accepted = w.run("accept");
  assert.equal(accepted.status, "BLOCKED", JSON.stringify(accepted));
  assert.equal(accepted.code, "PACKAGE_APPROVAL_MISMATCH");
  assert.equal(accepted.stats.verificationCommands, 1);
  assert.equal(accepted.receipt, undefined); assert.equal(accepted.returnSync, undefined);
  assert.equal(w.run("resume").code, "PACKAGE_APPROVAL_MISMATCH");
  await assert.rejects(readFile(path.join(w.root, "actions.log")), { code: "ENOENT" });
});

test("prepared experiment, human detour, retained regression and lost wake close through the existing cycle", async t => {
  const w = await workspace(t, true); await w.ready();
  const original = await readFile(path.join(w.root, "candidate.mjs"), "utf8");
  const intended = original.replace("const key = entry.id;", "const key = entry.id.toLowerCase();");
  await w.put("candidate.mjs", intended.replace("entry.label.trim()", "entry.label"));
  assert.equal(w.run("accept").code, "BEHAVIOR_MISMATCH", "new behavior cannot erase retained behavior");
  await w.put("candidate.mjs", intended);

  const now = Date.parse("2026-01-01T12:00:00Z");
  const state = (status, evidence, resumeWhen = null) => `Orchestrator health: HEALTHY | Context: manager | Profile: maximum
Project Guard: ACTIVE | Incident: none
Human attention: NONE
## Execution Leases
| Work | State | Owner / context |
| --- | --- | --- |
| bundle-change | ${status} | bundle-worker |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify({ schemaVersion: 1, id: "BUNDLE-NEXT", work: "bundle-change", action: "Verify the agreed bundle increment",
    owner: "bundle-worker", state: status, evidence, ...(resumeWhen ? { resumeWhen } : {}) })}
\`\`\`
<!-- vydykhai:project-state:end -->`;
  const guard = (content, ownerStatus, issues = []) => {
    const activity = { schemaVersion: 1, continuationKey: readProductionContinuation(content).key,
      observedAt: new Date(now).toISOString(), orchestrator: { context: "manager", status: "IDLE", evidence: "native-manager" },
      owner: { context: "bundle-worker", status: ownerStatus, evidence: "native-worker" },
      wait: { status: "PENDING", evidence: "human-decision" } };
    const continuation = evaluateProductionContinuation(content, activity, { now });
    const all = [...continuation.issues, ...issues];
    return classifyGuard({ ok: all.length === 0, stateIssues: all, graphIssues: [], continuation }, content);
  };
  const sources = await w.json("sources.json"), pkg = await w.json("package.json");
  const direct = "I am directing this lab now. Ask me before any change of direction or transfer into the product.";
  sources.events.push({ id: "S5", authorKind: "human", body: direct });
  await w.put("sources.json", sources);
  assert.equal(w.run("resume").status, "BLOCKED");
  const waiting = state("WAITING", "human-S5", "The human returns coordination or requests a bounded intervention");
  assert.equal(guard(waiting, "IDLE").action, "NOOP");
  assert.equal(evaluateProductionContinuation(waiting, null, { now }).coverage, "LIMITED");

  // Explicit fixture decisions model the human and owner; the checker does not infer their meaning.
  const returned = "Return coordination for the same narrow bundle fix and its verification. Product integration still requires my decision.";
  sources.events.push({ id: "S6", authorKind: "human", body: returned });
  await w.put("sources.json", sources);
  for (const [eventId, quote, disposition, supersededBy] of [
    ["S5", direct, "superseded", "S6:1"], ["S6", returned, "current_constraint", null],
  ]) pkg.classifications.push({ sourceId: "bundle-history", eventId, eventDisposition: "assertions",
    reason: "Explicit source-backed handoff decision for the same bounded experiment.",
    assertions: [{ id: `${eventId}:1`, quote, disposition, scope: ["bundle"], targetRef: "module:buildBundle",
      reason: "Preserve direct human control and the separate integration decision.", supersededBy, ownerGate: null, trigger: null }] });
  await w.put("package.json", pkg);
  const prepare = (mode, ...args) => w.cli("context-prepare", mode, "--output", "reviewed", ...args);
  assert.equal(prepare("plan", "--input", "package.json").status, "PLAN_READY");
  assert.equal(prepare("confirm", "--owner", "module-owner", "--decision", "approved").status, "PREPARED");
  const delivery = prepare("read", "--worker", "bundle-worker");
  assert.match(delivery.context, /Product integration still requires my decision/);
  assert.match(delivery.context, /CSV/);
  await w.put("worker-evidence.txt", "Retain buildBundle and its JSON consumer; implement only the accepted comparison fix. Keep CSV deferred. Coordination returned for verification only; product integration is still a human decision.");
  assert.equal(prepare("ack", "--worker", "bundle-worker", "--evidence", "worker-evidence.txt").status, "ACKNOWLEDGED");
  const run = op => w.cli("context-run", "--input", `reviewed/${op}.json`);
  assert.equal(run("resume").status, "ACTION_COMPLETED");
  const working = state("WORKING", "actual-action");
  assert.equal(guard(working, "ACTIVE").action, "NOOP");
  assert.equal(guard(working, "IDLE").action, "WAKE", "missing native return cannot close the lease");
  assert.equal(run("preflight").status, "READY", "reconcile without rerunning the dependent action");
  const accepted = run("accept");
  assert.equal(accepted.status, "VERIFIED", JSON.stringify(accepted));
  assert.equal(accepted.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.deepEqual(accepted.receipt.observations.map(x => x.id), ["B1", "B2", "N1"]);
  await w.put("outbox.md", accepted.returnSync);
  const outbox = validateDurableOutbox(await readFile(path.join(w.root, "outbox.md"), "utf8"));
  assert.equal(outbox.pendingReturnIds.length, 1);
  assert.equal(outbox.returnCount, 1);
  assert.equal(outbox.returns[0].fields.Status, "CHECKPOINT_READY", "readiness is delivered before human acceptance");
  assert.equal(guard(working, "IDLE", outbox.issues).action, "WAKE");
  const route = createReturnRoute({ returnReceiptId: outbox.pendingReturnIds[0], consumer: "manager",
    routedNextAction: "Preserve the lab result and await the human integration decision", evidence: "exact-verification-receipt" });
  await w.put("outbox.md", accepted.returnSync + "\n" + route);
  const routedContent = await readFile(path.join(w.root, "outbox.md"), "utf8");
  assert.ok(routedContent.startsWith(accepted.returnSync + "\n"), "routing preserves the task's producer bytes");
  const routed = validateDurableOutbox(routedContent);
  assert.deepEqual(routed.pendingReturnIds, []);
  assert.equal(routed.returnCount, 1, "the manager does not manufacture a second producer");
  assert.equal(routed.routeCount, 1);
  assert.equal(routed.returns[0].fields.Status, "CHECKPOINT_READY", "routing cannot promote readiness to acceptance");
  assert.equal(guard(state("WAITING", "human-integration", "Human decides whether to integrate"), "IDLE").action, "NOOP");
  assert.equal(await readFile(path.join(w.root, "actions.log"), "utf8"), "called\n");
  assert.equal(await readFile(path.join(w.root, "candidate.mjs"), "utf8"), intended);
});
