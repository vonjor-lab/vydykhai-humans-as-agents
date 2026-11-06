// Compare authenticated checkpoint projections; never infer intent from final prose.
import { createHash } from "node:crypto";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = v => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 4096 &&
  !/[\r\n\0]/.test(v) && !/<[^>]*>/.test(v);
const identity = ["work", "revision", "checkpoint", "humanEvent", "contextEpoch"];

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
