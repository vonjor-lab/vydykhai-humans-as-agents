// A bounded continuation never upgrades the whole project's readiness.
// Evidence authenticity and dependency completeness require independent host review.
import {assessCapabilityReadiness} from "./adoption-plan.mjs";
import {sha256, canonicalJson} from "./memory-brief.mjs";

const filled = v => typeof v === "string" && v.trim().length > 0;
export const incrementEvidenceKey = input => sha256(canonicalJson({scope: input.scope,
  inventory: input.inventory, readiness: input.readiness, findings: input.findings,
  task: input.increment?.task, route: input.increment?.readiness,
  dependencies: input.increment?.dependencyReview?.rows}));

export function assessIncrementReadiness(input) {
  const fail = reason => ({ready: false, reason, wholeProjectReady: false});
  const i = input?.increment, r = i?.dependencyReview;
  const areas = input?.readiness?.architecture?.inventory?.areas;
  if (!filled(i?.task) || !i.readiness || i.readiness.scope === input.scope ||
      i.readiness.architecture !== undefined || !Array.isArray(areas) || !areas.length ||
      !Array.isArray(r?.rows) || r.rows.length !== areas.length ||
      new Set(r.rows.map(row => row?.area)).size !== areas.length ||
      Array.from(r.rows).some(row => !areas.includes(row?.area) || !filled(row.evidence) ||
        !["DEPENDENCY", "INDEPENDENT"].includes(row.status)))
    return fail("Current whole-project inventory and complete dependency dispositions required");
  if (!filled(r.reviewer) || r.reviewer === input.owner ||
      input.findings.some(f => f.owner === r.reviewer) || !filled(r.evidence) ||
      r.key !== incrementEvidenceKey(input))
    return fail("Independent dependency review must match the current project and increment");
  const dependencies = r.rows.filter(row => row.status === "DEPENDENCY");
  if (!dependencies.length) return fail("At least one actual public dependency is required");
  for (const row of dependencies) {
    const current = input.readiness.architecture.coverage.find(c => c.area === row.area);
    if (!current || current.access !== "AVAILABLE" || current.modularity !== "ENCAPSULATED" ||
        current.documentation !== "CURRENT") return fail("Required public boundary is not ready");
  }
  let route;
  try {
    route = assessCapabilityReadiness(i.readiness, {requireArchitecture: false,
      requireTeamSync: input.readiness.teamSync !== undefined});
  } catch { return fail("Increment route proof invalid"); }
  if (route.dependentDispatch !== "READY") return fail("Increment must pass the existing route acceptance");
  return {ready: true, task: i.task, key: incrementEvidenceKey(input), wholeProjectReady: false};
}
