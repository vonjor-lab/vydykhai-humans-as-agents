const filled = value => typeof value === "string" && !!value.trim();
const validMs = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;

function timestamp(value) {
  if (validMs(value)) return value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const ms = Date.parse(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  return validMs(ms) && new Date(ms).toISOString() === canonical ? ms : null;
}

/**
 * Pure scheduling decision; all times are epoch milliseconds or UTC ISO strings.
 * observation = {trusted:true, resetAt, observedAt, source, evidence} comes from
 * the caller's trusted allowance observer, never from inference by this helper.
 * maxObservationAgeMs and followupOwner are explicit caller policy. failureTriggers
 * contains active nonreset trigger IDs. The caller durably records a reset epoch
 * only after completed health work, and retains its existing budget/leases.
 */
export function evaluateControlCadence({observation, now, previousCompletedResetEpoch = null,
  maxObservationAgeMs, followupOwner, paused = false, failureTriggers = []} = {}) {
  if (!filled(followupOwner) || !Number.isSafeInteger(maxObservationAgeMs) || maxObservationAgeMs <= 0 ||
    typeof paused !== "boolean" || !Array.isArray(failureTriggers) || !failureTriggers.every(filled)) {
    throw Error("CONTROL_CADENCE_CONFIG_INVALID");
  }
  const triggers = [...new Set(failureTriggers)];
  const nowMs = timestamp(now), completed = timestamp(previousCompletedResetEpoch);
  let observed = null;
  const result = (status, reason, action = "OBSERVE_ALLOWANCE_RESET") => {
    const unknown = status === "UNKNOWN";
    const pending = status === "DUE" || triggers.length > 0;
    return {schema:"control.cadence.v1", status:paused ? "PAUSED" : pending ? "REVIEW_DUE" : status,
      due:!paused && pending, paused, failureTriggers:triggers,
      periodic:{status, reason, resetEpoch:observed?.resetAt ?? null,
        nextDueAt:status === "WAITING" ? observed.resetAt : null, observation:observed},
      followup:unknown ? {owner:followupOwner, action, reason} : null};
  };
  if (nowMs === null) return result("UNKNOWN", "NOW_INVALID", "RECONCILE_CADENCE_TIME");
  if (previousCompletedResetEpoch !== null && completed === null) {
    return result("UNKNOWN", "COMPLETED_RESET_INVALID", "RECONCILE_COMPLETED_RESET");
  }
  if (completed !== null && completed > nowMs) {
    return result("UNKNOWN", "TIME_BEFORE_COMPLETED_RESET", "RECONCILE_CADENCE_TIME");
  }
  if (observation == null) return result("UNKNOWN", "RESET_OBSERVATION_MISSING");
  if (observation.trusted !== true) return result("UNKNOWN", "RESET_OBSERVATION_UNTRUSTED");
  if (!filled(observation.source) || !filled(observation.evidence)) {
    return result("UNKNOWN", "RESET_SOURCE_EVIDENCE_MISSING");
  }
  const resetAt = timestamp(observation.resetAt), observedAt = timestamp(observation.observedAt);
  if (resetAt === null || observedAt === null) return result("UNKNOWN", "RESET_OBSERVATION_TIME_INVALID");
  observed = {trusted:true, resetAt, observedAt, source:observation.source, evidence:observation.evidence};
  if (observedAt > nowMs) return result("UNKNOWN", "TIME_BEFORE_OBSERVATION", "RECONCILE_CADENCE_TIME");
  if (resetAt < observedAt) return result("UNKNOWN", "RESET_BEFORE_OBSERVATION");
  if (nowMs - observedAt > maxObservationAgeMs) return result("UNKNOWN", "RESET_OBSERVATION_STALE");
  if (completed !== null && resetAt < completed) return result("UNKNOWN", "RESET_EPOCH_REGRESSED");
  if (completed === resetAt) return result("COMPLETED", "RESET_EPOCH_ALREADY_COMPLETED");
  // There is no interval, catch-up loop, completion mutation or allocation refill.
  if (nowMs >= resetAt) return result("DUE", "OBSERVED_RESET_CROSSED");
  return result("WAITING", "OBSERVED_RESET_NOT_CROSSED");
}
