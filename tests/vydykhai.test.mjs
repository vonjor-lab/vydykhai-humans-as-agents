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
    await writeFile(path.join(target, "LICENSE.md"), "product license\n");
    await writeFile(path.join(target, "NOTICE.md"), "product notice\n");
    await writeFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "project-only\n");

    const install = run(["install", target]);
    assert.equal(install.status, 0, install.stderr);

    const agents = await readFile(path.join(target, "AGENTS.md"), "utf8");
    assert.match(agents, /Keep this rule/);
    assert.match(agents, /vydykhai:managed:start/);
    assert.match(agents, /Success Line/);
    assert.equal(await readFile(path.join(target, "LICENSE.md"), "utf8"), "product license\n");
    assert.equal(await readFile(path.join(target, "NOTICE.md"), "utf8"), "product notice\n");
    assert.equal(await readFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "utf8"), "project-only\n");
    assert.match(await readFile(path.join(target, "docs/workflows/README.md"), "utf8"), /environment-neutral workflows/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Return destination:/);
    assert.match(await readFile(path.join(target, "docs/workflows/intent-trail-template.md"), "utf8"), /APPROACH_PIVOT/);
    assert.match(await readFile(path.join(target, "docs/workflows/project-state-template.md"), "utf8"), /Task return mapping:/);
    await assert.rejects(readFile(path.join(target, "docs/codex-workflows/README.md"), "utf8"));

    const lock = JSON.parse(await readFile(path.join(target, ".vydykhai-lock.json"), "utf8"));
    assert.equal(lock.installedVersion, "1.11.0");
    assert.equal(lock.creator.name, "Alexander Rozhnov");
    assert.equal(lock.creator.nameRu, "Александр Рожнов");
    assert.equal(lock.license, "PolyForm-Small-Business-1.0.0");
    assert.equal(lock.canonicalSource, "https://github.com/vonjor-lab/vydykhai-humans-as-agents");
    assert.match(await readFile(path.join(target, "docs/VYDYKHAI_NOTICE.md"), "utf8"), /Alexander Rozhnov/);

    const doctor = run(["doctor", target, "--offline"]);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Integrity: OK/);
    assert.match(doctor.stdout, /latest-available-flagship \/ deepest-bounded/);
    assert.match(doctor.stdout, /Creator: Alexander Rozhnov \(@vonjor-lab\)/);
    assert.match(doctor.stdout, /License: PolyForm-Small-Business-1\.0\.0/);

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
    assert.match(await readFile(corePath, "utf8"), /Version: 1\.11\.0/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("current manifest preserves updater compatibility fields", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "vydykhai.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.defaultAgentProfile.modelPolicy, "latest-available-flagship");
  assert.equal(manifest.defaultAgentProfile.reasoningEffort, "xhigh");
  assert.equal(manifest.defaultAgentProfile.reasoningPolicy, "deepest-bounded");
  assert.equal(manifest.defaultScopeFreshnessDays, 7);
  assert.ok(manifest.managedPaths.includes("docs/workflows"));
  assert.ok(!manifest.managedPaths.includes("docs/codex-workflows"));
  assert.match(await readFile(path.join(root, "docs/workflows/idea-memory-template.md"), "utf8"), /protects the nearest DOD/);
  const core = await readFile(path.join(root, "docs/FRAMEWORK.md"), "utf8");
  assert.match(core, /Shared Sync Contract/);
  assert.match(core, /Expansion Check/);
  assert.match(core, /Intent Trail/);
  assert.match(core, /APPROACH_PIVOT/);
  const projectState = await readFile(path.join(root, "docs/workflows/project-state-template.md"), "utf8");
  assert.match(projectState, /Shared Sync:/);
  assert.match(projectState, /Context visibility:/);
  assert.match(projectState, /Intent Trail:/);
  assert.match(await readFile(path.join(root, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Intent \/ Approach Delta:/);
  const orchestratorWorkflow = await readFile(path.join(root, "docs/workflows/framework-orchestrator.md"), "utf8");
  assert.match(orchestratorWorkflow, /THIS ORCHESTRATOR IS RETIRED - DO NOT CONTINUE HERE/);
  assert.match(orchestratorWorkflow, /ROTATION_CUTOVER_INCOMPLETE/);
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
