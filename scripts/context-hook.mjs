// Opt-in POSIX lifecycle callback adapter. It never invokes the managed action.
import { readFile, lstat, realpath, mkdir, rmdir, rename, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { parseContextJson, runContextTransition } from "./context-run.mjs";

const MAX = 2 * 1024 * 1024;
const hash = value => sha256(canonicalJson(value));
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).sort().join() === [...names].sort().join();
const text = v => typeof v === "string" && v.length > 0 && v.length <= 4096 && !v.includes("\0");
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const ref = v => keys(v, ["path", "sha256"]) && text(v.path) && digest(v.sha256);
const need = (v, code) => { if (!v) throw new Error(code); };
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
export const nativeActionCommand = action => `cd -- ${quote(action.cwd)} && ${[action.executable, ...action.args].map(quote).join(" ")}`;
export const hookEventKey = e => hash({ session: e.session_id, turn: e.turn_id });
const invocationKey = e => hash({ session: e.session_id, tool: e.tool_use_id });
const quiet = () => ({ output: null, code: "QUIET" });
const feedback = (event, code) => ({ code, output: event === "PreToolUse" ? {
  hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: `Context preflight: ${code}. Read context state and reconcile the source/receipt before retrying; recovery tools remain available.` },
} : { systemMessage: `Context callback: ${code}. Managed action remains unverified; review local metadata.` } });

