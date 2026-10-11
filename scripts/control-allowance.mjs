// Caller-owned CLI/auth paths only. No credential reads, inference, store or budget mutations.
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {lstat, realpath} from "node:fs/promises";
import path from "node:path";

const source = "codex-app-server:account/rateLimits/read";
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const positive = v => Number.isSafeInteger(v) && v > 0;
const absolute = v => typeof v === "string" && !v.includes("\0") && path.isAbsolute(v);
const maxTime = 8640000000000000;
const isolation = ["analytics.enabled=false", 'cli_auth_credentials_store="file"', "mcp_servers={}",
  "features.plugins=false", "features.remote_plugin=false", "features.apps=false", "features.enable_mcp_apps=false",
  "features.codex_apps_mcp_2026_07_28=false", "features.hooks=false", "features.skill_mcp_dependency_install=false",
  "features.skip_host_skill_discovery=true", "features.shell_tool=false", "features.unified_exec=false",
  "features.shell_snapshot=false", "features.multi_agent=false", "agents.enabled=false",
  'shell_environment_policy.inherit="none"', "project_doc_max_bytes=0", "notify=[]", 'web_search="disabled"',
  'otel.exporter="none"', 'otel.trace_exporter="none"'];
const unknown = (request, reason) => ({schema:"control.allowance.v1", status:"UNKNOWN", request, reason,
  observation:null, window:null});

async function metadata(file) {
  try {return await lstat(file);} catch (e) {if (["ENOENT", "ENOTDIR"].includes(e.code)) return null; throw e;}
}
async function inspectAuthHome(home) {
  if (typeof process.getuid !== "function") return "AUTH_HOME_OWNER_UNSUPPORTED";
  if (path.resolve(home) !== home || await realpath(home) !== home) return "AUTH_HOME_UNSAFE";
  const uid = process.getuid();
  for (let cursor = home;; cursor = path.dirname(cursor)) {
    const stat = await lstat(cursor), leaf = cursor === home;
    if (!stat.isDirectory() || stat.isSymbolicLink() || ![0, uid].includes(stat.uid) ||
        leaf && (stat.uid !== uid || stat.mode & 0o077) ||
        !leaf && stat.mode & 0o022 && !(stat.mode & 0o1000)) return "AUTH_HOME_UNSAFE";
    // Empty-table CLI overrides merge, so they cannot remove inherited MCP entries.
    if (leaf && (await metadata(path.join(home, "config.toml")) || await metadata(path.join(home, "managed_config.toml"))) ||
        await metadata(path.join(cursor, ".codex", "config.toml"))) return "AUTH_HOME_CONFIG_PRESENT";
    if (path.dirname(cursor) === cursor) break;
  }
  const auth = await metadata(path.join(home, "auth.json"));
  if (auth && (!auth.isFile() || auth.isSymbolicLink() || auth.uid !== uid || auth.mode & 0o077 || auth.nlink !== 1))
    return "AUTH_FILE_UNSAFE";
  return null;
}

