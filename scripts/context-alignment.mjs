// Bind a necessity review to the existing brief, not to a second architecture registry.
import { canonicalJson, sha256 } from "./memory-brief.mjs";

const keys = (v, names) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).sort().join("\0") === [...names].sort().join("\0");
const text = v => typeof v === "string" && v.trim().length > 0;
const need = (v, code) => { if (!v) throw new Error(code); };
const unique = v => Array.isArray(v) && new Set(v).size === v.length;

export function alignmentBasis(pkg, navigation) {
  const a = pkg.alignment;
  need(keys(a, ["goalRef", "invariantRefs", "acceptanceRef", "decisions", "review"]), "ALIGNMENT_REQUIRED");
  need(unique(a.invariantRefs) && a.invariantRefs.length > 0 && Array.isArray(a.decisions), "ALIGNMENT_INVALID");
  const refs = new Map(navigation.references.map(r => [r.id, r]));
  const selected = new Map();
  const use = id => {
    const r = refs.get(id);
    need(text(id) && r?.appliesTo === "task", "ALIGNMENT_SOURCE_MISSING");
    need(![...pkg.task.candidateFiles, ...pkg.module.implementationFiles].includes(r.path), "ALIGNMENT_BASELINE_MUTABLE");
    selected.set(id, r);
  };
  [a.goalRef, ...a.invariantRefs, a.acceptanceRef].forEach(use);
  const modules = pkg.moduleAccess.modules;
  need(a.decisions.length === modules.length && unique(a.decisions.map(d => d?.moduleId)), "ALIGNMENT_MODULE_COVERAGE");
  let reviewRequired = false;
  for (const d of a.decisions) {
    need(keys(d, ["moduleId", "boundaryChange", "gapRef", "existingRef", "rationale"]) &&
      typeof d.boundaryChange === "boolean" && text(d.rationale), "ALIGNMENT_DECISION_INVALID");
    const m = modules.find(m => m.id === d.moduleId);
    need(m, "ALIGNMENT_MODULE_COVERAGE");
    use(d.existingRef);
    if (m.intent === "consume") need(!d.boundaryChange && d.gapRef === null, "ALIGNMENT_CONSUMER_REWRITE");
    else use(d.gapRef);
    if (m.intent === "create") need(d.boundaryChange, "ALIGNMENT_NEW_BOUNDARY_UNREVIEWED");
    reviewRequired ||= d.boundaryChange;
  }
  const { review, ...meaning } = a;
  const basis = { schema: "context.alignment-basis.v1", owner: pkg.owner, task: pkg.task,
    module: pkg.module, moduleAccess: pkg.moduleAccess, outcome: navigation.outcome, alignment: meaning,
    sources: [...selected.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
  return { basis, basisSha256: sha256(canonicalJson(basis)), reviewRequired };
}

export async function prepareAlignment(pkg, navigation, read, parse) {
  const result = alignmentBasis(pkg, navigation), ref = pkg.alignment.review;
  if (result.reviewRequired && ref === null) {
    const error = new Error("ALIGNMENT_REVIEW_REQUIRED");
    error.reviewBasis = result; throw error;
  }
  if (ref !== null) {
    need(keys(ref, ["path", "sha256"]) && text(ref.path) && /^[a-f0-9]{64}$/.test(ref.sha256), "ALIGNMENT_REVIEW_INVALID");
    const data = await read(ref.path);
    need(sha256(data) === ref.sha256, "ALIGNMENT_REVIEW_CHANGED");
    const review = parse(data);
    need(keys(review, ["schema", "basisSha256", "reviewer", "decision", "reason"]) &&
      review.schema === "context.alignment-review.v1" && review.basisSha256 === result.basisSha256 &&
      text(review.reviewer) && text(review.reason), "ALIGNMENT_REVIEW_INVALID");
    need(![pkg.owner, pkg.task.worker, pkg.navigation.preparedBy].includes(review.reviewer), "ALIGNMENT_REVIEW_NOT_INDEPENDENT");
    need(review.decision === "fit", "ALIGNMENT_REVISION_REQUIRED");
  }
  return { schema: "context.alignment.v1", ...result, review: ref,
    coverage: ref ? "REVIEW_BOUND" : "UNCHANGED_BOUNDARIES_DECLARED", semanticTruth: "REVIEWER_OWNED" };
}
