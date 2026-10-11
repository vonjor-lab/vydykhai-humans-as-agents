// Experimental 2.0 read-only assessment. Not installed, a scheduler or an action gate.
import { assessCapabilityReadiness } from "./adoption-plan.mjs";
import { sha256, canonicalJson } from "./memory-brief.mjs";
import { assessDebtProgress } from "./debt-progress.mjs";
import { checkFindingHistory, checkFindingLeases } from "./finding-history.mjs";
import { assessIncrementReadiness } from "./increment-readiness.mjs";

// Views of existing State/map/graph/tracker evidence, not seven new ledgers.
export const recoveryAreas = ["goals-and-plan", "successes-and-modules", "memory-and-ideas",
  "code-map-and-docs", "repository-custody", "shared-work", "control-and-security"];
const filled = v => typeof v === "string" && v.trim().length > 0;
const list = v => Array.isArray(v);
const unique = rows => list(rows) && Array.from(rows).every(r => filled(r?.id)) &&
  new Set(rows.map(r => r.id)).size === rows.length;
const instant = v => filled(v) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const validFinding = f => recoveryAreas.includes(f.area) && filled(f.criterion) && filled(f.owner) &&
  filled(f.evidence) && instant(f.firstSeen) && instant(f.reviewAt) &&
  Number.isSafeInteger(f.attempts) && f.attempts >= 0 && typeof f.blocksResume === "boolean" &&
  filled(f.plan) && filled(f.work) && ["OPEN", "CLOSED"].includes(f.status) &&
  (f.lastResult === undefined || (f.attempts > 0 && ["FAILED", "PASSED"].includes(f.lastResult)));

export function recoveryEvidenceKey(input) {
  return sha256(canonicalJson({scope: input.scope, owner: input.owner, boundary: input.boundary,
    previousFindings: input.previousFindings, preservation: input.preservation,
    inventory: input.inventory, findings: input.findings, readiness: input.readiness,
    debtProgress: input.debtProgress ?? null, repairLeases: input.repairLeases ?? [], increment: input.increment ?? null}));
}

export function continuationEvidenceKey(input) {
  const next = input.continuation;
  return sha256(canonicalJson({recoveryKey: recoveryEvidenceKey(input),
    task: next?.task, owner: next?.owner, authority: next?.authority}));
}

