import test from "node:test";
import assert from "node:assert/strict";
import fs, {mkdtemp, mkdir, realpath, readFile, writeFile, rm} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";
import path from "node:path";
import {pairGraph} from "../scripts/qualify-memory-pair.mjs";
import {packMemoryGraph} from "../scripts/memory-storage.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";

async function fixture(t, transform = graph => graph) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "registered-memory-storage-")));
  t.after(() => rm(root, {recursive:true, force:true}));
  const workspace = path.join(root, "workspace"); await mkdir(workspace, {mode:0o700});
  // Physical archival padding is not current guidance or a producer implementation.
  const graph = transform(pairGraph().replace("<!-- vydykhai:project-memory-graph:end -->",
    "Historical archival context.\n".repeat(40000) + "<!-- vydykhai:project-memory-graph:end -->"));
  const input = path.join(workspace, "graph.md"); await writeFile(input, graph);
  const packed = await packMemoryGraph(input, path.join(workspace, "packed"), 128 * 1024);
  const manifest = JSON.parse(await readFile(packed.path, "utf8"));
  const entries = [{id:"memory", path:"packed/graph.json", purpose:"Accepted logical graph storage"},
    ...manifest.parts.map((p,i) => ({id:`part-${i}`, path:`packed/${p.path}`, purpose:"Registered graph storage part"}))];
  const sourceFile = path.join(root, "sources.json");
  const save = () => writeFile(sourceFile, JSON.stringify({schema:"control.review-sources.v1",workspace,sources:entries}), {mode:0o600});
  await save();
  return {workspace, graph, input, packed, manifest, entries, sourceFile, save};
}

test("registered multipart graph is recalled without exposing archival parts or implementation context", async t => {
  const x = await fixture(t), sources = await openReviewSources(x.sourceFile);
  const recalled = await sources.recallMemory({id:"memory", request:"Use bundle for another JSON consumer"});
  assert.equal(recalled.status, "RECALL_CANDIDATE");
  assert.equal(recalled.graphSha256, x.packed.sha256);
  assert.equal(recalled.graphStorage.format, "memory.storage.v1");
  assert.equal(recalled.graphStorage.parts, x.manifest.parts.length);
  assert.equal(recalled.graphStorage.index, undefined);
  assert.ok(recalled.acquiredSources.every(s => typeof s.id === "string" && /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(recalled.acquiredSources.length, x.entries.length);
  assert.match(recalled.items.find(n => n.type === "COMMITMENT").apply, /CSV/);
  assert.doesNotMatch(JSON.stringify(recalled), /Historical archival context/);
  assert.ok(Buffer.byteLength(JSON.stringify(recalled)) < 65536);
  assert.equal(recalled.admission, "NOT_GRANTED");
  assert.equal(await readFile(x.input, "utf8"), x.graph);
});

for (const kind of ["unregistered", "ambiguous", "selected-only"])
  test(`multipart recall refuses ${kind} part authority before reading physical bytes`, async t => {
    const x = await fixture(t), entry = x.entries[1], forbidden = path.join(x.workspace, entry.path);
    if (kind === "unregistered") x.entries.splice(1, 1);
    if (kind === "ambiguous") x.entries.push({...entry, id:"duplicate-part"});
    if (kind === "selected-only") Object.assign(entry, {startMarker:"<!-- part -->", endMarker:"<!-- end -->"});
    await x.save();
    const originalRead = fs.readFile; let reads = 0;
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      if (file === forbidden) reads++;
      return originalRead(file, ...args);
    });
    syncBuiltinESMExports(); t.after(() => {intercepted.mock.restore(); syncBuiltinESMExports();});
    const result = await (await openReviewSources(x.sourceFile)).recallMemory({id:"memory", request:"Use bundle"});
    assert.equal(result.status, "BLOCKED"); assert.equal(result.code, "MEMORY_STORAGE_PART_NOT_REGISTERED");
    assert.equal(reads, 0); assert.equal(result.admission, "NOT_GRANTED");
  });

