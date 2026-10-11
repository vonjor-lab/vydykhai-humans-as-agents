import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, realpath, chmod, symlink, link, rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {tmpdir} from "node:os";
import path from "node:path";
import {readControlAllowance} from "../scripts/control-allowance.mjs";
import {evaluateControlCadence} from "../scripts/control-cadence.mjs";
import {healthControl} from "../scripts/control-health.mjs";

const seconds = 4102444800; // Fixed 2100 reset; no remote account or inference.
const weekly = extras => ({usedPercent:37, windowDurationMins:10080, resetsAt:seconds, ...extras});
const bucket = extras => ({limitId:"codex", primary:{usedPercent:12, windowDurationMins:300, resetsAt:seconds},
  secondary:weekly(), ...extras});
const snapshot = extras => ({rateLimits:bucket({secondary:weekly({usedPercent:99})}),
  rateLimitsByLimitId:{codex:bucket()}, ...extras});

async function fixture(t, result = snapshot(), mode = "normal") {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "control-allowance-")));
  t.after(() => rm(root, {recursive:true, force:true}));
  const authHome = path.join(root, "auth-home"), binary = path.join(root, "fake-codex");
  await mkdir(authHome, {mode:0o700});
  const transcript = path.join(authHome, "rpc.jsonl"), pidFile = path.join(authHome, "pid");
  await writeFile(binary, `#!${process.execPath}
const fs = require("node:fs");
const readline = require("node:readline");
const {spawn} = require("node:child_process");
const mode = ${JSON.stringify(mode)}, result = ${JSON.stringify(result)};
fs.writeFileSync("pid", String(process.pid));
fs.appendFileSync("rpc.jsonl", JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd()})+"\\n");
const reply = (id, result) => process.stdout.write(JSON.stringify({id,result})+"\\n");
const noise = "PRIVATE_ACCOUNT_SENTINEL";
let stage = 0;
process.on("SIGTERM", () => {});
readline.createInterface({input:process.stdin}).on("line", line => {
  const message = JSON.parse(line);
  fs.appendFileSync("rpc.jsonl", JSON.stringify(message)+"\\n");
  if (mode === "silent") return;
  if (message.method === "initialize") {
    if (stage !== 0 || message.id !== 1 || !message.params.clientInfo.name) process.exit(7);
    stage = 1;
    if (mode === "init-error") return process.stdout.write(JSON.stringify({id:1,error:{code:-1,message:noise}})+"\\n");
    if (mode === "early-result") return reply(2,result);
    if (mode === "bad-json") return process.stdout.write(noise+"\\n");
    if (mode === "bad-frame") return process.stdout.write("null\\n");
    if (mode === "bad-version") return process.stdout.write('{"jsonrpc":"1.0","id":1,"result":{}}\\n');
    if (mode === "server-request") return process.stdout.write('{"id":1,"method":"account/read"}\\n');
    if (mode === "exit") return process.exit(8);
    if (mode === "stdout-overflow") return process.stdout.write(noise.repeat(5000));
    if (mode === "stderr-overflow") return process.stderr.write(noise.repeat(5000));
    if (mode === "partial") return process.stdout.write('{"id":1,"result":');
    if (mode === "invalid-utf8") return process.stdout.write(Buffer.from([0xff,10]));
    if (mode === "notification-only") return process.stdout.write(JSON.stringify({method:"account/rateLimits/updated",params:result})+"\\n");
    if (mode === "aggregate") return process.stderr.write(noise.repeat(40), () => reply(1, {userAgent:noise}));
    if (mode === "pipes" || mode === "escaped") {
      const descendant = spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{detached:mode === "escaped",stdio:["ignore",1,2]});
      fs.writeFileSync("descendant.pid",String(descendant.pid));
    }
    reply(1, {userAgent:noise});
    if (mode === "duplicate") reply(1,{});
  } else if (message.method === "initialized") {
    if (stage !== 1 || "id" in message) process.exit(7);
    stage = 2;
  } else if (message.method === "account/rateLimits/read") {
    if (stage !== 2 || message.id !== 2) process.exit(7);
    stage = 3;
    if (mode === "read-error") return process.stdout.write(JSON.stringify({id:2,error:{code:-1,message:noise}})+"\\n");
    if (mode === "missing-result") return process.stdout.write('{"id":2}\\n');
    if (mode === "null-result") return reply(2,null);
    if (mode === "wrong-id") return reply("2",result);
    if (mode === "notifications") process.stdout.write(JSON.stringify({method:"account/rateLimits/updated",params:snapshotNoise()})+"\\n");
    process.stderr.write(noise);
    const line = JSON.stringify({id:2,result})+"\\n";
    if (mode === "split") {
      process.stdout.write(line.slice(0,11));
      setTimeout(()=>process.stdout.write(line.slice(11)),10);
    } else {
      // Flush the late-handshake overflow before the final reply can trigger
      // client cleanup; unflushed future writes are not observed output.
      if (mode === "late-stderr") return process.stderr.write(noise.repeat(5000), () => process.stdout.write(line));
      process.stdout.write(line);
    }
  } else process.exit(7);
});
function snapshotNoise(){return {rateLimits:{limitId:"other",secondary:{usedPercent:0,resetsAt:1,windowDurationMins:10080}}};}
`, {mode:0o700});
  const request = {binary, authHome, limitId:"codex", windowDurationMins:10080, timeoutMs:2000, maxBytes:65536};
  return {root, request, transcript, pidFile};
}
const readTranscript = async x => (await readFile(x.transcript,"utf8")).trim().split("\n").map(line => JSON.parse(line));
async function stopped(x) {
  const pid = Number(await readFile(x.pidFile, "utf8"));
  assert.throws(() => process.kill(pid, 0), {code:"ESRCH"});
}
function isUnknown(result, reason) {
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.observation, null);
  assert.equal(result.window, null);
  if (reason) assert.equal(result.reason, reason);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_ACCOUNT_SENTINEL"));
}

