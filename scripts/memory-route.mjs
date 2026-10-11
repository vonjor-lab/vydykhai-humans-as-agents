// Read-only candidate retrieval. Structural success never grants task admission.
import {createHash} from "node:crypto";
import {readMemoryGraph} from "./memory-storage.mjs";
import {section, tableRows, bulletFields} from "./artifact-markdown.mjs";

const ids = value => value?.match(/(?:ENT|MEM)-[A-Za-z0-9_-]+/g) || [];
const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const matches = (request, alias) => alias && ` ${request} `.includes(` ${alias} `);
const current = node => !["SUPERSEDED", "RETIRED", "DORMANT"].includes(node.status);
const relations = node => (node.fields.get("Relations") || "").split(/\s*;\s*/).map(value =>
  ({kind:value.match(/^([a-z-]+)\s*(?:->|\u2192)/)?.[1], targets:ids(value)}));
const headings = ["## Anchor Index", "## Entity Routes", "## Current Memory Nodes",
  "## Source Coverage Ledger", "## Pending Memory Events", "## Live Retrieval Probes", "## Legacy Source Map"];
const rows = (content, heading, header) => tableRows(section(content, heading,
  headings.slice(headings.indexOf(heading) + 1)), header);
const base = {semanticTruth: "NOT_VERIFIED", admission: "NOT_GRANTED", coverageBasis: "DECLARED_GRAPH_ONLY"};

function parseNodes(content) {
  return section(content, "## Current Memory Nodes", ["## Source Coverage Ledger"])
    .split(/^### /m).slice(1).map(record => {
      const [heading, ...lines] = record.split(/\r?\n/);
      const {fields, duplicates} = bulletFields(lines);
      const [type, status] = (fields.get("Type / status") || "").split(/\s*\/\s*/);
      return {id: heading.match(/^(MEM-[A-Za-z0-9_-]+)/)?.[1], type, status, fields, duplicates};
    });
}

