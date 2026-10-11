// Executable specification under trusted fixture inputs, never a host gate.
import {validProductAcceptance, assessPostAccept} from "../../../scripts/post-accept.mjs";
import {canonicalJson} from "../../../scripts/memory-brief.mjs";
export const catalog = Array.from({length: 28}, (_, i) => `C${String(i + 1).padStart(2, "0")}`);
const bindingKeys = ["task", "scope", "baseline", "module", "memory", "policy"];
const known = value => typeof value === "string" && value.trim().length > 0;
const bound = (a, b) => bindingKeys.every(k => known(a?.[k]) && a[k] === b?.[k]);
const date = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const ok = value => ({ok: true, ...value});
const fail = reason => ({ok: false, reason});

export function assessReview(review, packet, required, excludedActors) {
  if (!known(review?.actor) || excludedActors.includes(review.actor)) return fail("NOT_INDEPENDENT");
  if (!bound(packet, review.binding)) return fail("STALE_BINDING");
  if (!Array.isArray(required) || new Set(required).size !== required.length ||
      required.some(id => !catalog.includes(id))) return fail("INVALID_SELECTION");
  const rows = review.rows;
  if (!Array.isArray(rows) || rows.length !== catalog.length ||
      new Set(rows.map(r => r?.id)).size !== catalog.length ||
      rows.some(r => !catalog.includes(r?.id))) return fail("INCOMPLETE_CATALOG");
  for (const row of rows) {
    if (required.includes(row.id)) {
      if (row.status !== "PASS" || !known(row.evidence)) return fail(`UNCOVERED:${row.id}`);
    } else if (row.status === "NOT_APPLICABLE") {
      if (!known(row.reason)) return fail(`UNJUSTIFIED_SKIP:${row.id}`);
    } else if (row.status !== "PASS" || !known(row.evidence)) return fail(`UNSETTLED:${row.id}`);
  }
  return ok({meaning: "TRUSTED_FIXTURE_ONLY"});
}

export function newCycle(packet, required, actors) {
  return {stage: "DRAFT", packet: structuredClone(packet), required: [...required],
    actors: {...actors}, receipt: null, dispositions: [], history: []};
}

