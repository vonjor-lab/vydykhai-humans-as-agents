import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { checkWorkerAdoption } from "../scripts/vydykhai.mjs";
import { assessWorkerAdoption } from "../scripts/adoption-plan.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(source, "scripts/vydykhai.mjs");
const run = (bin, args, cwd) => spawnSync(bin, args, { cwd, encoding: "utf8" });
const git = (cwd, ...args) => {
  const r = run("git", args, cwd); assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
};
const digest = value => createHash("sha256").update(value).digest("hex");
async function snapshot(root) {
  const files = {};
  async function visit(relative = "") {
    for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (item.name === ".git") continue;
      const p = path.join(relative, item.name);
      if (item.isDirectory()) await visit(p);
      else if (item.isFile()) files[p] = digest(await readFile(path.join(root, p)));
    }
  }
  await visit(); return files;
}
async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-worker-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "accepted"), worker = path.join(root, "worker");
  for (const dir of [target, worker]) {
    await mkdir(dir);
    const r = run(process.execPath, [cli, "install", dir], root);
    assert.equal(r.status, 0, r.stderr);
  }
  git(worker, "init", "-q");
  await writeFile(path.join(worker, "product.txt"), "accepted product\n");
  git(worker, "add", ".");
  git(worker, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "accepted fixture");
  return { root, target, worker };
}

test("matching real worker kit is read-only and does not claim instruction adoption", async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.worker, "product.txt"), "uncommitted product change\n");
  await writeFile(path.join(f.worker, "task-checkpoint.md"), "PAUSED by human; remaining implementation retained\n");
  await writeFile(path.join(f.worker, "docs/workflows/project-local.md"), "Unmanaged project guidance stays untouched.\n");
  const before = await snapshot(f.worker), head = git(f.worker, "rev-parse", "HEAD");
  const r = run(process.execPath, [cli, "adoption-plan", f.target, "--worker", f.worker, "--json"], f.root);
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout), check = plan.workerCheck;
  assert.equal(check.status, "KIT_MATCH");
  assert.equal(check.activeUse, "UNPROVEN_BY_KIT_CHECK");
  assert.equal(check.readOnly, true);
  assert.equal(check.checkout.workspace, f.worker);
  assert.equal(check.checkout.head, head);
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
  assert.deepEqual(await checkWorkerAdoption(f.target, f.worker), check);
  assert.deepEqual(await snapshot(f.worker), before);
  assert.equal(git(f.worker, "rev-parse", "HEAD"), head);
});

for (const [version, revision] of [
  ["1.24.2", "d1eaba6e7c73ee5f855339663f55c7ee292e5827"],
  ["1.29.0", "d46692adfbbb32ab1049794677a0e704830d362c"],
]) test(`resumed ${version} worker requires an update and preserves its product branch`, async t => {
  const archive = spawnSync("git", ["archive", revision], { cwd: source, maxBuffer: 8 * 1024 * 1024 });
  if (archive.status !== 0) { t.skip("Historical source unavailable in this checkout"); return; }
  const f = await fixture(t), old = path.join(f.root, "historical");
  await mkdir(old);
  assert.equal(spawnSync("tar", ["-x", "-C", old], { input: archive.stdout }).status, 0);
  // Install into a fresh historical worker, not over newer managed files.
  const worker = path.join(f.root, "old-worker"); await mkdir(worker);
  let r = run(process.execPath, [path.join(old, "scripts/vydykhai.mjs"), "install", worker], f.root);
  assert.equal(r.status, 0, r.stderr);
  git(worker, "init", "-q"); git(worker, "add", ".");
  git(worker, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "old worker");
  git(worker, "checkout", "-qb", "retained-product");
  await writeFile(path.join(worker, "product.txt"), "unique unfinished work\n");
  const before = await snapshot(worker), head = git(worker, "rev-parse", "HEAD");
  r = run(process.execPath, [cli, "adoption-plan", f.target, "--worker", worker, "--json"], f.root);
  assert.equal(r.status, 1);
  const first = JSON.parse(r.stdout).workerCheck;
  assert.equal(first.status, "UPDATE_REQUIRED");
  assert.equal(first.checkout.branch, "retained-product");
  assert.deepEqual(await snapshot(worker), before);
  r = run(process.execPath, [cli, "update", worker, "--from", source], f.root);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await checkWorkerAdoption(f.target, worker)).status, "KIT_MATCH");
  assert.equal(await readFile(path.join(worker, "product.txt"), "utf8"), "unique unfinished work\n");
  assert.equal(git(worker, "rev-parse", "HEAD"), head);
  assert.equal(git(worker, "branch", "--show-current"), "retained-product");
});

