// Trusted operator recovery, never a worker tool or automatic lease timeout.
// Unknown model/tool outcomes remain owned; this path cannot authorize retries.
import {mkdir, open, unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {verifyControlActivation, readActivationJson} from "./control-activation.mjs";
import {openControlStore} from "./control-store.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if(!value)throw Error(code);};
const filled = value => typeof value === "string" && !!value.trim();
const pending = state => Object.values(state.reservations ?? {}).filter(r => r.status === "IN_FLIGHT");
async function snapshot(descriptorFile) {
  const {descriptor, profile} = await verifyControlActivation(descriptorFile);
  const root = descriptor.controlRoot.path;
  const lease = await readActivationJson(path.join(root, "observer.lease"));
  need(filled(lease.token) && Number.isSafeInteger(lease.pid) && lease.pid > 0, "CONTROL_RECOVERY_LEASE_INVALID");
  const host = await (await openControlStore(profile.directory)).read();
  const review = await (await openControlStore(profile.review.directory)).read();
  const owner = profile.ownerDelivery ? await (await openControlStore(profile.ownerDelivery.directory)).read() : null;
  need(!profile.ownerDelivery || owner?.state.schema==="control.owner-delivery.v1", "CONTROL_RECOVERY_JOURNAL_MISSING");
  need(host && review && host.state.configKey && review.state.configKey &&
    review.state.schema === "control.model-review.v1", "CONTROL_RECOVERY_JOURNAL_MISSING");
  const value = {descriptorHash: hash(descriptor), lease,
    host: {revision:host.revision,digest:host.digest}, review: {revision:review.revision,digest:review.digest},
    ...(owner ? {owner:{revision:owner.revision,digest:owner.digest}} : {}),
    unknownRuns:[...Object.values(review.state.runs),...Object.values(owner?.state.runs??{})].filter(r => r.state !== "STOPPED").length,
    unknownEffects:pending(host.state).length};
  return {root, value, key:hash(value)};
}
export async function inspectControlRecovery(descriptorFile) {
  const {value,key} = await snapshot(descriptorFile);
  return {...value,key,status:"RECONCILIATION_REQUIRED",automaticRetry:false};
}
async function processAbsent(pid) {
  try {process.kill(pid, 0); return false;} catch(e) {if(e.code === "ESRCH")return true; throw e;}
}
export async function recoverStoppedControlObserver({descriptorFile, expectedKey, actor, evidence, observeStop}) {
  need(filled(actor) && filled(evidence) && typeof observeStop === "function",
    "CONTROL_RECOVERY_INDEPENDENT_OBSERVER_REQUIRED");
  const before = await snapshot(descriptorFile);
  need(before.key === expectedKey, "CONTROL_RECOVERY_STATE_CHANGED");
  need(before.value.unknownRuns === 0 && before.value.unknownEffects === 0, "CONTROL_RECOVERY_OUTCOME_UNKNOWN");
  // Supplied by a trusted process supervisor after actual close/readback. This
  // callback is not serializable in an owner/worker request or a model verdict.
  const observation = await observeStop(structuredClone(before.value.lease));
  need(observation?.state === "STOPPED" && observation.pid === before.value.lease.pid &&
    observation.token === before.value.lease.token && filled(observation.evidence) &&
    await processAbsent(before.value.lease.pid), "CONTROL_RECOVERY_STOP_UNPROVEN");
  const marker = path.join(before.root,"observer-recovery.lease"), token = randomUUID();
  const fd = await open(marker,"wx",0o600).catch(e => {
    if(e.code === "EEXIST")throw Error("CONTROL_RECOVERY_ALREADY_OWNED"); throw e;
  });
  try {await fd.writeFile(canonicalJson({token, pid:process.pid, expectedKey})+"\n");await fd.sync();}
  finally {await fd.close();}
  try {
    const current = await snapshot(descriptorFile);
    need(current.key === expectedKey, "CONTROL_RECOVERY_STATE_CHANGED");
    const directory = path.join(before.root,"observer-recovery");
    await mkdir(directory,{mode:0o700}).catch(e => {if(e.code !== "EEXIST")throw e;});
    const store = await openControlStore(directory);
    if(!await store.read())await store.initialize({schema:"control.observer-recovery.v1",events:[]});
    const record = {key:expectedKey, snapshot:before.value, actor,evidence,observation,
      recordedAt:new Date().toISOString(), action:"RELEASE_STOPPED_OBSERVER_ONLY",automaticRetry:false};
    const row = await store.transact(s => {
      need(s.schema === "control.observer-recovery.v1","CONTROL_RECOVERY_JOURNAL_INVALID");
      if(!s.events.some(e => e.key === expectedKey))s.events.push(record);return s;
    });
    need((await snapshot(descriptorFile)).key === expectedKey,"CONTROL_RECOVERY_STATE_CHANGED");
    await unlink(path.join(before.root,"observer.lease"));
    const dir = await open(before.root,"r");try{await dir.sync();}finally{await dir.close();}
    return {status:"OBSERVER_RELEASED", recoveryDigest:row.digest, automaticRetry:false,
      host:before.value.host,review:before.value.review};
  } finally {
    need((await readActivationJson(marker)).token === token,"CONTROL_RECOVERY_OWNERSHIP_CHANGED");
    await unlink(marker);
  }
}
