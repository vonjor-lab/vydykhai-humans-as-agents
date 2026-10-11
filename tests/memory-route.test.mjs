import test from "node:test";
import assert from "node:assert/strict";
import {readFile, mkdtemp, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {deriveMemoryRoute, memoryRecallCommand} from "../scripts/memory-route.mjs";
import {validateMemoryGraph} from "../scripts/vydykhai.mjs";
import {packMemoryGraph} from "../scripts/memory-storage.mjs";

const manifest = JSON.parse(await readFile(new URL("../vydykhai.json", import.meta.url), "utf8"));
const services = {manifest, validateGraph: validateMemoryGraph};
function node(id, type, about, apply, extra = {}) {
  const f = {"Type / status": `${type} / ACTIVE`, About: about, "Recall when": "next consumer",
    Because: "Preserve accepted behavior", Apply: apply, Avoid: "copying the algorithm",
    Verify: "public consumer result", "Applies / exceptions": "declared capability",
    "Owner gate": type === "COMMITMENT" ? "owner" : "none",
    "Return / close when": type === "COMMITMENT" ? "before the next consumer" : "NOT_REQUIRED",
    Relations: `about -> ${about}`, "Source / checked": "accepted decision / revision-2", ...extra};
  return `### ${id} - ${id}\n` + Object.entries(f).map(([k,v]) => `- ${k}: ${v}`).join("\n");
}
function graph(extraNodes = []) {
  const nodes = [node("MEM-GOAL", "INVARIANT", "ENT-GOAL", "Keep owner isolation"),
    node("MEM-RATE", "DECISION", "ENT-QUOTE", "Use accepted rounded cents, not the old floating rate"),
    node("MEM-RETURN", "COMMITMENT", "ENT-QUOTE", "Obtain approval before changing the discount policy"),
    node("MEM-DOWNSTREAM", "REQUIREMENT", "ENT-DOWNSTREAM", "Keep stable quote ids"), ...extraNodes];
  return `<!-- vydykhai:project-memory-graph v4 -->
Watermark: event-2
Operating Brief: accepted-brief
Source ledger: this graph
Declared anchors: 5
Declared routes: 4
Declared nodes: ${nodes.length}
Last compaction: none
Last retrieval check: synthetic structural fixture, not inference
## Anchor Index
| ID | Kind | Canonical name / real-world aliases | Scope / identity | Documentation / implementation | Source / checked |
| --- | --- | --- | --- | --- | --- |
| ENT-GOAL | OUTCOME | approved commercial work | project | NOT_REQUIRED: outcome | brief / revision-1 |
| ENT-QUOTE | MODULE | quotation / supplier offer | quote | contract: public/quote.md; implementation: private/quote/ | design / revision-2 |
| ENT-DATA | ARTIFACT | accepted quotation record | quote output | public example | result / revision-2 |
| ENT-DOWNSTREAM | MODULE | invoice projection | downstream | contract: public/invoice.md; implementation: private/invoice/ | design / revision-1 |
| ENT-OTHER | MODULE | inventory | unrelated | contract: public/inventory.md; implementation: private/inventory/ | design / revision-1 |
## Entity Routes
| From | Relation | To | Applies / qualification | Source / checked |
| --- | --- | --- | --- | --- |
| ENT-QUOTE | serves | ENT-GOAL | purpose | brief / revision-1 |
| ENT-QUOTE | produces | ENT-DATA | output | contract / revision-2 |
| ENT-DOWNSTREAM | consumes | ENT-DATA | downstream | contract / revision-1 |
| ENT-OTHER | serves | ENT-GOAL | independent | brief / revision-1 |
## Current Memory Nodes
${nodes.join("\n")}
## Source Coverage Ledger
| Source / participant | Range / revision | Anchors | Current nodes | Coverage | Gap / supersession | Checked |
| --- | --- | --- | --- | --- | --- | --- |
${nodes.map((n,i) => `| decision-${i} | revision-2 | ${n.match(/^- About: (.*)$/m)[1]} | ${n.match(/^### (MEM-\S+)/)[1]} | COVERED | none | fixture reviewer |`).join("\n")}
| artifact | revision-2 | ENT-DATA | none | EVIDENCE_ONLY | output fixture | fixture reviewer |
| inventory | revision-1 | ENT-OTHER | none | EVIDENCE_ONLY | independent fixture | fixture reviewer |
## Pending Memory Events
| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
## Live Retrieval Probes
| Slot | Raw trigger | Expected route | Observed evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
${["CURRENT", "NEXT", "CROSS_DOMAIN", "PRIOR_MISS"].map(x=>`| ${x} | fixture | declared route | structural fixture | PASS / fixture | source |`).join("\n")}
## Legacy Source Map
| Previous id or artifact | Current anchor/node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
<!-- vydykhai:project-memory-graph:end -->
`;
}
function addRoutes(content, added) {
  return content.replace(/^Declared routes: (\d+)$/m, (_, n) => `Declared routes: ${Number(n) + added.length}`)
    .replace("## Current Memory Nodes", added.map(r=>`| ${r[0]} | ${r[1]} | ${r[2]} | fixture | source |`).join("\n") + "\n## Current Memory Nodes");
}

test("incoming declared entity and memory constraints and entity prerequisites are retained", () => {
  const constrained = addRoutes(graph([node("MEM-EXTERNAL", "REQUIREMENT", "ENT-OTHER", "Preserve inventory isolation",
    {Relations: "about -> ENT-OTHER; constrains -> MEM-RATE"})]), [["ENT-OTHER", "constrains", "ENT-QUOTE"]]);
  assert.deepEqual(validateMemoryGraph(constrained, manifest), []);
  const r = deriveMemoryRoute(constrained, "Use quotation");
  assert.ok(r.items.some(x=>x.id === "MEM-EXTERNAL"));
  assert.ok(r.contracts.some(x=>x.path === "public/inventory.md"));
  const required = graph([node("MEM-EXTERNAL", "REQUIREMENT", "ENT-OTHER", "Preserve inventory isolation")])
    .replace("Relations: about -> ENT-QUOTE", "Relations: about -> ENT-QUOTE; requires -> ENT-OTHER");
  assert.ok(deriveMemoryRoute(required, "Use quotation").items.some(x=>x.id === "MEM-EXTERNAL"));
});

test("external memory prerequisites extend pending and contract relevance without internal access", () => {
  const external = graph([node("MEM-EXTERNAL", "REQUIREMENT", "ENT-OTHER", "Preserve inventory isolation")])
    .replace("Relations: about -> ENT-QUOTE", "Relations: about -> ENT-QUOTE; requires -> MEM-EXTERNAL")
    .replace("## Live Retrieval Probes", "| event-3 | correction | changed inventory | ENT-OTHER | NONE | REFINE | source | PENDING |\n## Live Retrieval Probes");
  const r = deriveMemoryRoute(external, "Use quotation");
  assert.equal(r.status, "NEEDS_DISCOVERY"); assert.ok(r.gaps.some(x=>x.includes("event-3")));
  assert.ok(r.contracts.some(x=>x.path === "public/inventory.md"));
});

test("consumer relevance does not depend on route row ordering or open composite internals", () => {
  const route = ["ENT-OTHER", "consumes", "ENT-DOWNSTREAM"];
  const last = addRoutes(graph(), [route]);
  const row = "| ENT-OTHER | consumes | ENT-DOWNSTREAM | fixture | source |\n";
  const first = last.replace(row, "").replace("| ENT-QUOTE | serves", row + "| ENT-QUOTE | serves");
  const a = deriveMemoryRoute(first, "Use quotation"), b = deriveMemoryRoute(last, "Use quotation");
  assert.deepEqual(a.items, b.items); assert.deepEqual(a.contracts, b.contracts);
  assert.equal(a.status, b.status); assert.ok(!a.contracts.some(x=>x.path === "public/inventory.md"));
});

test("escaped Markdown pipes and field continuations do not hide pending state or obligation text", async () => {
  const content = graph().replace("Apply: Keep owner isolation", "Apply: Keep owner isolation\n  Never mix owners on restoration.")
    .replace("## Live Retrieval Probes", "| event-3 | correction | changed A\\|B | ENT-QUOTE | NONE | REFINE | source | PENDING |\n## Live Retrieval Probes");
  const r = deriveMemoryRoute(content, "Use quotation");
  assert.equal(r.status, "NEEDS_DISCOVERY"); assert.match(r.items.find(x=>x.id === "MEM-GOAL").apply, /Never mix owners/);
  const root = await mkdtemp(path.join(tmpdir(), "memory-route-markdown-"));
  try {
    const file = path.join(root, "graph.md"); await writeFile(file, content);
    assert.equal((await memoryRecallCommand(["--graph", file, "--request", "Use quotation"], services)).status, "NEEDS_DISCOVERY");
    await writeFile(file, content.replace("changed A\\|B", "changed A|B"));
    assert.equal((await memoryRecallCommand(["--graph", file, "--request", "Use quotation"], services)).code, "MEMORY_GRAPH_INVALID");
  } finally {await rm(root, {recursive:true, force:true});}
});

test("explicit supersession inconsistency and conflicts require reconciliation, not silently mixed guidance", () => {
  for (const relation of ["supersedes", "conflicts"]) {
    const content = graph([node("MEM-NEW", "DECISION", "ENT-QUOTE", "Use a different current rule",
      {Relations:`about -> ENT-QUOTE; ${relation} -> MEM-RATE`})]);
    const r = deriveMemoryRoute(content, "Use quotation");
    assert.equal(r.status, "NEEDS_DISCOVERY"); assert.ok(r.gaps.some(x=>x.includes(relation)));
  }
});

test("overlapping aliases require resolution while explicitly named distinct boundaries remain possible", () => {
  const overlap = graph().replace("invoice projection |", "invoice projection / offer |");
  assert.equal(deriveMemoryRoute(overlap, "Use supplier offer").status, "NEEDS_DISCOVERY");
  const explicit = deriveMemoryRoute(graph(), "Connect quotation and invoice projection");
  assert.equal(explicit.status, "RECALL_CANDIDATE");
});

test("ordinary alias finds parent obligations, low-match commitment and downstream contract without internals", () => {
  assert.deepEqual(validateMemoryGraph(graph(), manifest), []);
  const r = deriveMemoryRoute(graph(), "Connect a new consumer of the supplier offer");
  assert.equal(r.status, "RECALL_CANDIDATE");
  assert.deepEqual(r.roots, ["ENT-QUOTE"]);
  assert.deepEqual(r.items.map(n=>n.id).sort(), ["MEM-DOWNSTREAM", "MEM-GOAL", "MEM-RATE", "MEM-RETURN"]);
  assert.deepEqual(r.contracts.map(x=>x.path).sort(), ["public/invoice.md", "public/quote.md"]);
  assert.doesNotMatch(JSON.stringify(r), /private\/|public\/inventory/);
  assert.equal(r.semanticTruth, "NOT_VERIFIED"); assert.equal(r.admission, "NOT_GRANTED");
});

test("unknown language is an explicit discovery gap, never guessed readiness", () => {
  const r = deriveMemoryRoute(graph(), "Improve the ambient sound");
  assert.equal(r.status, "NEEDS_DISCOVERY"); assert.equal(r.reason, "NO_ANCHOR_MATCH");
  assert.equal(r.admission, "NOT_GRANTED");
});

test("superseded text is not current guidance, and applicable conflict remains a gap", () => {
  const r = deriveMemoryRoute(graph([node("MEM-OLD", "DECISION", "ENT-QUOTE", "Use floating amounts", {"Type / status": "DECISION / SUPERSEDED"}),
    node("MEM-CONFLICT", "DECISION", "ENT-QUOTE", "Two contradictory approvals", {"Type / status": "DECISION / CONFLICT"})]), "Use the quotation");
  assert.ok(!r.items.some(x=>x.id === "MEM-OLD"));
  assert.ok(r.gaps.some(x=>x.includes("MEM-CONFLICT")));
  assert.equal(r.status, "NEEDS_DISCOVERY");
});

test("pending meaning and unavailable relevant primary evidence cannot become a sufficient packet", () => {
  const pending = graph().replace("## Live Retrieval Probes", "| event-3 | correction | changed discount | ENT-QUOTE | NONE | REFINE | decision | PENDING |\n## Live Retrieval Probes");
  assert.equal(deriveMemoryRoute(pending, "Use quotation").status, "NEEDS_DISCOVERY");
  const unavailable = graph().replace("| COVERED | none | fixture reviewer |", "| UNAVAILABLE | source missing | fixture reviewer |");
  assert.equal(deriveMemoryRoute(unavailable, "Use quotation").status, "NEEDS_DISCOVERY");
});

test("transport budget refuses an oversized projection rather than dropping low-ranked obligations", () => {
  const r = deriveMemoryRoute(graph(), "Use quotation", {maxBytes: 100});
  assert.equal(r.status, "NEEDS_DISCOVERY"); assert.equal(r.reason, "RECALL_PACKET_TOO_LARGE");
  assert.equal(r.stats.relevantItems, 4); assert.equal(r.admission, "NOT_GRANTED");
});

test("read-only CLI entry works for inline and existing packed graph and rejects malformed source/arguments", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-route-"));
  try {
    const file = path.join(root, "graph.md"); await writeFile(file, graph());
    const args = ["--graph", file, "--request", "Use supplier offer"];
    const r = await memoryRecallCommand(args, services); assert.equal(r.status, "RECALL_CANDIDATE");
    const cli = spawnSync(process.execPath, [new URL("../scripts/vydykhai.mjs", import.meta.url).pathname,
      "memory-recall", ...args], {encoding:"utf8", timeout:5000});
    assert.equal(cli.status, 0, cli.stderr); assert.deepEqual(JSON.parse(cli.stdout), r);
    assert.equal(await readFile(file, "utf8"), graph());
    const packed = await packMemoryGraph(file, path.join(root, "packed"), 500);
    const p = await memoryRecallCommand(["--graph", packed.path, "--request", "Use supplier offer"], services);
    assert.equal(p.graphSha256, r.graphSha256); assert.deepEqual(p.items, r.items);
    await writeFile(file, graph().replace("Declared nodes: 4", "Declared nodes: 5"));
    assert.equal((await memoryRecallCommand(args, services)).code, "MEMORY_GRAPH_INVALID");
    assert.equal((await memoryRecallCommand([...args, "--graph", file], services)).status, "BLOCKED");
  } finally { await rm(root, {recursive:true, force:true}); }
});

test("pending unrelated knowledge does not stop read-only recall; pending relevant meaning does", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-route-pending-"));
  try {
    const file = path.join(root, "graph.md");
    const pending = anchor => graph().replace("## Live Retrieval Probes",
      `| event-3 | correction | changed policy | ${anchor} | NONE | REFINE | decision | PENDING |\n## Live Retrieval Probes`);
    await writeFile(file, pending("ENT-OTHER"));
    assert.ok(validateMemoryGraph(pending("ENT-OTHER"), manifest).some(x=>x.includes("still pending")));
    assert.equal((await memoryRecallCommand(["--graph", file, "--request", "Use quotation"], services)).status, "RECALL_CANDIDATE");
    await writeFile(file, pending("ENT-QUOTE"));
    assert.equal((await memoryRecallCommand(["--graph", file, "--request", "Use quotation"], services)).status, "NEEDS_DISCOVERY");
  } finally {await rm(root, {recursive:true, force:true});}
});

test("broad outcomes and colliding aliases require Discovery instead of guessed boundaries", () => {
  assert.equal(deriveMemoryRoute(graph(), "Improve approved commercial work").status, "NEEDS_DISCOVERY");
  const collision = graph().replace("invoice projection |", "invoice projection / supplier offer |");
  const result = deriveMemoryRoute(collision, "Use supplier offer");
  assert.equal(result.status, "NEEDS_DISCOVERY"); assert.ok(result.gaps.some(x=>x.includes("Ambiguous")));
});

test("fresh next-task recall reads integrated correction, preserves obligations and does not replay old guidance", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-route-next-"));
  try {
    const file = path.join(root, "graph.md"); await writeFile(file, graph());
    const first = await memoryRecallCommand(["--graph", file, "--request", "Use supplier offer"], services);
    assert.ok(first.items.some(n=>n.id === "MEM-RATE" && n.apply.includes("rounded cents")));
    const pending = graph().replace("## Live Retrieval Probes",
      "| event-3 | correction | use half-even rounding | ENT-QUOTE | NONE | REFINE | acceptance | PENDING |\n## Live Retrieval Probes");
    await writeFile(file, pending);
    assert.equal((await memoryRecallCommand(["--graph", file, "--request", "Connect quotation to a new consumer"], services)).status, "NEEDS_DISCOVERY");
    const integrated = graph().replace("Watermark: event-2", "Watermark: event-3")
      .replace("Use accepted rounded cents, not the old floating rate", "Use integer cents and half-even rounding; the old floating rate stays rejected")
      .replaceAll("revision-2", "revision-3");
    await writeFile(file, integrated);
    const next = await memoryRecallCommand(["--graph", file, "--request", "Connect quotation to a new consumer"], services);
    assert.equal(next.status, "RECALL_CANDIDATE"); assert.equal(next.watermark, "event-3");
    assert.notEqual(next.graphSha256, first.graphSha256);
    assert.match(next.items.find(n=>n.id === "MEM-RATE").apply, /half-even rounding/);
    assert.ok(next.items.some(n=>n.id === "MEM-RETURN"));
    assert.equal(next.admission, "NOT_GRANTED");
    assert.equal(await readFile(file, "utf8"), integrated);
  } finally {await rm(root, {recursive:true, force:true});}
});