export function assessProjectRecovery(input, {now = Date.now()} = {}) {
  const result = (action, reasons = [], extra = {}) => ({action, reasons,
    mutationAuthorized: false, semanticAcceptance: "NOT_ESTABLISHED",
    independentWork: "PRESERVE_EXISTING_AUTHORITY_AND_PAUSES", owner: input?.owner || null, ...extra});
  if (!input || !filled(input.scope) || !filled(input.owner) || !Number.isFinite(now))
    return result("INVALID_INPUT", ["Scope, existing owner and current time required"]);
  if (input.paused === true) return result("PRESERVE_PAUSE");
  if (input.externalUnknown === true) return result("RECONCILE_EXTERNAL_OUTCOME");
  let readiness;
  try { readiness = assessCapabilityReadiness(input.readiness); }
  catch { return result("RECONCILE_READINESS", ["Existing adoption snapshot invalid"]); }
  if (input.readiness.scope !== input.scope)
    return result("RECONCILE_READINESS", ["Recovery and adoption scopes differ"]);

  const p = input.preservation;
  if (!p || !filled(p.baseline) || !filled(p.backup) || !filled(p.restore) ||
      !unique(p.successes) || !filled(p.successInventory) ||
      p.successes.some(s => !filled(s.artifact) || !filled(s.conditions) || !filled(s.evidence) ||
        typeof s.requiredForResume !== "boolean" ||
        !["REPRODUCED", "ASSISTED", "UNVERIFIED"].includes(s.status)))
    return result("PRESERVE_BASELINE", ["Preserve work, data, historical success conditions and recovery route"]);

  const inv = input.inventory;
  if (!inv || inv.scope !== input.scope || !filled(inv.revision) || !filled(inv.evidence) ||
      !filled(inv.reviewedBy) || inv.reviewedBy === input.owner || !list(inv.rows) ||
      inv.rows.length !== recoveryAreas.length ||
      new Set(inv.rows.map(r => r?.area)).size !== recoveryAreas.length ||
      Array.from(inv.rows).some(r => !recoveryAreas.includes(r?.area) ||
        !["VERIFIED", "GAP", "UNKNOWN"].includes(r.status) || !filled(r.evidence)))
    return result("COMPLETE_DIAGNOSIS", ["All recovery areas need current independent-source dispositions"]);

  if (!unique(input.findings) || !unique(input.previousFindings) ||
      !input.findings.every(validFinding) || !input.previousFindings.every(validFinding))
    return result("RECONCILE_FINDINGS", ["Explicit current and previous findings required"]);
  const historyError = checkFindingHistory(input.previousFindings, input.findings);
  if (historyError) return result("RECONCILE_FINDINGS", [historyError]);
  for (const f of input.findings) {
    const currentClosure = f.checkedRevision === inv.revision || (f.revalidations ?? []).some(r =>
      r.revision === inv.revision && filled(r.evidence) && filled(r.reviewedBy) && r.reviewedBy !== f.owner && r.reviewedBy !== input.owner);
    if (f.status === "CLOSED" && (!filled(f.proof) || !filled(f.reviewedBy) ||
          f.reviewedBy === f.owner || !currentClosure))
      return result("RECONCILE_FINDINGS", ["Repair needs owned plan, deadline, original evidence and independent current closure"]);
  }
  for (const row of inv.rows) {
    const open = input.findings.filter(f => f.area === row.area && f.status === "OPEN");
    if (row.status !== "VERIFIED" && !open.length)
      return result("ASSIGN_EXISTING_MAINTENANCE", [`${row.area}: no owned open finding`]);
    if (row.status === "VERIFIED" && open.length)
      return result("RECONCILE_FINDINGS", [`${row.area}: verified claim contradicts open findings`]);
  }

  const open = input.findings.filter(f => f.status === "OPEN");
  const debt = open.map(({id, owner, reviewAt, blocksResume}) => ({id, owner, reviewAt, blocksResume}));
  if (open.length) {
    const leaseError = checkFindingLeases(input.findings, input.repairLeases);
    if (leaseError) return result("RECONCILE_REPAIR_OWNER", [leaseError], {debt});
  }
  for (const [ready, area] of [[readiness.preparation.codeMapped, "code-map-and-docs"],
    [readiness.preparation.modular, "successes-and-modules"]]) {
    if (!ready && !open.some(f => f.area === area))
      return result("ASSIGN_EXISTING_MAINTENANCE", [`${area}: whole-project obligation remains due`], {debt});
  }
  if (open.some(f => f.attempts >= 1 && f.lastResult === "FAILED"))
    return result("REVIEW_FAILED_REPAIR", ["Preserve attempts; changed evidence or explicit new decision required"], {debt});
  const boundary = input.boundary;
  if (!boundary || !filled(boundary.checkpoint) || !instant(boundary.reviewAt) ||
      !["PENDING", "REACHED"].includes(boundary.status))
    return result("SCHEDULE_SAFE_BOUNDARY", ["Named checkpoint and finite review time required"], {debt});
  if (boundary.status !== "REACHED")
    return result(Date.parse(boundary.reviewAt) <= now ? "REPLAN_OVERDUE_BOUNDARY" : "WAIT_SAFE_BOUNDARY", [], {debt});
  if (!filled(boundary.evidence)) return result("PROVE_SAFE_BOUNDARY", [], {debt});
  if (open.some(f => f.blocksResume))
    return result("REPAIR_BEFORE_DEPENDENT_RESUME", [], {debt});
  if (open.some(f => Date.parse(f.reviewAt) <= now))
    return result("REVIEW_DUE_DEBT", [], {debt});
  let increment;
  if (readiness.dependentDispatch !== "READY") {
    if (!input.increment)
      return result("FINISH_EXISTING_ADOPTION", readiness.gaps, {debt, readinessAction: readiness.action});
    const areas = {"code-map": "code-map-and-docs", "module-map": "code-map-and-docs",
      "module-contracts": "successes-and-modules", "graph-routes": "memory-and-ideas", "verification": "control-and-security"};
    if (readiness.gaps.some(id => !open.some(f => f.area === areas[id])))
      return result("ASSIGN_EXISTING_MAINTENANCE", ["Whole-project readiness gaps remain owned during bounded continuation"], {debt});
    increment = assessIncrementReadiness(input);
    if (!increment.ready) return result("PROVE_INDEPENDENT_INCREMENT", [increment.reason], {debt});
  }
  if (p.successes.some(s => s.requiredForResume && s.status !== "REPRODUCED"))
    return result("PROVE_RETAINED_SUCCESSES", ["Assisted or unverified examples are not autonomous public-use proof"], {debt});
  if (p.successes.some(s => s.status !== "REPRODUCED" &&
      !open.some(f => list(f.successIds) && f.successIds.includes(s.id))))
    return result("ASSIGN_EXISTING_MAINTENANCE", ["Unrecovered historical success needs an owned follow-up"], {debt});

  if (input.debtProgress !== undefined) {
    if (input.debtProgress?.before?.scope !== input.scope || input.debtProgress?.after?.scope !== input.scope)
      return result("REVIEW_DEBT_TREND", ["Debt window belongs to a different or missing project scope"], {debt});
    const trend = assessDebtProgress(input.debtProgress);
    if (["RECONCILE_EVIDENCE", "PRIORITY_REVIEW", "REVIEW_PRODUCT_BALANCE"].includes(trend.action))
      return result("REVIEW_DEBT_TREND", [trend.reason], {debt, trend});
    // These are two views of the same obligations, not independent truth stores.
    const items = input.debtProgress.after.items;
    if (items.some(item => !input.findings.some(f => f.id === item.id && f.criterion === item.criterion &&
        f.owner === item.owner && f.attempts === item.attempts && Date.parse(f.reviewAt) === item.reviewAt &&
        (f.status === "CLOSED") === (item.status === "CLOSED"))) ||
        open.some(f => !items.some(item => item.id === f.id)))
      return result("RECONCILE_FINDINGS", ["Debt trend and recovery dispositions disagree"], {debt, trend});
  }

  const key = recoveryEvidenceKey(input), r = input.review;
  if (!r || r.key !== key || !filled(r.evidence) || !filled(r.reviewer) ||
      r.reviewer === input.owner || input.findings.some(f => f.owner === r.reviewer))
    return result("INDEPENDENT_RECOVERY_REVIEW", [], {debt, evidenceKey: key});
  const next = input.continuation;
  if (increment && next?.task !== increment.task)
    return result("PREPARE_PRODUCTIVE_RESUME", ["Only the independently checked increment may resume"], {debt, evidenceKey: key});
  if (!next || !filled(next.task) || !filled(next.owner) || !filled(next.authority) ||
      next.recoveryKey !== key || next.bindingKey !== continuationEvidenceKey(input) || !filled(next.workerReadback))
    return result("PREPARE_PRODUCTIVE_RESUME", [], {debt, evidenceKey: key});
  if (!filled(next.observedProgress))
    return result("VERIFY_ACTUAL_CONTINUATION", [], {debt, evidenceKey: key});
  if (!filled(input.humanReport) || input.reportKey !== next.bindingKey)
    return result("DELIVER_RECOVERY_REPORT", [], {debt, evidenceKey: key});
  return result(open.length ? "RECORDED_RESUME_WITH_DEBT" : "RECORDED_RECOVERY_COMPLETE", [],
    {debt, evidenceKey: key, wholeProjectReady: readiness.dependentDispatch === "READY",
      note: "Declared receipt coverage only; verify meaning, authority and operations in the host"});
}
