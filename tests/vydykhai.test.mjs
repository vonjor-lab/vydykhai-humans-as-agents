import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts/vydykhai.mjs");

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("install, doctor, conflict protection, and forced repair", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-target-"));
  try {
    await mkdir(path.join(target, ".git"));
    await mkdir(path.join(target, ".agents/skills/project-only"), { recursive: true });
    await writeFile(path.join(target, "AGENTS.md"), "# Product Rules\n\n- Keep this rule.\n");
    await writeFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "project-only\n");

    const install = run(["install", target]);
    assert.equal(install.status, 0, install.stderr);

    const agents = await readFile(path.join(target, "AGENTS.md"), "utf8");
    assert.match(agents, /Keep this rule/);
    assert.match(agents, /vydykhai:managed:start/);
    assert.equal(await readFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "utf8"), "project-only\n");

    const lock = JSON.parse(await readFile(path.join(target, ".vydykhai-lock.json"), "utf8"));
    assert.equal(lock.installedVersion, "1.5.2");

    const doctor = run(["doctor", target, "--offline"]);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Integrity: OK/);
    assert.match(doctor.stdout, /latest-available-flagship \/ xhigh/);

    const corePath = path.join(target, "docs/FRAMEWORK.md");
    await writeFile(corePath, "local modification\n");

    const brokenDoctor = run(["doctor", target, "--offline"]);
    assert.equal(brokenDoctor.status, 1);
    assert.match(brokenDoctor.stdout, /Modified managed files/);

    const protectedInstall = run(["install", target]);
    assert.equal(protectedInstall.status, 1);
    assert.match(protectedInstall.stderr, /Refusing to overwrite locally modified framework files/);

    const repaired = run(["install", target, "--force"]);
    assert.equal(repaired.status, 0, repaired.stderr);
    assert.match(await readFile(corePath, "utf8"), /Version: 1\.5\.2/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("update from a local canonical source preserves project files", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-update-"));
  try {
    await mkdir(path.join(target, ".git"));
    await writeFile(path.join(target, "AGENTS.md"), "# Product\n");
    assert.equal(run(["install", target]).status, 0);

    const projectDoc = path.join(target, "docs/project-only.md");
    await writeFile(projectDoc, "keep\n");

    const update = run(["update", target, "--from", root]);
    assert.equal(update.status, 0, update.stderr);
    assert.equal(await readFile(projectDoc, "utf8"), "keep\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("install refuses target symlinks in managed paths", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-symlink-"));
  const outside = await mkdtemp(path.join(tmpdir(), "vydykhai-outside-"));
  try {
    await mkdir(path.join(target, ".git"));
    await symlink(outside, path.join(target, "docs"));
    const install = run(["install", target]);
    assert.equal(install.status, 1);
    assert.match(install.stderr, /Refusing to write through target symlink/);
  } finally {
    await rm(target, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