function normalize(result, request, observedAt) {
  if (!object(result)) return unknown(request, "RESULT_INVALID");
  let bucket, bucketPath;
  // A present but unavailable multi-bucket view must not downgrade to the legacy view.
  if (Object.hasOwn(result, "rateLimitsByLimitId")) {
    const map = result.rateLimitsByLimitId;
    if (!object(map) || !Object.hasOwn(map, request.limitId) || !object(map[request.limitId]))
      return unknown(request, "BUCKET_UNAVAILABLE");
    bucket = map[request.limitId];
    bucketPath = `rateLimitsByLimitId[${JSON.stringify(request.limitId)}]`;
    // The explicit map key identifies the bucket even if optional display metadata is null.
    if (bucket.limitId != null && bucket.limitId !== request.limitId)
      return unknown(request, "BUCKET_ID_MISMATCH");
  } else {
    bucket = result.rateLimits;
    bucketPath = "rateLimits";
    if (!object(bucket) || bucket.limitId !== request.limitId)
      return unknown(request, "BUCKET_UNAVAILABLE");
  }
  const windows = ["primary", "secondary"].filter(key => bucket[key] != null);
  if (windows.some(key => !object(bucket[key]) || !positive(bucket[key].windowDurationMins)))
    return unknown(request, "WINDOW_AMBIGUOUS");
  const matches = windows.filter(key => bucket[key].windowDurationMins === request.windowDurationMins);
  if (matches.length !== 1) return unknown(request, matches.length ? "WINDOW_AMBIGUOUS" : "WINDOW_UNAVAILABLE");
  const key = matches[0], selected = bucket[key], seconds = selected.resetsAt;
  if (!Number.isSafeInteger(selected.usedPercent) || selected.usedPercent < 0 || selected.usedPercent > 2147483647)
    return unknown(request, "USAGE_UNAVAILABLE");
  const resetAt = seconds * 1000;
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(resetAt) || resetAt > maxTime ||
      !Number.isSafeInteger(observedAt) || observedAt < 0 || observedAt > maxTime || resetAt < observedAt)
    return unknown(request, "RESET_UNAVAILABLE");
  const window = {limitId:request.limitId, windowDurationMins:request.windowDurationMins,
    usedPercent:selected.usedPercent, remainingPercent:Math.max(0, 100 - selected.usedPercent)};
  const evidence = createHash("sha256").update(JSON.stringify({source, bucketPath, key, window, resetAt, observedAt})).digest("hex");
  return {schema:"control.allowance.v1", status:"OBSERVED", request, window,
    observation:{trusted:true, resetAt, observedAt, source, evidence:`${source}:sha256:${evidence}`}};
}

/**
 * Explicit binary/authHome must be host-owned, not worker input. authHome is the
 * CLI's CODEX_HOME; HOME and cwd are isolated there too. No process.env inheritance.
 * POSIX owner-private canonical auth-only home; config-bearing homes are refused.
 * Metadata only: never read/copy auth.json. Parent directories must be trusted.
 * windowDurationMins is explicit (weekly = 10080). Returned request retains policy.
 * Only OBSERVED.observation may be passed to health.recordResetObservation.
 * Native resetsAt is Unix seconds; health timestamps are epoch milliseconds.
 */
