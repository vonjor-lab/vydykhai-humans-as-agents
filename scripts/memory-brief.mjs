import { createHash } from "node:crypto";

export const EXECUTABLE_BRIEF_SCHEMA = "memory.executable-brief.v1";
export const APPLICATION_RECEIPT_SCHEMA = "memory.application-receipt.v1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[^\s<>][^\r\n<>]*$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownKeysMatch(value, keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function validText(value) {
  return typeof value === "string" && value.length > 0;
}

function validHash(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function validStringArray(value, { nonEmpty = false } = {}) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(validId);
}

function firstDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function firstCollision(groups) {
  const owners = new Map();
  for (const [namespace, values] of groups) {
    for (const value of values) {
      const owner = owners.get(value);
      if (owner && owner !== namespace) return value;
      owners.set(value, namespace);
    }
  }
  return null;
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sameValue(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

// RFC 8785 uses ECMAScript primitive serialization and lexicographically sorted object keys.
export function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not allow non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON accepts only JSON values");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function authorityIssues(value, path) {
  const keys = [
    "activeGraphId",
    "activeGraphBodySha256",
    "retrievalSnapshotId",
    "retrievalSnapshotSha256",
    "sourceRefs",
  ];
  if (!ownKeysMatch(value, keys)) return [`${path} must contain exactly ${keys.join(", ")}`];
  const issues = [];
  if (!validId(value.activeGraphId)) issues.push(`${path}.activeGraphId is invalid`);
  if (!validHash(value.activeGraphBodySha256)) issues.push(`${path}.activeGraphBodySha256 is invalid`);
  if (!validId(value.retrievalSnapshotId)) issues.push(`${path}.retrievalSnapshotId is invalid`);
  if (!validHash(value.retrievalSnapshotSha256)) issues.push(`${path}.retrievalSnapshotSha256 is invalid`);
  if (!validStringArray(value.sourceRefs, { nonEmpty: true })) {
    issues.push(`${path}.sourceRefs is invalid`);
  } else {
    const duplicate = firstDuplicate(value.sourceRefs);
    if (duplicate) issues.push(`${path}.sourceRefs repeats ${duplicate}`);
  }
  return issues;
}

function sourceRefsIssues(value, path) {
  if (!validStringArray(value, { nonEmpty: true })) return [`${path} is invalid`];
  const duplicate = firstDuplicate(value);
  return duplicate ? [`${path} repeats ${duplicate}`] : [];
}

function itemShapeIssues(item, index) {
  const path = `payload.items[${index}]`;
  if (!isObject(item)) return [`${path} must be an object`];
  const shared = ["id", "kind", "atomic", "allowFactoring", "sourceRefs"];
  const issues = [];
  if (!validId(item.id)) issues.push(`${path}.id is invalid`);
  if (item.atomic !== true) issues.push(`${path}.atomic must be true`);
  if (item.allowFactoring !== false) issues.push(`${path}.allowFactoring must be false`);
  issues.push(...sourceRefsIssues(item.sourceRefs, `${path}.sourceRefs`));

  if (item.kind === "ordered_action") {
    const keys = [...shared, "position", "clauses"];
    if (!ownKeysMatch(item, keys)) issues.push(`${path} has an invalid ordered_action shape`);
    if (!validId(item.position)) issues.push(`${path}.position is invalid`);
    if (!Array.isArray(item.clauses) || item.clauses.length === 0) {
      issues.push(`${path}.clauses must be a non-empty array`);
    } else {
      item.clauses.forEach((clause, clauseIndex) => {
        const clausePath = `${path}.clauses[${clauseIndex}]`;
        if (!ownKeysMatch(clause, ["id", "text", "sourceRefs"])) {
          issues.push(`${clausePath} has an invalid shape`);
          return;
        }
        if (!validId(clause.id)) issues.push(`${clausePath}.id is invalid`);
        if (!validText(clause.text)) issues.push(`${clausePath}.text is invalid`);
        issues.push(...sourceRefsIssues(clause.sourceRefs, `${clausePath}.sourceRefs`));
      });
    }
  } else if (item.kind === "repeated_rows") {
    const keys = [...shared, "rowCount", "rows"];
    if (!ownKeysMatch(item, keys)) issues.push(`${path} has an invalid repeated_rows shape`);
    if (!Number.isInteger(item.rowCount) || item.rowCount < 1) issues.push(`${path}.rowCount is invalid`);
    if (!Array.isArray(item.rows) || item.rows.length === 0 || item.rows.length !== item.rowCount) {
      issues.push(`${path}.rows must match rowCount and be non-empty`);
    } else {
      item.rows.forEach((row, rowIndex) => {
        const rowPath = `${path}.rows[${rowIndex}]`;
        if (!ownKeysMatch(row, ["id", "path", "through", "terminal", "sourceRefs"])) {
          issues.push(`${rowPath} has an invalid shape`);
          return;
        }
        if (!validId(row.id)) issues.push(`${rowPath}.id is invalid`);
        for (const field of ["path", "through", "terminal"]) {
          if (!validText(row[field])) issues.push(`${rowPath}.${field} is invalid`);
        }
        issues.push(...sourceRefsIssues(row.sourceRefs, `${rowPath}.sourceRefs`));
      });
    }
  } else {
    issues.push(`${path}.kind is invalid`);
  }
  return issues;
}

function envelopeShapeIssues(envelope) {
  if (!ownKeysMatch(envelope, ["header", "payload", "briefDigest"])) {
    return ["envelope must contain exactly header, payload, briefDigest"];
  }
  const issues = [];
  const headerKeys = [
    "schema",
    "canonicalization",
    "digestAlgorithm",
    "readOnly",
    "writeBack",
    "authorityReceipt",
    "ordinaryPromptSha256",
  ];
  if (!ownKeysMatch(envelope.header, headerKeys)) issues.push("header has an invalid shape");
  else {
    if (envelope.header.schema !== EXECUTABLE_BRIEF_SCHEMA) issues.push("header.schema is invalid");
    if (envelope.header.canonicalization !== "RFC8785-JCS") issues.push("header.canonicalization is invalid");
    if (envelope.header.digestAlgorithm !== "SHA-256") issues.push("header.digestAlgorithm is invalid");
    if (envelope.header.readOnly !== true || envelope.header.writeBack !== false) {
      issues.push("header must be read-only and non-writing");
    }
    issues.push(...authorityIssues(envelope.header.authorityReceipt, "header.authorityReceipt"));
    if (!validHash(envelope.header.ordinaryPromptSha256)) issues.push("header.ordinaryPromptSha256 is invalid");
  }
  if (!ownKeysMatch(envelope.payload, ["items", "manifest"])) issues.push("payload has an invalid shape");
  else {
    if (!Array.isArray(envelope.payload.items) || envelope.payload.items.length === 0) {
      issues.push("payload.items must be a non-empty array");
    } else {
      envelope.payload.items.forEach((item, index) => issues.push(...itemShapeIssues(item, index)));
    }
    const manifest = envelope.payload.manifest;
    if (!ownKeysMatch(manifest, ["requiredItemIds", "requiredClauseIds", "requiredRowIds"])) {
      issues.push("payload.manifest has an invalid shape");
    } else {
      for (const field of ["requiredItemIds", "requiredClauseIds", "requiredRowIds"]) {
        if (!validStringArray(manifest[field])) issues.push(`payload.manifest.${field} is invalid`);
      }
    }
  }
  if (!validHash(envelope.briefDigest)) issues.push("briefDigest is invalid");
  return issues;
}

function receiptShapeIssues(receipt) {
  const keys = [
    "schema",
    "authorityReceipt",
    "ordinaryPromptSha256",
    "briefDigest",
    "requiredItemIds",
    "requiredClauseIds",
    "requiredRowIds",
    "appliedItemIds",
    "appliedClauseIds",
    "appliedRowIds",
    "status",
    "issues",
  ];
  if (!ownKeysMatch(receipt, keys)) return [`receipt must contain exactly ${keys.join(", ")}`];
  const issues = [];
  if (receipt.schema !== APPLICATION_RECEIPT_SCHEMA) issues.push("receipt.schema is invalid");
  issues.push(...authorityIssues(receipt.authorityReceipt, "receipt.authorityReceipt"));
  if (!validHash(receipt.ordinaryPromptSha256)) issues.push("receipt.ordinaryPromptSha256 is invalid");
  if (!validHash(receipt.briefDigest)) issues.push("receipt.briefDigest is invalid");
  for (const field of [
    "requiredItemIds",
    "requiredClauseIds",
    "requiredRowIds",
    "appliedItemIds",
    "appliedClauseIds",
    "appliedRowIds",
  ]) {
    if (!validStringArray(receipt[field])) issues.push(`receipt.${field} is invalid`);
  }
  if (!["APPLIED", "BLOCKED"].includes(receipt.status)) issues.push("receipt.status is invalid");
  if (!Array.isArray(receipt.issues)) issues.push("receipt.issues must be an array");
  else receipt.issues.forEach((issue, index) => {
    const path = `receipt.issues[${index}]`;
    if (!ownKeysMatch(issue, ["code", "collection", "id"])) issues.push(`${path} has an invalid shape`);
    else if (issue.code !== "MISSING_ID" || !["item", "clause", "row"].includes(issue.collection) || !validId(issue.id)) {
      issues.push(`${path} is invalid`);
    }
  });
  return issues;
}

function deriveManifest(items) {
  const requiredItemIds = items.map((item) => item.id);
  const requiredClauseIds = items.flatMap((item) => item.kind === "ordered_action"
    ? item.clauses.map((clause) => clause.id) : []);
  const requiredRowIds = items.flatMap((item) => item.kind === "repeated_rows"
    ? item.rows.map((row) => row.id) : []);
  for (const values of [requiredItemIds, requiredClauseIds, requiredRowIds]) {
    const duplicate = firstDuplicate(values);
    if (duplicate) return { error: { code: "DUPLICATE_ID", id: duplicate } };
  }
  const collision = firstCollision([
    ["item", requiredItemIds],
    ["clause", requiredClauseIds],
    ["row", requiredRowIds],
  ]);
  if (collision) return { error: { code: "ID_COLLISION", id: collision } };
  return { manifest: { requiredItemIds, requiredClauseIds, requiredRowIds } };
}

function invalid(code, message, details = {}) {
  return { status: "INVALID", code, issues: [{ message, ...details }] };
}

function manifestMatches(left, right) {
  return sameArray(left.requiredItemIds, right.requiredItemIds) &&
    sameArray(left.requiredClauseIds, right.requiredClauseIds) &&
    sameArray(left.requiredRowIds, right.requiredRowIds);
}

function orderedSubset(required, applied) {
  let cursor = -1;
  for (const id of applied) {
    const index = required.indexOf(id);
    if (index <= cursor) return false;
    cursor = index;
  }
  return true;
}

function missingIds(required, applied) {
  const present = new Set(applied);
  return required.filter((id) => !present.has(id));
}

export class MemoryBriefContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemoryBriefContractError";
    this.code = code;
  }
}

