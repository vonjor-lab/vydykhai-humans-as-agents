// Disposable protocol host, not a native Codex adapter or production authorization layer.
import {readFile, open, rename} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {canonicalJson, sha256} from "../../../scripts/memory-brief.mjs";
import {evaluateCheckpointReview} from "../../../scripts/vydykhai.mjs";
import {nativeActionCommand} from "../../../scripts/context-hook.mjs";

const [mode, file] = process.argv.slice(2);
const config = JSON.parse(await readFile(file, "utf8"));
const hash = v => sha256(canonicalJson(v));
if (mode === "run" || mode === "reconcile") {
  const actual = nativeActionCommand({...config.action, executable: process.execPath});
  const fixed = config.hookArgs[config.hookArgs.indexOf("--command") + 1];
  if (actual !== config.event?.tool_input?.command || actual !== fixed) throw Error("DISPATCH_BINDING_MISMATCH");
}
async function durable(file, value) {
  const temp = `${file}.pending`;
  const handle = await open(temp, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify(value) + "\n"); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temp, file);
}
function hook(event) {
  const run = spawnSync(process.execPath, config.hookArgs, {input: JSON.stringify(event), encoding: "utf8", timeout: 5000});
  if (run.status !== 0 || run.error) throw Error("HOOK_PROCESS_FAILED");
  const response = run.stdout ? JSON.parse(run.stdout) : null;
  if (response?.hookSpecificOutput?.permissionDecision === "deny") return response;
  if (response !== null) throw Error("HOOK_OBSERVATION_UNSETTLED");
  return null;
}
async function interruptAt(stage) {
  process.send?.({stage});
  await new Promise(() => setInterval(() => {}, 1000));
}
if (mode === "watch") {
  process.send?.({stage: "WATCHING"});
  await new Promise(resolve => setTimeout(resolve, config.delayMs));
  const state = await readFile(config.state, "utf8"), outbox = await readFile(config.outbox, "utf8");
  const observed = evaluateCheckpointReview(state, outbox, {now: Date.now()});
  await durable(config.result, {stateSha256: sha256(state), outboxSha256: sha256(outbox), observed});
  process.send?.({stage: "OBSERVED"});
} else if (mode === "run") {
  const denied = hook(config.event);
  if (denied) {
    console.log(JSON.stringify({status: "BLOCKED", evidence: denied}));
  } else {
    if (config.interruption === "before-action") await interruptAt("ADMITTED_WITHOUT_EFFECT");
    const run = spawnSync(process.execPath, config.action.args, {cwd: config.action.cwd,
      env: {}, encoding: "utf8", timeout: 5000});
    if (run.error) throw run.error;
    if (config.interruption === "before-observation") await interruptAt("EFFECT_WITHOUT_OBSERVATION");
    const response = {exit_code: run.status, output: run.stdout};
    await durable(config.observation, {schema: "qualification.observation.v1", event: config.event,
      actionSha256: hash(config.action), response, responseSha256: hash(response)});
    if (config.interruptBeforePost) {
      await interruptAt("DURABLE_EFFECT_WITHOUT_POST");
    }
    hook({...config.event, hook_event_name: "PostToolUse", tool_response: response});
    console.log(JSON.stringify({status: "OBSERVED", response}));
  }
} else if (mode === "reconcile") {
  const observation = JSON.parse(await readFile(config.observation, "utf8"));
  if (hash(observation.event) !== hash(config.event) || observation.actionSha256 !== hash(config.action) ||
      observation.responseSha256 !== hash(observation.response)) throw Error("STALE_HOST_OBSERVATION");
  hook({...observation.event, hook_event_name: "PostToolUse", tool_response: observation.response});
  console.log(JSON.stringify({status: "RECONCILED_WITHOUT_REPLAY", response: observation.response}));
} else throw Error("UNKNOWN_MODE");
