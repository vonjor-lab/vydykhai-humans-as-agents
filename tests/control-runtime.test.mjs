import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, readFile, writeFile, chmod, cp, rm, symlink} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {endpointFixture, endpointServices} from "./control-endpoint-fixture.mjs";
import {inspectControlRuntime, stageControlRuntime, verifyControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";
import {openControlStore} from "../scripts/control-store.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
async function setup(t) {
  const x = await endpointFixture(t), directory = path.join(x.privateRoot, "runtimes");
  await mkdir(directory, {mode: 0o700});
  const original = await inspectControlRuntime(sourceRoot);
  const stage = extra => stageControlRuntime({sourceRoot, directory, workspace: x.f.root, expectedDigest: original.digest, ...extra});
  return {...x, directory, original, stage};
}
test("staged runtime imports outside the project and preserves paused work on reopen", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t);
  await x.f.put("unique-work.txt", "unfinished product work");
  await x.host.pause(true); const before = await x.host.snapshot();
  const installed = await x.stage(); assert.equal(installed.status, "STAGED_NOT_ACTIVATED");
  assert.deepEqual(await x.stage(), installed);
  const runtime = await loadControlRuntime({packageRoot: installed.root, expectedDigest: installed.digest, workspace: x.f.root});
  const restored = await runtime.host.openControlHost(x.profile.directory, x.profile.config, endpointServices);
  assert.deepEqual(await restored.snapshot(), before);
  assert.equal(await readFile(path.join(x.f.root, "unique-work.txt"), "utf8"), "unfinished product work");
  const importedProfile = await import(pathToFileURL(path.join(installed.root,"scripts/control-codex-profile.mjs")));
  assert.ok(importedProfile.controlledCodexConfig({workspace: x.f.root, endpointFile: x.file})
    ["mcp_servers.vydykhai_control"].args[0].startsWith(installed.root + "/"));
});
test("copy update and rollback retain unknown effects; unsupported state is held, not reset", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t), first = await x.stage();
  await x.approve();
  const reservation = await x.host.control.reserve(await x.host.control.authorize({
    ...Object.values((await x.host.snapshot()).grants)[0].binding
  }));
  assert.ok(reservation);
  await x.host.pause(true); const before = await x.host.snapshot();
  const candidate = path.join(x.privateRoot, "candidate");
  await cp(sourceRoot, candidate, {recursive: true, filter: p => !p.includes(`${path.sep}.git`)});
  const file = path.join(candidate, "scripts/control-catalog.mjs");
  await writeFile(file, (await readFile(file, "utf8")) + "\n// Packaging-only rollback fixture.\n");
  const next = await inspectControlRuntime(candidate), second = await x.stage({sourceRoot: candidate, expectedDigest: next.digest});
  for (const version of [second, first]) {
    const runtime = await loadControlRuntime({packageRoot: version.root, expectedDigest: version.digest, workspace: x.f.root});
    const host = await runtime.host.openControlHost(x.profile.directory, x.profile.config, endpointServices);
    assert.deepEqual(await host.snapshot(), before);
    assert.equal(Object.values((await host.snapshot()).reservations)[0].status, "IN_FLIGHT");
  }
  const store = await openControlStore(x.profile.directory);
  await store.transact(state => ({...state, schema: "control.host.future"}));
  const runtime = await loadControlRuntime({packageRoot: first.root, expectedDigest: first.digest, workspace: x.f.root});
  const old = await runtime.host.openControlHost(x.profile.directory, x.profile.config, endpointServices);
  await assert.rejects(old.snapshot(), /CONTROL_CONFIG_MISMATCH/);
  assert.equal((await store.read()).state.schema, "control.host.future");
});
test("staging refuses changed source, in-project destination, symlinks and corrupted versions", async t => {
  const x = await setup(t);
  await assert.rejects(x.stage({expectedDigest: "a".repeat(64)}), /SOURCE_CHANGED/);
  await assert.rejects(x.stage({directory: x.f.root}), /WORKSPACE_BOUNDARY/);
  const installed = await x.stage(), file = path.join(installed.root, "scripts/control-host.mjs");
  await chmod(file, 0o600); await writeFile(file, "corrupted");
  await assert.rejects(verifyControlRuntime(installed.root, installed.digest), /FILE_MISMATCH/);
  await assert.rejects(x.stage(), /FILE_MISMATCH/);
  assert.equal(await readFile(file, "utf8"), "corrupted");
  await rm(file); await symlink(path.join(sourceRoot, "scripts/control-host.mjs"), file);
  await assert.rejects(verifyControlRuntime(installed.root, installed.digest), /FILE_UNSAFE/);
});
