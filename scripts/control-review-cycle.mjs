// Experimental, uninstalled checkpoint protocol. Injected observers are trusted
// custody adapters, not model/user assertions. This API grants no host admission.
import {randomUUID} from "node:crypto";
import {openControlStore} from "./control-store.mjs";
import {controlCatalog, controlCheckIds} from "./control-catalog.mjs";
import {validateReviewPart} from "./control-review-partitions.mjs";
import {validateModelReviewAcquisition} from "./control-model-review.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if (!value) throw Error(code);};
const filled = value => typeof value === "string" && !!value.trim();
const instant = value => filled(value) && Number.isFinite(Date.parse(value));
const groups = new Map(controlCatalog.map(g => [g.id, g.checks.map(c => c.id)]));
const catalogKey = hash(controlCatalog);
const receiptMetadata = observed => {
  const retained = Object.fromEntries(["cycleId", "basisKey", "attemptId", "group", "state", "outcome",
    "observedAt", "rawDigest", "evidence"].filter(k => Object.hasOwn(observed, k)).map(k => [k, observed[k]]));
  retained.observationDigest = hash(observed);
  if (retained.evidence.length > 1024) retained.evidence = `oversized-evidence:${hash(retained.evidence)}`;
  const readbacks = observed.readbacks;
  retained.readbacks = Array.isArray(readbacks) && readbacks.length <= 128 ? readbacks.map(source =>
    source && typeof source.id === "string" && source.id.length <= 128 &&
      typeof source.status === "string" && source.status.length <= 64 &&
      (source.sha256 === undefined || /^[a-f0-9]{64}$/.test(source.sha256)) ?
      {id: source.id, status: source.status, ...(source.sha256 ? {sha256: source.sha256} : {})} :
      {invalidReadback: true, digest: hash(source ?? null)}) : {digest: hash(readbacks ?? null)};
  if (Object.hasOwn(observed, "answer")) {
    if (Buffer.byteLength(canonicalJson(observed.answer)) <= 65536) retained.answer = structuredClone(observed.answer);
    else retained.answerDigest = hash(observed.answer);
  }
  return retained;
};

