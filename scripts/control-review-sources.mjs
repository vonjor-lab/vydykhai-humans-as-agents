// A host-owned public-source registry, not the preparer's answer or a code dump.
import {readFile, realpath, lstat} from "node:fs/promises";
import path from "node:path";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {artifactRef, artifactBytes} from "./context-run.mjs";

const need = (v,c) => {if(!v) throw Error(c);};
const batchSchema = "control.review-source-batch.v1";
const maxBatchBytes = 256*1024;
export function reviewSourceRequests(args) {
  need(args && typeof args === "object" && !Array.isArray(args), "REVIEW_SOURCE_REQUEST_INVALID");
  if(Object.keys(args).join() === "id" && typeof args.id === "string")return [args];
  need(Object.keys(args).join() === "ids" && Array.isArray(args.ids) && args.ids.length > 0 &&
    args.ids.length <= 32 && Array.from(args.ids).every(id=>typeof id === "string" && id.trim()) &&
    new Set(args.ids).size === args.ids.length, "REVIEW_SOURCE_REQUEST_INVALID");
  return args.ids.map(id=>({id}));
}
// A batch is transport only: each original keeps its identity, bytes and proof.
export function reviewSourceReadbacks(args,value) {
  const requests=reviewSourceRequests(args);
  const rows=Object.hasOwn(args,"ids") ? value?.sources : [value];
  if(Object.hasOwn(args,"ids"))need(value?.schema === batchSchema &&
    Object.keys(value).sort().join() === "schema,sources" && Array.isArray(rows) &&
    Buffer.byteLength(JSON.stringify(value)) <= maxBatchBytes, "REVIEW_SOURCE_BATCH_INVALID");
  need(Array.isArray(rows) && rows.length === requests.length && requests.every((r,i)=>rows[i]?.id===r.id),
    "REVIEW_SOURCE_BATCH_INVALID");
  return rows;
}
const sourceReference = entry => ({path:entry.path,sha256:"0".repeat(64),
  ...(Object.hasOwn(entry,"startMarker") || Object.hasOwn(entry,"endMarker") ?
    {startMarker:entry.startMarker,endMarker:entry.endMarker} : {})});
