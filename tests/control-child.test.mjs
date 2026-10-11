import test from "node:test";
import assert from "node:assert/strict";
import {runControlChild} from "../scripts/control-child.mjs";

const run = (program, options = {}) => runControlChild({executable: process.execPath,
  args: ["--input-type=module", "-e", program], cwd: process.cwd(), env: {PATH: process.env.PATH},
  input: "", timeoutMs: 3000, maxBytes: 4096, ...options});
test("detached inherited pipe cannot keep control waiting past its termination budget", {timeout: 4000}, async t => {
  const start = Date.now();
  const result = await run(`import{spawn}from'node:child_process';
    const c=spawn(process.execPath,['-e','setTimeout(()=>{},2000)'],{detached:true,stdio:['ignore',1,2]});
    console.log(c.pid);c.unref();setInterval(()=>{},1000);`, {timeoutMs: 500, stopGraceMs: 100});
  const pid = Number(result.output.trim());
  if(pid) t.after(() => {try {process.kill(-pid,"SIGKILL");} catch {}});
  assert.ok(pid > 0, "the detached pipe holder must actually have started");
  assert.equal(result.state, "UNKNOWN"); assert.equal(result.reason, "TIMEOUT");
  assert.ok(Date.now() - start < 1600, "must not wait for the detached helper to finish");
});
test("successful exit, failed exit, cancellation and excess output stay distinct", async () => {
  const good = await run("console.log('ok')");
  assert.equal(good.state,"CLOSED"); assert.equal(good.code,0); assert.equal(good.reason,null);
  const bad = await run("process.exit(7)"); assert.equal(bad.code,7);
  const cancelled = await run("process.exit(0)", {signal: AbortSignal.abort()});
  assert.equal(cancelled.state,"NOT_STARTED");
  const overflow = await run("process.stdout.write('x'.repeat(100000));setInterval(()=>{},1000)");
  assert.equal(overflow.reason,"OUTPUT_CAPACITY"); assert.ok(overflow.output.length <= 4096);
  assert.equal(overflow.timing.stdoutChunksTruncated,true);
  assert.ok(overflow.timing.stdoutChunks.every(chunk=>chunk.endByte<=Buffer.byteLength(overflow.output)));
});
test("transport timing distinguishes output acquisition from a subsequent silent timeout", async () => {
  const result=await run("console.log(JSON.stringify({phase:'sources-read'}));setInterval(()=>{},1000)",{timeoutMs:1000});
  assert.equal(result.reason,"TIMEOUT");
  assert.ok(Number.isFinite(Date.parse(result.timing.startedAt)));
  assert.ok(result.timing.firstStdoutMs>=0);
  assert.ok(result.timing.lastStdoutMs>=result.timing.firstStdoutMs);
  assert.ok(result.timing.elapsedMs>=result.timing.lastStdoutMs);
  assert.equal(result.timing.stdoutChunks.at(-1).endByte,result.stdoutBytes);
  assert.equal(result.timing.stdoutChunksTruncated,false);
  assert.ok(result.timing.stdoutChunks.every(chunk=>Object.keys(chunk).sort().join(',')==='atMs,endByte'));
});
test("successful silent child is not assigned fictional output acquisition", async()=>{
  const result=await run("process.exit(0)");
  assert.equal(result.timing.firstStdoutMs,null);assert.equal(result.timing.lastStdoutMs,null);
  assert.deepEqual(result.timing.stdoutChunks,[]);
});
test("split UTF-8 bytes preserve both retained answers and diagnostics",async()=>{
  const result=await run("process.stdout.write(Buffer.from([0xd0]));process.stderr.write(Buffer.from([0xe2,0x82]));setTimeout(()=>{process.stdout.write(Buffer.from([0x96]));process.stderr.write(Buffer.from([0xac]));},50)");
  assert.equal(result.output,String.fromCharCode(0x416));
  assert.equal(result.errors,String.fromCharCode(0x20ac));
  assert.equal(result.stdoutBytes,2);assert.equal(result.stderrBytes,3);
  assert.equal(result.timing.stdoutChunks.at(-1).endByte,2);
  assert.equal(result.reason,null);
});
