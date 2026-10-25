import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, realpath, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import childProcess from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import {setTimeout as delay} from "node:timers/promises";
import {fixture, hash} from "./context-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";

async function waitFor(file, deadline) {
  while (performance.now() < deadline) {
    try {return JSON.parse(await readFile(file, "utf8"));}
    catch (error) {if (error.code !== "ENOENT") throw error;}
    await delay(10);
  }
  throw Error("FIXTURE_RECEIPT_DEADLINE");
}

for (const mode of ["timeout", "output-limit"]) test(`writable ${mode} settles before escaped pipe holder exits, without closed proof`, {
  skip: process.platform !== "darwin" && "requires existing macOS writable sandbox"
}, async t => {
  const body = "import {spawn} from 'node:child_process'; import {writeFileSync,renameSync} from 'node:fs';\n" +
    "const holder = spawn(process.execPath, ['holder.mjs'], {detached:true,stdio:['ignore','inherit','inherit']});\n" +
    "writeFileSync('holder-pid.tmp',JSON.stringify({pid:holder.pid})); renameSync('holder-pid.tmp','holder-pid.json'); holder.unref();\n" +
    (mode === "output-limit" ? "process.stdout.write('x'.repeat(70000));\n" : "") +
    "setInterval(()=>{},1000);\n";
  const f = await fixture(t, {actionBody: body});
  await f.put("holder.mjs", "import {writeFileSync,renameSync} from 'node:fs';\n" +
    "writeFileSync('holder-start.tmp',JSON.stringify({pid:process.pid,at:Date.now()}));renameSync('holder-start.tmp','holder-start.json');\n" +
    "setTimeout(()=>{writeFileSync('holder-end.tmp',JSON.stringify({pid:process.pid}));renameSync('holder-end.tmp','holder-end.json');process.exit(0);},1800);\n");
  f.task.action.timeoutMs = 500;
  if (mode === "output-limit") f.task.action.maxOutputBytes = 1024;
  await f.refresh(); const prepared = await f.prepare();
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "command-deadline-")));
  t.after(() => rm(directory, {recursive:true,force:true}));
  const config = {workspace:f.root,policy:sha256("public-timeout-fixture"),owner:"owner",executor:"worker",reviewer:"reviewer"};
  const host = await openControlHost(directory,config,{}); await host.initialize();
  const binding = {operation:"resume",taskId:f.task.id,taskSha256:f.request.task.sha256,capsuleSha256:f.request.capsule.sha256,
    sourceDigest:prepared.coverageBasis.sourceDigest,dependencyDigest:prepared.coverageBasis.dependencyDigest,
    commandSha256:hash(f.task.action),cwd:f.root,executable:await realpath(process.execPath),kind:"dependent"};
  await host.approveCommand(binding,{reviewer:"reviewer",reviewReceipt:"public-fixture-current-readiness",dependencies:[],expiresAt:Date.now()+60000});
  const sandboxLaunch = await localControlSandbox({workspace:f.root,controlRoot:directory});
  const spawn = childProcess.spawn;
  let commandChild, holderPid, launchedAt, exitedAt, closedAt, watchdog, watchdogUsed = false, settled = false;
  let notifyLaunch; const launched = new Promise(resolve => {notifyLaunch = resolve;});
  const killOwned = pid => {
    if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) return;
    try {process.kill(-pid,"SIGKILL");} catch (error) {if(error.code !== "ESRCH") throw error;}
  };
  const cleanup = async () => {
    clearTimeout(watchdog);
    if (!holderPid) {
      try {holderPid = JSON.parse(await readFile(path.join(f.root,"holder-pid.json"),"utf8")).pid;}
      catch (error) {if(error.code !== "ENOENT") throw error;}
    }
    killOwned(holderPid); killOwned(commandChild?.pid);
    commandChild?.stdout?.destroy(); commandChild?.stderr?.destroy(); commandChild?.unref();
  };
  t.mock.method(childProcess,"spawn",(...args) => {
    commandChild = spawn(...args); launchedAt = performance.now(); notifyLaunch();
    commandChild.once("exit",()=>{exitedAt=performance.now();});
    commandChild.once("close",()=>{closedAt=performance.now();});
    watchdog = setTimeout(()=>{watchdogUsed=true; cleanup().catch(error=>t.diagnostic(error.code));},2500);
    return commandChild;
  });
  syncBuiltinESMExports();
  t.after(async()=>{try {await cleanup();} finally {t.mock.restoreAll();syncBuiltinESMExports();}});
  let transition;
  try {
    transition = runControlledContextTransition({...f.request,operation:"resume"},{control:host.control,sandboxLaunch})
      .then(result=>{settled=true;return result;});
    await launched;
    holderPid = (await waitFor(path.join(f.root,"holder-pid.json"),launchedAt+800)).pid;
    const holder = await waitFor(path.join(f.root,"holder-start.json"),launchedAt+800);
    assert.equal(holder.pid,holderPid);
    if (mode === "timeout") {
      await delay(Math.max(0,launchedAt+650-performance.now()));
      assert.ok(exitedAt,"original process has actually exited");
      assert.equal(closedAt,undefined,"escaped holder still owns inherited pipes before teardown");
      assert.equal(settled,false);
    }
    const result = await transition, elapsed = performance.now()-launchedAt;
    assert.ok(elapsed < 1100,`settled after ${Math.round(elapsed)}ms; expected 500ms deadline + 250ms grace + scheduling tolerance`);
    await assert.rejects(readFile(path.join(f.root,"holder-end.json")),{code:"ENOENT"});
    assert.equal(result.status,"BLOCKED"); assert.equal(result.actionOutcome,"OUTCOME_UNKNOWN");
    assert.equal(result.replayRequiresReconciliation,true);
    const beforeLateExit = await host.snapshot(), reservation = beforeLateExit.reservations[hash(binding)];
    assert.equal(reservation.status,"IN_FLIGHT"); assert.equal(reservation.failure,undefined);
    assert.equal(reservation.resultSha256,undefined);
    await assert.rejects(host.control.authorize(binding),/COMMAND_NOT_APPROVED/);
    const different = {...binding,commandSha256:sha256("different-command")};
    await host.approveCommand(different,{reviewer:"reviewer",reviewReceipt:"new-readiness",dependencies:[],expiresAt:Date.now()+60000});
    await assert.rejects(host.control.authorize(different),/TASK_OUTCOME_UNKNOWN/);
    const held = await host.snapshot();
    await waitFor(path.join(f.root,"holder-end.json"),launchedAt+2400); await delay(30);
    assert.deepEqual(await host.snapshot(),held,"late pipe close cannot fabricate failure/completion proof");
    assert.equal(watchdogUsed,false);
    t.diagnostic(`${mode}: parent exit ${Math.round(exitedAt-launchedAt)}ms; settlement ${Math.round(elapsed)}ms; holder self-exit <2400ms; watchdog unused`);
  } finally {
    await cleanup(); if(transition)await transition;
  }
});
