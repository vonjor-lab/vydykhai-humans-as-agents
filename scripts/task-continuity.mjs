// Compare authenticated checkpoint projections; never infer intent from final prose.
import { createHash } from "node:crypto";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = v => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 4096 &&
  !/[\r\n\0]/.test(v) && !/<[^>]*>/.test(v);
const identity = ["work", "revision", "checkpoint", "humanEvent", "contextEpoch"];

// Validate a projection of the existing task ledger, not a new ledger or authority.
export function evaluateTaskDisposition(v) {
  const result = (status, reason) => ({status, reason, replayAuthorized:false,
    assurance:"DECLARED_EVIDENCE_ONLY", productAccepted:status === "PASS" && v?.action === "accept"});
  const hold = reason => result("UNVERIFIED", reason);
  if (!object(v) || v.boundary !== "task-disposition" ||
      !["work","owner","revision","candidate","plan","authority","ledger"].every(k => text(v[k])) ||
      !["execute","accept","handoff","halt"].includes(v.action)) return hold("current task disposition missing");
  if (v.action === "halt") return result("HELD", "stop requires no independent permission; product remains open");
  if (v.effects !== "RECONCILED") return result("OUTCOME_UNKNOWN", "reconcile effects; no replay or accepted closure");
  if (v.pause !== "CLEARED") return result("HELD", "human pause or unresolved authority");
  const b = v.budget;
  if (!object(b) || !["limit","spent","reserved","next","reviewReserve"].every(k =>
      Number.isSafeInteger(b[k]) && b[k] >= 0) || b.limit === 0 || !text(b.unit)) return hold("complete task budget unavailable");
  if (!Array.isArray(v.attempts) || v.attempts.length > 128 ||
      !v.attempts.every(a => object(a) && ["id","hypothesis","evidence"].every(k => text(a[k])) &&
        ["failed","succeeded","unknown"].includes(a.outcome) && typeof a.escalated === "boolean") ||
      new Set(v.attempts.map(a => a.id)).size !== v.attempts.length ||
      !Number.isSafeInteger(v.maxAttempts) || v.maxAttempts < 1 || v.maxAttempts > 128 ||
      !Number.isSafeInteger(v.maxEscalations) || v.maxEscalations < 0 || v.maxEscalations > v.maxAttempts) {
    return hold("bounded cumulative attempt history unavailable");
  }
  if (v.attempts.some(a => a.outcome === "unknown")) return result("OUTCOME_UNKNOWN", "unknown attempt requires reconciliation");
  const r = v.review;
  if (!object(r) || typeof r.required !== "boolean" || !Array.isArray(r.triggers) ||
      !r.triggers.every(t => ["acceptance","no-progress","handoff"].includes(t)) || !text(r.basis)) {
    return hold("review applicability missing");
  }
  if ((r.triggers.length || v.action === "handoff") && !r.required) return hold("mandatory review cannot be waived");
  if (v.action === "execute") {
    const n = v.next;
    if (!object(n) || !["hypothesis","check","reason"].every(k => text(n[k])) ||
        typeof n.escalated !== "boolean") return hold("concrete changed plan and discriminating check required");
    if (v.attempts.length >= v.maxAttempts ||
        v.attempts.filter(a => a.escalated).length + Number(n.escalated) > v.maxEscalations ||
        b.spent + b.reserved + b.next + b.reviewReserve > b.limit || b.spent + b.reserved >= b.limit) {
      return result("HELD", "task allowance exhausted; verdict cannot grant more attempts or spend");
    }
    if (v.attempts.some(a => a.outcome === "failed" && a.hypothesis === n.hypothesis)) {
      return result("HELD", "failed hypothesis cannot be replayed unchanged");
    }
    if (n.escalated && v.cause !== "capability") return hold("model escalation requires a capability gap");
  }
  if (r.required) {
    const q = r.verdict, a = r.application;
    if (!text(r.dispatch) || !object(q) || !object(a) ||
        !["id","reviewer","evidence"].every(k => text(q[k])) ||
        !Array.isArray(v.authors) || !v.authors.length || !v.authors.every(text) ||
        q.reviewer === v.owner || v.authors.includes(q.reviewer)) return hold("independent verdict not received");
    if (!["work","revision","candidate","plan","ledger"].every(k => q[k] === v[k]) ||
        a.verdict !== q.id || a.owner !== v.owner || !text(a.evidence)) return hold("stale verdict or unapplied disposition");
    const expected = {execute:"CORRECT", accept:"ACCEPT", handoff:"CONSULT"}[v.action];
    if (q.decision !== expected) return result("HELD", "verdict does not support requested action");
    if (v.action === "execute" && (!text(q.gap) || !text(q.check) || q.check !== v.next.check)) {
      return hold("continuation requires an actionable independently identified gap and check");
    }
    if (v.action === "handoff" && !text(q.reason)) return hold("handoff grounds missing");
  }
  if (v.action === "accept" && !text(v.acceptanceEvidence)) return hold("actual product acceptance evidence missing");
  if (v.action === "handoff" && (!object(v.handoff) ||
      !["retained","alternatives","decisionNeeded","resumeWhen","delivered"].every(k => text(v.handoff[k])))) {
    return hold("human decision package not delivered");
  }
  return result("PASS", "declared disposition consistent; host authority and evidence authenticity remain required");
}

