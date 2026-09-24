import { createHash } from "node:crypto";

const stable = value => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const hash = value => createHash("sha256").update(stable(value)).digest("hex");
const version = v => typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v);
const compare = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

// Compares observed kits only; the project owner still accepts the target and
// the worker must read back its changed instructions at a safe boundary.
export function assessWorkerAdoption(target, worker) {
  const valid = kit => kit && version(kit.version) && typeof kit.source === "string" && kit.source &&
    /^[a-f0-9]{64}$/.test(kit.bundleSha256 || "");
  if (!valid(target) || !valid(worker)) return { status: "LIMITED", reason: "KIT_IDENTITY_UNAVAILABLE" };
  if (target.source !== worker.source) return { status: "REVIEW_REQUIRED", reason: "DIFFERENT_SOURCE" };
  if (compare(worker.version, target.version) > 0) return { status: "REVIEW_REQUIRED", reason: "WORKER_NEWER_THAN_TARGET" };
  if (worker.version !== target.version || worker.bundleSha256 !== target.bundleSha256) {
    return { status: "UPDATE_REQUIRED", reason: "TARGET_KIT_DIFFERS" };
  }
  return { status: "KIT_MATCH", reason: "WORKER_READBACK_REQUIRED" };
}

export function kitIdentity(manifest, managedFiles, agentsBlockHash) {
  return { version: manifest.version, source: manifest.canonicalSource || manifest.upstream || "unknown",
    bundleSha256: hash({ managedFiles, agentsBlockHash }) };
}

// Applicability only. A matching identity is never semantic/host acceptance.
export function adoptionEvidenceScope(requirement, current, recorded = {}) {
  const bindings = {};
  for (const key of requirement.reuseBy) {
    if (typeof current[key] !== "string" || !current[key]) return { status: "MISSING_SCOPE", missing: key };
    bindings[key] = current[key];
  }
  const scopeSha256 = hash({ requirement: requirement.id, bindings });
  return { status: recorded.scopeSha256 === scopeSha256 ? "REVIEW_EXISTING_EVIDENCE" : "REVIEW_CHANGED_SCOPE",
    scopeSha256, acceptance: "NOT_ESTABLISHED", progressOwner: "Project State" };
}

// Read-only transition advice over the existing Project State evidence. The
// caller supplies source-backed checks; this function never certifies their
// truth, creates tasks, or treats a file name as semantic coverage.
export function assessCapabilityReadiness(input) {
  const required = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
  const statuses = new Set(["VERIFIED", "MISSING", "STALE", "CONTRADICTORY", "INACCESSIBLE", "CANDIDATE"]);
  const filled = value => typeof value === "string" && value.trim().length > 0;
  if (!input || !["launch", "reconnect", "update", "continue"].includes(input.trigger) ||
      !filled(input.scope) || !input.bindings || typeof input.bindings !== "object" || Array.isArray(input.bindings) ||
      (input.sourceRevision !== undefined && !filled(input.sourceRevision)) ||
      (input.boundaryChange !== undefined && typeof input.boundaryChange !== "boolean") ||
      (input.boundaryApproved !== undefined && typeof input.boundaryApproved !== "boolean") ||
      required.some(id => !filled(input.bindings[id])) || !Array.isArray(input.checks) ||
      input.checks.some(c => !c || !required.includes(c.id) || !statuses.has(c.status) ||
        !filled(c.binding) || c.binding !== input.bindings[c.id] ||
        (c.status === "VERIFIED" && (!filled(c.source) || !filled(c.checkedBinding)))) ||
      new Set(input.checks.map(c => c.id)).size !== input.checks.length ||
      (input.modules && (!Array.isArray(input.modules) || input.modules.some(m => !filled(m.id) ||
        typeof m.requiredForConsumption !== "boolean" ||
        !["EXPERIMENTAL", "CANDIDATE", "ACCEPTED", "DEPRECATED"].includes(m.behavior) ||
        !["UNPROVEN", "PROVEN"].includes(m.packaging)) ||
        new Set(input.modules.map(m => m.id)).size !== input.modules.length))) {
    throw new Error("Invalid capability readiness input");
  }
  const relevantKey = hash({ scope: input.scope, bindings: Object.fromEntries(required.map(id => [id, input.bindings[id]])) });
  const checks = new Map(input.checks.map(c => [c.id, c]));
  const gaps = required.filter(id => checks.get(id)?.status !== "VERIFIED" || checks.get(id)?.checkedBinding !== input.bindings[id]);
  const inaccessible = gaps.filter(id => checks.get(id)?.status === "INACCESSIBLE");
  const actionable = gaps.filter(id => !inaccessible.includes(id));
  // One unresolved adoption defect per shared scope. Evidence revisions and
  // partial repairs cannot reset its retry history; a reviewed new condition
  // may explicitly clear the recorded attempt in Project State.
  const defectKey = hash({ scope: input.scope, defect: "module-context-readiness" });
  const proofSteps = ["moduleFound", "contextDelivered", "retainedAndNewAcceptance", "documentationUpdated", "semanticIntegration", "nextRetrieval"];
  const proof = input.accepted?.routeProof;
  const proofComplete = proofSteps.every(step => filled(proof?.[step]));
  const accepted = input.accepted?.relevantKey === relevantKey && input.accepted.status === "ACCEPTED" &&
    filled(input.accepted.acceptedBy) && proofComplete;
  const packagingGaps = (input.modules || []).filter(module => module.requiredForConsumption &&
    (module.behavior !== "ACCEPTED" || module.packaging !== "PROVEN" || !filled(module.connectionEvidence))).map(module => module.id);
  const candidateOwner = input.owner;
  const owner = candidateOwner?.scope === input.scope &&
    filled(candidateOwner.id) && ["PREPARED", "STARTED", "WORKING", "WAITING", "RETURNED"].includes(candidateOwner.status) &&
    (candidateOwner.status !== "WAITING" || filled(candidateOwner.checkpoint)) ? candidateOwner : null;
  const ownerNeedsReconciliation = candidateOwner && !owner;
  let action;
  if (input.boundaryChange && !input.boundaryApproved) action = "PROPOSE_MIGRATION";
  else if (accepted && gaps.length === 0 && !input.boundaryChange) action = "REUSE_ACCEPTED";
  else if (owner) action = "REUSE_OWNER";
  else if (ownerNeedsReconciliation) action = "RECONCILE_OWNER";
  else if ((actionable.length || input.boundaryChange) && input.repairAttemptedFor === defectKey) action = "WAIT_CHECKPOINT";
  else if (actionable.length || input.boundaryChange) action = "ASSIGN_MAINTENANCE";
  else if (inaccessible.length) action = "LIMITED_ACCESS";
  else action = "REVIEW_ROUTE_PROOF";
  return { status: action === "REUSE_ACCEPTED" ? packagingGaps.length ? "ACCEPTED_WITH_LIMITS" : "ACCEPTED" : "PENDING", action,
    relevantKey, defectKey, gaps, inaccessible, packagingGaps, owner: owner?.id || null,
    dependentDispatch: action === "REUSE_ACCEPTED" && packagingGaps.length === 0 ? "READY" : "WAIT_FOR_APPLICABLE_PROOF",
    independentWork: "CONTINUE_WITHIN_EXISTING_AUTHORITY",
    note: "Project State owns progress; this classifier does not authenticate sources or certify semantic proof." };
}