export async function openReviewCycle(directory, config, adapters) {
  const {readBasis, readEpoch, observeAttempt, observeRecovery, now = () => Date.now()} = adapters;
  need([readBasis, readEpoch, observeAttempt, observeRecovery, now].every(f => typeof f === "function"), "CYCLE_ADAPTER_INVALID");
  const fixed = structuredClone(config), basis = fixed.basis;
  need(/^[a-f0-9]{64}$/.test(basis?.epoch) && ["POST", "HEALTH"].includes(basis?.phase) && filled(basis.action) &&
    /^[a-f0-9]{64}$/.test(basis.offer?.key) && Array.isArray(basis.offer?.input?.previousFindings) &&
    Array.isArray(basis.sources?.rows) && basis.sources.rows.length > 0 &&
    Array.isArray(basis.requiredSourceIds) && basis.requiredSourceIds.every(filled) &&
    filled(fixed.owner) && filled(fixed.reviewer) && fixed.owner !== fixed.reviewer &&
    instant(fixed.expiresAt) && Number.isInteger(fixed.maxCalls) && fixed.maxCalls > 0 && fixed.maxCalls <= 20,
  "CYCLE_CONFIG_INVALID");
  const basisKey = hash({catalogKey, basis}), configKey = hash(fixed);
  const store = await openControlStore(directory);
  const current = async () => {
    const snapshotMatches = hash({catalogKey, basis: await readBasis()}) === basisKey;
    let row = await store.read();
    const matches = snapshotMatches && readEpoch() === basis.epoch;
    if (!matches && row && !row.state.invalidated) row = await store.transact(state => {
      need(state.configKey === configKey, "CYCLE_IDENTITY_INVALID");
      state.invalidated ??= {observedAt: new Date(now()).toISOString(), reason: "CYCLE_BASIS_INVALIDATED"};
      return state;
    });
    return matches && !row?.state.invalidated;
  };
  const live = () => need(now() < Date.parse(fixed.expiresAt), "CYCLE_EXPIRED");
  const assertCurrent = async () => need(await current(), "CYCLE_BASIS_INVALIDATED");
  // No await after the custody fence on a success path. The SDK must own this
  // monotone epoch; a cached file hash or an async getter is not that contract.
  const fence = () => need(readEpoch() === basis.epoch, "CYCLE_BASIS_INVALIDATED");
  const latest = async () => {
    const row = await store.read();
    need(row?.state.schema === "control.review-cycle.prototype.v1" &&
      row.state.configKey === configKey && row.state.basisKey === basisKey, "CYCLE_IDENTITY_INVALID");
    return row;
  };
  const active = state => state.attempts.some(a => ["RESERVED", "DISPATCHED", "UNKNOWN"].includes(a.status));
  const attemptAuthority = attempt => {
    live();
    if (attempt.recovery) need(now() < Date.parse(attempt.recovery.expiresAt), "CYCLE_RECOVERY_EXPIRED");
  };
  const reserve = (state, group, id, recovery = null) => {
    need(groups.has(group), "CYCLE_GROUP_INVALID");
    need(!active(state), "CYCLE_ATTEMPT_UNRESOLVED");
    need(!state.receipts[group], "CYCLE_GROUP_COMPLETED");
    need(state.attempts.length < fixed.maxCalls, "CYCLE_CAPACITY_EXHAUSTED");
    state.attempts.push({id, group, status: "RESERVED", reservedAt: new Date(now()).toISOString(), recovery});
    return state;
  };
  const identity = observation => need(observation?.cycleId && observation.cycleId === cycleId &&
    observation.basisKey === basisKey, "CYCLE_OBSERVATION_UNBOUND");
  const initial = await store.read();
  if (!initial) {
    await assertCurrent(); live();
    await store.initialize({schema: "control.review-cycle.prototype.v1", configKey, basisKey,
      cycleId: randomUUID(), attempts: [], receipts: {}});
  }
  const cycleId = (await latest()).state.cycleId;
  return {
    cycleId, basisKey,
    async status() {
      const valid = await current(), row = await latest(), expired = now() >= Date.parse(fixed.expiresAt);
      const rows = controlCheckIds.map(id => ({id, state: !valid || expired ? "INVALIDATED" :
        row.state.receipts[id.split(".")[0]] ? "COMPLETED" :
          row.state.attempts.some(a => a.group === id.split(".")[0] &&
            ["RESERVED", "DISPATCHED", "UNKNOWN"].includes(a.status)) ? "ASSIGNED" : "PENDING"}));
      return {...row, rows, current: valid, expired, admission: "DENIED_NOT_INTEGRATED",
        accounting: {reserved: row.state.attempts.length,
          dispatched: row.state.attempts.filter(a => a.dispatchedAt && a.status !== "NOT_STARTED").length,
          completed: Object.keys(row.state.receipts).length, nativeUsage: "UNKNOWN"}};
    },
    async claim(group) {
      await latest(); await assertCurrent(); live();
      const id = randomUUID();
      await store.transact(state => {
        live(); need(!state.attempts.some(a => a.group === group), "CYCLE_EXPLICIT_RECOVERY_REQUIRED");
        return reserve(state, group, id);
      });
      return id;
    },
    async markDispatched(id) {
      const before = await latest(), marker = randomUUID();
      need(before.state.attempts.find(a => a.id === id)?.status === "RESERVED", "CYCLE_NOT_RESERVED");
      try {
        await assertCurrent();
        await store.transact(state => {
          const attempt = state.attempts.find(a => a.id === id); attemptAuthority(attempt);
          fence();
          need(attempt.status === "RESERVED", "CYCLE_NOT_RESERVED");
          Object.assign(attempt, {status: "DISPATCHED", dispatchMarker: marker, dispatchedAt: new Date(now()).toISOString()});
          return state;
        });
        await assertCurrent(); attemptAuthority((await latest()).state.attempts.find(a => a.id === id)); fence();
      } catch (error) {
        await store.transact(state => {
          const attempt = state.attempts.find(a => a.id === id);
          if (attempt.status === "RESERVED" || (attempt.status === "DISPATCHED" && attempt.dispatchMarker === marker))
            Object.assign(attempt, {status: "NOT_STARTED", dispatchError: error.message});
          if (error.message === "CYCLE_BASIS_INVALIDATED")
            state.invalidated ??= {observedAt: new Date(now()).toISOString(), reason: error.message};
          return state;
        });
        throw error;
      }
    },
    async settle(id, {reconcile = false} = {}) {
      const before = await latest(), attempt = before.state.attempts.find(a => a.id === id);
      need(attempt && (reconcile ? attempt.status === "UNKNOWN" :
        ["DISPATCHED", "COMPLETED"].includes(attempt.status)), "CYCLE_NOT_DISPATCHED");
      const observed = structuredClone(await observeAttempt(id)); identity(observed);
      if (reconcile) need(observed.state === "STOPPED", "CYCLE_STOPPED_OUTCOME_REQUIRED");
      need(observed.attemptId === id && observed.group === attempt.group && instant(observed.observedAt) &&
        Date.parse(observed.observedAt) >= Date.parse(attempt.dispatchedAt) &&
        Date.parse(observed.observedAt) <= now() &&
        /^[a-f0-9]{64}$/.test(observed.rawDigest) && filled(observed.evidence), "CYCLE_RECEIPT_INVALID");
      const receiptKey = hash(observed);
      if (attempt.status === "COMPLETED") {
        need(before.state.receipts[attempt.group].receiptKey === receiptKey, "CYCLE_RECEIPT_CHANGED");
        return structuredClone(before.state.receipts[attempt.group]);
      }
      let decoded, validationError;
      if (observed.state === "STOPPED") try {
        need(["COMPLETED", "FAILED"].includes(observed.outcome), "CYCLE_OUTCOME_INVALID");
        if (observed.outcome === "COMPLETED") {
          await assertCurrent(); attemptAuthority(attempt);
          need(Date.parse(observed.observedAt) < Date.parse(fixed.expiresAt), "CYCLE_EXPIRED_RECEIPT");
          need(Array.isArray(observed.readbacks) && observed.readbacks.length <= 128 &&
            Buffer.byteLength(canonicalJson(observed.answer ?? null)) <= 65536, "CYCLE_RESULT_CAPACITY");
          validateModelReviewAcquisition(basis.sources, observed.readbacks, basis.requiredSourceIds, basis.sourceScope);
          decoded = validateReviewPart(observed.answer, groups.get(attempt.group), {readbacks: observed.readbacks,
            offer: basis.offer, reviewer: fixed.reviewer, observedAt: observed.observedAt});
          decoded.findings = decoded.findings.filter(f => groups.get(attempt.group).includes(f.checkId));
          await assertCurrent();
        }
      } catch (error) {validationError = error.message; decoded = undefined;}
      const saved = await store.transact(state => {
        const currentAttempt = state.attempts.find(a => a.id === id);
        if (currentAttempt.status === "COMPLETED") {
          need(state.receipts[attempt.group].receiptKey === receiptKey, "CYCLE_RECEIPT_CHANGED"); return state;
        }
        need(currentAttempt.status === (reconcile ? "UNKNOWN" : "DISPATCHED"), "CYCLE_ATTEMPT_CHANGED");
        let accepted = decoded, error = validationError;
        if (accepted) try {attemptAuthority(currentAttempt); fence();}
        catch (e) {error = e.message; accepted = undefined;}
        if (error === "CYCLE_BASIS_INVALIDATED")
          state.invalidated ??= {observedAt: new Date(now()).toISOString(), reason: error};
        currentAttempt.status = observed.state !== "STOPPED" ? "UNKNOWN" : accepted ? "COMPLETED" : "FAILED";
        const metadata = receiptMetadata(observed);
        (currentAttempt.observations ??= currentAttempt.observation ? [currentAttempt.observation] : []).push(metadata);
        currentAttempt.observation = metadata;
        if (error) currentAttempt.validationError = error;
        if (accepted) state.receipts[attempt.group] = {attemptId: id, receiptKey, observed: metadata, decoded: accepted};
        return state;
      });
      const retained = saved.state.attempts.find(a => a.id === id);
      if (retained.validationError) throw Error(retained.validationError);
      if (retained.status === "COMPLETED") try {await assertCurrent(); attemptAuthority(retained); fence();}
      catch (error) {
        if (error.message === "CYCLE_BASIS_INVALIDATED") await store.transact(state => {
          state.invalidated ??= {observedAt: new Date(now()).toISOString(), reason: error.message}; return state;
        });
        throw error;
      }
      return structuredClone(saved.state.receipts[attempt.group] ?? saved.state.attempts.find(a => a.id === id));
    },
    async reconcile(id) {return this.settle(id, {reconcile: true});},
    async recover(priorId, decisionId) {
      const before = await latest(); await assertCurrent(); live();
      const prior = before.state.attempts.find(a => a.id === priorId);
      need(prior?.status === "FAILED" || (prior?.status === "NOT_STARTED" && filled(prior.dispatchError)),
        "CYCLE_STOPPED_FAILURE_REQUIRED");
      const decision = structuredClone(await observeRecovery(decisionId)); identity(decision);
      need(decision.id === decisionId && decision.priorAttempt === priorId && decision.group === prior.group &&
        decision.action === "RETRY" && decision.state === "APPROVED" && filled(decision.evidence) &&
        filled(decision.reviewedBy) && decision.reviewedBy !== fixed.owner && instant(decision.expiresAt) &&
        now() < Date.parse(decision.expiresAt) && Date.parse(decision.expiresAt) <= Date.parse(fixed.expiresAt),
      "CYCLE_RECOVERY_UNAUTHORIZED");
      await assertCurrent(); const id = randomUUID();
      await store.transact(state => {
        live(); need(now() < Date.parse(decision.expiresAt), "CYCLE_RECOVERY_EXPIRED");
        need(state.attempts.filter(a => a.group === prior.group).at(-1)?.id === priorId &&
          !state.attempts.some(a => a.recovery?.id === decisionId), "CYCLE_RECOVERY_REUSED");
        return reserve(state, prior.group, id, decision);
      });
      return id;
    }
  };
}
