import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { nativeActionCommand, hookEventKey } from "../scripts/context-hook.mjs";

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
  assert.equal(w.run("accept").status, "BLOCKED", "unfixed Candidate must fail N1");
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