export function planAdoption({ manifest, managedFiles, agentsBlockHash, sourceRevision, previousLock, changelog }) {
  if (!version(manifest.version)) throw new Error("Adoption target version must be semver");
  const target = kitIdentity(manifest, managedFiles, agentsBlockHash);
  const id = hash(target), previous = previousLock?.adoptionPlan;
  const sameTarget = previous?.schema === "vydykhai.adoption-plan.v1" && previous.id === id && stable(previous.target) === stable(target);
  const reviewFromVersion = previous && Object.hasOwn(previous, "reviewFromVersion") ? previous.reviewFromVersion
    : previousLock?.installedVersion === manifest.version ? null : previousLock?.installedVersion ?? null;
  if (reviewFromVersion !== null && !version(reviewFromVersion)) throw new Error("Invalid previous installed version");
  const releases = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
    .filter(m => compare(m[1], manifest.version) <= 0 && (reviewFromVersion ? compare(m[1], reviewFromVersion) > 0 : true))
    .map(m => ({ version: m[1], path: "docs/COLLABORATION_FRAMEWORK_CHANGELOG.md",
      heading: m[0].split("\n")[0], contentSha256: hash(m[2].trim()) })).sort((a, b) => compare(a.version, b.version));
  const requirements = manifest.adoptionRequirements ?? [{ id: "legacy-release-review", since: manifest.version,
    action: "Review release deltas and existing project-launch/update activation obligations before claiming active use.",
    reuseBy: ["targetBundle", "activeContext"], workflow: "docs/workflows/framework-orchestrator.md" }];
  if (!Array.isArray(requirements) || requirements.some(r => !r || typeof r.id !== "string" || !version(r.since) ||
      typeof r.action !== "string" || typeof r.workflow !== "string" || !Array.isArray(r.reuseBy) || !r.reuseBy.length ||
      r.reuseBy.some(k => typeof k !== "string" || !k))) throw new Error("Invalid adoption requirements");
  if (new Set(requirements.map(r => r.id)).size !== requirements.length) throw new Error("Duplicate adoption requirement");
  return { schema: "vydykhai.adoption-plan.v1", id, target, sourceRevision,
    reviewFromVersion, supersedesPlanId: sameTarget ? previous.supersedesPlanId : previous?.id ?? null, releases,
    releaseCoverage: reviewFromVersion === null ? "UNKNOWN_BASELINE_REVIEW_ALL_DECLARED" : releases.length ? "DECLARED_CHANGELOG_RANGE" : "REVIEW_RELEASE_GAP_OR_SAME_VERSION",
    requirements: requirements.filter(r => compare(r.since, manifest.version) <= 0),
    activeUse: "UNPROVEN_BY_INSTALLER", progressOwner: "Project State",
    next: `Active orchestrator: consume this plan at the named safe checkpoint under ${manifest.adoptionRequirements ? "docs/workflows/framework-activation.md" : "docs/workflows/framework-orchestrator.md"}; reuse accepted scoped evidence and existing repair history, then resume productive work or present one exact human checkpoint.` };
}