test("fixed native handshake, explicit environment, selected weekly map and health-ready evidence", async t => {
  const x = await fixture(t, snapshot({accountId:"PRIVATE_ACCOUNT_SENTINEL", credits:{balance:"PRIVATE_ACCOUNT_SENTINEL"}}));
  const previous = process.env.CONTROL_ALLOWANCE_SECRET;
  process.env.CONTROL_ALLOWANCE_SECRET = "do-not-inherit";
  t.after(() => {if(previous === undefined)delete process.env.CONTROL_ALLOWANCE_SECRET; else process.env.CONTROL_ALLOWANCE_SECRET=previous;});
  const before = structuredClone(x.request), started = Date.now(), result = await readControlAllowance(x.request);
  assert.equal(result.status, "OBSERVED");
  assert.deepEqual(result.request, before); assert.deepEqual(x.request, before);
  assert.deepEqual(result.window, {limitId:"codex", windowDurationMins:10080, usedPercent:37, remainingPercent:63});
  assert.equal(result.observation.resetAt, seconds * 1000);
  assert.ok(result.observation.observedAt >= started && result.observation.observedAt <= Date.now());
  assert.equal(result.observation.trusted, true);
  assert.equal(result.observation.source, "codex-app-server:account/rateLimits/read");
  assert.match(result.observation.evidence, /:sha256:[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_ACCOUNT_SENTINEL"));
  const [launch, initialize, initialized, read] = await readTranscript(x);
  assert.deepEqual(launch.args.slice(0,3), ["app-server", "--listen", "stdio://"]);
  const overrides = [];
  for(let i=3;i<launch.args.length;i+=2) {assert.equal(launch.args[i],"-c");overrides.push(launch.args[i+1]);}
  assert.deepEqual(overrides, ["analytics.enabled=false", 'cli_auth_credentials_store="file"', "mcp_servers={}",
    "features.plugins=false", "features.remote_plugin=false", "features.apps=false", "features.enable_mcp_apps=false",
    "features.codex_apps_mcp_2026_07_28=false", "features.hooks=false", "features.skill_mcp_dependency_install=false",
    "features.skip_host_skill_discovery=true", "features.shell_tool=false", "features.unified_exec=false",
    "features.shell_snapshot=false", "features.multi_agent=false", "agents.enabled=false",
    'shell_environment_policy.inherit="none"', "project_doc_max_bytes=0", "notify=[]", 'web_search="disabled"',
    'otel.exporter="none"', 'otel.trace_exporter="none"']);
  assert.equal(launch.cwd, await realpath(x.request.authHome));
  // CoreFoundation may inject its own locale metadata independently of spawn's env.
  const {__CF_USER_TEXT_ENCODING, ...env} = launch.env;
  if (__CF_USER_TEXT_ENCODING !== undefined) assert.equal(process.platform,"darwin");
  assert.deepEqual(env, {HOME:x.request.authHome, CODEX_HOME:x.request.authHome, PATH:"/usr/bin:/bin", NODE_V8_COVERAGE:""});
  assert.equal(initialize.method, "initialize");
  assert.deepEqual(initialize.params.capabilities, {experimentalApi:false, explicitGatewayOauth:true});
  assert.deepEqual(initialized, {method:"initialized"});
  assert.deepEqual(read, {id:2, method:"account/rateLimits/read", params:{excludeResetCreditDetails:true, supportsLunaReserve:false}});
  await stopped(x);
  const now = Date.now(), state = {paused:false, health:{completedResetEpoch:null}, budget:{remaining:0}};
  const health = healthControl({state:async()=>structuredClone(state), update:async change=>change(state),
    config:{health:{cadence:{observer:"allowance", maxObservationAgeMs:60000}}}});
  await health.recordResetObservation({observer:"allowance", observation:result.observation});
  assert.deepEqual(state.budget, {remaining:0});
  assert.deepEqual(state.health.resetObservation, result.observation);
  assert.equal(evaluateControlCadence({observation:result.observation, now, maxObservationAgeMs:60000,
    followupOwner:"allowance"}).periodic.status, "WAITING");
});

test("explicit selection accepts either slot, keyed nullable metadata, and identified legacy only", async t => {
  const cases = [
    snapshot({rateLimitsByLimitId:{codex:bucket({primary:weekly(), secondary:null})}}),
    snapshot({rateLimitsByLimitId:{codex:bucket({limitId:null})}}),
    {rateLimits:bucket()},
    snapshot({rateLimitsByLimitId:{codex:bucket({secondary:weekly({usedPercent:0})})}}),
    snapshot({rateLimitsByLimitId:{codex:bucket({secondary:weekly({usedPercent:105})})}})
  ];
  for (const payload of cases) {
    const x = await fixture(t, payload), result = await readControlAllowance(x.request);
    assert.equal(result.status,"OBSERVED");
    assert.equal(result.window.remainingPercent, Math.max(0,100-result.window.usedPercent));
    await stopped(x);
  }
});

test("missing, null or inconsistent map never silently falls back to valid legacy", async t => {
  for (const map of [null, [], {}, {other:bucket()}, {codex:null}, {codex:bucket({limitId:"other"})}]) {
    const x = await fixture(t, snapshot({rateLimitsByLimitId:map}));
    isUnknown(await readControlAllowance(x.request)); await stopped(x);
  }
  for (const legacy of [null, {}, bucket({limitId:null}), bucket({limitId:"other"})]) {
    const x = await fixture(t, {rateLimits:legacy});
    isUnknown(await readControlAllowance(x.request),"BUCKET_UNAVAILABLE");
  }
});

test("no fabricated reset, usage or window when null, missing, ambiguous or malformed", async t => {
  const cases = [
    bucket({primary:weekly()}), bucket({primary:weekly({resetsAt:seconds+1})}),
    bucket({primary:null,secondary:null}), bucket({primary:{windowDurationMins:null}}),
    bucket({primary:{windowDurationMins:0}}), bucket({primary:"bad"}),
    bucket({secondary:weekly({windowDurationMins:300})}), bucket({secondary:weekly({windowDurationMins:"10080"})}),
    ...[null, undefined, -1, 1.5, "37"].map(usedPercent=>bucket({secondary:weekly({usedPercent})})),
    ...[null, undefined, -1, 1, 1.5, "4102444800", Number.MAX_SAFE_INTEGER].map(resetsAt=>bucket({secondary:weekly({resetsAt})}))
  ];
  for (const selected of cases) {
    const x = await fixture(t, snapshot({rateLimitsByLimitId:{codex:selected}}));
    isUnknown(await readControlAllowance(x.request)); await stopped(x);
  }
});

test("read notifications never substitute for the requested snapshot; fragmented framing works", async t => {
  for (const mode of ["notifications", "split"]) {
    const x = await fixture(t, snapshot(), mode), result = await readControlAllowance(x.request);
    assert.equal(result.status,"OBSERVED"); assert.equal(result.observation.resetAt,seconds*1000); await stopped(x);
  }
});

test("RPC failures and invalid frames return sanitized UNKNOWN and stop only owned processes", async t => {
  const cases = {"init-error":"RPC_ERROR", "read-error":"RPC_ERROR", "early-result":"PROTOCOL_INVALID",
    "bad-json":"PROTOCOL_INVALID", "bad-frame":"PROTOCOL_INVALID", "bad-version":"PROTOCOL_INVALID",
    "server-request":"PROTOCOL_INVALID", "duplicate":"PROTOCOL_INVALID", "wrong-id":"PROTOCOL_INVALID",
    "missing-result":"PROTOCOL_INVALID", "null-result":"PROTOCOL_INVALID", "invalid-utf8":"PROTOCOL_INVALID", "exit":"PROCESS_EXIT"};
  for (const [mode,reason] of Object.entries(cases)) {
    const x = await fixture(t, snapshot(), mode);
    isUnknown(await readControlAllowance(x.request),reason); await stopped(x);
    if (mode === "init-error") assert.equal((await readTranscript(x)).length,2);
  }
});

test("timeout, partial lines and notification-only output are bounded UNKNOWN", async t => {
  for (const mode of ["silent", "partial", "notification-only"]) {
    const x = await fixture(t, snapshot(), mode), start = performance.now();
    // Exercise a started process timing out, not CPU contention killing Node
    // before the fixture can record its PID during the full parallel suite.
    isUnknown(await readControlAllowance({...x.request,timeoutMs:2000}),"TIMEOUT");
    assert.ok(performance.now()-start < 4000); await stopped(x);
  }
});

test("aggregate stdout and stderr limits include unterminated output", async t => {
  for (const mode of ["stdout-overflow", "stderr-overflow", "aggregate", "late-stderr"]) {
    const x = await fixture(t, snapshot(), mode);
    const result = await readControlAllowance({...x.request,maxBytes:1024});
    assert.equal(result.status, "UNKNOWN", mode);
    isUnknown(result,"OUTPUT_CAPACITY"); await stopped(x);
  }
  const x = await fixture(t, snapshot({padding:"x".repeat(1024)}));
  isUnknown(await readControlAllowance({...x.request,maxBytes:1024}),"OUTPUT_CAPACITY");
});

test("cleanup kills owned inherited-pipe descendants without waiting for their timers", async t => {
  const unrelated = spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});
  t.after(async()=>{const closed=new Promise(resolve=>unrelated.once("close",resolve)); unrelated.kill("SIGKILL"); await closed;});
  const x = await fixture(t, snapshot(), "pipes"), start = performance.now();
  assert.equal((await readControlAllowance(x.request)).status,"OBSERVED");
  assert.ok(performance.now()-start < 1500); await stopped(x);
  assert.doesNotThrow(()=>process.kill(unrelated.pid,0));
  const descendant = Number(await readFile(path.join(x.request.authHome,"descendant.pid"),"utf8"));
  // Reaping a killed descendant is asynchronous on some hosts.
  let alive = true;
  for(let i=0;i<100 && alive;i++) {
    try {process.kill(descendant,0); await new Promise(resolve=>setTimeout(resolve,10));}
    catch(e) {assert.equal(e.code,"ESRCH");alive=false;}
  }
  assert.equal(alive,false);
});

