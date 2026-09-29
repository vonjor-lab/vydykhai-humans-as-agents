import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("release validation preserves exact migration references, not stale current versions", async t => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-version-"));
  t.after(() => rm(target, { recursive: true, force: true }));
  await cp(root, target, {
    recursive: true,
    filter: source => ![".git", "node_modules"].includes(path.relative(root, source).split(path.sep)[0]),
  });
  const run = () => spawnSync(process.execPath, [path.join(target, "scripts/validate-framework.mjs")], {
    cwd: target, encoding: "utf8",
  });
  const current = run();
  assert.equal(current.status, 0, current.stderr);

  for (const [name, stale, version] of [
    ["docs/workflows/framework-activation.md", "Current version: 1.32.8", "1.32.8"],
    ["README.md", "From 1.32.8", "1.32.8"],
    ["docs/workflows/framework-activation.md", "From 1.32.80", "1.32.80"],
  ]) {
    const file = path.join(target, name);
    const original = await readFile(file, "utf8");
    await writeFile(file, original + "\n" + stale + "\n");
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.ok(rejected.stderr.includes(`Unexpected historical version ${version} in active file ${name}`), rejected.stderr);
    await writeFile(file, original);
  }
});