export async function readControlAllowance(options = {}) {
  const {binary, authHome, limitId, windowDurationMins, timeoutMs = 5000, maxBytes = 65536, signal} = options ?? {};
  const request = {binary, authHome, limitId, windowDurationMins, timeoutMs, maxBytes};
  if (!absolute(binary) || !absolute(authHome) || typeof limitId !== "string" ||
      !limitId.trim() || limitId.length > 128 || /[\x00-\x1f\x7f]/.test(limitId) || !positive(windowDurationMins) ||
      !positive(timeoutMs) || timeoutMs > 10000 || !positive(maxBytes) || maxBytes < 1024 || maxBytes > 1048576 ||
      signal != null && (typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function"))
    return unknown(request, "CONFIG_INVALID");
  if (signal?.aborted) return unknown(request, "CANCELLED");
  const deadline = performance.now() + timeoutMs;
  let metadataTimer, metadataAbort;
  const refusal = await Promise.race([inspectAuthHome(authHome).catch(() => "AUTH_HOME_UNSAFE"),
    new Promise(resolve => {
      metadataTimer = setTimeout(() => resolve("TIMEOUT"), timeoutMs);
      metadataAbort = () => resolve("CANCELLED");
      signal?.addEventListener("abort", metadataAbort, {once:true});
      if (signal?.aborted) metadataAbort();
    })]);
  clearTimeout(metadataTimer); signal?.removeEventListener("abort", metadataAbort);
  if (refusal) return unknown(request, refusal);
  const remainingMs = Math.ceil(deadline - performance.now());
  if (signal?.aborted || remainingMs <= 0) return unknown(request, signal?.aborted ? "CANCELLED" : "TIMEOUT");
  return await new Promise(resolve => {
    let child;
    try {
      child = spawn(binary, ["app-server", "--listen", "stdio://", ...isolation.flatMap(value => ["-c", value])], {
        cwd:authHome, env:{HOME:authHome, CODEX_HOME:authHome, PATH:"/usr/bin:/bin",
          NODE_V8_COVERAGE:""},
        shell:false, detached:process.platform !== "win32", stdio:["pipe", "pipe", "pipe"]});
    } catch {resolve(unknown(request, "SPAWN_FAILED")); return;}
    let bytes = 0, pending = Buffer.alloc(0), expected = 1, result, stopping = false, finished = false, grace;
    const kill = () => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (e) {if (e.code !== "ESRCH") result = unknown(request, "TERMINATION_UNKNOWN");}
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener("abort", abort);
      pending = Buffer.alloc(0);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
      resolve(result ?? unknown(request, "PROCESS_EXIT"));
    };
    const stop = value => {
      if (stopping || finished) return;
      stopping = true; result = value; clearTimeout(timer); kill();
      // Inherited pipes cannot make an owned-process cleanup wait unboundedly.
      grace = setTimeout(() => {result = unknown(request, "TERMINATION_UNKNOWN"); kill(); finish();}, 250);
    };
    const fail = reason => stop(unknown(request, reason));
    const abort = () => fail("CANCELLED");
    const send = message => {
      if (stopping || finished) return;
      try {child.stdin.write(JSON.stringify(message) + "\n");} catch {fail("WRITE_FAILED");}
    };
    const receive = line => {
      let message;
      try {message = JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(line));}
      catch {fail("PROTOCOL_INVALID"); return;}
      if (!object(message) || message.jsonrpc !== undefined && message.jsonrpc !== "2.0") {
        fail("PROTOCOL_INVALID"); return;
      }
      if (!Object.hasOwn(message, "id")) {
        if (typeof message.method !== "string" || Object.hasOwn(message, "result") || Object.hasOwn(message, "error"))
          fail("PROTOCOL_INVALID");
        return; // Notifications (including sparse usage updates) are not read evidence.
      }
      if (message.id !== expected || Object.hasOwn(message, "method")) {fail("PROTOCOL_INVALID"); return;}
      if (Object.hasOwn(message, "error")) {fail("RPC_ERROR"); return;}
      if (!object(message.result)) {fail("PROTOCOL_INVALID"); return;}
      if (expected === 1) {
        expected = 2;
        send({method:"initialized"});
        send({id:2, method:"account/rateLimits/read", params:{excludeResetCreditDetails:true, supportsLunaReserve:false}});
      } else stop(normalize(message.result, request, Date.now()));
    };
    const timer = setTimeout(() => fail("TIMEOUT"), remainingMs);
    child.once("error", () => fail("SPAWN_FAILED"));
    child.once("close", (code, endedBy) => {
      if (result?.status === "OBSERVED" && (code !== null && code !== 0 || endedBy && endedBy !== "SIGKILL"))
        result = unknown(request, "PROCESS_EXIT");
      finish();
    });
    child.stdin.on("error", () => fail("WRITE_FAILED"));
    child.stdout.on("error", () => fail("READ_FAILED"));
    child.stderr.on("error", () => fail("READ_FAILED"));
    const count = chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        if (stopping) result = unknown(request, "OUTPUT_CAPACITY"); else fail("OUTPUT_CAPACITY");
        return false;
      }
      return !stopping && !finished;
    };
    child.stderr.on("data", count); // Bound but never retain or log stderr/account data.
    child.stdout.on("data", chunk => {
      if (!count(chunk)) return;
      pending = Buffer.concat([pending, chunk]);
      let index;
      while (!stopping && !finished && (index = pending.indexOf(10)) !== -1) {
        const line = pending.subarray(0, index); pending = pending.subarray(index + 1); receive(line);
      }
    });
    signal?.addEventListener("abort", abort, {once:true});
    if (signal?.aborted) abort();
    else send({id:1, method:"initialize", params:{clientInfo:{name:"vydykhai_allowance", version:"1.0.0"},
      capabilities:{experimentalApi:false, explicitGatewayOauth:true}}});
  });
}
