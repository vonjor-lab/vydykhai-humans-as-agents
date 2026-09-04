import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  APPLICATION_RECEIPT_SCHEMA,
  MemoryBriefContractError,
  canonicalJson,
  compileExecutableBrief,
  composeBrief,
  sha256,
  validateApplicationReceipt,
} from "../scripts/memory-brief.mjs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts/vydykhai.mjs");

const hash = (value) => sha256(value);
const authorityReceipt = {
  activeGraphId: "GRAPH-7",
  activeGraphBodySha256: hash("graph-body"),
  retrievalSnapshotId: "SNAPSHOT-11",
  retrievalSnapshotSha256: hash("retrieval-snapshot"),
  sourceRefs: ["memory://accepted/current"],
};
const ordinaryPromptSha256 = hash("ordinary task prompt");
const atomicItems = [
  {
    id: "ITEM-ORDER",
    kind: "ordered_action",
    atomic: true,
    allowFactoring: false,
    position: "before implementation",
    sourceRefs: ["memory://rule/order"],
    clauses: [
      { id: "CLAUSE-PREFLIGHT", text: "Read the accepted baseline first.", sourceRefs: ["memory://rule/order"] },
      { id: "CLAUSE-CHECKPOINT", text: "Stop at the named human checkpoint.", sourceRefs: ["memory://rule/checkpoint"] },
    ],
  },
  {
    id: "ITEM-MATRIX",
    kind: "repeated_rows",
    atomic: true,
    allowFactoring: false,
    rowCount: 4,
    sourceRefs: ["memory://decision/path-matrix"],
    rows: [
      { id: "ROW-A", path: "new", through: "entry", terminal: "created", sourceRefs: ["memory://decision/path-matrix"] },
      { id: "ROW-B", path: "resume", through: "entry", terminal: "continued", sourceRefs: ["memory://decision/path-matrix"] },
      { id: "ROW-C", path: "reopen", through: "history", terminal: "restored", sourceRefs: ["memory://decision/path-matrix"] },
      { id: "ROW-D", path: "return", through: "workspace", terminal: "unchanged", sourceRefs: ["memory://decision/path-matrix"] },
    ],
  },
];

function compile() {
  return compileExecutableBrief({ authorityReceipt, ordinaryPromptSha256, atomicItems });
}

function receiptFor(envelope, overrides = {}) {
  const manifest = envelope.payload.manifest;
  return {
    schema: APPLICATION_RECEIPT_SCHEMA,
    authorityReceipt: structuredClone(envelope.header.authorityReceipt),
    ordinaryPromptSha256: envelope.header.ordinaryPromptSha256,
    briefDigest: envelope.briefDigest,
    requiredItemIds: [...manifest.requiredItemIds],
    requiredClauseIds: [...manifest.requiredClauseIds],
    requiredRowIds: [...manifest.requiredRowIds],
    appliedItemIds: [...manifest.requiredItemIds],
    appliedClauseIds: [...manifest.requiredClauseIds],
    appliedRowIds: [...manifest.requiredRowIds],
    status: "APPLIED",
    issues: [],
    ...overrides,
  };
}

test("compiler derives the complete manifest and preserves four independent rows", () => {
  const before = structuredClone({ authorityReceipt, ordinaryPromptSha256, atomicItems });
  const { envelope, atomicRender } = compile();
  assert.deepEqual(envelope.payload.manifest, {
    requiredItemIds: ["ITEM-ORDER", "ITEM-MATRIX"],
    requiredClauseIds: ["CLAUSE-PREFLIGHT", "CLAUSE-CHECKPOINT"],
    requiredRowIds: ["ROW-A", "ROW-B", "ROW-C", "ROW-D"],
  });
  assert.equal(envelope.payload.items[1].rows.length, 4);
  for (const id of ["ROW-A", "ROW-B", "ROW-C", "ROW-D"]) assert.match(atomicRender, new RegExp(id));
  assert.deepEqual({ authorityReceipt, ordinaryPromptSha256, atomicItems }, before);
});

test("canonical compilation and rendering are deterministic", () => {
  const first = compile();
  const second = compile();
  assert.deepEqual(second, first);
  assert.equal(first.envelope.briefDigest, hash(canonicalJson({
    header: first.envelope.header,
    payload: first.envelope.payload,
  })));
  assert.match(first.atomicRender, /^<!-- vydykhai:executable-memory-brief v1 -->\n/);
  assert.match(first.atomicRender, /\n<!-- vydykhai:executable-memory-brief:end -->$/);
});

test("a complete application receipt closes every atomic id", () => {
  const { envelope } = compile();
  assert.deepEqual(validateApplicationReceipt({ envelope, receipt: receiptFor(envelope) }), {
    status: "APPLIED",
    code: "OK",
    issues: [],
  });
});

test("a shortened manifest cannot validate even when the receipt repeats it", () => {
  const { envelope } = compile();
  const shortened = structuredClone(envelope);
  shortened.payload.manifest.requiredRowIds.pop();
  shortened.briefDigest = hash(canonicalJson({ header: shortened.header, payload: shortened.payload }));
  const receipt = receiptFor(shortened, {
    requiredRowIds: [...shortened.payload.manifest.requiredRowIds],
    appliedRowIds: [...shortened.payload.manifest.requiredRowIds],
  });
  assert.equal(validateApplicationReceipt({ envelope: shortened, receipt }).code, "MANIFEST_MISMATCH");
});