export function advance(cycle, event, input = {}) {
  const keep = (patch, action = event) => ok({action, cycle: {...cycle, ...patch,
    history: [...cycle.history, event]}});
  if (input.paused) return fail("PAUSED");
  if (input.externalUnknown) return fail("RECONCILE_EXTERNAL_OUTCOME");
  if (event === "prepare" && cycle.stage === "DRAFT") {
    if (!bindingKeys.every(k => known(cycle.packet[k]))) return fail("MISSING_BINDING");
    const check = assessReview(input.review, cycle.packet, cycle.required,
      Object.values(cycle.actors));
    return check.ok ? keep({stage: "PREPARED"}) : check;
  }
  if (event === "start" && cycle.stage === "PREPARED") {
    if (input.authorized !== true) return fail("AUTHORITY_REQUIRED");
    if (!bound(cycle.packet, input.current)) return fail("REPREPARE_CHANGED_SCOPE");
    if (!bound(cycle.packet, input.workerReadback)) return fail("WORKER_READBACK_REQUIRED");
    return keep({stage: "RUNNING"});
  }
  if (event === "continue" && cycle.stage === "RUNNING") {
    if (input.authorized !== true) return fail("AUTHORITY_REQUIRED");
    if (!bound(cycle.packet, input.current)) return fail("REPREPARE_CHANGED_SCOPE");
    return keep({}, "CONTINUE_WITHOUT_REVIEW");
  }
  if (event === "verify" && cycle.stage === "RUNNING") {
    const check = assessReview(input.review, cycle.packet, cycle.required,
      Object.values(cycle.actors));
    if (!check.ok) return check;
    if (![input.retainedBehavior, input.promisedBehavior, input.exactRuntime].every(v => v === true))
      return fail("BEHAVIOR_NOT_PROVEN");
    return keep({stage: "VERIFIED"});
  }
  if (event === "retain" && cycle.stage === "VERIFIED") {
    if (![input.requiredDocs, input.requiredMemory, input.requiredTracker].every(v => v === true))
      return fail("RETENTION_INCOMPLETE");
    if (!known(input.receipt)) return fail("RETURN_REQUIRED");
    if (!Array.isArray(input.dispositions) || !input.dispositions.length)
      return fail("CUSTODY_REQUIRED");
    for (const row of input.dispositions) {
      if (!known(row.artifact) || !known(row.evidence)) return fail("CUSTODY_UNPROVEN");
      if (row.status === "CLEANED") continue;
      if (row.status !== "RETAINED" || !known(row.owner) || !known(row.reason) || !date(row.due))
        return fail("RETAINED_OWNER_REQUIRED");
    }
    return keep({stage: "RETAINED", receipt: input.receipt,
      dispositions: structuredClone(input.dispositions)});
  }
  if (event === "consume" && cycle.stage === "RETAINED") {
    if (input.consumer !== cycle.actors.owner || input.receipt !== cycle.receipt)
      return fail("CONSUMPTION_MISMATCH");
    if (!known(input.nextAction)) return fail("NEXT_ACTION_REQUIRED");
    const a = input.acceptance;
    if (!validProductAcceptance(a) || a.task !== cycle.packet.task || a.owner !== cycle.actors.owner ||
        a.executor !== cycle.actors.executor || a.producerReturn.path !== cycle.receipt)
      return fail("PRODUCT_ACCEPTANCE_REQUIRED");
    return keep({stage: "ACCEPTED_CONTROL_DUE", nextAction: input.nextAction, acceptance: structuredClone(a)});
  }
  if (event === "postAccept" && cycle.stage === "ACCEPTED_CONTROL_DUE") {
    if (!input.control?.acceptance || canonicalJson(input.control.acceptance) !== canonicalJson(cycle.acceptance))
      return fail("ACCEPTANCE_MISMATCH");
    const result = assessPostAccept(input.control);
    return result.action === "CONTROL_CONFIRMED" ? keep({stage: "CLOSED"}) : fail(result.action);
  }
  if (event === "consume" && ["ACCEPTED_CONTROL_DUE", "CLOSED"].includes(cycle.stage) && input.receipt === cycle.receipt &&
      input.consumer === cycle.actors.owner) return ok({action: "QUIET", cycle});
  return fail("INVALID_TRANSITION");
}

// A timer must supply these observations; this pure function creates none.
export function healthDecision({now, dueAt, observedAt, maxAgeMs, signal,
  incidentId, consumed = [], paused = false, budget = 0}) {
  if (paused) return {action: "PAUSED", retained: true};
  if (![now, dueAt, observedAt, maxAgeMs].every(Number.isFinite) || maxAgeMs < 0 ||
      observedAt > now || now - observedAt > maxAgeMs)
    return {action: "UNKNOWN_OBSERVATION"};
  if (now < dueAt && !signal) return {action: "QUIET"};
  if (!known(incidentId)) return {action: "MISSING_ENROLLMENT"};
  if (consumed.includes(incidentId)) return {action: "QUIET"};
  if (!Number.isFinite(budget) || budget <= 0) return {action: "BUDGET_DECISION", incidentId};
  return {action: "REVIEW_DUE", incidentId};
}

export function reconcileFindings(previous, incoming, reviewer, repairer) {
  if (!known(reviewer) || reviewer === repairer) return fail("NOT_INDEPENDENT");
  if (!Array.isArray(previous) || !Array.isArray(incoming)) return fail("INVALID_FINDINGS");
  if (new Set(previous.map(x => x.id)).size !== previous.length ||
      new Set(incoming.map(x => x.id)).size !== incoming.length) return fail("DUPLICATE_FINDING");
  for (const old of previous) {
    const next = incoming.find(x => x.id === old.id);
    if (!next || next.criterion !== old.criterion) return fail("LOST_CRITERION");
    if (old.status === "CLOSED" && next.status !== "CLOSED") return fail("REOPEN_WITHOUT_NEW_INCIDENT");
  }
  for (const next of incoming) {
    if (!known(next.id) || !known(next.criterion)) return fail("INVALID_FINDING");
    if (next.status === "CLOSED") {
      if (!known(next.evidence)) return fail("REPAIR_UNPROVEN");
    } else if (next.status !== "OPEN" || !known(next.owner) || !date(next.due)) {
      return fail("UNOWNED_DEBT");
    }
  }
  return ok({findings: structuredClone(incoming)});
}