export function compileExecutableBrief({ authorityReceipt, ordinaryPromptSha256, atomicItems } = {}) {
  const header = {
    schema: EXECUTABLE_BRIEF_SCHEMA,
    canonicalization: "RFC8785-JCS",
    digestAlgorithm: "SHA-256",
    readOnly: true,
    writeBack: false,
    authorityReceipt: structuredClone(authorityReceipt),
    ordinaryPromptSha256,
  };
  const items = structuredClone(atomicItems);
  const provisional = { header, payload: { items, manifest: {
    requiredItemIds: [], requiredClauseIds: [], requiredRowIds: [],
  } }, briefDigest: "0".repeat(64) };
  const shapeIssues = envelopeShapeIssues(provisional);
  if (shapeIssues.length) throw new MemoryBriefContractError("SCHEMA_INVALID", shapeIssues.join("; "));
  const derived = deriveManifest(items);
  if (derived.error) throw new MemoryBriefContractError(derived.error.code, `Duplicate or colliding id: ${derived.error.id}`);
  const payload = { items, manifest: derived.manifest };
  const briefDigest = sha256(canonicalJson({ header, payload }));
  const envelope = { header, payload, briefDigest };
  const atomicRender = `<!-- vydykhai:executable-memory-brief v1 -->\n${canonicalJson(envelope)}\n<!-- vydykhai:executable-memory-brief:end -->`;
  return { envelope, atomicRender };
}