test("duplicate and cross-namespace ids fail during compilation", () => {
  for (const [code, items] of [
    ["DUPLICATE_ID", [atomicItems[0], { ...atomicItems[0] }]],
    ["ID_COLLISION", [{ ...atomicItems[0], clauses: [{ ...atomicItems[0].clauses[0], id: "ITEM-ORDER" }] }]],
  ]) {
    assert.throws(
      () => compileExecutableBrief({ authorityReceipt, ordinaryPromptSha256, atomicItems: items }),
      (error) => error instanceof MemoryBriefContractError && error.code === code,
    );
  }
  assert.throws(
    () => compileExecutableBrief({
      authorityReceipt: {
        ...authorityReceipt,
        sourceRefs: [authorityReceipt.sourceRefs[0], authorityReceipt.sourceRefs[0]],
      },
      ordinaryPromptSha256,
      atomicItems,
    }),
    (error) => error instanceof MemoryBriefContractError && error.code === "SCHEMA_INVALID",
  );
});

test("digest, authority, prompt, unknown id, and order mismatches fail closed", () => {
  const { envelope } = compile();
  const cases = [
    ["BRIEF_DIGEST_MISMATCH", { ...envelope, briefDigest: hash("different") }, receiptFor(envelope)],
    ["AUTHORITY_MISMATCH", envelope, receiptFor(envelope, {
      authorityReceipt: { ...authorityReceipt, activeGraphId: "GRAPH-OTHER" },
    })],
    ["PROMPT_HASH_MISMATCH", envelope, receiptFor(envelope, { ordinaryPromptSha256: hash("other prompt") })],
    ["UNKNOWN_ID", envelope, receiptFor(envelope, { appliedRowIds: ["ROW-A", "ROW-UNKNOWN"] })],
    ["ORDER_MISMATCH", envelope, receiptFor(envelope, { appliedRowIds: ["ROW-B", "ROW-A", "ROW-C", "ROW-D"] })],
  ];
  for (const [code, candidateEnvelope, receipt] of cases) {
    assert.equal(validateApplicationReceipt({ envelope: candidateEnvelope, receipt }).code, code);
  }
});

test("APPLIED cannot omit ids and BLOCKED reports the exact missing complement", () => {
  const { envelope } = compile();
  const appliedMissing = receiptFor(envelope, { appliedRowIds: ["ROW-A", "ROW-B", "ROW-C"] });
  assert.equal(validateApplicationReceipt({ envelope, receipt: appliedMissing }).code, "INCONSISTENT_STATUS");

  const blocked = receiptFor(envelope, {
    appliedClauseIds: ["CLAUSE-PREFLIGHT"],
    appliedRowIds: ["ROW-A", "ROW-C"],
    status: "BLOCKED",
    issues: [
      { code: "MISSING_ID", collection: "clause", id: "CLAUSE-CHECKPOINT" },
      { code: "MISSING_ID", collection: "row", id: "ROW-B" },
      { code: "MISSING_ID", collection: "row", id: "ROW-D" },
    ],
  });
  assert.deepEqual(validateApplicationReceipt({ envelope, receipt: blocked }), {
    status: "BLOCKED",
    code: "MISSING_ID",
    issues: blocked.issues,
  });

  const unreported = structuredClone(blocked);
  unreported.issues.pop();
  assert.equal(validateApplicationReceipt({ envelope, receipt: unreported }).code, "UNREPORTED_MISSING_ID");
  const extra = structuredClone(blocked);
  extra.issues.push({ code: "MISSING_ID", collection: "row", id: "ROW-A" });
  assert.equal(validateApplicationReceipt({ envelope, receipt: extra }).code, "UNEXPECTED_ISSUE");
});

test("brief composition preserves exact atomic and advisory bytes", () => {
  const { atomicRender } = compile();
  assert.equal(composeBrief({ atomicRender, advisoryText: "" }), atomicRender);
  const advisoryText = "Обычный контекст\n\nKeep intentional whitespace. ";
  assert.equal(composeBrief({ atomicRender, advisoryText }), `${atomicRender}\n\n${advisoryText}`);
  assert.throws(() => composeBrief({ atomicRender, advisoryText: null }), TypeError);
});

test("CLI compiles and validates the same deterministic contract", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "vydykhai-memory-brief-"));
  try {
    const inputPath = path.join(temporary, "input.json");
    const envelopePath = path.join(temporary, "envelope.json");
    const receiptPath = path.join(temporary, "receipt.json");
    await writeFile(inputPath, JSON.stringify({ authorityReceipt, ordinaryPromptSha256, atomicItems }));
    const compiled = spawnSync(process.execPath, [cli, "memory-brief-compile", "--input", inputPath], { encoding: "utf8" });
    assert.equal(compiled.status, 0, compiled.stderr);
    const output = JSON.parse(compiled.stdout);
    await writeFile(envelopePath, JSON.stringify(output.envelope));
    await writeFile(receiptPath, JSON.stringify(receiptFor(output.envelope)));
    const validated = spawnSync(process.execPath, [cli, "memory-brief-validate", "--envelope", envelopePath, "--receipt", receiptPath], { encoding: "utf8" });
    assert.equal(validated.status, 0, validated.stderr);
    assert.equal(JSON.parse(validated.stdout).status, "APPLIED");

    await writeFile(receiptPath, JSON.stringify(receiptFor(output.envelope, { appliedRowIds: ["ROW-A"] })));
    const rejected = spawnSync(process.execPath, [cli, "memory-brief-validate", "--envelope", envelopePath, "--receipt", receiptPath], { encoding: "utf8" });
    assert.equal(rejected.status, 1);
    assert.equal(JSON.parse(rejected.stdout).status, "INVALID");
    assert.deepEqual(JSON.parse(await readFile(inputPath, "utf8")).atomicItems, atomicItems);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