test("unobserved pipe closure after kill remains UNKNOWN and bounded", async t => {
  const x = await fixture(t, snapshot(), "escaped");
  let pid;
  t.after(async()=>{
    if (pid) {try {process.kill(pid,"SIGKILL");} catch(e) {if(e.code!=="ESRCH")throw e;}}
  });
  const start = performance.now();
  const result = await readControlAllowance(x.request);
  pid = Number(await readFile(path.join(x.request.authHome,"descendant.pid"),"utf8"));
  isUnknown(result,"TERMINATION_UNKNOWN");
  assert.ok(performance.now()-start < 1500); await stopped(x);
});

test("invalid policy, explicit spawn failure, pre-cancel and in-flight cancel stay UNKNOWN", async t => {
  const x = await fixture(t, snapshot(), "silent");
  for (const change of [{binary:"codex"}, {authHome:"relative"}, {limitId:null}, {limitId:""},
    {windowDurationMins:null}, {windowDurationMins:0}, {windowDurationMins:1.5},
    {timeoutMs:10001}, {timeoutMs:0}, {maxBytes:1023}, {maxBytes:1048577}, {signal:{}}])
    isUnknown(await readControlAllowance({...x.request,...change}),"CONFIG_INVALID");
  isUnknown(await readControlAllowance(),"CONFIG_INVALID");
  isUnknown(await readControlAllowance({...x.request,binary:path.join(x.request.authHome,"absent")}),"SPAWN_FAILED");
  const cancelled = new AbortController(); cancelled.abort();
  isUnknown(await readControlAllowance({...x.request,signal:cancelled.signal}),"CANCELLED");
  await assert.rejects(readFile(x.pidFile),{code:"ENOENT"});
  const controller = new AbortController(), promise = readControlAllowance({...x.request,signal:controller.signal});
  for(let i=0;i<150;i++) {
    try {await readFile(x.pidFile);break;} catch(e) {if(e.code!=="ENOENT")throw e;await new Promise(resolve=>setTimeout(resolve,10));}
  }
  controller.abort();
  isUnknown(await promise,"CANCELLED"); await stopped(x);
});

