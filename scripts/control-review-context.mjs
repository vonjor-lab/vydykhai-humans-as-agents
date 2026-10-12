import {controlCheckIds} from "./control-catalog.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const need = (value, code) => {if (!value) throw Error(code);};
const pointerFields = ["id", "status", "sha256"];
const select = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));

// This is a model VIEW. Admission, history and source verification use the original offer.
export function reviewPromptView(offer, checkIds) {
  if (checkIds === undefined) return structuredClone(offer);
  need(Array.isArray(checkIds) && checkIds.length > 0 && new Set(checkIds).size === checkIds.length &&
    checkIds.every(id => controlCheckIds.includes(id)), "MODEL_REVIEW_CONTEXT_IDS_INVALID");
  const original = structuredClone(offer);
  const findings = original.input?.previousFindings, evidence = original.input?.sourceEvidence;
  if (evidence === undefined) return original;
  need(Array.isArray(findings) && Array.isArray(evidence?.rows), "MODEL_REVIEW_CONTEXT_INPUT_INVALID");
  need(!Object.hasOwn(original.input, "globalDependencies") && !Object.hasOwn(original, "promptContext"),
    "MODEL_REVIEW_CONTEXT_RESERVED_FIELD");
  const assigned = new Set(checkIds);
  original.input.previousFindings = findings.filter(finding => assigned.has(finding.checkId));
  original.input.globalDependencies = findings.filter(finding => !assigned.has(finding.checkId)).map(finding => {
    if (finding.blocksResume || finding.lastResult === "FAILED") return finding;
    const {criterion, ...dependency} = finding;
    return dependency;
  });
  original.input.sourceEvidence = {
    ...(evidence.digest === undefined ? {} : {originalSnapshotDigest: evidence.digest}),
    ...(evidence.bytes === undefined ? {} : {originalSnapshotBytes: evidence.bytes}),
    ...(evidence.scope === undefined ? {} : {scope: evidence.scope}),
    pointers: evidence.rows.map(row => select(row, pointerFields)),
    acquisition: "ORIGINAL_SOURCE_READBACK_REQUIRED"
  };
  original.promptContext = {schema: "control.review-prompt-context.v1", assignedIds: [...checkIds],
    originalOfferSha256: sha256(canonicalJson(offer)),
    originalSourceMetadata: "FULL_INDEX_AVAILABLE_BY_LIST_SOURCES",
    scopeCompleteness: "NOT_ESTABLISHED_BY_THIS_VIEW",
    unassignedFindings: "RETAINED_BY_HOST_NOT_ASSIGNED_FOR_JUDGMENT"};
  return original;
}