export function composeBrief({ atomicRender, advisoryText } = {}) {
  if (typeof atomicRender !== "string" || typeof advisoryText !== "string") {
    throw new TypeError("composeBrief accepts atomicRender and advisoryText strings");
  }
  return advisoryText === "" ? atomicRender : `${atomicRender}\n\n${advisoryText}`;
}

export function validateApplicationReceipt({ envelope, receipt } = {}) {
  const shapeIssues = [...envelopeShapeIssues(envelope), ...receiptShapeIssues(receipt)];
  if (shapeIssues.length) return invalid("SCHEMA_INVALID", shapeIssues[0]);

  const derived = deriveManifest(envelope.payload.items);
  if (derived.error) return invalid(derived.error.code, `Duplicate or colliding id: ${derived.error.id}`, { id: derived.error.id });
  for (const field of [
    "requiredItemIds", "requiredClauseIds", "requiredRowIds",
    "appliedItemIds", "appliedClauseIds", "appliedRowIds",
  ]) {
    const duplicate = firstDuplicate(receipt[field]);
    if (duplicate) return invalid("DUPLICATE_ID", `receipt.${field} repeats ${duplicate}`, { id: duplicate });
  }
  const receiptCollision = firstCollision([
    ["item", [...receipt.requiredItemIds, ...receipt.appliedItemIds]],
    ["clause", [...receipt.requiredClauseIds, ...receipt.appliedClauseIds]],
    ["row", [...receipt.requiredRowIds, ...receipt.appliedRowIds]],
  ]);
  if (receiptCollision) return invalid("ID_COLLISION", `Receipt id crosses namespaces: ${receiptCollision}`, { id: receiptCollision });

  if (!manifestMatches(envelope.payload.manifest, derived.manifest)) {
    return invalid("MANIFEST_MISMATCH", "Envelope manifest does not match payload items");
  }
  const expectedDigest = sha256(canonicalJson({ header: envelope.header, payload: envelope.payload }));
  if (envelope.briefDigest !== expectedDigest) return invalid("BRIEF_DIGEST_MISMATCH", "Envelope digest does not match its content");
  if (!sameValue(receipt.authorityReceipt, envelope.header.authorityReceipt)) {
    return invalid("AUTHORITY_MISMATCH", "Receipt authority does not match the brief");
  }
  if (receipt.ordinaryPromptSha256 !== envelope.header.ordinaryPromptSha256) {
    return invalid("PROMPT_HASH_MISMATCH", "Receipt prompt hash does not match the brief");
  }
  if (receipt.briefDigest !== envelope.briefDigest) return invalid("BRIEF_DIGEST_MISMATCH", "Receipt digest does not match the brief");
  const receiptManifest = {
    requiredItemIds: receipt.requiredItemIds,
    requiredClauseIds: receipt.requiredClauseIds,
    requiredRowIds: receipt.requiredRowIds,
  };
  if (!manifestMatches(receiptManifest, derived.manifest)) {
    return invalid("MANIFEST_MISMATCH", "Receipt manifest does not match the derived brief manifest");
  }

  const collections = [
    ["item", derived.manifest.requiredItemIds, receipt.appliedItemIds],
    ["clause", derived.manifest.requiredClauseIds, receipt.appliedClauseIds],
    ["row", derived.manifest.requiredRowIds, receipt.appliedRowIds],
  ];
  const requiredByCollection = new Map(collections.map(([name, required]) => [name, new Set(required)]));
  for (const [collection, required, applied] of collections) {
    const unknown = applied.find((id) => !required.includes(id));
    if (unknown) return invalid("UNKNOWN_ID", `Unknown applied ${collection} id: ${unknown}`, { collection, id: unknown });
  }
  for (const issue of receipt.issues) {
    if (!requiredByCollection.get(issue.collection)?.has(issue.id)) {
      return invalid("UNKNOWN_ID", `Unknown issue ${issue.collection} id: ${issue.id}`, { collection: issue.collection, id: issue.id });
    }
  }
  for (const [collection, required, applied] of collections) {
    if (!orderedSubset(required, applied)) return invalid("ORDER_MISMATCH", `Applied ${collection} ids are out of order`);
  }

  const missing = collections.flatMap(([collection, required, applied]) =>
    missingIds(required, applied).map((id) => ({ code: "MISSING_ID", collection, id })));
  if ((receipt.status === "APPLIED" && missing.length > 0) || (receipt.status === "BLOCKED" && missing.length === 0)) {
    return invalid("INCONSISTENT_STATUS", "Receipt status does not match its missing ids");
  }
  const issueKeys = receipt.issues.map((issue) => `${issue.collection}:${issue.id}`);
  const missingKeys = missing.map((issue) => `${issue.collection}:${issue.id}`);
  const omitted = missingKeys.find((key) => !issueKeys.includes(key));
  if (omitted) return invalid("UNREPORTED_MISSING_ID", `Missing id is not reported: ${omitted}`);
  if (firstDuplicate(issueKeys) || issueKeys.length !== missingKeys.length || issueKeys.some((key) => !missingKeys.includes(key))) {
    return invalid("UNEXPECTED_ISSUE", "Receipt issues are not the exact missing-id complement");
  }
  if (receipt.status === "BLOCKED") return { status: "BLOCKED", code: "MISSING_ID", issues: missing };
  return { status: "APPLIED", code: "OK", issues: [] };
}

