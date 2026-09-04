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
