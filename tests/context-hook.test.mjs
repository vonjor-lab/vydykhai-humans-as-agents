import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync, execFile } from "node:child_process";
import { nativeActionCommand, hookEventKey, preflightHook } from "../scripts/context-hook.mjs";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";

// Reuse the reviewed synthetic setup without changing the owner's extraction API
// or importing/registering its entire test suite a second time.
const testPath = fileURLToPath(new URL("./context-run.test.mjs", import.meta.url));
const source = await readFile(testPath, "utf8");
const helper = source.slice(0, source.indexOf("\nconst noAction ="))
  .replace('"../scripts/memory-brief.mjs"', JSON.stringify(new URL("../scripts/memory-brief.mjs", import.meta.url).href))
  .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(testPath).href)) + "\nexport { fixture };";
const { fixture } = await import("data:text/javascript;base64," + Buffer.from(helper).toString("base64"));
const adapter = fileURLToPath(new URL("../scripts/context-hook.mjs", import.meta.url));
const hash = v => sha256(canonicalJson(v));

async function setup(t) {
  const f = await fixture(t); await f.prepare();
  await mkdir(path.join(f.root, "hook-metadata"));
  const command = nativeActionCommand({ ...f.task.action, cwd: f.root });
  const args = [adapter, "--workspace", f.root, "--command", command, "--state", "hook-state.json", "--metadata", "hook-metadata"];
  const state = { schema: "context.hook-state.v1", request: await f.put("hook-request.json", { ...f.request, operation: "preflight" }), eventBindings: [] };
  await f.put("hook-state.json", state);
  const event = { cwd: f.root, session_id: "synthetic-session", turn_id: "turn-1", transcript_path: null,
    hook_event_name: "UserPromptSubmit", prompt: f.exported.events[0].body };
  const tool = (id = "call-1", inputCommand = command) => ({ ...event, hook_event_name: "PreToolUse", tool_name: "Bash",
    tool_input: { command: inputCommand }, tool_use_id: id });
  const run = e => {
    const r = spawnSync(process.execPath, args, { input: JSON.stringify(e), encoding: "utf8", timeout: 5000 });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, "");
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const record = async () => JSON.parse(await readFile(path.join(f.root, "hook-metadata", `event-${hookEventKey(event)}.json`), "utf8"));
  const review = async () => {
    const observed = await record();
    // Synthetic reviewer explicitly maps this prompt to the existing approved meaning.
    state.eventBindings.push({ eventKey: observed.key, eventSha256: hash(observed), classification: f.binding(f.classifications.records[0]) });
    await f.put("hook-state.json", state);
  };
  return { ...f, command, args, state, event, tool, run, record, review };
}
const denied = output => output?.hookSpecificOutput?.permissionDecision === "deny";
const noAction = f => assert.rejects(readFile(path.join(f.root, "actions.log")), { code: "ENOENT" });

test("library preflight reuses reviewed context with zero commands and compiles", async t => {
  const f = await setup(t); f.run(f.event); await f.review();
  const before = await readdir(path.join(f.root, "hook-metadata"));
  const result = await preflightHook(f.state, f.root, [await f.record()]);
  assert.equal(result.status, "READY"); assert.equal(result.stats.commands, 0); assert.equal(result.stats.compiles, 0);
  assert.deepEqual(await readdir(path.join(f.root, "hook-metadata")), before); await noAction(f);
});

test("callback protocol denies pending source, then allows host-owned action once and deduplicates observation", async t => {
  const f = await setup(t);
  assert.equal(f.run(f.event), null); assert.equal(f.run(f.event), null);
  assert.ok(denied(f.run(f.tool()))); await noAction(f);
  await f.review();
  assert.equal(f.run(f.tool()), null); await noAction(f); // Hook NEVER executes the action.
  // Explicit protocol harness, not a native Codex callback: host owns this one execution.
  const host = spawnSync("/bin/sh", ["-c", f.command], { encoding: "utf8" }); assert.equal(host.status, 0);
  const post = { ...f.tool(), hook_event_name: "PostToolUse", tool_response: { exit_code: host.status, output: host.stdout } };
  assert.equal(f.run(post), null); assert.equal(f.run(post), null);
  assert.ok(denied(f.run(f.tool())));
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
  const names = await readdir(path.join(f.root, "hook-metadata"));
  assert.equal(names.filter(n => n.startsWith("event-")).length, 1);
  assert.equal(names.filter(n => n.startsWith("observation-")).length, 1);
  const receipt = JSON.parse(await readFile(path.join(f.root, "hook-metadata", names.find(n => n.startsWith("observation-")))));
  assert.equal(receipt.acceptance, "NOT_ESTABLISHED");
});

test("new input invalidates managed preparation while unchanged callbacks and recovery stay quiet", async t => {
  const f = await setup(t); f.run(f.event); await f.review();
  assert.equal(f.run(f.tool()), null);
  f.event.turn_id = "turn-2"; f.event.prompt = "A new instruction requiring owner review.";
  f.run(f.event);
  assert.ok(denied(f.run(f.tool("call-2"))));
  assert.equal(f.run(f.tool("read", "cat sources.json")), null);
  assert.equal(f.run({ ...f.tool(), tool_name: "request_user_input" }), null);
  assert.equal(f.run({ ...f.tool(), cwd: path.dirname(f.root) }), null);
  await noAction(f);
});

