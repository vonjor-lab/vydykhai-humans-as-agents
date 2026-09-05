import { createHash } from "node:crypto";

const stable = value => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const hash = value => createHash("sha256").update(stable(value)).digest("hex");
const version = v => typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v);
const compare = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

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

export function planAdoption({ manifest, managedFiles, agentsBlockHash, sourceRevision, previousLock, changelog }) {
  if (!version(manifest.version)) throw new Error("Adoption target version must be semver");
  const target = { version: manifest.version, source: manifest.canonicalSource || manifest.upstream || "unknown",
    bundleSha256: hash({ managedFiles, agentsBlockHash }) };
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
