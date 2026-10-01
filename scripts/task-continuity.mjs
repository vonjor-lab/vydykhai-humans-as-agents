// Compare authenticated checkpoint projections; never infer intent from final prose.
import { createHash } from "node:crypto";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = v => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 4096 &&
  !/[\r\n\0]/.test(v) && !/<[^>]*>/.test(v);
const identity = ["work", "revision", "checkpoint", "humanEvent", "contextEpoch"];

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