// Separate from the strict executable-brief v1 carrier. This checks declared source
// accounting and content bindings, never semantic truth or product acceptance.
export function checkPreparedContext(input = {}) {
  const blocked = (code, ref = "context") => ({ status: "BLOCKED", code, ref });
  const contextId = v => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
  const strings = (v, nonEmpty = false) => Array.isArray(v) && v.length <= 1024 && (!nonEmpty || v.length > 0) &&
    v.every(x => validText(x) && x.trim()) && new Set(v).size === v.length;
  const scopeValues = v => strings(v, true) && v.every(x => x === "*" || contextId(x));
  const intersects = (a, b) => a.includes("*") || b.includes("*") || a.some(v => b.includes(v));
  if (!ownKeysMatch(input, ["inventory", "dispositions", "prepared", "phase"]) ||
      !["prepare", "bind"].includes(input.phase) || !Array.isArray(input.inventory) ||
      !Array.isArray(input.dispositions) || !isObject(input.prepared)) return blocked("CONTEXT_SCHEMA_INVALID");
  const p = input.prepared;
  if (!ownKeysMatch(p, ["scope", "taskId", "owner", "allowLocalOverlay", "items", "envelope", "atomicRender"]) ||
      !scopeValues(p.scope) || !contextId(p.taskId) || !contextId(p.owner) || typeof p.allowLocalOverlay !== "boolean" ||
      !Array.isArray(p.items) || typeof p.atomicRender !== "string") return blocked("CONTEXT_SCHEMA_INVALID");
  const inventory = new Map(), dispositionMap = new Map(), assertions = new Map(), required = new Set();
  for (const source of input.inventory) {
    if (!ownKeysMatch(source, ["sourceId", "eventId", "sha256", "scope"]) || !contextId(source.sourceId) ||
        !contextId(source.eventId) || !validHash(source.sha256) || !scopeValues(source.scope)) return blocked("CONTEXT_SCHEMA_INVALID");
    const key = `${source.sourceId}/${source.eventId}`;
    if (inventory.has(key)) return blocked("DUPLICATE_SOURCE", key);
    inventory.set(key, source);
  }
  for (const d of input.dispositions) {
    if (!ownKeysMatch(d, ["sourceId", "eventId", "sourceSha256", "reviewRef", "integrated", "localOwner", "localTask", "assertions", "reason"]) ||
        !contextId(d.sourceId) || !contextId(d.eventId) || !validHash(d.sourceSha256) || !validText(d.reviewRef) ||
        typeof d.integrated !== "boolean" || !(d.localOwner === null || contextId(d.localOwner)) ||
        !(d.localTask === null || contextId(d.localTask)) || (d.localOwner === null) !== (d.localTask === null) ||
        !Array.isArray(d.assertions) || !validText(d.reason)) return blocked("CONTEXT_SCHEMA_INVALID");
    const key = `${d.sourceId}/${d.eventId}`;
    if (dispositionMap.has(key)) return blocked("DUPLICATE_DISPOSITION", key);
    if (!inventory.has(key)) return blocked("UNKNOWN_SOURCE_DISPOSITION", key);
    dispositionMap.set(key, d);
    if (d.sourceSha256 !== inventory.get(key).sha256) return blocked("SOURCE_REVISION_CHANGED", key);
    for (const a of d.assertions) {
      if (!ownKeysMatch(a, ["id", "disposition", "scope", "targetRef", "reason", "supersededBy", "ownerGate", "trigger"]) ||
          !contextId(a.id) || !scopeValues(a.scope) || !validText(a.targetRef) || !validText(a.reason) ||
          !["current_constraint", "accepted_capability", "deferred", "superseded", "unresolved", "evidence_only"].includes(a.disposition) ||
          !(a.supersededBy === null || validText(a.supersededBy)) ||
          !(a.ownerGate === null || validText(a.ownerGate)) || !(a.trigger === null || validText(a.trigger))) return blocked("CONTEXT_SCHEMA_INVALID");
      if (assertions.has(a.id)) return blocked("DUPLICATE_ASSERTION", a.id);
      const sourceScope = inventory.get(key).scope;
      if (!sourceScope.includes("*") && !a.scope.every(s => sourceScope.includes(s))) return blocked("ASSERTION_SCOPE_OUTSIDE_SOURCE", a.id);
      assertions.set(a.id, { assertion: a, source: d });
      if (a.disposition === "superseded" && !a.supersededBy) return blocked("SUPERSESSION_SOURCE_MISSING", a.id);
      if (a.disposition === "deferred" && (!a.ownerGate || !a.trigger)) return blocked("DEFERRED_GATE_MISSING", a.id);
      if (intersects(a.scope, p.scope)) {
        if (a.disposition === "unresolved") return blocked("SOURCE_UNRESOLVED", a.id);
        if (["current_constraint", "accepted_capability", "deferred"].includes(a.disposition)) required.add(a.id);
      }
    }
  }
  for (const [key, s] of inventory) {
    if (!intersects(s.scope, p.scope)) continue;
    const d = dispositionMap.get(key);
    if (!d) return blocked("SOURCE_RANGE_PENDING", key);
  }
  // Supersession is a bound edge between reviewed assertions, not free text.
  // Each edge must cover the whole old scope; partial replacement needs explicit
  // scoped assertions so that obligations outside the replacement survive.
  for (const { assertion } of assertions.values()) {
    if (assertion.disposition !== "superseded") continue;
    const visited = new Set([assertion.id]);
    let current = assertion;
    while (current.disposition === "superseded") {
      const replacement = assertions.get(current.supersededBy);
      if (!replacement) return blocked("SUPERSESSION_SOURCE_MISSING", current.id);
      const next = replacement.assertion;
      if (visited.has(next.id)) return blocked("SUPERSESSION_CYCLE", next.id);
      if (!next.scope.includes("*") && !current.scope.every(s => next.scope.includes(s))) return blocked("SUPERSESSION_SCOPE_GAP", current.id);
      if (next.disposition === "unresolved") return blocked("SUPERSESSION_UNRESOLVED", next.id);
      const d = replacement.source;
      if (!d.integrated && !(p.allowLocalOverlay && d.localOwner === p.owner && d.localTask === p.taskId)) return blocked("SHARED_INTEGRATION_PENDING", next.id);
      visited.add(next.id);
      current = next;
    }
  }
  for (const [key, s] of inventory) {
    if (!intersects(s.scope, p.scope)) continue;
    const d = dispositionMap.get(key);
    if (!d.integrated && !(p.allowLocalOverlay && d.localOwner === p.owner && d.localTask === p.taskId)) return blocked("SHARED_INTEGRATION_PENDING", key);
  }
  const itemIds = new Set(), delivered = new Set();
  for (const item of p.items) {
    if (!ownKeysMatch(item, ["id", "text", "sourceAssertionRefs"]) || !contextId(item.id) || !validText(item.text) || !item.text.trim() ||
        !strings(item.sourceAssertionRefs, true)) return blocked("CONTEXT_SCHEMA_INVALID");
    if (itemIds.has(item.id)) return blocked("DUPLICATE_CONTENT_ID", item.id);
    itemIds.add(item.id);
    for (const ref of item.sourceAssertionRefs) {
      if (!assertions.has(ref)) return blocked("UNKNOWN_CONTENT_SOURCE", ref);
      delivered.add(ref);
    }
  }
  if (input.phase === "bind") {
    if (p.envelope !== null) {
      const m = p.envelope?.payload?.manifest;
      if (!m) return blocked("CONTEXT_ENVELOPE_INVALID");
      const checked = validateApplicationReceipt({ envelope: p.envelope, receipt: {
        schema: APPLICATION_RECEIPT_SCHEMA, authorityReceipt: p.envelope.header?.authorityReceipt,
        ordinaryPromptSha256: p.envelope.header?.ordinaryPromptSha256, briefDigest: p.envelope.briefDigest,
        ...m, appliedItemIds: m.requiredItemIds, appliedClauseIds: m.requiredClauseIds,
        appliedRowIds: m.requiredRowIds, status: "APPLIED", issues: [],
      } });
      if (checked.status !== "APPLIED") return blocked("CONTEXT_ENVELOPE_INVALID");
      const render = `<!-- vydykhai:executable-memory-brief v1 -->\n${canonicalJson(p.envelope)}\n<!-- vydykhai:executable-memory-brief:end -->`;
      if (p.atomicRender !== render) return blocked("RENDER_BINDING_MISMATCH");
      for (const item of p.envelope.payload.items) {
        for (const part of item.clauses || item.rows) {
          if (itemIds.has(part.id)) return blocked("DUPLICATE_CONTENT_ID", part.id);
          itemIds.add(part.id);
          for (const ref of part.sourceRefs) {
            if (!assertions.has(ref)) return blocked("UNKNOWN_CONTENT_SOURCE", ref);
            delivered.add(ref);
          }
        }
      }
    } else if (p.atomicRender !== "") return blocked("RENDER_BINDING_MISMATCH");
    for (const id of required) if (!delivered.has(id)) return blocked("BRIEF_ASSERTION_MISSING", id);
  }
  return { status: "READY", code: "OK", requiredAssertionIds: [...required].sort(),
    coverageBasis: "declared-source-snapshots", semanticTruth: "NOT_VERIFIED" };
}