export function deriveMemoryRoute(content, request, {maxBytes = 65536} = {}) {
  if (typeof content !== "string" || typeof request !== "string" || !request.trim() ||
      !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    return {...base, status: "BLOCKED", code: "MEMORY_RECALL_INPUT_INVALID"};
  }
  if (!content.includes("<!-- vydykhai:project-memory-graph v4 -->")) {
    return {...base, status: "NEEDS_DISCOVERY", reason: "GRAPH_V4_ROUTE_REQUIRED"};
  }
  const anchors = rows(content, headings[0], /^ID$/i);
  const routes = rows(content, headings[1], /^From$/i);
  const nodes = parseNodes(content);
  const pending = rows(content, headings[4], /^Event$/i);
  const counts = [["anchors", anchors.length], ["routes", routes.length], ["nodes", nodes.length]];
  if (headings.some(h => !content.includes(h)) || counts.some(([key, count]) =>
    Number(content.match(new RegExp(`^Declared ${key}:\\s*(\\d+)\\s*$`, "m"))?.[1]) !== count) ||
    anchors.some(a => a.length !== 6) || routes.some(r => r.length !== 5) ||
    pending.some(r => r.length !== 8 || !["PENDING", "INTEGRATED", "NEEDS_HUMAN"].includes(r[7])) ||
    nodes.some(n => !n.id || n.duplicates.length || !n.type || !n.status)) {
    return {...base, status: "BLOCKED", code: "MEMORY_GRAPH_INVALID"};
  }
  const identity = {graphSha256: createHash("sha256").update(content).digest("hex"),
    watermark: content.match(/^Watermark:[ \t]*(.*)$/m)?.[1]?.trim() || null};
  const query = normalize(request);
  const matched = anchors.filter(a => a[2].split(/\s*[/;]\s*/).some(alias => matches(query, normalize(alias))));
  const roots = matched.map(a => a[0]);
  if (!roots.length) {
    const result = {...base, ...identity, status: "NEEDS_DISCOVERY", reason: "NO_ANCHOR_MATCH",
    roots, gaps: ["Resolve the request against the public anchor index; do not guess a module."],
    index: anchors.map(a => ({id: a[0], kind: a[1], name: a[2]}))};
    if (Buffer.byteLength(JSON.stringify(result)) > maxBytes) {
      delete result.index; result.gaps.push("The index exceeds the transport budget; resolve it outside the worker context.");
    }
    return result;
  }
  const scope = new Set(roots), edges = new Set();
  const include = (r, target) => {scope.add(target); edges.add(r);};
  // Follow purpose upward, never from a shared goal down into sibling modules.
  function ancestors() {
    let changed = true;
    while (changed) {
      const before = scope.size;
      for (const r of routes) if (scope.has(r[0]) && ["serves", "part-of"].includes(r[1])) include(r, r[2]);
      changed = scope.size !== before;
    }
  }
  ancestors();
  for (const r of routes) if (roots.includes(r[0]) && ["depends-on", "consumes", "produces", "stored-in"].includes(r[1])) include(r, r[2]);
  const consumerFrontier = new Set(scope);
  for (const r of routes) if (r[1] === "consumes" && consumerFrontier.has(r[2])) include(r, r[0]);
  ancestors();
  const selected = new Map(nodes.filter(n => current(n) && ids(n.fields.get("About")).some(id => scope.has(id)))
    .map(n => [n.id, n]));
  const gaps = [];
  const aliasMatches = [];
  for (const a of matched) for (const alias of a[2].split(/\s*[/;]\s*/).map(normalize)) {
    if (!matches(query, alias)) continue;
    let offset = 0, index;
    while ((index = ` ${query} `.indexOf(` ${alias} `, offset)) !== -1) {
      aliasMatches.push({owner:a[0], start:index + 1, end:index + 1 + alias.length}); offset = index + 1;
    }
  }
  if (aliasMatches.some((a,i) => aliasMatches.slice(i + 1).some(b => a.owner !== b.owner && a.start < b.end && b.start < a.end))) {
    gaps.push("Ambiguous matching alias: resolve the intended public boundary.");
  }
  if (!matched.some(a => ["MODULE", "CAPABILITY", "ENTITY", "ARTIFACT", "SYSTEM"].includes(a[1].toUpperCase()))) {
    gaps.push("The request names a broad outcome or actor, not an execution boundary; resolve it through Discovery.");
  }
  // Close declared obligations, not composite children or successive consumer trees.
  let changed = true;
  while (changed) {
    const before = scope.size + selected.size;
    for (const r of routes) {
      if (scope.has(r[0]) && ["serves", "part-of", "depends-on", "stored-in"].includes(r[1])) include(r, r[2]);
      if (r[1] === "constrains" && scope.has(r[2])) include(r, r[0]);
    }
    for (const n of nodes.filter(current)) {
      const incoming = relations(n).some(r => r.kind === "constrains" && r.targets.some(id => scope.has(id) || selected.has(id)));
      if (incoming || ids(n.fields.get("About")).some(id => scope.has(id))) selected.set(n.id, n);
    }
    for (const n of selected.values()) {
      ids(n.fields.get("About")).forEach(id => scope.add(id));
      for (const relation of relations(n).filter(r => r.kind === "requires")) for (const id of relation.targets) {
        if (id.startsWith("ENT-")) scope.add(id);
        else {
          const dependency = nodes.find(candidate => candidate.id === id && current(candidate));
          if (dependency) selected.set(id, dependency);
          else gaps.push(`${n.id}: required current memory ${id} is unresolved`);
        }
      }
    }
    changed = scope.size + selected.size !== before;
  }
  for (const n of nodes.filter(current)) for (const relation of relations(n)) {
    if (!["supersedes", "conflicts"].includes(relation.kind)) continue;
    for (const id of relation.targets) {
      const target = nodes.find(candidate => candidate.id === id);
      if ((selected.has(n.id) || selected.has(id) || scope.has(id)) &&
          (relation.kind === "conflicts" || (target && current(target)))) {
        gaps.push(`${n.id}: ${relation.kind} ${id} requires source/status reconciliation`);
      }
    }
  }
  for (const n of selected.values()) {
    if (n.status !== "ACTIVE") gaps.push(`${n.id}: ${n.status} requires source reconciliation`);
    if (n.type === "POINTER") gaps.push(`${n.id}: protected evidence requires its authorized retrieval boundary`);
  }
  for (const r of rows(content, headings[3], /^Source \/ participant$/i)) {
    if ((ids(r[2]).some(id => scope.has(id)) || ids(r[3]).some(id => selected.has(id))) &&
        ["PARTIAL", "CONFLICT", "UNAVAILABLE"].includes(r[4])) {
      gaps.push(`Source coverage ${r[0]}: ${r[4]}`);
    }
  }
  for (const r of pending) {
    if (["PENDING", "NEEDS_HUMAN"].includes(r[7]) &&
        (!ids(r[3]).length || ids(r[3]).some(id => scope.has(id)))) gaps.push(`Pending event ${r[0]}: ${r[7]}`);
  }
  const contracts = anchors.filter(a => scope.has(a[0])).flatMap(a => {
    const contract = a[4].match(/(?:^|;)\s*contract:\s*([^;]+)/i)?.[1]?.trim();
    if (["MODULE", "CAPABILITY"].includes(a[1].toUpperCase()) && (!contract || /^NOT_REQUIRED/i.test(contract))) {
      gaps.push(`${a[0]}: public contract unresolved`);
    }
    return contract && !/^NOT_REQUIRED/i.test(contract) ? [{anchor: a[0], path: contract, source: a[5]}] : [];
  });
  const items = [...selected.values()].map(n => ({id: n.id, type: n.type, status: n.status,
    about: ids(n.fields.get("About")), recallWhen: n.fields.get("Recall when"),
    because: n.fields.get("Because"), apply: n.fields.get("Apply"), avoid: n.fields.get("Avoid"),
    verify: n.fields.get("Verify"), scope: n.fields.get("Applies / exceptions"),
    ownerGate: n.fields.get("Owner gate"), returnWhen: n.fields.get("Return / close when"),
    relations: n.fields.get("Relations"), source: n.fields.get("Source / checked")}));
  const result = {...base, ...identity, status: gaps.length ? "NEEDS_DISCOVERY" : "RECALL_CANDIDATE",
    roots, anchors: anchors.filter(a => scope.has(a[0])).map(a => ({id:a[0], kind:a[1], name:a[2], scope:a[3], source:a[5]})),
    routes: [...edges].map(r => ({from:r[0], relation:r[1], to:r[2], qualification:r[3], source:r[4]})),
    contracts, items, gaps:[...new Set(gaps)], stats: {relevantItems: items.length, relevantAnchors: scope.size}};
  if (Buffer.byteLength(JSON.stringify(result)) > maxBytes) return {...base, ...identity, roots,
    status: "NEEDS_DISCOVERY", reason: "RECALL_PACKET_TOO_LARGE", stats: result.stats,
    gaps: ["Split the task at a public boundary; no relevant obligation was silently dropped."]};
  return result;
}

export async function memoryRecallCommand(args, {validateGraph, manifest}) {
  const opts = new Map();
  if (args.length !== 4) return {...base, status: "BLOCKED", code: "MEMORY_RECALL_ARGUMENTS_INVALID"};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--graph", "--request"].includes(args[i]) || opts.has(args[i]) || !args[i + 1]?.trim()) {
      return {...base, status: "BLOCKED", code: "MEMORY_RECALL_ARGUMENTS_INVALID"};
    }
    opts.set(args[i], args[i + 1]);
  }
  try {
    const graph = await readMemoryGraph(opts.get("--graph"));
    const issues = validateGraph(graph.text, manifest, {inspectionOnly:true});
    if (issues.length) return {...base, status: "BLOCKED", code: "MEMORY_GRAPH_INVALID", issues};
    return deriveMemoryRoute(graph.text, opts.get("--request"));
  } catch {
    return {...base, status: "BLOCKED", code: "MEMORY_RECALL_READ_FAILED"};
  }
}
