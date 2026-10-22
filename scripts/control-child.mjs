// Bounded process observation. Timeout/abort requests are never exit evidence.
import {spawn} from "node:child_process";
import {StringDecoder} from "node:string_decoder";

export async function runControlChild({executable, args, cwd, env, input, timeoutMs,
  maxBytes, signal, stopGraceMs = 250, completedOutput}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 16 * 1024 * 1024 ||
      !Number.isSafeInteger(stopGraceMs) || stopGraceMs < 1 || stopGraceMs > 2000)
    throw Error("CONTROL_CHILD_BUDGET_INVALID");
  if(signal?.aborted) return {state: "NOT_STARTED", reason: "CANCELLED_BEFORE_DISPATCH",
    code: null, signal: null, output: "", errors: "", stdoutBytes: 0, stderrBytes: 0};
  const child = spawn(executable, args, {cwd, env, detached: true, stdio: ["pipe", "pipe", "pipe"]});
  const startedAt = new Date().toISOString(), started = performance.now(), stdoutChunks = [];
  const stdoutDecoder = new StringDecoder("utf8"), stderrDecoder = new StringDecoder("utf8");
  let firstStdoutMs = null, lastStdoutMs = null, stdoutChunksTruncated = false;
  let output = "", errors = "", stdoutBytes = 0, stderrBytes = 0, reason = null, grace, finish;
  const done = new Promise(resolve => {finish = resolve;});
  const kill = () => {
    if(child.pid) {try {process.kill(-child.pid, "SIGKILL");} catch(e) {if(e.code !== "ESRCH") reason = "TERMINATION_UNKNOWN";}}
  };
  const stop = why => {
    if(grace) return;
    reason ??= why; kill();
    grace = setTimeout(() => finish({state: "UNKNOWN", code: null, signal: null}), stopGraceMs);
  };
  const abort = () => stop("CANCELLED");
  child.once("error", () => {reason ??= "SPAWN_FAILED";});
  child.once("close", (code, endedBy) => finish({state: "CLOSED", code, signal: endedBy}));
  child.stdout.on("data", chunk => {
    stdoutBytes += chunk.length;
    lastStdoutMs = Math.round(performance.now() - started);
    firstStdoutMs ??= lastStdoutMs;
    // Offsets address retained transport bytes, not JavaScript string positions
    // or model reasoning. No duplicate output text is stored.
    if(stdoutBytes + stderrBytes <= maxBytes) {
      output += stdoutDecoder.write(chunk);
      if (stdoutChunks.length < 256) stdoutChunks.push({endByte: stdoutBytes, atMs: lastStdoutMs});
      else stdoutChunksTruncated = true;
      // A protocol-specific durable receipt can end a read-only reviewer. The
      // caller must still verify it and observe actual process termination.
      if(completedOutput) {
        try {const completion=completedOutput(output);if(completion) stop(completion===true?"RESULT_SUBMITTED":completion);}
        catch {stop("RESULT_OBSERVATION_FAILED");}
      }
    } else {stdoutChunksTruncated = true; stop("OUTPUT_CAPACITY");}
  });
  child.stderr.on("data", chunk => {
    stderrBytes += chunk.length;
    if(stdoutBytes + stderrBytes <= maxBytes) errors += stderrDecoder.write(chunk); else stop("OUTPUT_CAPACITY");
  });
  child.stdin.on("error", () => {});
  signal?.addEventListener("abort", abort, {once: true});
  const timer = setTimeout(() => stop("TIMEOUT"), timeoutMs);
  if(signal?.aborted) abort(); else child.stdin.end(input);
  let result;
  try {result = await done;}
  finally {clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener("abort", abort);}
  if(result.state === "UNKNOWN") {
    kill(); child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
  }
  output += stdoutDecoder.end(); errors += stderrDecoder.end();
  return {...result, reason, output, errors, stdoutBytes, stderrBytes,
    timing: {startedAt, elapsedMs: Math.round(performance.now() - started), firstStdoutMs, lastStdoutMs,
      stdoutChunks, stdoutChunksTruncated}};
}
