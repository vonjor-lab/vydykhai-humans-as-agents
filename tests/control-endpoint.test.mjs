import test from "node:test";
import assert from "node:assert/strict";
import {readFile, writeFile, realpath} from "node:fs/promises";
import {hash} from "./context-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {endpointFixture, endpointServices as services} from "./control-endpoint-fixture.mjs";
import {openWorkerEndpoint} from "../scripts/control-endpoint.mjs";
import {controlledCodexConfig, codexConfigArgs} from "../scripts/control-codex-profile.mjs";

test("endpoint verification uses accept with its own exact grant, not product acceptance", {skip: process.platform !== "darwin"}, async t => {
  const x = await endpointFixture(t);
  x.profile.requests.push({id: "check", request: {...x.f.request, operation: "accept"}});
  await writeFile(x.file, JSON.stringify(x.profile));
  const endpoint = await openWorkerEndpoint(x.file, services);
  await x.approve();
  assert.equal((await endpoint.execute({requestId: "check"})).status, "BLOCKED");
  assert.equal((await endpoint.execute({requestId: "next"})).status, "ACTION_COMPLETED");
  const prepared = x.prepared;
  const files = await Promise.all([...x.f.task.candidateFiles].sort().map(async p =>
    ({path: p, sha256: sha256(await readFile(path.join(x.f.root, p)))})));
  await x.host.approveCommand({operation: "accept", taskId: x.f.task.id,
    taskSha256: x.f.request.task.sha256, capsuleSha256: x.f.request.capsule.sha256,
    sourceDigest: prepared.coverageBasis.sourceDigest, dependencyDigest: prepared.coverageBasis.dependencyDigest,
    candidateSha256: hash({workspace: x.f.root, files}), commandSha256: hash(x.f.module.verificationCommand),
    cwd: x.f.root, executable: await realpath(process.execPath), kind: "verification"},
    {reviewer: x.profile.config.reviewer, reviewReceipt: "fixture:verification-reviewed",
      dependencies: [], expiresAt: Date.now() + 120000});
  const result = await endpoint.execute({requestId: "check"});
  assert.equal(result.status, "VERIFIED", JSON.stringify(result));
  assert.equal(result.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.equal((await endpoint.execute({requestId: "check"})).status, "BLOCKED");
  assert.deepEqual((await x.host.snapshot()).acceptances, {});
  x.profile.requests[1].request.operation = "verify";
  await writeFile(x.file, JSON.stringify(x.profile));
  await assert.rejects(openWorkerEndpoint(x.file, services), /CONTROL_ENDPOINT_REQUEST_INVALID/);
});

test("worker endpoint exposes no control mutations and always uses actual sandboxed admission", {skip: process.platform !== "darwin"}, async t => {
  const x = await endpointFixture(t), endpoint = await openWorkerEndpoint(x.file, services);
  assert.deepEqual(Object.keys(endpoint), ["execute"]);
  assert.equal((await endpoint.execute({requestId: "next"})).status, "BLOCKED");
  for (const args of [{requestId: "next", reviewer: "reviewer"}, {requestId: "other"}, {role: "owner"}])
    await assert.rejects(endpoint.execute(args), /NOT_REGISTERED/);
  await x.approve();
  assert.equal((await endpoint.execute({requestId: "next"})).status, "ACTION_COMPLETED");
  assert.equal((await endpoint.execute({requestId: "next"})).status, "BLOCKED");
  assert.equal(await readFile(path.join(x.f.root, "actions.log"), "utf8"), "called\n");
});

test("stdio MCP lists one capability and refuses forged control method calls", {skip: process.platform !== "darwin"}, async t => {
  const x = await endpointFixture(t); await x.approve();
  const messages = [{method: "initialize", params: {protocolVersion: "2024-11-05", capabilities: {}, clientInfo: {name: "fixture", version: "1"}}},
    {method: "tools/list"}, {method: "tools/call", params: {name: "approveCommand", arguments: {}}},
    {method: "tools/call", params: {name: "execute_registered", arguments: {requestId: "next"}}}];
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/control-mcp.mjs", import.meta.url)), x.file],
    {input: messages.map((m,i) => JSON.stringify({jsonrpc: "2.0", id: i+1, ...m})).join("\n") + "\n", encoding: "utf8", timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  const replies = result.stdout.trim().split("\n").map(JSON.parse);
  assert.deepEqual(replies[1].result.tools.map(t => t.name), ["execute_registered"]);
  assert.equal(replies[2].error.code, -32601);
  assert.equal(JSON.parse(replies[3].result.content[0].text).status, "ACTION_COMPLETED");
});

test("CLI profile removes direct action tools and makes the controlled MCP required", () => {
  const config = controlledCodexConfig({workspace: "/tmp/work", endpointFile: "/tmp/private/worker.json"});
  assert.equal(config["features.shell_tool"], false);
  assert.equal(config["features.unified_exec"], false);
  assert.equal(config["permissions.controlled.filesystem"]["/tmp/work"], "read");
  assert.equal(config["mcp_servers.vydykhai_control"].required, true);
  assert.ok(codexConfigArgs(config).includes('features.shell_tool=false'));
});
