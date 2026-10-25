import {controlCatalog, checkControlCoverage} from "./control-catalog.mjs";
import {checkFindingHistory} from "./finding-history.mjs";

const filled = v => typeof v === "string" && !!v.trim();
const instant = v => filled(v) && Number.isFinite(Date.parse(v));
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const unique = rows => Array.isArray(rows) && Array.from(rows).every(r => filled(r?.id)) &&
  new Set(rows.map(r => r.id)).size === rows.length;
export const validAffectedTasks = tasks => tasks === undefined || Array.isArray(tasks) &&
  tasks.length > 0 && tasks.length <= 128 && Array.from(tasks).every(id =>
    typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id)) &&
  new Set(tasks).size === tasks.length;

// Shared by post-accept and periodic health review. Neither route may weaken
// the catalog, original finding identity or independent repair history.
export function validateControlFindings({review: r, previousFindings, key, expectedIds}) {
  const error = (action, reason) => ({action, reason});
  const coverage = checkControlCoverage(r.rows, expectedIds);
  if (!coverage.ok) return error("RECONCILE_REVIEW", coverage.reason);
  if (!unique(r.findings)) return error("RECONCILE_FINDINGS", "Explicit complete finding set required");
  for (const f of r.findings) {
    const check = controlCatalog.flatMap(g => g.checks).find(c => c.id === f.checkId);
    if (!check || (expectedIds && !expectedIds.includes(f.checkId)) || f.criterion !== check.criterion || f.area !== f.checkId.split(".")[0] ||
        ![f.evidence, f.owner, f.work].every(filled) || !instant(f.firstSeen) || !instant(f.reviewAt) ||
        !Number.isSafeInteger(f.attempts) || f.attempts < 0 || typeof f.blocksResume !== "boolean" ||
        !validAffectedTasks(f.affectedTasks) ||
        !["OPEN", "CLOSED"].includes(f.status) || f.owner === r.reviewer ||
        (f.lastResult !== undefined && (!f.attempts || !["FAILED", "PASSED"].includes(f.lastResult))) ||
        (f.status === "CLOSED" && (!filled(f.proof) || !filled(f.reviewedBy) || !digest(f.checkedKey) ||
          (previousFindings.find(old => old.id === f.id)?.status !== "CLOSED" &&
            (f.reviewedBy !== r.reviewer || f.checkedKey !== key)))))
      return error("RECONCILE_FINDINGS", "Finding needs original criterion, owned repair and independent closure");
  }
  const history = checkFindingHistory(previousFindings, r.findings);
  if (history) return error("RECONCILE_FINDINGS", history);
  for (const row of r.rows) {
    const open = r.findings.filter(f => f.checkId === row.id && f.status === "OPEN");
    if (["FINDING", "UNKNOWN", "DEFERRED"].includes(row.status)) {
      if (!open.some(f => f.id === row.findingId)) return error("RECONCILE_REVIEW", "Review row must retain its open finding");
    } else if (open.length) return error("RECONCILE_REVIEW", "Passing or excluded row contradicts its open finding");
  }
  return null;
}
