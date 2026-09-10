import { createHash } from "node:crypto";

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const concrete = value => typeof value === "string" && !!value.trim() && value.trim() === value &&
  !/[\r\n|]/.test(value) && !/<[^>]*>/.test(value) && value.toLowerCase() !== "none";
const activeStates = new Set(["PREPARED", "STARTED", "WORKING"]);
const knownStates = new Set([...activeStates, "WAITING", "RETURNED", "CLOSED", "OUTCOME_UNKNOWN"]);

// A deadline observes a missing receipt, never the runtime or the meaning of a pause.
// The adapter authenticates sources and delivery; this pure classifier grants neither.
export function classifyCheckpointReviews({ leases, orchestrator, outbox }, {
  now = Date.now(), notifiedIncidentIds = [], uncertainIncidentIds = [], attentionIncidentIds = [],
  noticeTimes = {}, responseWaitSeconds = 1800,
} = {}) {
  const reviews = [];
  const issues = [];
  const fail = reason => issues.push(`Checkpoint review: ${reason}`);
  if (!Array.isArray(leases) || !concrete(orchestrator) || !Number.isFinite(now) ||
      !Number.isFinite(responseWaitSeconds) || responseWaitSeconds <= 0) {
    return { action: "LIMITED", coverage: "LIMITED", reviews, issues: ["Checkpoint review: invalid scope or clock"] };
  }
  const outboxReady = outbox && Array.isArray(outbox.returns) && Array.isArray(outbox.routes) &&
    Array.isArray(outbox.issues) && outbox.issues.every(issue => /^Durable outbox: return .* requires routing$/.test(issue)) &&
    outbox.returns.every(record => record.valid) && outbox.routes.every(record => record.valid);
  if (!outboxReady) fail("outbox unavailable or malformed; retain existing pending work");
  const workIds = leases.map(lease => lease.work?.split(/\s/)[0]);
  const checkpoints = leases.map(lease => {
    try { return JSON.parse(lease.checkpointText); } catch { return null; }
  });
  for (const [index, lease] of leases.entries()) {
    const work = workIds[index];
    const base = { work, owner: lease.owner, state: lease.state };
    const limited = reason => { fail(`${work || "unknown work"}: ${reason}`); reviews.push({ ...base, status: "LIMITED", reason }); };
    if (!concrete(work) || workIds.filter(id => id === work).length !== 1 || !knownStates.has(lease.state)) {
      limited("ambiguous work identity or state"); continue;
    }
    if (!activeStates.has(lease.state)) {
      reviews.push({ ...base, status: "QUIET", reason: "waiting-returned-closed-or-uncertain-work" }); continue;
    }
    if (!lease.checkpointText?.startsWith("{")) {
      limited("no agreed machine-readable checkpoint; do not infer a deadline"); continue;
    }
    const checkpoint = checkpoints[index];
    const fields = ["id", "owner", "dueAt", "expected", "receiptId", "authority"];
    if (!checkpoint || fields.some(key => !concrete(checkpoint[key])) ||
        Object.keys(checkpoint).some(key => !fields.includes(key)) ||
        !lease.owner?.split(/\s+\/\s+/).includes(checkpoint.owner) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(checkpoint.dueAt) ||
        !Number.isFinite(Date.parse(checkpoint.dueAt)) ||
        new Date(checkpoint.dueAt).toISOString().replace(".000Z", "Z") !== checkpoint.dueAt.replace(".000Z", "Z")) {
      limited("checkpoint fields, owner or UTC deadline invalid"); continue;
    }
    if (checkpoints.filter(c => c?.id === checkpoint.id).length !== 1 ||
        checkpoints.filter(c => c?.receiptId === checkpoint.receiptId).length !== 1) {
      limited("checkpoint or expected receipt reused by multiple leases"); continue;
    }
    // A tick, renamed title, deferred date or recipient rotation is not a new occurrence.
    const incidentId = `checkpoint-${digest([work, checkpoint.id]).slice(0, 20)}`;
    const entry = { ...base, checkpoint: checkpoint.id, expected: checkpoint.expected, dueAt: checkpoint.dueAt,
      receiptId: checkpoint.receiptId, authority: checkpoint.authority, recipient: orchestrator, incidentId,
      binding: digest([work, lease.state, lease.owner, checkpoint, orchestrator]) };
    if (!outboxReady) { limited("outbox unavailable or malformed; absence is not established"); continue; }
    const receipt = outbox.returns.find(record => record.id === checkpoint.receiptId);
    if (receipt) {
      if (!receipt.fields?.["Task / context / PR / commit / artifact"]?.split(/\s+\/\s+/).includes(checkpoint.owner)) {
        limited("expected receipt has a different producer context"); continue;
      }
      reviews.push({ ...entry, status: "RECEIPT_PRESENT", reason: "use-existing-return-route-not-a-deadline-notice" }); continue;
    }
    if (Date.parse(checkpoint.dueAt) > now) {
      reviews.push({ ...entry, status: "QUIET", reason: "checkpoint-not-due" }); continue;
    }
    if (notifiedIncidentIds.includes(incidentId) || uncertainIncidentIds.includes(incidentId)) {
      const notifiedAt = Date.parse(noticeTimes[incidentId]);
      if (!uncertainIncidentIds.includes(incidentId) && Number.isFinite(notifiedAt) &&
          notifiedAt <= now && now - notifiedAt < responseWaitSeconds * 1000) {
        reviews.push({ ...entry, status: "NOTICE_PENDING", reason: "allow-manager-response-without-another-notice", preservePending: true }); continue;
      }
      reviews.push({ ...entry, status: attentionIncidentIds.includes(incidentId) ? "ATTENTION_RECORDED" : "NEEDS_ATTENTION",
        reason: "prior-notice-unresolved-do-not-resend", preservePending: true }); continue;
    }
    reviews.push({ ...entry, status: "REVIEW_DUE", reason: "expected-receipt-not-observed-by-agreed-checkpoint" });
  }
  const due = reviews.filter(review => review.status === "REVIEW_DUE");
  return {
    action: due.length ? "REVIEW_DUE" : reviews.some(review => review.status === "NEEDS_ATTENTION") ? "NEEDS_ATTENTION" : issues.length ? "LIMITED" : "NOOP",
    coverage: issues.length ? "LIMITED" : "CHECKPOINTS_ONLY", reviews, issues,
    runtimeObservation: "NOT_EVALUATED", deliveryPermission: "NOT_EVALUATED", taskCompletion: "NOT_EVALUATED",
    pendingReturnIds: outbox?.pendingReturnIds || [],
  };
}

// Recompute from fresh authenticated sources just before a non-interrupting notice.
// A positive result still is not transport permission or a completed delivery.
export function checkpointNoticeStillDue(previous, current) {
  return previous?.status === "REVIEW_DUE" && current?.action === "REVIEW_DUE" &&
    current.reviews.some(review => review.status === "REVIEW_DUE" && review.incidentId === previous.incidentId &&
      review.binding === previous.binding);
}