async function readBounded(file) {
  const stat = await lstat(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX, "HOOK_FILE_INVALID");
  const bytes = await readFile(file); need(bytes.length <= MAX, "HOOK_FILE_INVALID"); return bytes;
}
async function safePath(root, relative) {
  need(text(relative) && !path.isAbsolute(relative) && !relative.split(/[\\/]/).includes(".."), "HOOK_PATH_INVALID");
  const target = path.resolve(root, relative);
  need(target.startsWith(root + path.sep) && await realpath(target) === target, "HOOK_PATH_INVALID");
  return target;
}
const json = async file => parseContextJson(await readBounded(file));
async function pinned(root, reference) {
  need(ref(reference), "HOOK_REF_INVALID");
  const bytes = await readBounded(await safePath(root, reference.path));
  need(sha256(bytes) === reference.sha256, "HOOK_PIN_CHANGED"); return parseContextJson(bytes);
}
async function optional(file) {
  try { return await json(file); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
async function save(file, value) {
  // Caller holds the directory lock. Rename never exposes partial JSON to readers.
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, canonicalJson(value) + "\n", { flag: "wx", mode: 0o600 });
  await rename(temp, file);
}
async function lock(dir) {
  const target = path.join(dir, "lock");
  for (let n = 0; n < 20; n++) {
    try { await mkdir(target, { mode: 0o700 }); return () => rmdir(target); }
    catch (e) { if (e.code !== "EEXIST") throw e; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("HOOK_BUSY_RECONCILE"); // Never steal a crashed/concurrent owner's lock.
}

// Library preflight is read-only: shared context checks plus transport-to-source binding.
export async function preflightHook(state, root, events, services = {}) {
  need(keys(state, ["schema", "request", "eventBindings"]) && state.schema === "context.hook-state.v1" &&
    ref(state.request) && Array.isArray(state.eventBindings) && state.eventBindings.length <= 256, "HOOK_STATE_INVALID");
  const request = await pinned(root, state.request);
  need(request.operation === "preflight" && request.workspace === root, "HOOK_REQUEST_INVALID");
  const result = await runContextTransition(request, services);
  if (result.status !== "READY") return result;
  const mapped = new Map();
  for (const b of state.eventBindings) {
    need(keys(b, ["eventKey", "eventSha256", "classification"]) && digest(b.eventKey) && digest(b.eventSha256) &&
      object(b.classification) && !mapped.has(b.eventKey), "HOOK_EVENT_BINDING_INVALID");
    need(result.classificationBindings.some(c => hash(c) === hash(b.classification)), "HOOK_CLASSIFICATION_CHANGED");
    mapped.set(b.eventKey, b);
  }
  for (const event of events) {
    const b = mapped.get(event.key);
    if (!b || b.eventSha256 !== hash(event)) return { status: "BLOCKED", code: "HOOK_SOURCE_PENDING" };
    const source = result.sourceBodies.find(s => s.sourceId === b.classification.sourceId &&
      s.eventId === b.classification.eventId && s.sha256 === b.classification.sha256);
    if (!source || source.bodySha256 !== event.promptSha256) return { status: "BLOCKED", code: "HOOK_SOURCE_BODY_MISMATCH" };
  }
  return result;
}

// Options are fixed in the trusted hook definition, not supplied by tool/prompt text.
export async function handleContextHook(event, options, services = {}) {
  const kind = event?.hook_event_name;
  if (!["UserPromptSubmit", "PreToolUse", "PostToolUse"].includes(kind)) return quiet();
  if (kind !== "UserPromptSubmit" && (event.tool_name !== "Bash" || event.tool_input?.command !== options.command)) return quiet();
  // Out-of-workspace sessions are unrelated, including tools used for recovery.
  if (event.cwd !== options.workspace) return quiet();
  let release;
  try {
    need(text(event.session_id) && text(event.turn_id), "HOOK_EVENT_ID_MISSING");
    need(await realpath(options.workspace) === options.workspace, "HOOK_WORKSPACE_INVALID");
    const dir = await safePath(options.workspace, options.metadata);
    need((await lstat(dir)).isDirectory(), "HOOK_METADATA_INVALID");
    release = await lock(dir);
    const eventKey = hookEventKey(event);
    if (kind === "UserPromptSubmit") {
      need(typeof event.prompt === "string" && Buffer.byteLength(event.prompt) <= MAX &&
        (event.transcript_path === null || text(event.transcript_path)), "HOOK_PROMPT_EVENT_INVALID");
      const record = { schema: "context.hook-event.v1", key: eventKey, session: event.session_id, turn: event.turn_id,
        promptSha256: sha256(event.prompt), transcriptRef: event.transcript_path };
      const file = path.join(dir, `event-${eventKey}.json`), prior = await optional(file);
      if (prior && hash(prior) !== hash(record)) await save(path.join(dir, `conflict-${eventKey}.json`), {
        session: event.session_id, originalSha256: hash(prior), revisedSha256: hash(record) });
      need(prior === null || hash(prior) === hash(record), "HOOK_EVENT_REVISION_CONFLICT");
      if (!prior) await save(file, record);
      return quiet(); // No prompt copy, semantic inference, source coverage claim or wakeup.
    }
    need(text(event.tool_use_id), "HOOK_TOOL_ID_MISSING");
    const key = invocationKey(event), admissionFile = path.join(dir, `admission-${key}.json`);
    const identity = { eventKey, session: event.session_id, turn: event.turn_id, tool: event.tool_use_id,
      commandSha256: sha256(options.command) };
    const prior = await optional(admissionFile);
    if (kind === "PostToolUse") {
      need(prior && hash(prior.identity) === hash(identity), "HOOK_ADMISSION_MISSING");
      need(Object.hasOwn(event, "tool_response"), "HOOK_RESPONSE_MISSING");
      const receipt = { schema: "context.hook-observation.v1", admissionSha256: hash(prior),
        responseSha256: hash(event.tool_response), acceptance: "NOT_ESTABLISHED" };
      const file = path.join(dir, `observation-${key}.json`), existing = await optional(file);
      need(existing === null || hash(existing) === hash(receipt), "HOOK_OBSERVATION_CONFLICT");
      if (!existing) await save(file, receipt);
      return quiet(); // No stdout copy, result rewriting, verification or action invocation.
    }
    need(prior === null, "HOOK_ALREADY_ADMITTED_RECONCILE");
    const state = await json(await safePath(options.workspace, options.state));
    const names = await readdir(dir);
    need(names.length <= 1024, "HOOK_METADATA_WINDOW_FULL");
    need(!names.includes(`intake-failure-${sha256(event.session_id)}`), "HOOK_INTAKE_FAILURE_RECONCILE");
    for (const name of names.filter(f => /^conflict-[a-f0-9]{64}\.json$/.test(f))) {
      const conflict = await json(path.join(dir, name));
      need(keys(conflict, ["session", "originalSha256", "revisedSha256"]) && text(conflict.session) &&
        digest(conflict.originalSha256) && digest(conflict.revisedSha256), "HOOK_EVENT_INVALID");
      need(conflict.session !== event.session_id, "HOOK_EVENT_REVISION_CONFLICT");
    }
    const files = names.filter(f => /^event-[a-f0-9]{64}\.json$/.test(f));
    need(files.length <= 256, "HOOK_EVENT_WINDOW_FULL");
    const events = [];
    for (const file of files) {
      const record = await json(path.join(dir, file));
      need(keys(record, ["schema", "key", "session", "turn", "promptSha256", "transcriptRef"]) &&
        record.schema === "context.hook-event.v1" && text(record.session) && text(record.turn) && digest(record.promptSha256) &&
        (record.transcriptRef === null || text(record.transcriptRef)) &&
        record.key === hookEventKey({ session_id: record.session, turn_id: record.turn }) && file === `event-${record.key}.json`, "HOOK_EVENT_INVALID");
      if (record.session === event.session_id) events.push(record);
    }
    need(events.some(e => e.key === eventKey), "HOOK_CURRENT_INPUT_UNSEEN");
    const result = await preflightHook(state, options.workspace, events, services);
    need(result.status === "READY", result.code || "HOOK_PREFLIGHT_LIMITED");
    need(nativeActionCommand(result.action) === options.command, "HOOK_ACTION_MISMATCH");
    await save(admissionFile, { schema: "context.hook-admission.v1", identity,
      requestSha256: state.request.sha256, eventSetSha256: hash(events.sort((a, b) => a.key.localeCompare(b.key))),
      sourceDigest: result.coverageBasis.sourceDigest, outcome: "AWAITING_NATIVE_OBSERVATION" });
    return quiet(); // Let Codex's original tool run; do not return allow/rewrite/approval.
  } catch (e) {
    const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(e.message) ? e.message : "HOOK_STATE_OR_IO_INVALID";
    if (kind === "UserPromptSubmit") {
      // A known failed input must not disappear behind an older reviewed record.
      // This mkdir is intentionally independent of the busy/crashed writer lock.
      try {
        need(text(event.session_id), "HOOK_EVENT_ID_MISSING");
        const dir = await safePath(options.workspace, options.metadata);
        try { await mkdir(path.join(dir, `intake-failure-${sha256(event.session_id)}`), { mode: 0o700 }); }
        catch (failure) { if (failure.code !== "EEXIST") throw failure; }
      } catch {
        return { code, output: { systemMessage: `Context intake LIMITED/UNKNOWN: ${code}; no failure marker could be persisted. User input remains available for repair or stop. Managed-action coverage cannot be certified from indistinguishable older state.` } };
      }
    }
    return feedback(kind, code);
  } finally { if (release) await release(); }
}

export async function hookMain(args, input = process.stdin) {
  const flags = ["--workspace", "--command", "--state", "--metadata"];
  need(args.length === 8 && flags.every((f, i) => args[i * 2] === f && text(args[i * 2 + 1])), "HOOK_ARGUMENTS_INVALID");
  const options = Object.fromEntries(flags.map((f, i) => [f.slice(2), args[i * 2 + 1]]));
  let data = Buffer.alloc(0);
  for await (const chunk of input) { data = Buffer.concat([data, Buffer.from(chunk)]); need(data.length <= MAX, "HOOK_INPUT_TOO_LARGE"); }
  const event = parseContextJson(data);
  // Return-source parsing stays in the existing canonical module; lazy import has no main side effects.
  const { parseDurableOutboxComment } = await import("./vydykhai.mjs");
  return handleContextHook(event, options, { parseDurableOutboxComment });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await hookMain(process.argv.slice(2));
    if (result.output) process.stdout.write(JSON.stringify(result.output) + "\n");
  } catch {
    // Unidentifiable input cannot be scoped to an action. Report protocol failure,
    // not universal fail-closed enforcement (the host skips failed hooks).
    process.stdout.write(JSON.stringify({ systemMessage: "Context hook protocol invalid; managed-action coverage is UNKNOWN. Review the hook configuration." }) + "\n");
    process.exitCode = 1;
  }
}
