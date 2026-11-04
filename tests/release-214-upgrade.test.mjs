import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

test("2.1.13 installed updater applies current candidate while retaining project evidence", t => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const dir = mkdtempSync(path.join(tmpdir(), "vydykhai-214-upgrade-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const old = path.join(dir, "old"), target = path.join(dir, "project");
  mkdirSync(old); mkdirSync(target);
  const archive = spawnSync("git", ["archive", "v2.1.13"], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(archive.status, 0, String(archive.stderr));
  const unpack = spawnSync("tar", ["-x", "-C", old], { input: archive.stdout });
  assert.equal(unpack.status, 0, String(unpack.stderr));
  const run = (cli, args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: target, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
  };
  run(path.join(old, "scripts/vydykhai.mjs"), ["install", target]);
  const lock = () => JSON.parse(readFileSync(path.join(target, ".vydykhai-lock.json"), "utf8"));
  assert.equal(lock().installedVersion, "2.1.13");
  const retained = {
    "project-state.md": "Pending human question; accepted baseline; active worker; UNKNOWN effects; spend retained.\n",
    "project-memory.md": "Decision rationale; rejected alternative; safe pointer without credential; original source.\n",
    "independent-evidence.json": JSON.stringify({ verdict: "REJECT", findings: ["open"], expense: "UNKNOWN_NONZERO" })
  };
  for (const [name, body] of Object.entries(retained)) writeFileSync(path.join(target, name), body);
  const cli = path.join(target, "scripts/vydykhai.mjs");
  run(cli, ["update", target, "--from", root]);
  assert.equal(lock().installedVersion, JSON.parse(readFileSync(path.join(root, "vydykhai.json"), "utf8")).version);
  for (const [name, body] of Object.entries(retained)) assert.equal(readFileSync(path.join(target, name), "utf8"), body);
  const plan = JSON.parse(run(cli, ["adoption-plan", target, "--json"]));
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
  assert.match(plan.requirements.find(r => r.id === "prepared-work").action, /unhinted retrieval\/application/);
  assert.match(plan.requirements.find(r => r.id === "resume-or-checkpoint").action, /qualify success\/error terminal delivery/);
  run(cli, ["doctor", target, "--offline"]);
});