export function validateReviewSourceScope(scope, acceptance) {
  need(scope && Object.keys(scope).sort().join() === "acceptanceSha256,schema,sourceIds" &&
    scope.schema === "control.review-source-scope.v1" && /^[a-f0-9]{64}$/.test(scope.acceptanceSha256) &&
    Array.isArray(scope.sourceIds) && scope.sourceIds.length > 0 && scope.sourceIds.length <= 500 &&
    Array.from(scope.sourceIds).every(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id)) &&
    new Set(scope.sourceIds).size === scope.sourceIds.length &&
    (!acceptance || scope.acceptanceSha256 === sha256(canonicalJson(acceptance))), "REVIEW_SOURCE_SCOPE_INVALID");
  return scope;
}
export async function readPrivateControlJson(file) {
  const stat = await lstat(file), parent = path.dirname(file);
  need(await realpath(file) === path.resolve(file) && stat.isFile() && !(stat.mode & 0o077) &&
    stat.size <= 1024*1024 && !((await lstat(parent)).mode & 0o077), "CONTROL_CONFIG_UNSAFE");
  return JSON.parse(await readFile(file,"utf8"));
}
export async function openReviewSources(file) {
  const config = await readPrivateControlJson(file), root = await realpath(config.workspace);
  const maxSnapshotBytes = config.maxSnapshotBytes ?? 2*1024*1024;
  need(Number.isSafeInteger(maxSnapshotBytes) && maxSnapshotBytes >= 1024 && maxSnapshotBytes <= 16*1024*1024,
    "REVIEW_SOURCE_SNAPSHOT_BUDGET_INVALID");
  need(config.schema === "control.review-sources.v1" && root === config.workspace &&
    !path.resolve(file).startsWith(root + path.sep) && Array.isArray(config.sources) &&
    config.sources.length > 0 && config.sources.length <= 500, "REVIEW_SOURCE_CONFIG_INVALID");
  const entries = new Map();
  for(const entry of config.sources) {
    need(entry && /^[A-Za-z0-9_-]{1,100}$/.test(entry.id) && !entries.has(entry.id) &&
      typeof entry.path === "string" && !path.isAbsolute(entry.path) && !entry.path.split(/[\\/]/).includes("..") &&
      typeof entry.purpose === "string" && entry.purpose.trim(), "REVIEW_SOURCE_ENTRY_INVALID");
    need(artifactRef(sourceReference(entry)), "REVIEW_SOURCE_SELECTOR_INVALID");
    entries.set(entry.id, {...entry});
  }
  const read = async id => {
    need(entries.has(id), "REVIEW_SOURCE_NOT_REGISTERED");
    const entry = entries.get(id), target = path.resolve(root, entry.path);
    need(target.startsWith(root + path.sep), "REVIEW_SOURCE_PATH_INVALID");
    try {
      need(await realpath(target) === target, "REVIEW_SOURCE_PATH_INVALID");
      const stat = await lstat(target);
      // Marker-bound sources share the existing 2 MiB artifact envelope;
      // only the selected bytes may enter the 128 KiB reviewer context.
      const fileLimit = Object.hasOwn(entry,"startMarker") ? 2*1024*1024 : 128*1024;
      need(stat.isFile() && stat.size <= fileLimit, "REVIEW_SOURCE_CAPACITY");
      const bytes = await readFile(target);
      need(bytes.length <= fileLimit, "REVIEW_SOURCE_CAPACITY");
      const selected = artifactBytes(sourceReference(entry),bytes);
      need(selected.length <= 128*1024, "REVIEW_SOURCE_CAPACITY");
      return {...entry, status: "AVAILABLE", sha256: sha256(selected), text: selected.toString("utf8")};
    } catch(e) {if(e.code === "ENOENT") return {...entry, status: "MISSING"}; throw e;}
  };
  return {
    workspace:root,
    async list() {return Array.from(entries.values());},
    async read(args) {
      const requests=reviewSourceRequests(args);
      if(!Object.hasOwn(args,"ids"))return read(args.id);
      need(requests.every(r=>entries.has(r.id)), "REVIEW_SOURCE_NOT_REGISTERED");
      const value={schema:batchSchema,sources:[]};
      for(const request of requests) {
        value.sources.push(await read(request.id));
        need(Buffer.byteLength(JSON.stringify(value)) <= maxBatchBytes, "REVIEW_SOURCE_BATCH_CAPACITY");
      }
      return value;
    },
    async recallMemory(args) {
      need(args && Object.keys(args).sort().join() === "id,request" && typeof args.id === "string" &&
        typeof args.request === "string" && args.request.trim(), "MEMORY_RECALL_REQUEST_INVALID");
      const source = await read(args.id);
      const identity = {id:source.id, sha256:source.sha256 ?? null};
      if (source.status !== "AVAILABLE") return {source:identity, status:"NEEDS_DISCOVERY",
        reason:"MEMORY_SOURCE_UNAVAILABLE", admission:"NOT_GRANTED", semanticTruth:"NOT_VERIFIED"};
      const {decodeMemoryGraph} = await import("./memory-storage.mjs");
      const acquiredSources = [{id:source.id, sha256:source.sha256}];
      let acquiredBytes = Buffer.byteLength(source.text), graph;
      try {
        need(sha256(Buffer.from(source.text)) === source.sha256, "MEMORY_STORAGE_NOT_UTF8");
        graph = await decodeMemoryGraph(Buffer.from(source.text), async part => {
          const expectedPath = path.posix.join(path.posix.dirname(source.path), part.path);
          const candidates = [...entries.values()].filter(entry => entry.path === expectedPath &&
            !Object.hasOwn(entry,"startMarker") && !Object.hasOwn(entry,"endMarker"));
          need(candidates.length === 1, "MEMORY_STORAGE_PART_NOT_REGISTERED");
          const observed = await read(candidates[0].id);
          need(observed.status === "AVAILABLE", "MEMORY_STORAGE_PART_UNAVAILABLE");
          const bytes = Buffer.from(observed.text);
          need(sha256(bytes) === observed.sha256, "MEMORY_STORAGE_NOT_UTF8");
          acquiredBytes += bytes.length;
          need(acquiredBytes <= 2*1024*1024, "REVIEW_SOURCE_TOTAL_CAPACITY");
          acquiredSources.push({id:observed.id, sha256:observed.sha256});
          return bytes;
        });
      } catch(e) {
        return {source:identity, status:"BLOCKED", code:/^[A-Z][A-Z0-9_]+$/.test(e.message) ?
          e.message : "MEMORY_STORAGE_INVALID", admission:"NOT_GRANTED", semanticTruth:"NOT_VERIFIED"};
      }
      const {deriveMemoryRoute} = await import("./memory-route.mjs");
      const {validateMemoryGraph} = await import("./vydykhai.mjs");
      const manifest = JSON.parse(await readFile(new URL("../vydykhai.json", import.meta.url), "utf8"));
      const issues = validateMemoryGraph(graph.text, manifest, {inspectionOnly:true});
      if (issues.length) {
        const refusal = {source:identity, status:"BLOCKED", code:"MEMORY_GRAPH_INVALID",
          issues, admission:"NOT_GRANTED", semanticTruth:"NOT_VERIFIED"};
        if (Buffer.byteLength(JSON.stringify(refusal)) <= 65536) return refusal;
        const diagnosticBytes = Buffer.from(JSON.stringify(issues));
        // Refuse the whole invalid graph; an oversized diagnostic is not a recall packet.
        const {issues:omitted, ...bounded} = refusal;
        return {...bounded, diagnostics:{status:"OMITTED_OVERSIZE", count:omitted.length,
          bytes:diagnosticBytes.length, sha256:sha256(diagnosticBytes)}};
      }
      const result = {...deriveMemoryRoute(graph.text, args.request), source:identity,
        ...(graph.storage.format === "memory.storage.v1" ? {
          graphStorage:{format:graph.storage.format, bytes:graph.storage.bytes, sha256:graph.storage.sha256,
            parts:graph.storage.parts, manifestSha256:graph.storage.manifestSha256}, acquiredSources} : {})};
      if (Buffer.byteLength(JSON.stringify(result)) > 65536) return {source:identity,
        status:"NEEDS_DISCOVERY", reason:"RECALL_PACKET_TOO_LARGE", admission:"NOT_GRANTED", semanticTruth:"NOT_VERIFIED"};
      return result;
    },
    async snapshot(scope) {
      if(scope !== undefined) validateReviewSourceScope(scope);
      const ids = scope ? [...scope.sourceIds].sort() : [...entries.keys()];
      need(ids.every(id => entries.has(id)), "REVIEW_SOURCE_SCOPE_UNREGISTERED");
      const rows = []; let bytes = 0;
      for(const id of ids) {
        const row = await read(id); bytes += Buffer.byteLength(row.text ?? "");
        need(bytes <= maxSnapshotBytes, "REVIEW_SOURCE_TOTAL_CAPACITY");
        const {text, ...reference} = row; rows.push(reference);
      }
      return {rows, digest: sha256(canonicalJson(rows)), bytes, ...(scope ? {scope:structuredClone(scope)} : {})};
    }
  };
}
