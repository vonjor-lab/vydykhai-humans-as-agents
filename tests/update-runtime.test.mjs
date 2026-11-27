import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const repo = await realpath(new URL("..", import.meta.url));
const cliPath = "scripts/vydykhai.mjs";
const lockPath = ".vydykhai-lock.json";

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-update-runtime-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "product");
  const source = path.join(root, "source");
  await mkdir(target);
  await mkdir(source);
  const manifest = JSON.parse(await readFile(path.join(repo, "vydykhai.json")));
  for (const name of manifest.managedPaths) {
    const destination = path.join(source, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(repo, name), destination, { recursive: true });
  }
  const setVersion = version => writeFile(path.join(source, "vydykhai.json"),
    JSON.stringify({ ...manifest, version }));
  const run = (runtime, command, ...flags) => spawnSync(process.execPath,
    [path.join(runtime, cliPath), command, target, ...flags], {
      cwd: root, env: { PATH: process.env.PATH, HOME: root }, encoding: "utf8", timeout: 15000,
    });
  const install = run(source, "install");
  assert.equal(install.status, 0, install.stderr);
  return { root, source, target, setVersion, run };
}

test("an older installed updater can copy a newer kit; the source CLI completes setup", async t => {
  const { source, target, setVersion, run } = await fixture(t);
  const lock = path.join(target, lockPath), original = await readFile(lock, "utf8");
  const hooks = path.join(target, ".codex/hooks.json");
  await rm(hooks);
  await setVersion("2.99.0");
  const refused = run(target, "update", "--from", source, "--force", "--guard-background-declined");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Cannot apply a Guard decision/);
  assert.doesNotMatch(refused.stdout, /CONFIGURED/);
  assert.equal(await readFile(lock, "utf8"), original);
  await assert.rejects(readFile(hooks), { code: "ENOENT" });

  const copied = run(target, "update", "--from", source);
  assert.equal(copied.status, 0, copied.stderr);
  assert.match(copied.stdout, /LIMITED \(kit copied; setup not run\)/);
  assert.doesNotMatch(copied.stdout, /CONFIGURED/);
  assert.equal(JSON.parse(await readFile(lock, "utf8")).installedVersion, "2.99.0");
  await assert.rejects(readFile(hooks), { code: "ENOENT" });

  const updated = run(source, "update", "--from", source, "--guard-background-declined");
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /opening hook: CONFIGURED/);
  assert.equal(JSON.parse(await readFile(lock, "utf8")).installedVersion, "2.99.0");
  assert.ok(JSON.parse(await readFile(hooks, "utf8")).hooks.Stop);
});

test("copy-only update never imports newly copied or preexisting target setup code", async t => {
  const { root, source, target, run } = await fixture(t);
  const marker = path.join(root, "setup-executed");
  const trap = `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed");`;
  await writeFile(path.join(source, "scripts/guard-setup.mjs"), trap);
  const refused = run(target, "update", "--from", source, "--guard-background-approved");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Cannot apply a Guard decision/);
  const updated = run(target, "update", "--from", source);
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /LIMITED \(kit copied; setup not run\)/);
  assert.doesNotMatch(updated.stdout, /CONFIGURED/);
  assert.equal(await readFile(path.join(target, "scripts/guard-setup.mjs"), "utf8"), trap);
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

test("the source CLI still requires separate transition and overwrite approvals", async t => {
  const { source, target, setVersion, run } = await fixture(t);
  const lock = path.join(target, lockPath), original = await readFile(lock, "utf8");
  const previous = JSON.parse(original).installedVersion;
  const next = "1.99.0";
  await setVersion(next);
  const localFile = path.join(target, "docs/FRAMEWORK.md");
  await writeFile(localFile, "local edit");
  const update = (...flags) => run(source, "update", "--from", source, ...flags);
  const noConsent = update("--force");
  assert.equal(noConsent.status, 1);
  assert.match(noConsent.stderr, /requires explicit human approval/);
  const approval = ["--approve-transition", `${previous}:${next}`];
  const conflict = update(...approval);
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /Refusing to overwrite/);
  assert.equal(await readFile(lock, "utf8"), original);
  assert.equal(await readFile(localFile, "utf8"), "local edit");
  const updated = update(...approval, "--force");
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(JSON.parse(await readFile(lock, "utf8")).installedVersion, next);
});
