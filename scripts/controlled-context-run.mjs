// Candidate command boundary, not an authenticated/native host adapter. Host code
// supplies protected observation/reservation services; task JSON cannot supply them.
import {runContextTransition, readCommandFailure} from "./context-run.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {observeConfinedFile,sealCommandEffects} from "./control-health-domain.mjs";

const filled = v => typeof v === "string" && v.trim().length > 0;
const hash = value => sha256(canonicalJson(value));
const freeze = value => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
class ControlDeadlineError extends Error {}

// Timeout never means admission. Reserve must atomically consume the exact grant
// and leave IN_FLIGHT evidence before execution; late reservations are reconciled,
// never automatically released or retried by this bridge.
async function bounded(call, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(() => call(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ControlDeadlineError("CONTROL_TIMEOUT")); }, timeoutMs); })]);
  } finally { clearTimeout(timer); }
}

export async function runControlledContextTransition(request, services = {}) {
  const control = services.control;
  const timeoutMs = control?.timeoutMs ?? 2000;
  if (!["authorize", "reserve", "observe"].every(key => typeof control?.[key] === "function") ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000)
    return {status: "BLOCKED", code: "CONTROL_ADAPTER_REQUIRED", actionOutcome: "NOT_INVOKED",
      replayRequiresReconciliation: false, enforcement: "controlled-command-boundary",
      hostIdentity: "NOT_ESTABLISHED"};
  const {authorize, reserve, observe} = control;
  let controlFailureCode = null, controlFailure = null, pendingObservation = null;
  let phase, phaseStarted;
  const enter = next => { phase = next; phaseStarted = performance.now(); };
  const failureDetail = error => ({phase,
    kind: error instanceof ControlDeadlineError ? "DEADLINE" : phase === "EXECUTE" ? "ACTION_UNRESOLVED" : "SERVICE_REJECTION",
    elapsedMs: Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(performance.now() - phaseStarted)))});
  const dispatch = async (binding, invoke) => {
    const fixed = freeze(structuredClone(binding)), bindingSha256 = hash(fixed);
    let started = false, reserved = null;
    try {
      enter("AUTHORIZE");
      const grant = await bounded(signal => authorize(fixed, {signal}), timeoutMs);
      if (!grant || grant.decision !== "ALLOW" || grant.bindingSha256 !== bindingSha256 ||
          !filled(grant.id) || !filled(grant.reviewReceipt) || !filled(grant.stateRevision) ||
          !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now()) throw Error("CONTROL_NOT_ADMITTED");
      const pinned = freeze(structuredClone(grant));
      enter("RESERVE");
      const claim = await bounded(signal => reserve(pinned, {signal}), timeoutMs);
      if (!claim || claim.bindingSha256 !== bindingSha256 || claim.grantId !== pinned.id ||
          claim.stateRevision !== pinned.stateRevision || !filled(claim.reservationId) ||
          claim.status !== "RESERVED" || pinned.expiresAt <= Date.now()) throw Error("CONTROL_RESERVATION_INVALID");
      reserved = freeze(structuredClone(claim));
      const before=fixed.confined ? await observeConfinedFile(request.workspace,fixed.confined.writeFiles[0]) : null;
      started = true;
      enter("EXECUTE");
      const result = await invoke();
      pendingObservation = {reserved, result, grant:pinned, before, observed: freeze({
        bindingSha256, outcome: "COMPLETED", resultSha256: hash({exitCode: result.exitCode,
          commandSha256: result.commandSha256, stdoutSha256: result.stdoutSha256,
          executable: result.executable, cwd: result.cwd})})};
      return result;
    } catch (error) {
      controlFailure = failureDetail(error);
      const failure = readCommandFailure(error);
      if (started && failure && typeof control.captureFailure === "function") {
        try {
          await bounded(signal => control.captureFailure(reserved, freeze({bindingSha256, failure}), {signal}), timeoutMs);
        } catch { /* The consumed reservation remains unresolved even if capture fails. */ }
      }
      controlFailureCode = started ? "CONTROL_OUTCOME_RECONCILIATION_REQUIRED" : "CONTROL_ADMISSION_FAILED";
      // Source text and service errors may contain sensitive data; expose no raw error.
      throw Error(controlFailureCode);
    }
  };
  let result = await runContextTransition(request, {...services, dispatch});
  // A zero-exit command is not completion until final source and behavior checks
  // succeed. Failed readback leaves the consumed reservation unresolved.
  if (pendingObservation && ["ACTION_COMPLETED", "VERIFIED"].includes(result.status)) {
    const {reserved, observed, result:commandResult, grant, before} = pendingObservation;
    try {
      enter("OBSERVE");
      if(before)sealCommandEffects(observed,{result:commandResult,grant,claim:reserved,before,
        after:await observeConfinedFile(request.workspace,grant.binding.confined.writeFiles[0])});
      const receipt = await bounded(signal => observe(reserved, observed, {signal}), timeoutMs);
      if (!receipt || receipt.reservationId !== reserved.reservationId ||
          receipt.bindingSha256 !== observed.bindingSha256 || !filled(receipt.evidence))
        throw Error("CONTROL_OBSERVATION_MISSING");
    } catch (error) {
      controlFailure = failureDetail(error);
      result = {...result, status: "BLOCKED", code: "CONTROL_OUTCOME_RECONCILIATION_REQUIRED",
        reference: null, actionOutcome: "OUTCOME_UNKNOWN", replayRequiresReconciliation: true};
    }
  } else if (pendingObservation) {
    controlFailure = failureDetail();
  }
  return {...result, ...(controlFailureCode ? {code: controlFailureCode} : {}),
    ...(controlFailure ? {controlFailure} : {}),
    enforcement: "controlled-command-boundary", hostIdentity: "NOT_ESTABLISHED"};
}
