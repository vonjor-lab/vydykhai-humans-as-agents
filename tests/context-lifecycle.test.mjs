import test from "node:test";
import assert from "node:assert/strict";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync, fork} from "node:child_process";
import {once} from "node:events";
import {fixture, hash} from "./context-fixture.mjs";
import {nativeActionCommand, hookEventKey} from "../scripts/context-hook.mjs";
import {createReturnRoute, validateDurableOutbox} from "../scripts/vydykhai.mjs";

const hook = fileURLToPath(new URL("../scripts/context-hook.mjs", import.meta.url));
const host = fileURLToPath(new URL("./fixtures/framework-v2/lifecycle-host.mjs", import.meta.url));
const json = async p => JSON.parse(await readFile(p, "utf8"));
function invoke(script, args, input) {
  const run = spawnSync(process.execPath, [script, ...args], {input: input && JSON.stringify(input), encoding: "utf8", timeout: 5000});
  assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr);
  return run.stdout ? JSON.parse(run.stdout) : null;
}
async function checkpoint(child, stage) {
  const timeout = AbortSignal.timeout(5000);
  for (;;) {
    const [message] = await once(child, "message", {signal: timeout});
    if (message.stage === stage) return;
  }
}
async function launched(t, args) {
  const child = fork(host, args, {silent: true});
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  return child;
}