test("managed conflict and sparse lock cannot masquerade as a current worker", async t => {
  const f = await fixture(t), file = path.join(f.worker, "docs/AGENTS_CORE.md");
  await writeFile(file, (await readFile(file, "utf8")) + "\nlocal conflicting rule\n");
  const before = await snapshot(f.worker);
  assert.equal((await checkWorkerAdoption(f.target, f.worker)).status, "BLOCKED");
  const update = run(process.execPath, [cli, "update", f.worker, "--from", source], f.root);
  assert.equal(update.status, 1); assert.match(update.stderr, /Refusing to overwrite/);
  assert.deepEqual(await snapshot(f.worker), before);
  const lockPath = path.join(f.worker, ".vydykhai-lock.json"), lock = JSON.parse(await readFile(lockPath));
  delete lock.managedFiles["docs/AGENTS_CORE.md"];
  await writeFile(lockPath, JSON.stringify(lock));
  assert.equal((await checkWorkerAdoption(f.target, f.worker)).detail, "KIT_FILE_SET_MISMATCH");
});

test("worker copy cannot certify an invalid target, missing participant or wrong checkout", async t => {
  const f = await fixture(t);
  assert.equal((await checkWorkerAdoption(f.target, path.join(f.root, "absent"))).status, "LIMITED");
  // The target has a kit but no repository. It cannot stand in for a worker checkout.
  assert.equal((await checkWorkerAdoption(f.target, f.target)).reason, "CHECKOUT_IDENTITY_UNAVAILABLE");
  await writeFile(path.join(f.target, "docs/AGENTS_CORE.md"), "invalid target\n");
  assert.equal((await checkWorkerAdoption(f.target, f.worker)).reason, "TARGET_KIT_INVALID");
});

test("branch switch and detached restore report the actual checkout without touching files", async t => {
  const f = await fixture(t), head = git(f.worker, "rev-parse", "HEAD");
  git(f.worker, "checkout", "-qb", "resumed-work");
  const before = await snapshot(f.worker);
  assert.equal((await checkWorkerAdoption(f.target, f.worker)).checkout.branch, "resumed-work");
  git(f.worker, "checkout", "--detach", head);
  const r = await checkWorkerAdoption(f.target, f.worker);
  assert.equal(r.status, "KIT_MATCH"); assert.equal(r.checkout.branch, "HEAD");
  assert.deepEqual(await snapshot(f.worker), before);
});

test("symlinked managed input is refused without following the external file", async t => {
  const f = await fixture(t), file = path.join(f.worker, "docs/AGENTS_CORE.md");
  await rm(file); await symlink(path.join(f.root, "nonexistent-external"), file);
  assert.equal((await checkWorkerAdoption(f.target, f.worker)).status, "BLOCKED");
});

test("newer version or different source requires review; same-version bundle drift requires update", () => {
  const kit = { version: "1.30.2", source: "canonical", bundleSha256: "a".repeat(64) };
  assert.equal(assessWorkerAdoption(kit, { ...kit, version: "1.31.0" }).reason, "WORKER_NEWER_THAN_TARGET");
  assert.equal(assessWorkerAdoption(kit, { ...kit, source: "different" }).reason, "DIFFERENT_SOURCE");
  assert.equal(assessWorkerAdoption(kit, { ...kit, bundleSha256: "b".repeat(64) }).status, "UPDATE_REQUIRED");
  assert.equal(assessWorkerAdoption(kit, null).status, "LIMITED");
});