// A resume receipt proves this transition, not completion of the task or host delivery.
export function evaluateResumeReceipt(value) {
  const result = (status, reason) => ({status, reason, replayAuthorized: false});
  if (!object(value) || value.boundary !== "task-resume" ||
      !["work", "owner", "humanEvent", "checkpoint", "action"].every(k => text(value[k]))) {
    return result("UNVERIFIED", "current resume scope missing");
  }
  if (value.effects === "UNKNOWN") return result("OUTCOME_UNKNOWN", "reconcile effects before any retry");
  if (value.pause !== "CLEARED" || value.effects !== "RECONCILED") {
    return result("UNVERIFIED", "pause authority or effects not reconciled");
  }
  const dispatch = value.dispatch, observed = value.observed;
  if (!object(dispatch) || !text(dispatch.evidence) || !text(dispatch.turnId)) {
    return result("UNVERIFIED", "promise is not dispatch");
  }
  if (!object(observed) || !text(observed.evidence)) {
    return result("UNVERIFIED", "dispatch is not first action");
  }
  for (const row of [dispatch, observed]) {
    if (!["work", "owner", "humanEvent", "checkpoint", "action"].every(k => row[k] === value[k])) {
      return result("MISMATCH", "receipt does not match current resume");
    }
  }
  if (observed.turnId !== dispatch.turnId) return result("MISMATCH", "stale or different worker turn");
  const task = evaluateTaskIdentity(value.taskIdentity, {
    work: value.work, context: value.owner, turnId: observed.turnId
  });
  if (task.coverage !== "COVERED") return result("UNVERIFIED", task.reason);
  if (task.nextAction || value.taskIdentity.current.humanEvent !== value.humanEvent ||
      value.taskIdentity.current.checkpoint !== value.checkpoint) {
    return result("MISMATCH", "restore current authoritative assignment before closing resume");
  }
  const readback = value.readback;
  if (!object(readback) || readback.evidence !== value.taskIdentity.seen.evidence ||
      readback.contextEpoch !== value.taskIdentity.current.contextEpoch ||
      observed.contextEpoch !== readback.contextEpoch ||
      !Number.isSafeInteger(readback.sequence) || readback.sequence < 0 ||
      !Number.isSafeInteger(observed.sequence) || observed.sequence <= readback.sequence) {
    return result("UNVERIFIED", "first action must follow current readback in the same observed epoch");
  }
  if (observed.kind !== "FIRST_ACTION") return result("UNVERIFIED", "acknowledgement or blocker is not execution");
  return result("PASS", "scoped first action observed; not DOD or autonomous delivery proof");
}

export function evaluateTaskIdentity(value, { work, context, turnId } = {}) {
  let observationKey = null;
  const result = (coverage, nextAction, reason) => ({ coverage, nextAction, reason,
    observationKey, replacementAuthorized: false, replayAuthorized: false });
  const limited = reason => result("LIMITED", "RECOVER_OBSERVATION", reason);
  if (value === undefined) return result("NOT_REQUESTED", null, "task identity not enrolled");
  if (!keys(value, ["schemaVersion", "current", "seen", "failedRestorations"]) || value.schemaVersion !== 1 ||
      ![work, context, turnId].every(text)) return limited("invalid task identity scope");
  const current = value.current;
  if (!keys(current, [...identity, "owner", "evidence"]) || !Object.values(current).every(text) ||
      current.work !== work || current.owner !== context) return limited("current assignment does not match the lease owner/work");
  if (!Array.isArray(value.failedRestorations) || value.failedRestorations.length > 32 ||
      !value.failedRestorations.every(r => keys(r, ["turnId", "evidence"]) && Object.values(r).every(text)) ||
      new Set(value.failedRestorations.map(r => r.turnId)).size !== value.failedRestorations.length) {
    return limited("restoration evidence is invalid or duplicated");
  }
  const seen = value.seen;
  if (!keys(seen, [...identity, "turnId", "evidence"]) || !Object.values(seen).every(text) || seen.turnId !== turnId) {
    return limited("current-turn assignment readback is unavailable");
  }
  // Equal routing verdicts do not prove two views observed the same assignment.
  observationKey = createHash("sha256").update(JSON.stringify([work, context, turnId,
    identity.map(k => current[k]), identity.map(k => seen[k]),
    value.failedRestorations.map(r => r.turnId).sort()])).digest("hex");
  const changed = identity.filter(k => seen[k] !== current[k]);
  if (!changed.length) return result("COVERED", null, "current assignment read back; not semantic acceptance");
  return result("COVERED", value.failedRestorations.length ? "REBRIEF_FRESH_CONTEXT" : "RESTORE_CURRENT_TASK",
    `current assignment mismatch: ${changed.join(", ")}`);
}