test("process interruption preserves real output, blocks replay, retains Return and enables a distinct next task", async t => {
  const f = await fixture(t, {actionBody: `import {appendFileSync, readFileSync} from 'node:fs';
import {buildBundle} from './candidate.mjs';
const result = buildBundle(JSON.parse(readFileSync(process.argv[2], 'utf8')));
appendFileSync('actions.log', JSON.stringify(result) + '\\n');
console.log(JSON.stringify(result));\n`});
  await f.put("input-1.json", [{id: "b", label: " Beta "}, {id: "a", label: "Alpha"}]);
  f.task.action.args.push("input-1.json"); await f.refresh(); await f.prepare();
  await mkdir(path.join(f.root, "hook-metadata"));
  const command = nativeActionCommand({...f.task.action, cwd: f.root});
  const hookArgs = [hook, "--workspace", f.root, "--command", command,
    "--state", "hook-state.json", "--metadata", "hook-metadata"];
  const event = {cwd: f.root, session_id: "first-host", turn_id: "first-turn", transcript_path: null,
    hook_event_name: "UserPromptSubmit", prompt: f.exported.events[0].body};
  assert.equal(invoke(hook, hookArgs.slice(1), event), null);
  const record = await json(path.join(f.root, "hook-metadata", `event-${hookEventKey(event)}.json`));
  const state = {schema: "context.hook-state.v1", request: await f.put("hook-request.json", {...f.request, operation: "preflight"}),
    eventBindings: [{eventKey: record.key, eventSha256: hash(record), classification: f.binding(f.classifications.records[0])}]};
  await f.put("hook-state.json", state);
  const tool = {...event, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command}, tool_use_id: "original-call"};
  const config = {hookArgs, event: tool, action: {args: f.task.action.args, cwd: f.root},
    observation: path.join(f.root, "host-observation.json"), interruptBeforePost: true};
  await f.put("input-2.json", [{id: "c", label: " Gamma "}]);
  await f.put("mismatch.json", {...config, action: {...config.action, args: ["action.mjs", "input-2.json"]}, interruptBeforePost: false});
  const mismatched = spawnSync(process.execPath, [host, "run", path.join(f.root, "mismatch.json")], {encoding: "utf8", timeout: 5000});
  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /DISPATCH_BINDING_MISMATCH/);
  await assert.rejects(readFile(path.join(f.root, "actions.log")), {code: "ENOENT"});
  await f.put("host.json", config);
  const child = await launched(t, ["run", path.join(f.root, "host.json")]);
  await checkpoint(child, "DURABLE_EFFECT_WITHOUT_POST");
  const closed = once(child, "close"); child.kill("SIGKILL");
  assert.equal((await closed)[1], "SIGKILL");
  const observed = await json(config.observation);
  assert.deepEqual(JSON.parse(observed.response.output), {schema: "bundle/v1",
    entries: [{id: "a", label: "Alpha"}, {id: "b", label: "Beta"}], count: 2});
  const effect = await readFile(path.join(f.root, "actions.log"), "utf8");

  // A fresh host has only durable files; changing the call id cannot hide UNKNOWN.
  await f.put("retry.json", {...config, event: {...tool, tool_use_id: "retry"}, interruptBeforePost: false});
  const retry = invoke(host, ["run", path.join(f.root, "retry.json")]);
  assert.equal(retry.status, "BLOCKED");
  assert.match(retry.evidence.hookSpecificOutput.permissionDecisionReason, /HOOK_ACTION_PENDING_RECONCILE/);
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), effect);
  // An old observation cannot be attached to a different invocation.
  const stale = spawnSync(process.execPath, [host, "reconcile", path.join(f.root, "retry.json")], {encoding: "utf8"});
  assert.notEqual(stale.status, 0); assert.match(stale.stderr, /STALE_HOST_OBSERVATION/);
  assert.equal(invoke(host, ["reconcile", path.join(f.root, "host.json")]).status, "RECONCILED_WITHOUT_REPLAY");
  assert.equal(invoke(host, ["reconcile", path.join(f.root, "host.json")]).status, "RECONCILED_WITHOUT_REPLAY");
  assert.equal(invoke(host, ["run", path.join(f.root, "host.json")]).status, "BLOCKED");
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), effect);

  const accepted = await f.run("accept"); assert.equal(accepted.status, "VERIFIED", accepted.raw);
  await f.put("return.md", accepted.returnSync);
  const parsed = validateDurableOutbox(await readFile(path.join(f.root, "return.md"), "utf8"));
  assert.equal(parsed.returns.length, 1);
  const id = parsed.returns[0].id;
  const route = createReturnRoute({returnReceiptId: id, consumer: "orchestrator",
    routedNextAction: "TASK-2 uses same accepted public contract on a new input", evidence: "observed-return-and-current-candidate"});
  await f.put("return.md", accepted.returnSync + "\n" + route);
  assert.equal(validateDurableOutbox(await readFile(path.join(f.root, "return.md"), "utf8")).issues.length, 0);
  await f.put("input-2.json", [{id: "c", label: " Gamma "}]);
  f.task.id = "TASK-2"; f.task.action.args = ["action.mjs", "input-2.json"];
  await f.refresh();
  assert.equal((await f.run("resume")).status, "BLOCKED", "Old task capsule/readback must not dispatch the next task");
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), effect);
  f.request.capsule = null; f.request.readback = null;
  await f.put("return-source.md", accepted.returnSync);
  f.registry.sources.push({id: "TASK-RETURN", path: "return-source.md", scope: ["bundle"], kind: "return"});
  await f.put("source-set.json", f.registry);
  assert.equal((await f.run()).code, "SOURCE_RANGE_PENDING", "Saved Return must be consumed, not merely exist");
  const returned = {sourceId: "TASK-RETURN", eventId: id,
    sourceSha256: hash({id, authorKind: "worker", body: accepted.returnSync}), eventDisposition: "evidence_only",
    assertions: [], reason: "Accepted prior result; existing source meaning retained",
    localOwner: null, localTask: null, review: null, integration: null};
  await f.reviewRecord(returned); f.classifications.records.push(returned);
  f.extraInventory.push({sourceId: returned.sourceId, eventId: id, sha256: returned.sourceSha256, scope: ["bundle"]});
  await f.refresh();
  const next = await f.prepare();
  assert.deepEqual(next.sourceReceipt.classifiedPrefixes[0].eventIds, ["S1", "S2", "S3"]);
  assert.ok(next.sourceReceipt.observed.some(s => s.sourceId === "TASK-RETURN" && s.eventId === id));
  const nextCommand = nativeActionCommand({...f.task.action, cwd: f.root});
  const nextArgs = [...hookArgs]; nextArgs[nextArgs.indexOf("--command") + 1] = nextCommand;
  const nextEvent = {...event, session_id: "resumed-host", turn_id: "second-turn"};
  assert.equal(invoke(hook, nextArgs.slice(1), nextEvent), null);
  const nextRecord = await json(path.join(f.root, "hook-metadata", `event-${hookEventKey(nextEvent)}.json`));
  state.request = await f.put("hook-request.json", {...f.request, operation: "preflight"});
  state.eventBindings.push({eventKey: nextRecord.key, eventSha256: hash(nextRecord), classification: f.binding(f.classifications.records[0])});
  await f.put("hook-state.json", state);
  const nextConfig = {...config, hookArgs: nextArgs, event: {...tool, session_id: nextEvent.session_id, turn_id: nextEvent.turn_id,
    tool_use_id: "next-call", tool_input: {command: nextCommand}}, action: {args: f.task.action.args, cwd: f.root},
    observation: path.join(f.root, "next-observation.json"), interruptBeforePost: false};
  await f.put("next-host.json", nextConfig);
  assert.equal(invoke(host, ["run", path.join(f.root, "next-host.json")]).status, "OBSERVED");
  const results = (await readFile(path.join(f.root, "actions.log"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(results.length, 2);
  assert.deepEqual(results[1], {schema: "bundle/v1", entries: [{id: "c", label: "Gamma"}], count: 1});
  assert.equal((await f.run("accept")).status, "VERIFIED");
});

for (const [interruption, stage, effectExpected] of [
  ["before-action", "ADMITTED_WITHOUT_EFFECT", false],
  ["before-observation", "EFFECT_WITHOUT_OBSERVATION", true],
]) test(`unknown effect after ${interruption} cannot be replayed or accepted as a recovered result`, async t => {
  const f = await fixture(t, {actionBody: `import {appendFileSync} from 'node:fs';
appendFileSync('effects.log', 'effect\\n');
console.log('effect completed');\n`});
  await f.prepare();
  await mkdir(path.join(f.root, "hook-metadata"));
  const command = nativeActionCommand({...f.task.action, cwd: f.root});
  const hookArgs = [hook, "--workspace", f.root, "--command", command,
    "--state", "hook-state.json", "--metadata", "hook-metadata"];
  const event = {cwd: f.root, session_id: "interrupted-host", turn_id: "interrupted-turn", transcript_path: null,
    hook_event_name: "UserPromptSubmit", prompt: f.exported.events[0].body};
  assert.equal(invoke(hook, hookArgs.slice(1), event), null);
  const record = await json(path.join(f.root, "hook-metadata", `event-${hookEventKey(event)}.json`));
  await f.put("hook-state.json", {schema: "context.hook-state.v1",
    request: await f.put("hook-request.json", {...f.request, operation: "preflight"}),
    eventBindings: [{eventKey: record.key, eventSha256: hash(record), classification: f.binding(f.classifications.records[0])}]});
  const tool = {...event, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {command}, tool_use_id: "original"};
  const config = {hookArgs, event: tool, action: {args: f.task.action.args, cwd: f.root},
    observation: path.join(f.root, "missing-observation.json"), interruption};
  await f.put("interrupted.json", config);
  const child = await launched(t, ["run", path.join(f.root, "interrupted.json")]);
  await checkpoint(child, stage);
  const closed = once(child, "close"); child.kill("SIGKILL");
  assert.equal((await closed)[1], "SIGKILL");
  await assert.rejects(readFile(config.observation), {code: "ENOENT"});
  const effect = await readFile(path.join(f.root, "effects.log"), "utf8").catch(e => {
    if (e.code !== "ENOENT") throw e;
    return null;
  });
  assert.equal(effect, effectExpected ? "effect\n" : null);
  await f.put("retry.json", {...config, interruption: null, event: {...tool, tool_use_id: "new-call"}});
  const retry = invoke(host, ["run", path.join(f.root, "retry.json")]);
  assert.equal(retry.status, "BLOCKED");
  assert.match(retry.evidence.hookSpecificOutput.permissionDecisionReason, /HOOK_ACTION_PENDING_RECONCILE/);
  const reconcile = spawnSync(process.execPath, [host, "reconcile", path.join(f.root, "interrupted.json")], {encoding: "utf8", timeout: 5000});
  assert.notEqual(reconcile.status, 0);
  assert.match(reconcile.stderr, /ENOENT/);
  // Candidate behavior can be tested independently; it is not recovery of the lost action.
  const verification = await f.run("accept");
  assert.equal(verification.status, "VERIFIED");
  assert.equal(verification.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.equal(verification.coverageBasis.replayProtection, "CALLER_OWNED");
  assert.equal(invoke(host, ["run", path.join(f.root, "retry.json")]).status, "BLOCKED");
  if (effectExpected) assert.equal(await readFile(path.join(f.root, "effects.log"), "utf8"), effect);
  else await assert.rejects(readFile(path.join(f.root, "effects.log")), {code: "ENOENT"});
});

test("separate timed checkpoint observation survives manager absence and stays quiet during a real wait", async t => {
  const f = await fixture(t);
  const cp = {id: "due-health", owner: "worker", dueAt: new Date(Date.now() - 1000).toISOString(),
    expected: "owned recovery result", receiptId: "missing-return", authority: "fixture-health-scope"};
  const state = status => `<!-- vydykhai:project-state v2 -->
## Control Snapshot
Orchestrator health: HEALTHY | Context: manager | Profile: ORCHESTRATOR / high
## Execution Leases
| Work | State | Owner | Repo | Baseline | DOD | Next receipt or review-by | Return route |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HEALTH recovery | ${status} | worker | fixture | baseline | recovery | ${JSON.stringify(cp)} | outbox |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify({schemaVersion: 1, id: "next", work: "HEALTH", action: "observe", owner: "worker", state: status,
    evidence: "fixture", ...(status === "WAITING" ? {resumeWhen: "human authorizes continuation"} : {})})}
\`\`\`
<!-- vydykhai:project-state:end -->`;
  await f.put("state.md", state("WORKING")); await f.put("outbox.md", "");
  const config = {state: path.join(f.root, "state.md"), outbox: path.join(f.root, "outbox.md"),
    result: path.join(f.root, "watch-result.json"), delayMs: 100};
  await f.put("watch.json", config);
  const child = await launched(t, ["watch", path.join(f.root, "watch.json")]);
  const end = once(child, "close"); await checkpoint(child, "WATCHING");
  // No manager task or completion callback runs during this interval.
  assert.equal((await end)[0], 0);
  const result = await json(config.result);
  assert.equal(result.observed.action, "REVIEW_DUE");
  assert.equal(result.observed.taskCompletion, "NOT_EVALUATED");
  await f.put("state.md", state("WAITING"));
  invoke(host, ["watch", path.join(f.root, "watch.json")]);
  assert.equal((await json(config.result)).observed.action, "NOOP");
});