test("auth-only home metadata rejects config, unsafe ownership/modes and symlink ancestry before launch", async t => {
  for (const mode of ["directory-mode", "parent-mode", "owner", "home-link", "parent-link", "missing", "file",
    "user-config", "managed-config", "project-config", "auth-link", "auth-mode", "auth-owner", "auth-directory", "auth-hardlink"]) {
    const x = await fixture(t), auth = path.join(x.request.authHome,"auth.json");
    let request = x.request, reason = "AUTH_HOME_UNSAFE";
    if (mode === "directory-mode") await chmod(x.request.authHome,0o755);
    if (mode === "parent-mode") await chmod(x.root,0o777);
    if (mode === "owner") t.mock.method(process,"getuid",()=>Number.MAX_SAFE_INTEGER);
    if (mode === "home-link") {const alias=path.join(x.root,"alias");await symlink(x.request.authHome,alias);request={...request,authHome:alias};}
    if (mode === "parent-link") {const alias=path.join(x.root,"alias");await symlink(x.root,alias);request={...request,authHome:path.join(alias,"auth-home")};}
    if (mode === "missing") request={...request,authHome:path.join(x.root,"absent")};
    if (mode === "file") request={...request,authHome:x.request.binary};
    if (mode === "user-config" || mode === "managed-config") {
      await writeFile(path.join(x.request.authHome,mode === "user-config" ? "config.toml" : "managed_config.toml"),
        "PRIVATE_ACCOUNT_SENTINEL invalid TOML with plugin/MCP commands",{mode:0o600});
      reason="AUTH_HOME_CONFIG_PRESENT";
    }
    if (mode === "project-config") {
      await mkdir(path.join(x.root,".codex"));
      await writeFile(path.join(x.root,".codex","config.toml"),"PRIVATE_ACCOUNT_SENTINEL",{mode:0o600});
      reason="AUTH_HOME_CONFIG_PRESENT";
    }
    if (mode.startsWith("auth-")) {
      reason="AUTH_FILE_UNSAFE";
      if (mode === "auth-link") await symlink(x.request.binary,auth);
      else if (mode === "auth-directory") await mkdir(auth);
      else if (mode === "auth-hardlink") {const target=path.join(x.root,"synthetic-auth");await writeFile(target,"PRIVATE_ACCOUNT_SENTINEL",{mode:0o600});await link(target,auth);}
      else await writeFile(auth,"PRIVATE_ACCOUNT_SENTINEL",{mode:mode === "auth-mode" ? 0o644 : 0o600});
      if (mode === "auth-owner") {
        const actual=process.getuid();
        t.mock.method(process,"getuid",()=>actual+1);
        reason="AUTH_HOME_UNSAFE";
      }
    }
    try {isUnknown(await readControlAllowance(request),reason);}
    finally {t.mock.restoreAll();await chmod(x.root,0o700);}
    await assert.rejects(readFile(x.pidFile),{code:"ENOENT"});
  }
});

