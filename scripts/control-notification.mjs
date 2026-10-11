// Local evidence journal only: no transport, alerts, model calls or readiness certification.
// TRUST BOUNDARY: all callers/files are the trusted host. Actor strings and hashes
// bind evidence; they do not authenticate a process or prove an external event.
// Never expose these mutators to a model. The host must independently observe
// transport consumption / owner application before recording either fact.
import {randomUUID} from "node:crypto";
import {controlDirectory} from "./control-activation.mjs";
import {openControlStore} from "./control-store.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => { if (!value) throw Error(`CONTROL_NOTIFICATION_${code}`); };
const text = value => typeof value === "string" && value.trim().length > 0 && value.length <= 512;
const bounded = (value, max) => Number.isInteger(value) && value > 0 && value <= max;
const now = () => new Date().toISOString();
const copy = value => JSON.parse(canonicalJson(value));
const MAX_STATE_BYTES = 256 * 1024;

// Use a dedicated existing private directory, never the host/review journal.
// Limits are a finite allocation, persisted at initialization and never replenished
// on reopen. Exhaustion requires host reconciliation; nothing is evicted.
export async function openControlNotification({directory, owner, transportActor,
  maxNotices = 32, maxAttempts = 8, maxRevisions = 256}) {
  need(text(owner) && text(transportActor) && owner !== transportActor, "ACTORS_INVALID");
  need(bounded(maxNotices, 128) && bounded(maxAttempts, 32) && bounded(maxRevisions, 1024), "LIMITS_INVALID");
  const config = {owner, transportActor, maxNotices, maxAttempts, maxRevisions};
  const identity = await controlDirectory(directory);
  const store = await openControlStore(directory);
  const checkDirectory = async () => {
    need(hash(await controlDirectory(directory)) === hash(identity), "DIRECTORY_CHANGED");
  };
  const validate = state => {
    need(state?.schema === "control.notification-outbox.v1" && hash(state.config) === hash(config) &&
      hash(state.directory) === hash(identity), "CONFIG_MISMATCH");
    need(Number.isInteger(state.writes) && state.writes >= 0 && state.writes < maxRevisions &&
      Array.isArray(state.notices) && state.notices.length <= maxNotices &&
      Buffer.byteLength(canonicalJson(state)) <= MAX_STATE_BYTES, "STATE_INVALID");
    for (const notice of state.notices) {
      need(notice.noticeHash === hash(notice.body) && notice.body.owner === owner &&
        Array.isArray(notice.attempts) && notice.attempts.length <= maxAttempts, "NOTICE_INVALID");
    }
  };
  const read = async () => {
    const row = await store.read();
    need(row, "NOT_INITIALIZED");
    validate(row.state);
    need(row.revision === row.state.writes, "HISTORY_INVALID");
    return row;
  };
  const transact = async update => {
    await checkDirectory();
    return store.transact(state => {
      validate(state);
      const before = hash(state);
      update(state);
      if (hash(state) !== before) {
        need(state.writes + 1 < maxRevisions, "REVISION_CAPACITY");
        state.writes++;
        need(Buffer.byteLength(canonicalJson(state)) <= MAX_STATE_BYTES, "STATE_CAPACITY");
      }
      return state;
    });
  };
  const find = (state, input, actor) => {
    need(input?.actor === actor, "ACTOR_MISMATCH");
    const notice = state.notices.find(n => n.body.id === input.id);
    need(notice && notice.noticeHash === input.noticeHash, "NOTICE_MISMATCH");
    return notice;
  };
  const attempt = (notice, input) => {
    const current = notice.attempts.at(-1);
    need(current && current.id === input.attemptId, "ATTEMPT_MISMATCH");
    return current;
  };
  const record = async (kind, input) => {
    input = copy(input);
    need(text(input.evidence), "EVIDENCE_REQUIRED");
    const at = now();
    const row = await transact(state => {
      const notice = find(state, input, kind === "transportObserved" ? transportActor : owner);
      const current = attempt(notice, input);
      const binding = {id: input.id, noticeHash: input.noticeHash, attemptId: input.attemptId,
        actor: input.actor, evidence: input.evidence};
      if (notice[kind]) {
        const {recordedAt, ...saved} = notice[kind];
        need(hash(saved) === hash(binding), "EVIDENCE_CONFLICT");
        return;
      }
      if (kind === "ownerApplied") need(notice.transportObserved, "TRANSPORT_EVIDENCE_REQUIRED");
      else current.status = "TRANSPORT_OBSERVED";
      notice[kind] = {...binding, recordedAt: at};
    });
    return row.state.notices.find(n => n.body.id === input.id);
  };
  return {
    async initialize() {
      await checkDirectory();
      const old = await store.read();
      if (old) return read();
      try {
        return await store.initialize({schema: "control.notification-outbox.v1",
          trustBoundary: "TRUSTED_HOST_ONLY_NO_MODEL_ATTESTATION", directory: identity, config,
          writes: 0, observationKey: null, lastNoticeId: null, notices: []});
      } catch (error) {
        if (error.message !== "CONTROL_ALREADY_INITIALIZED") throw error;
        return read();
      }
    },
    async snapshot() {
      await checkDirectory();
      const row = await read(), notices = row.state.notices;
      return {...row, pendingDelivery: notices.filter(n => !n.supersededBy && !n.transportObserved).length,
        pendingOwnerApplication: notices.filter(n => !n.supersededBy && !n.ownerApplied).length};
    },
    // Caller supplies the bounded semantic projection (e.g. inbox rows + failures).
    // Receipt timestamps, revision/call counters are deliberately not dedup keys.
    // Empty projection clears the episode; a later recurrence gets a new notice.
    async enqueueObservation({receipt, actionable, complete = false}) {
      receipt = copy(receipt); actionable = copy(actionable);
      need(typeof complete === "boolean", "COMPLETENESS_INVALID");
      need(receipt?.schema === "control.observer-readback.v1" && receipt.owner === owner &&
        text(receipt.status) && Buffer.byteLength(canonicalJson(receipt)) <= 16384, "RECEIPT_INVALID");
      need(Array.isArray(actionable) && actionable.length <= 32 &&
        Buffer.byteLength(canonicalJson(actionable)) <= 8192, "OBSERVATION_INVALID");
      if(!complete && actionable.length===0) {await read();return {queued:false,notice:null};}
      const key = actionable.length ? hash({owner, descriptorHash: receipt.descriptorHash ?? null, actionable,complete}) : null;
      const id = randomUUID(), at = now();
      let queued = false;
      const row = await transact(state => {
        queued = false;
        if (state.observationKey === key) return;
        // Supersession is a new host observation, NOT delivery, application or
        // finding closure. Incomplete/error-only observation cannot replace any
        // outstanding obligation. Original notice bodies always remain immutable.
        if(complete)for(const previous of state.notices.filter(n=>!n.supersededBy))
          previous.supersededBy={observationKey:key,nextNoticeId:key===null?null:id,receiptHash:hash(receipt),observedAt:at};
        state.observationKey = key;
        state.lastNoticeId = null;
        if (key === null) return;
        need(state.notices.length < maxNotices, "NOTICE_CAPACITY");
        const body = {schema: "control.notification-notice.v1", id, owner, observationKey: key,
          createdAt: at, actionable, complete, receipt, receiptHash: hash(receipt)};
        state.notices.push({body, noticeHash: hash(body), attempts: [], transportObserved: null, ownerApplied: null});
        state.lastNoticeId = id;
        queued = true;
      });
      return {queued, notice: row.state.notices.find(n => n.body.id === row.state.lastNoticeId) ?? null};
    },
    // Persist the claim BEFORE touching any transport. A lost claim stays pending;
    // restart never steals it. Trusted host reconciliation records failure explicitly.
    async beginDelivery(input) {
      input = copy(input);
      const id = randomUUID(), at = now();
      const row = await transact(state => {
        const notice = find(state, input, transportActor);
        need(!notice.transportObserved, "ALREADY_OBSERVED");
        need(notice.attempts.at(-1)?.status !== "STARTED", "DELIVERY_IN_FLIGHT");
        need(notice.attempts.length < maxAttempts, "ATTEMPT_CAPACITY");
        notice.attempts.push({id, actor: transportActor, startedAt: at, status: "STARTED", failure: null});
      });
      return {id: input.id, noticeHash: input.noticeHash, actor: transportActor, attemptId: id,
        notice: row.state.notices.find(n => n.body.id === input.id)};
    },
    async recordDeliveryFailure(input) {
      input = copy(input);
      need(text(input.error), "FAILURE_REQUIRED");
      const at = now();
      const row = await transact(state => {
        const notice = find(state, input, transportActor), current = attempt(notice, input);
        // A racing failure must never erase positive transport or owner evidence.
        if (notice.transportObserved) return;
        if (current.failure) {
          need(current.failure.error === input.error, "EVIDENCE_CONFLICT");
          return;
        }
        current.status = "FAILED";
        current.failure = {actor: transportActor, error: input.error, recordedAt: at};
      });
      return row.state.notices.find(n => n.body.id === input.id);
    },
    recordTransportObserved: input => record("transportObserved", input),
    recordOwnerApplied: input => record("ownerApplied", input)
  };
}
