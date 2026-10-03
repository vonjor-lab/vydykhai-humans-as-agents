// Physical storage can change without changing graph meaning, ids or history.
import { readFile, writeFile, mkdir, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { sha256, canonicalJson } from "./memory-brief.mjs";
import { parseContextJson } from "./context-run.mjs";

const keys = (v, names) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).sort().join("\0") === [...names].sort().join("\0");
const need = (v, code) => { if (!v) throw new Error(code); };
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const utf8 = bytes => {
  const text = bytes.toString("utf8");
  need(Buffer.from(text).equals(bytes), "MEMORY_STORAGE_NOT_UTF8"); return text;
};

function indexFor(text, parts) {
  const starts = [...text.matchAll(/^(?:#{1,3} [^\r\n]+|\| ENT-[^|\r\n]+\|)/gm)];
  // The index locates records, not semantic equivalence. Validate it on readback.
  let cursor = 0, offset = 0;
  return starts.map((match, i) => {
    offset += Buffer.byteLength(text.slice(cursor, match.index)); cursor = match.index;
    const end = offset + Buffer.byteLength(text.slice(cursor, starts[i + 1]?.index ?? text.length));
    let partOffset = 0;
    const selected = parts.filter(p => {
      const start = partOffset; partOffset += p.bytes; return start < end && partOffset > offset;
    }).map(p => p.path);
    return { heading: match[0], parts: selected };
  });
}

export async function readMemoryGraph(filename) {
  const bytes = await readFile(filename), text = utf8(bytes);
  if (!text.trimStart().startsWith("{")) return { text, storage: { format: "inline", bytes: bytes.length, sha256: sha256(bytes) } };
  const manifest = parseContextJson(bytes);
  need(keys(manifest, ["schema", "graphSha256", "bytes", "partBytes", "parts", "index"]) &&
    manifest.schema === "memory.storage.v1" && digest(manifest.graphSha256) &&
    Number.isSafeInteger(manifest.bytes) && manifest.bytes > 0 && Number.isSafeInteger(manifest.partBytes) &&
    manifest.partBytes >= 4 && Array.isArray(manifest.parts) && manifest.parts.length > 0, "MEMORY_STORAGE_MANIFEST_INVALID");
  const root = await realpath(path.dirname(filename)), chunks = [], seen = new Set();
  for (const p of manifest.parts) {
    need(keys(p, ["path", "bytes", "sha256"]) && /^part-\d+\.md$/.test(p.path) && !seen.has(p.path) &&
      Number.isSafeInteger(p.bytes) && p.bytes > 0 && p.bytes <= manifest.partBytes && digest(p.sha256), "MEMORY_STORAGE_PART_INVALID");
    seen.add(p.path);
    const full = path.join(root, p.path);
    const stat = await lstat(full);
    need(await realpath(full) === full && stat.isFile(), "MEMORY_STORAGE_PATH_INVALID");
    need(stat.size === p.bytes, "MEMORY_STORAGE_PART_CHANGED");
    const data = await readFile(full); utf8(data);
    need(data.length === p.bytes && sha256(data) === p.sha256, "MEMORY_STORAGE_PART_CHANGED"); chunks.push(data);
  }
  const joined = Buffer.concat(chunks);
  need(joined.length === manifest.bytes && sha256(joined) === manifest.graphSha256, "MEMORY_STORAGE_GRAPH_CHANGED");
  const graph = utf8(joined);
  need(canonicalJson(indexFor(graph, manifest.parts)) === canonicalJson(manifest.index), "MEMORY_STORAGE_INDEX_CHANGED");
  return { text: graph, storage: { format: manifest.schema, bytes: joined.length, sha256: manifest.graphSha256,
    parts: manifest.parts.length, manifestSha256: sha256(bytes), index: manifest.index } };
}

export function assessMemoryCapacity(current, candidate, limit, unit) {
  need(["utf8-bytes", "unicode-points", "utf16-units"].includes(unit), "MEMORY_CAPACITY_UNIT_REQUIRED");
  need(limit === null || (Number.isSafeInteger(limit) && limit > 0), "MEMORY_CAPACITY_INVALID");
  const size = s => unit === "utf8-bytes" ? Buffer.byteLength(s) : unit === "unicode-points" ? [...s].length : s.length;
  const used = size(candidate), delta = Math.max(0, used - size(current));
  const records = candidate.match(/^### MEM-[\s\S]*?(?=^#{2,3} |$(?![\s\S]))/gm) || [];
  const reserve = records.reduce((max, record) => Math.max(max, size(record)), delta);
  const remaining = limit === null ? null : limit - used;
  const status = limit === null ? "CAPACITY_UNKNOWN" : remaining < 0 ? "EXPAND_STORAGE_REQUIRED" :
    remaining < reserve ? "EXPANSION_DUE" : "FITS";
  return { status, unit, limit, used, remaining, reserve, reserveBasis: "max(next-delta, largest-current-memory-record)",
    writeFits: limit === null ? null : used <= limit, integrated: false,
    action: status === "FITS" ? "WRITE_AND_VERIFY_READBACK" : "RETAIN_DELTA_NOTIFY_OWNER_AND_RESOLVE_STORAGE",
    logicalMemoryLimit: null };
}

export async function packMemoryGraph(input, output, partBytes) {
  need(Number.isSafeInteger(partBytes) && partBytes >= 4, "MEMORY_PART_SIZE_INVALID");
  const graph = await readMemoryGraph(input), bytes = Buffer.from(graph.text), parts = [];
  need(bytes.length > 0, "MEMORY_GRAPH_EMPTY");
  // Exclusive candidate directory; existing/accepted storage is never overwritten.
  await mkdir(output);
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + partBytes, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    const line = bytes.lastIndexOf(10, end - 1);
    if (line >= start && line + 1 > start + (end - start) / 2) end = line + 1;
    const data = bytes.subarray(start, end), name = `part-${String(parts.length + 1).padStart(4, "0")}.md`;
    await writeFile(path.join(output, name), data, { flag: "wx", mode: 0o600 });
    parts.push({ path: name, bytes: data.length, sha256: sha256(data) }); start = end;
  }
  const manifest = { schema: "memory.storage.v1", graphSha256: sha256(bytes), bytes: bytes.length, partBytes, parts,
    index: indexFor(graph.text, parts) };
  const filename = path.join(output, "graph.json");
  await writeFile(filename, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const verified = await readMemoryGraph(filename);
  need(verified.text === graph.text, "MEMORY_STORAGE_ROUNDTRIP_FAILED");
  return { status: "CANDIDATE_VERIFIED", path: filename, bytes: bytes.length, sha256: manifest.graphSha256,
    parts: parts.length, activeGraphChanged: false, semanticValidation: "NOT_PERFORMED" };
}

export async function memoryStorageCommand(args) {
  try {
    const [mode, ...rest] = args, opts = {};
    need(rest.length % 2 === 0, "MEMORY_STORAGE_ARGUMENTS_INVALID");
    for (let i = 0; i < rest.length; i += 2) {
      need(!Object.hasOwn(opts, rest[i]), "MEMORY_STORAGE_ARGUMENTS_INVALID"); opts[rest[i]] = rest[i + 1];
    }
    if (mode === "pack") {
      need(keys(opts, ["--input", "--output", "--part-bytes"]), "MEMORY_STORAGE_ARGUMENTS_INVALID");
      return await packMemoryGraph(path.resolve(opts["--input"]), path.resolve(opts["--output"]), Number(opts["--part-bytes"]));
    }
    need(mode === "plan" && keys(opts, ["--input", "--candidate", "--limit", "--unit"]), "MEMORY_STORAGE_ARGUMENTS_INVALID");
    const current = await readMemoryGraph(path.resolve(opts["--input"])), candidate = await readMemoryGraph(path.resolve(opts["--candidate"]));
    return { ...assessMemoryCapacity(current.text, candidate.text, opts["--limit"] === "unknown" ? null : Number(opts["--limit"]), opts["--unit"]),
      currentSha256: sha256(current.text), candidateSha256: sha256(candidate.text) };
  } catch (e) { return { status: "BLOCKED", code: /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : "MEMORY_STORAGE_IO_INVALID", integrated: false }; }
}
