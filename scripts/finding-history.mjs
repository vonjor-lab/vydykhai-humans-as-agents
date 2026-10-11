// Compare retained findings; callers validate records and obtain prior state from storage.
import {canonicalJson} from "./memory-brief.mjs";
const filled = v => typeof v === "string" && v.trim().length > 0;
const unique = rows => Array.isArray(rows) && Array.from(rows).every(r => filled(r?.id)) &&
  new Set(rows.map(r => r.id)).size === rows.length;

export function checkFindingHistory(previous, current) {
  if (!unique(previous) || !unique(current)) return "Invalid or duplicate finding history";
  for (const f of [...previous, ...current]) {
    for (const field of ["revalidations", "retryDecisions"]) {
      const rows = f[field] ?? [];
      if (!Array.isArray(rows) || Array.from(rows).some(r => !r || !filled(r.evidence) || !filled(r.reviewedBy)))
        return "Invalid retained repair transition evidence";
      if (field === "revalidations" && (rows.some(r => !filled(r.revision)) ||
          new Set(rows.map(r => r.revision)).size !== rows.length)) return "Invalid revision revalidation";
      if (field === "retryDecisions" && (rows.some(r => !Number.isSafeInteger(r.fromAttempt) || r.fromAttempt < 1 ||
          !Number.isSafeInteger(r.toAttempt) || r.toAttempt <= r.fromAttempt || r.previousResult !== "FAILED" ||
          !filled(r.decision)) || new Set(rows.map(r => r.fromAttempt)).size !== rows.length))
        return "Invalid retry decision";
    }
  }
  for (const old of previous) {
    const next = current.find(f => f.id === old.id);
    if (!next || ["criterion", "evidence", "area", "firstSeen"].some(k => next[k] !== old[k]) ||
        canonicalJson(next.affectedTasks ?? null) !== canonicalJson(old.affectedTasks ?? null) ||
        next.attempts < old.attempts || (old.status === "CLOSED" && next.status !== "CLOSED"))
      return "Original evidence, boundary, criterion, attempts and closure must survive restart";
    if (old.status === "CLOSED" && ["proof", "reviewedBy", "checkedRevision", "checkedKey"].some(k => next[k] !== old[k]))
      return "Previously accepted closure evidence cannot be rewritten";
    if (old.status === "OPEN" && old.lastResult === "FAILED" && next.status === "CLOSED" &&
        (next.attempts <= old.attempts || next.lastResult !== "PASSED"))
      return "A failed repair closes only through a later recorded successful attempt";
    if (old.lastResult === "FAILED" && next.status === "OPEN" &&
        (next.lastResult === undefined || (next.attempts === old.attempts && next.lastResult !== "FAILED")))
      return "A failed attempt must remain visible until a later recorded result or verified closure";
    for (const field of ["revalidations", "retryDecisions"]) {
      if ((old[field] ?? []).some((record, i) => !next[field]?.[i] || canonicalJson(record) !== canonicalJson(next[field][i])))
        return "Repair decisions and revalidation history are append-only";
    }
    if (old.lastResult === "FAILED" && next.attempts > old.attempts &&
        !(next.retryDecisions ?? []).some(r => r.fromAttempt === old.attempts && r.toAttempt === next.attempts &&
          r.reviewedBy !== old.owner && r.reviewedBy !== next.owner))
      return "Retry after failure requires a transition-bound independent decision";
    if (next.reviewAt !== old.reviewAt && (!filled(next.reschedule?.decision) ||
        !filled(next.reschedule?.evidence) || next.reschedule.previous !== old.reviewAt ||
        next.reschedule.next !== next.reviewAt)) return "Changed review date requires retained rescheduling evidence";
    if (next.blocksResume !== old.blocksResume && (!filled(next.blockingChange?.decision) ||
        !filled(next.blockingChange?.evidence) || next.blockingChange.previous !== old.blocksResume ||
        next.blockingChange.next !== next.blocksResume)) return "Changed dependency hold requires explicit decision and evidence";
    if ((next.owner !== old.owner || next.work !== old.work) &&
        (!filled(next.transfer?.decision) || !filled(next.transfer?.evidence) ||
        next.transfer.fromOwner !== old.owner || next.transfer.toOwner !== next.owner ||
        next.transfer.fromWork !== old.work || next.transfer.toWork !== next.work))
      return "Owner or repair-work transfer requires an explicit retained handoff";
  }
  return null;
}

export function checkFindingLeases(findings, leases) {
  if (!Array.isArray(leases)) return "Missing existing execution-lease observations";
  const open = findings.filter(f => f.status === "OPEN");
  for (const f of open) {
    const matches = leases.filter(l => l?.work === f.work && l.owner === f.owner);
    if (matches.length !== 1) return "Open finding has no unique current repair lease";
    const l = matches[0];
    if (!["PREPARED", "STARTED", "WORKING", "WAITING"].includes(l.state) ||
        !filled(l.evidence) || !filled(l.checkpoint) ||
        !filled(l.reviewAt) || !Number.isFinite(Date.parse(l.reviewAt)) ||
        Date.parse(l.reviewAt) > Date.parse(f.reviewAt) ||
        (l.state === "WAITING" && !filled(l.resumeWhen))) return "Open finding is routed to a closed or unaccountable repair lease";
  }
  return null;
}