test("private regular auth metadata is accepted without content reads or copies", async t => {
  const x = await fixture(t), auth = path.join(x.request.authHome,"auth.json");
  await writeFile(auth,"PRIVATE_ACCOUNT_SENTINEL not JSON",{mode:0o600});
  const result = await readControlAllowance(x.request);
  assert.equal(result.status,"OBSERVED");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_ACCOUNT_SENTINEL"));
  assert.equal(await readFile(auth,"utf8"),"PRIVATE_ACCOUNT_SENTINEL not JSON");
  await stopped(x);
});

// Main may explicitly qualify a native CLI; the default suite never launches it.
test("opt-in native stdio read with fresh empty authHome returns UNKNOWN without inference", {
  skip:!process.env.VYDYKHAI_ALLOWANCE_CODEX_BINARY, timeout:15000
}, async t => {
  const authHome = await realpath(await mkdtemp(path.join(tmpdir(),"control-allowance-native-")));
  t.after(()=>rm(authHome,{recursive:true,force:true}));
  const result = await readControlAllowance({binary:process.env.VYDYKHAI_ALLOWANCE_CODEX_BINARY,authHome,
    limitId:"codex",windowDurationMins:10080,timeoutMs:5000,maxBytes:65536});
  isUnknown(result,"RPC_ERROR");
});
