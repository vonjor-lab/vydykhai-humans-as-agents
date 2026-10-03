import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assessMemoryCapacity, packMemoryGraph, readMemoryGraph, memoryStorageCommand } from "../scripts/memory-storage.mjs";
import { sha256 } from "../scripts/memory-brief.mjs";

async function fixture(t, content) {
  const root = await mkdtemp(path.join(tmpdir(), "memory-storage-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = path.join(root, "graph.md"), output = path.join(root, "candidate");
  await writeFile(input, content);
  return { root, input, output };
}

test("capacity concerns physical storage and never marks unwritten meaning integrated", () => {
  const text = "### MEM-A\n" + "x".repeat(90);
  const full = assessMemoryCapacity(text, text + "more", 100, "utf8-bytes");
  assert.equal(full.status, "EXPAND_STORAGE_REQUIRED");
  assert.equal(full.integrated, false); assert.equal(full.logicalMemoryLimit, null);
  assert.equal(assessMemoryCapacity(text, text, 120, "utf8-bytes").status, "EXPANSION_DUE");
  assert.equal(assessMemoryCapacity(text, text, 1000, "utf8-bytes").status, "FITS");
  const unknown = assessMemoryCapacity(text, text, null, "utf8-bytes");
  assert.equal(unknown.status, "CAPACITY_UNKNOWN"); assert.equal(unknown.writeFits, null);
});

test("provider units are explicit, including non-ASCII and supplementary Unicode", () => {
  const text = "\u0430\u{1f600}";
  assert.equal(assessMemoryCapacity("", text, 4, "utf8-bytes").used, 6);
  assert.equal(assessMemoryCapacity("", text, 4, "unicode-points").used, 2);
  assert.equal(assessMemoryCapacity("", text, 4, "utf16-units").used, 3);
  assert.throws(() => assessMemoryCapacity("", text, 4, "characters"), /UNIT_REQUIRED/);
});

test("multipart candidate preserves a large graph byte-for-byte, ids, history and lookup routes", async t => {
  const text = "# Project Memory Graph\r\n## Anchor Index\r\n| ENT-A | MODULE | reusable |\r\n" +
    "## Current Memory Nodes\r\n### MEM-A\r\n" + "historical source \u0430\u{1f600}\r\n".repeat(100000) + "### MEM-B\nKeep this commitment.\n";
  const f = await fixture(t, text), before = await readFile(f.input);
  const packed = await packMemoryGraph(f.input, f.output, 128 * 1024);
  assert.equal(packed.status, "CANDIDATE_VERIFIED"); assert.ok(packed.parts > 10);
  assert.equal(packed.activeGraphChanged, false); assert.equal(packed.semanticValidation, "NOT_PERFORMED");
  const restored = await readMemoryGraph(packed.path);
  assert.equal(restored.text, text); assert.equal(restored.storage.sha256, sha256(before));
  assert.ok(restored.storage.index.some(r => r.heading === "### MEM-B"));
  assert.deepEqual(await readFile(f.input), before);
  await assert.rejects(packMemoryGraph(f.input, f.output, 128 * 1024), { code: "EEXIST" });
  assert.equal((await readMemoryGraph(packed.path)).text, text);
});

test("tiny fragments do not split UTF-8 code points or lose unbroken lines", async t => {
  const text = "\u{1f600}\u0430x".repeat(20), f = await fixture(t, text);
  const packed = await packMemoryGraph(f.input, f.output, 4);
  assert.equal((await readMemoryGraph(packed.path)).text, text);
});

for (const attack of ["modified", "missing", "reordered", "traversal", "duplicate", "symlink", "index"]) {
  test(`memory storage fails closed on ${attack} parts or routes`, async t => {
    const f = await fixture(t, "# Graph\n### MEM-A\n" + "source\n".repeat(200));
    const packed = await packMemoryGraph(f.input, f.output, 100);
    const manifest = JSON.parse(await readFile(packed.path, "utf8")), part = path.join(f.output, manifest.parts[0].path);
    if (attack === "modified") await writeFile(part, "changed");
    if (attack === "missing") await rm(part);
    if (attack === "symlink") { await rm(part); await symlink(f.input, part); }
    if (attack === "reordered") manifest.parts.reverse();
    if (attack === "traversal") manifest.parts[0].path = "../graph.md";
    if (attack === "duplicate") manifest.parts[1] = manifest.parts[0];
    if (attack === "index") manifest.index = [];
    await writeFile(packed.path, JSON.stringify(manifest));
    await assert.rejects(readMemoryGraph(packed.path));
    assert.equal((await readFile(f.input, "utf8")).startsWith("# Graph"), true);
  });
}

test("existing control-check accepts the same logical graph via a manifest, without a storage-only PASS", async t => {
  const f = await fixture(t, "<!-- vydykhai:project-memory-graph v4 -->\n# Intentionally incomplete graph\n");
  const state = path.join(f.root, "state.md"); await writeFile(state, "# Intentionally incomplete state\n");
  const packed = await packMemoryGraph(f.input, f.output, 24);
  const run = graph => {
    const r = spawnSync(process.execPath, [new URL("../scripts/vydykhai.mjs", import.meta.url).pathname,
      "control-check", "--state", state, "--graph", graph, "--json"], { encoding: "utf8" });
    assert.equal(r.status, 1); return JSON.parse(r.stdout);
  };
  const inline = run(f.input), multipart = run(packed.path);
  assert.equal(multipart.ok, false); assert.equal(multipart.publicationReady, false);
  assert.deepEqual(multipart.graphIssues, inline.graphIssues);
  assert.equal(multipart.graphSha256, inline.graphSha256);
  assert.equal(multipart.memoryStorage.format, "memory.storage.v1");
});

test("CLI planning retains both candidates and reports an unknown capacity instead of success", async t => {
  const f = await fixture(t, "### MEM-A\nRetained meaning.\n");
  const r = await memoryStorageCommand(["plan", "--input", f.input, "--candidate", f.input,
    "--limit", "unknown", "--unit", "utf8-bytes"]);
  assert.equal(r.status, "CAPACITY_UNKNOWN"); assert.equal(r.integrated, false);
  assert.equal(r.currentSha256, r.candidateSha256);
});
