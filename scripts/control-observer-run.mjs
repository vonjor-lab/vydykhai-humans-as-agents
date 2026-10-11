// Exactly one tick. A scheduler may invoke this command but is not installed here.
import {open, rename, unlink} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {verifyControlActivation, acquireControlLease} from "./control-activation.mjs";
import {openControlStore} from "./control-store.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {openControlNotification} from "./control-notification.mjs";

const hash = v => sha256(canonicalJson(v));
async function saveReceipt(root, receipt) {
  const body = canonicalJson(receipt) + "\n";
  if(Buffer.byteLength(body) > 16384) throw Error("CONTROL_OBSERVER_RECEIPT_CAPACITY");
  const temp = path.join(root, `.readback-${randomUUID()}`), fd = await open(temp, "wx", 0o600);
  try {await fd.writeFile(body); await fd.sync();} finally {await fd.close();}
  try {await rename(temp, path.join(root, "observer-latest.json"));}
  catch(e) {await unlink(temp); throw e;}
  const dir = await open(root, "r"); try {await dir.sync();} finally {await dir.close();}
}
export async function runControlObserver(descriptorFile,{invocationId}={}) {
  if(invocationId!==undefined&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(invocationId))
    throw Error("CONTROL_OBSERVER_INVOCATION_INVALID");
  const verified = await verifyControlActivation(descriptorFile), root = verified.descriptor.controlRoot.path;
  const notifications = verified.profile.notifications ? await openControlNotification({
    ...verified.profile.notifications,owner:verified.profile.config.owner}) : null;
  const release = await acquireControlLease(root);
  let safeToRelease = false, pauseState = null;
  try {
    // Reverify after acquiring exclusivity, before loading mutable service state.
    const {descriptor, profile, runtime} = await verifyControlActivation(descriptorFile);
    const service = await runtime.service.openControlService(profile);
    pauseState=(await service.host.snapshot()).paused; await service.review.capacity();
    const result = await service.tick();
    const host = await (await openControlStore(profile.directory)).read();
    pauseState=host.state.paused;
    const review = await (await openControlStore(profile.review.directory)).read();
    const unknownRuns = Object.values(review.state.runs).filter(r => r.state !== "STOPPED").length;
    const capacity = await service.review.capacity();
    const actions = {};
    for(const item of result.results) actions[item.action] = (actions[item.action] ?? 0) + 1;
    const receipt = {schema: "control.observer-readback.v1", descriptorHash: hash(descriptor),
      ...(invocationId?{invocationId}:{}),
      observedAt: new Date().toISOString(), status: unknownRuns ? "UNKNOWN_RECONCILIATION_REQUIRED" : "ONE_TICK_OBSERVED",
      owner: profile.config.owner, projectReadiness: "NOT_CERTIFIED", calls: result.calls,
      actions, inboxCount: result.inbox.length, paused: host.state.paused, capacity, unknownRuns,
      ...(result.allowance?{allowance:result.allowance}:{}),
      notificationRoute:notifications ? "DURABLE_PENDING_NOT_DELIVERED" : "NOT_CONFIGURED_NOT_QUALIFIED",
      host: {revision: host.revision, digest: host.digest}, review: {revision: review.revision, digest: review.digest}};
    await saveReceipt(root, receipt);
    if(notifications && !host.state.paused)await notifications.enqueueObservation({receipt,complete:true,
      actionable:[
        ...result.inbox.map(({id,action,reviewKey,followup})=>({id,action,reviewKey:reviewKey??null,...(followup?{followup}:{})})),
        ...(unknownRuns ? [{action:"UNKNOWN_RECONCILIATION_REQUIRED"}] : []),
        ...((capacity.remainingReviews??capacity.remaining)===0 && result.results.some(r=>r.action==="REVIEW_DUE") ? [{action:"REVIEW_BUDGET_EXHAUSTED"}] : [])]});
    if(service.ownerDelivery) {
      receipt.ownerDelivery=await service.ownerDelivery.deliver();
      receipt.ownerCapacity=await service.ownerDelivery.capacity();
      receipt.notificationRoute=receipt.ownerDelivery.status;
      if(receipt.ownerCapacity.unknownRuns)receipt.status="UNKNOWN_RECONCILIATION_REQUIRED";
      const current=await (await openControlStore(profile.directory)).read();
      receipt.host={revision:current.revision,digest:current.digest};
      await saveReceipt(root,receipt);
    }
    if(!unknownRuns&&!receipt.ownerCapacity?.unknownRuns&&profile.continuation) {
      receipt.continuation=await service.continueRegistered();
      const current=await (await openControlStore(profile.directory)).read();
      receipt.host={revision:current.revision,digest:current.digest};
      receipt.unknownActions=Object.values(current.state.reservations).filter(r=>r.status==="IN_FLIGHT").length;
      if(receipt.unknownActions)receipt.status="UNKNOWN_RECONCILIATION_REQUIRED";
      await saveReceipt(root,receipt);
      if(notifications&&!current.state.paused)await notifications.enqueueObservation({receipt,complete:true,
        actionable:[...(await service.owner.inbox()).map(({id,action,reviewKey,followup})=>
          ({id,action,reviewKey:reviewKey??null,...(followup?{followup}:{})})),
          ...(receipt.unknownActions?[{action:"UNKNOWN_RECONCILIATION_REQUIRED"}]:[])]});
    }
    safeToRelease = unknownRuns === 0 && !receipt.ownerCapacity?.unknownRuns && !receipt.unknownActions;
    return receipt;
  } catch(e) {
    // Failure after service entry may follow dispatch. Keep ownership, never replay.
    const receipt = {schema: "control.observer-readback.v1", status: "UNKNOWN_RECONCILIATION_REQUIRED",
      ...(invocationId?{invocationId}:{}),
      observedAt: new Date().toISOString(), owner: verified.profile.config.owner,
      descriptorHash:hash(verified.descriptor),projectReadiness: "NOT_CERTIFIED", error: String(e.message).slice(0, 512)};
    await saveReceipt(root, receipt);
    pauseState=await openControlStore(verified.profile.directory).then(store=>store.read()).then(row=>row?.state?.paused??null).catch(()=>null);
    if(notifications && pauseState===false)await notifications.enqueueObservation({receipt,complete:false,
      actionable:[{action:receipt.status,error:receipt.error}]}).catch(()=>{});
    throw e;
  } finally {if(safeToRelease) await release();}
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {process.stdout.write(JSON.stringify(await runControlObserver(process.argv[2],{invocationId:process.argv[3]})) + "\n");}
  catch(e) {process.stderr.write(String(e.message) + "\n"); process.exitCode = 1;}
}