test("large multipart graph keeps bounded ordinary recall and never drops an oversized relevant obligation", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-route-envelope-"));
  t.after(() => rm(root, {recursive:true, force:true}));
  const unrelated = Array.from({length:512}, (_, i) => node(`MEM-INVENTORY-${i}`, "DECISION", "ENT-OTHER",
    `Inventory-only retained choice ${i}. ` + "unrelated evidence ".repeat(128)));
  const content = graph(unrelated), file = path.join(root, "graph.md");
  assert.ok(Buffer.byteLength(content) > 1024 * 1024);
  await writeFile(file, content);
  const packed = await packMemoryGraph(file, path.join(root, "packed"), 128 * 1024);
  const recalled = await memoryRecallCommand(["--graph", packed.path, "--request", "Use supplier offer"], services);
  assert.equal(recalled.status, "RECALL_CANDIDATE");
  assert.equal(recalled.stats.relevantItems, 4);
  assert.deepEqual(recalled.items, deriveMemoryRoute(graph(), "Use supplier offer").items);
  assert.ok(Buffer.byteLength(JSON.stringify(recalled)) < 8192);
  assert.equal(recalled.admission, "NOT_GRANTED");
  assert.equal(await readFile(file, "utf8"), content);
  const oversized = content.replace("Apply: Keep owner isolation", "Apply: Keep owner isolation " + "required ".repeat(10000));
  await writeFile(file, oversized);
  const refused = await memoryRecallCommand(["--graph", file, "--request", "Use supplier offer"], services);
  assert.equal(refused.reason, "RECALL_PACKET_TOO_LARGE");
  assert.equal(refused.stats.relevantItems, 4);
  assert.equal(refused.admission, "NOT_GRANTED");
  assert.equal(await readFile(file, "utf8"), oversized);
});