test("missing or malformed state fails only declared action; unseen current input never counts as covered", async t => {
  const f = await setup(t);
  assert.match(f.run(f.tool()).hookSpecificOutput.permissionDecisionReason, /HOOK_CURRENT_INPUT_UNSEEN/);
  for (const state of ["missing", "{}", '{"schema":1,"schema":2}']) {
    if (state === "missing") await rm(path.join(f.root, "hook-state.json")); else await f.put("hook-state.json", state);
    assert.ok(denied(f.run(f.tool())));
    assert.equal(f.run(f.tool("recovery", "cat hook-state.json")), null);
  }
  await noAction(f);
});

test("callback metadata never copies prompt or tool response bodies and conflicting identity requires recovery", async t => {
  const f = await setup(t);
  f.run(f.event); await f.review(); f.run(f.tool());
  const post = { ...f.tool(), hook_event_name: "PostToolUse", tool_response: "SYNTHETIC-PRIVATE-OUTPUT" };
  f.run(post);
  assert.match(f.run({ ...post, tool_response: "changed" }).systemMessage, /HOOK_OBSERVATION_CONFLICT/);
  assert.match(f.run({ ...f.event, prompt: "changed same event" }).systemMessage, /HOOK_EVENT_REVISION_CONFLICT/);
  assert.match(f.run(f.tool("call-after-conflict")).hookSpecificOutput.permissionDecisionReason, /HOOK_INTAKE_FAILURE_RECONCILE/);
  for (const name of await readdir(path.join(f.root, "hook-metadata"))) {
    if ((await lstat(path.join(f.root, "hook-metadata", name))).isDirectory()) continue;
    const bytes = await readFile(path.join(f.root, "hook-metadata", name), "utf8");
    assert.doesNotMatch(bytes, /SYNTHETIC-PRIVATE/); assert.ok(!bytes.includes(f.event.prompt));
  }
  await noAction(f);
});

test("persisted intake failure blocks managed action after recovery; total write failure never vetoes human input", async t => {
  const f = await setup(t); f.run(f.event); await f.review();
  const lock = path.join(f.root, "hook-metadata", "lock"); await mkdir(lock);
  assert.match(f.run({ ...f.event, prompt: "changed while writer is unavailable" }).systemMessage, /HOOK_BUSY_RECONCILE/);
  await rm(lock, { recursive: true });
  assert.match(f.run(f.tool("fresh-call")).hookSpecificOutput.permissionDecisionReason, /HOOK_INTAKE_FAILURE_RECONCILE/);
  assert.equal(f.run(f.tool("recovery", "cat hook-state.json")), null);
  await rm(path.join(f.root, "hook-metadata"), { recursive: true });
  const warning = f.run({ ...f.event, prompt: "cannot persist any marker; help repair or stop" });
  assert.match(warning.systemMessage, /LIMITED\/UNKNOWN/);
  assert.equal(warning.decision, undefined); assert.equal(warning.continue, undefined);
  await noAction(f);
});

test("new materially different prompt cannot reuse a valid old source classification", async t => {
  const f = await setup(t); f.event.prompt = "Replace the full bundle contract with only its internal pass.";
  f.run(f.event); await f.review(); // Deliberately forged transport link; classification itself is valid.
  const result = f.run(f.tool());
  assert.ok(denied(result)); assert.match(result.hookSpecificOutput.permissionDecisionReason, /HOOK_SOURCE_BODY_MISMATCH/);
  await noAction(f);
});

test("concurrent callback processes create one admission and one post receipt without executing commands", async t => {
  const f = await setup(t); f.run(f.event); await f.review();
  const concurrent = async event => {
    const input = JSON.stringify(event);
    // execFile has no stdin option; write input to the returned child's pipe.
    return new Promise((resolve, reject) => {
      const child = execFile(process.execPath, f.args, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) reject(error); else { assert.equal(stderr, ""); resolve(stdout ? JSON.parse(stdout) : null); }
      }); child.stdin.end(input);
    });
  };
  const outcomes = await Promise.all([concurrent(f.tool()), concurrent(f.tool())]);
  assert.equal(outcomes.filter(x => x === null).length, 1); assert.equal(outcomes.filter(denied).length, 1);
  const post = { ...f.tool(), hook_event_name: "PostToolUse", tool_response: { observed: "synthetic callback only" } };
  assert.deepEqual(await Promise.all([concurrent(post), concurrent(post)]), [null, null]);
  assert.equal((await readdir(path.join(f.root, "hook-metadata"))).filter(n => n.startsWith("observation-")).length, 1);
  await noAction(f);
});

test("stale mapping, action mismatch and interrupted lock cannot dispatch; unmatched recovery remains reachable", async t => {
  for (const mode of ["mapping", "action", "lock"]) {
    const f = await setup(t); f.run(f.event); await f.review();
    if (mode === "mapping") { f.state.eventBindings[0].classification.classificationSha256 = "0".repeat(64); await f.put("hook-state.json", f.state); }
    if (mode === "action") {
      f.task.action.args = ["other.mjs"]; await f.refresh(); f.request.capsule = null; f.request.readback = null; await f.prepare();
      f.state.request = await f.put("hook-request.json", { ...f.request, operation: "preflight" }); await f.put("hook-state.json", f.state);
    }
    if (mode === "lock") await mkdir(path.join(f.root, "hook-metadata", "lock"));
    assert.ok(denied(f.run(f.tool())), mode);
    assert.equal(f.run(f.tool("read", "cat sources.json")), null); await noAction(f);
  }
});
