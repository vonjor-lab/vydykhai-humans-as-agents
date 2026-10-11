// Experimental read-only Health Review input. Does not discover or close debt.
const filled = v => typeof v === "string" && v.trim().length > 0;
const severities = ["NORMAL", "HIGH", "CRITICAL"];
const states = ["OPEN", "DEFERRED", "ACCEPTED_RISK", "CLOSED"];
const unresolved = row => row.status !== "CLOSED";
const valid = s => s && filled(s.scope) && filled(s.evidence) && Number.isFinite(s.at) &&
  Array.isArray(s.items) && new Set(s.items.map(r => r?.id)).size === s.items.length &&
  Array.from(s.items).every(r => filled(r?.id) && filled(r.criterion) && filled(r.owner) && filled(r.evidence) &&
    filled(r.originEvidence) && ["INHERITED", "DISCOVERED", "CREATED"].includes(r.origin) &&
    severities.includes(r.severity) && states.includes(r.status) && Number.isFinite(r.reviewAt) &&
    Number.isSafeInteger(r.attempts) && r.attempts >= 0 &&
    (r.status !== "CLOSED" || (filled(r.closure?.evidence) && filled(r.closure?.reviewer) &&
      r.closure.reviewer !== r.owner && r.closure.criterion === r.criterion)));

export function assessDebtProgress(input) {
  const {before, after, outcomes = [], stagnantWindows, policy} = input ?? {};
  const result = (action, reason, metrics = null) => ({action, reason, metrics,
    semanticAcceptance: "NOT_ESTABLISHED", mutationAuthorized: false});
  if (!valid(before) || !valid(after) || before.scope !== after.scope || after.at <= before.at ||
      !Array.isArray(outcomes) || new Set(outcomes.map(o => o?.id)).size !== outcomes.length ||
      Array.from(outcomes).some(o => !filled(o?.id) || !filled(o.evidence) || o.scope !== before.scope ||
        !Number.isFinite(o.at) || o.at <= before.at || o.at > after.at) ||
      !Number.isSafeInteger(stagnantWindows) || stagnantWindows < 0 ||
      !policy || !filled(policy.evidence) || !Number.isFinite(policy.windowMs) || policy.windowMs <= 0 ||
      !Number.isSafeInteger(policy.maxStagnantWindows) || policy.maxStagnantWindows < 1)
    return result("RECONCILE_EVIDENCE", "Invalid comparable observations or accepted policy");
  const old = new Map(before.items.map(r => [r.id, r]));
  for (const prior of before.items) {
    const current = after.items.find(r => r.id === prior.id);
    if (!current || current.criterion !== prior.criterion || current.origin !== prior.origin ||
        current.originEvidence !== prior.originEvidence || current.severity !== prior.severity ||
        current.attempts < prior.attempts || (prior.status === "CLOSED" && unresolved(current)))
      return result("RECONCILE_EVIDENCE", "Lost/relabelled obligation, changed risk classification or reset history");
    if (current.reviewAt !== prior.reviewAt && (!filled(current.reschedule?.decision) ||
        !filled(current.reschedule?.evidence) || current.reschedule.previous !== prior.reviewAt ||
        current.reschedule.next !== current.reviewAt))
      return result("RECONCILE_EVIDENCE", "Changed review date requires explicit retained rescheduling evidence");
  }
  const added = after.items.filter(r => !old.has(r.id));
  if (added.some(r => r.origin === "INHERITED"))
    return result("RECONCILE_EVIDENCE", "Newly recorded debt must distinguish discovered from created");
  const closed = before.items.filter(unresolved).filter(r =>
    after.items.find(a => a.id === r.id).status === "CLOSED");
  const current = after.items.filter(unresolved);
  const bySeverity = rows => Object.fromEntries(severities.map(s => [s, rows.filter(r => r.severity === s).length]));
  const metrics = {baselineOpen: before.items.filter(unresolved).length, baselineClosed: closed.length,
    baselineRemaining: before.items.filter(unresolved).length - closed.length,
    discovered: added.filter(r => r.origin === "DISCOVERED").length,
    created: added.filter(r => r.origin === "CREATED").length,
    openCreated: added.filter(r => r.origin === "CREATED" && unresolved(r)).length,
    currentOpen: current.length, deferred: current.filter(r => r.status === "DEFERRED").length,
    acceptedRisk: current.filter(r => r.status === "ACCEPTED_RISK").length,
    overdue: current.filter(r => r.reviewAt <= after.at).length,
    closedBySeverity: bySeverity(closed), openBySeverity: bySeverity(current), outcomes: outcomes.length};
  if (current.some(r => r.severity === "CRITICAL"))
    return result("PRIORITY_REVIEW", "Unresolved critical debt cannot hide behind aggregate improvement", metrics);
  if (metrics.overdue) return result("PRIORITY_REVIEW", "Due obligations require disposition, not silent postponement", metrics);
  if (after.at - before.at < policy.windowMs)
    return result("WINDOW_NOT_COMPLETE", "Do not judge trend on a partial window", metrics);
  if (metrics.openCreated > metrics.baselineClosed)
    return result("PRIORITY_REVIEW", "New work adds more unresolved debt than was retired", metrics);
  if (metrics.baselineOpen && !metrics.baselineClosed && stagnantWindows + 1 >= policy.maxStagnantWindows)
    return result("PRIORITY_REVIEW", "Accepted stagnation threshold reached", metrics);
  if (metrics.baselineClosed && !outcomes.length)
    return result("REVIEW_PRODUCT_BALANCE", "Maintenance progress alone is not product productivity", metrics);
  if (metrics.baselineClosed)
    return result("PROGRESS_RECORDED", "Retained debt reduction and product outcome need semantic confirmation", metrics);
  return result(metrics.currentOpen ? "OWNED_DEBT_REMAINS" : "NO_DEBT_RECORDED",
    "No full-project health claim follows from this snapshot", metrics);
}