for (const format of ["multipart", "inline"])
  test(`${format} invalid-graph diagnostics stay bounded without certifying or losing the failure`, async t => {
    const x = await fixture(t, graph => graph.replace("## Source Coverage Ledger",
      "## Source Coverage Ledger\n| ARCHIVE_ONLY_" + "X".repeat(75000) + " | broken |"));
    if (format === "inline") {
      await writeFile(x.input, x.graph.replace("Historical archival context.\n".repeat(40000), ""));
      x.entries.splice(0, x.entries.length, {id:"memory", path:"graph.md", purpose:"Inline graph"});
      await x.save();
    }
    const result = await (await openReviewSources(x.sourceFile)).recallMemory({id:"memory", request:"Use bundle"});
    assert.equal(result.status, "BLOCKED"); assert.equal(result.code, "MEMORY_GRAPH_INVALID");
    assert.equal(result.admission, "NOT_GRANTED"); assert.equal(result.semanticTruth, "NOT_VERIFIED");
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
    assert.equal(result.issues, undefined);
    assert.equal(result.diagnostics.status, "OMITTED_OVERSIZE");
    assert.ok(result.diagnostics.count > 0 && result.diagnostics.bytes > 65536);
    assert.match(result.diagnostics.sha256, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(result), /ARCHIVE_ONLY_/);
  });

for (const kind of ["changed", "missing", "manifest-hash", "duplicate-key"])
  test(`multipart recall refuses ${kind} bytes and never falls back to an incomplete graph`, async t => {
    const x = await fixture(t), part = path.join(x.workspace, x.entries[1].path);
    if (kind === "changed") {
      const bytes = await readFile(part); bytes[0] ^= 1; await writeFile(part, bytes);
    }
    if (kind === "missing") await rm(part);
    if (kind === "manifest-hash") {
      x.manifest.graphSha256 = "0".repeat(64); await writeFile(x.packed.path, JSON.stringify(x.manifest));
    }
    if (kind === "duplicate-key") {
      const raw = await readFile(x.packed.path, "utf8");
      await writeFile(x.packed.path, raw.replace("{", '{"schema":"contradictory",'));
    }
    const result = await (await openReviewSources(x.sourceFile)).recallMemory({id:"memory", request:"Use bundle"});
    assert.equal(result.status, "BLOCKED"); assert.equal(result.admission, "NOT_GRANTED");
    assert.equal(result.items, undefined); assert.equal(await readFile(x.input, "utf8"), x.graph);
  });

test("actual read-only MCP recalls registered parts and refuses later changed bytes without execution authority", async t => {
  const x = await fixture(t);
  const recall = () => {
    const request = {jsonrpc:"2.0", id:1, method:"tools/call", params:{name:"recall_memory",
      arguments:{id:"memory", request:"Use bundle for another JSON consumer"}}};
    const child = spawnSync(process.execPath,
      [fileURLToPath(new URL("../scripts/control-review-mcp.mjs", import.meta.url)), x.sourceFile],
      {input:JSON.stringify(request) + "\n", encoding:"utf8", timeout:5000, maxBuffer:128*1024});
    assert.equal(child.status, 0, child.stderr);
    const reply = JSON.parse(child.stdout);
    assert.equal(reply.error, undefined); assert.equal(reply.result.isError, undefined);
    return JSON.parse(reply.result.content[0].text);
  };
  const accepted = recall();
  assert.equal(accepted.status, "RECALL_CANDIDATE");
  assert.equal(accepted.graphSha256, x.packed.sha256);
  assert.equal(accepted.admission, "NOT_GRANTED");
  assert.ok(Buffer.byteLength(JSON.stringify(accepted)) <= 65536);
  await writeFile(path.join(x.workspace, x.entries[1].path), "Changed part");
  const refused = recall();
  assert.equal(refused.status, "BLOCKED"); assert.equal(refused.admission, "NOT_GRANTED");
  assert.equal(refused.items, undefined); assert.equal(await readFile(x.input, "utf8"), x.graph);
});
