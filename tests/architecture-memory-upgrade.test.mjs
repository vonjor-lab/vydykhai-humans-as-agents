import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

for (const [version, baseline] of [["1.33.1", "3854bafcdbd2ac9a30f7fb1baeba102b53e8c53c"],
  ["1.34.0", "87af6e9b8b05a7e3216692dafc257e5932f65805"]]) {
test(`published ${version} updater retains unfinished work and exposes storage/alignment/sync adoption without claiming it`, async t => {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const archive = spawnSync("git", ["archive", baseline], { cwd: repository, maxBuffer: 16 * 1024 * 1024 });
  if (archive.status !== 0) return t.skip(`Published ${version} source unavailable; no network fetch performed`);
  const root = await mkdtemp(path.join(tmpdir(), "vydykhai-architecture-memory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = path.join(root, "published"), target = path.join(root, "project");
  await mkdir(old); await mkdir(target);
  assert.equal(spawnSync("tar", ["-x", "-C", old], { input: archive.stdout }).status, 0);
  const cli = (entry, args, status = 0) => {
    const r = spawnSync(process.execPath, [entry, ...args], { cwd: target, encoding: "utf8", timeout: 15000 });
    assert.equal(r.error, undefined, r.error?.message); assert.equal(r.status, status, r.stdout + r.stderr);
    return r.stdout;
  };
  cli(path.join(old, "scripts/vydykhai.mjs"), ["install", target]);
  const installed = path.join(target, "scripts/vydykhai.mjs");
  const json = (args, status = 0) => JSON.parse(cli(installed, args, status));
  await cp(path.join(repository, "examples/context-preparation"), target, { recursive: true });
  const saved = {
    "project-state.md": "Human pause remains binding. Next action: review the retained checkpoint.\n",
    "graph.md": "# Graph\n### MEM-A\nRetain the accepted module and the pending owner decision.\n",
    "checkpoint.txt": "Accepted baseline is retained; the next outcome remains unfinished.\n",
    "candidate.mjs": await readFile(path.join(target, "candidate.mjs"), "utf8")
  };
  for (const [name, body] of Object.entries(saved)) await writeFile(path.join(target, name), body);
  assert.equal(json(["context-prepare", "plan", "--input", "package-modular.json", "--output", "prepared"]).status, "PLAN_READY");
  assert.equal(json(["context-prepare", "confirm", "--output", "prepared", "--owner", "module-owner", "--decision", "approved"]).status, "PREPARED");
  assert.equal(json(["context-prepare", "read", "--output", "prepared", "--worker", "bundle-worker"]).status, "DELIVERED");
  await writeFile(path.join(target, "readback.txt"), "Retain buildBundle output and deferred CSV owner decision; change only duplicate comparison.\n");
  assert.equal(json(["context-prepare", "ack", "--output", "prepared", "--worker", "bundle-worker", "--evidence", "readback.txt"]).status, "ACKNOWLEDGED");
  assert.match(cli(installed, ["update", target, "--from", repository]), /UNPROVEN_BY_INSTALLER/);
  assert.match(cli(installed, ["doctor", target, "--offline"]), /Integrity: OK/);
  const plan = json(["adoption-plan", target, "--json"]);
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
  assert.match(plan.requirements.find(r => r.id === "team-memory").action, /capacity/);
  assert.match(plan.requirements.find(r => r.id === "team-memory").action, /recipient retrieval\/application receipts/);
  assert.match(plan.requirements.find(r => r.id === "prepared-work").action, /context\.package\.v3/);
  for (const [name, body] of Object.entries(saved)) assert.equal(await readFile(path.join(target, name), "utf8"), body);
  const legacy = json(["context-run", "--input", "prepared/preflight.json"]);
  assert.equal(legacy.status, "READY"); assert.equal(legacy.coverageBasis.alignment, "LEGACY_UNCHECKED");
  const pkg = JSON.parse(await readFile(path.join(target, "package-modular.json"), "utf8"));
  pkg.schema = "context.package.v3";
  pkg.alignment = null;
  await writeFile(path.join(target, "new-package.json"), JSON.stringify(pkg));
  assert.equal(json(["context-prepare", "plan", "--input", "new-package.json", "--output", "new-prepared"], 1).code, "ALIGNMENT_REQUIRED");
  const facts = { goal: "Deliver reusable bundles.", invariant: "Retain public output and owner decisions.",
    gap: "Independent case N1 exposes case-sensitive duplicate comparison.", acceptance: "Pass retained B1/B2 and new N1." };
  await writeFile(path.join(target, "architecture.md"), Object.values(facts).join("\n"));
  for (const [id, quote] of Object.entries(facts)) pkg.navigation.references.push({ id, quote, path: "architecture.md", purpose: id, appliesTo: "task" });
  pkg.alignment = { goalRef: "goal", invariantRefs: ["invariant"], acceptanceRef: "acceptance", review: null,
    decisions: [{ moduleId: "buildBundle", boundaryChange: false, gapRef: "gap", existingRef: "public-contract",
      rationale: "Fix the declared comparison within the retained public module." }] };
  await writeFile(path.join(target, "new-package.json"), JSON.stringify(pkg));
  assert.equal(json(["context-prepare", "plan", "--input", "new-package.json", "--output", "new-prepared"]).status, "PLAN_READY");
  assert.equal(json(["context-prepare", "confirm", "--output", "new-prepared", "--owner", "module-owner", "--decision", "approved"]).status, "PREPARED");
  const alignment = JSON.parse(await readFile(path.join(target, "new-prepared/alignment.json"), "utf8"));
  assert.equal(alignment.coverage, "UNCHANGED_BOUNDARIES_DECLARED");
  const capacity = json(["memory-storage", "plan", "--input", "graph.md", "--candidate", "graph.md", "--limit", "unknown", "--unit", "utf8-bytes"], 2);
  assert.equal(capacity.status, "CAPACITY_UNKNOWN"); assert.equal(capacity.integrated, false);
  const packed = json(["memory-storage", "pack", "--input", "graph.md", "--output", "graph-candidate", "--part-bytes", "32"]);
  assert.equal(packed.status, "CANDIDATE_VERIFIED"); assert.equal(packed.activeGraphChanged, false);
  const api = await import(pathToFileURL(path.join(target, "scripts/memory-storage.mjs")));
  assert.equal((await api.readMemoryGraph(packed.path)).text, saved["graph.md"]);
  cli(installed, ["update", target, "--from", repository]);
  assert.equal(json(["adoption-plan", target, "--json"]).id, plan.id);
  for (const [name, body] of Object.entries(saved)) assert.equal(await readFile(path.join(target, name), "utf8"), body);
  t.diagnostic("Actual published updater and installed commands; no live project migration or model behavior claimed.");
});
}
