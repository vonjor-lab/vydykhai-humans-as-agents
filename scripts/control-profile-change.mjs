// Trusted paused setup only. New allocations never overwrite old run journals.
import {open, lstat, rename, unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {controlDirectory, readActivationJson, verifyControlActivation, acquireControlLease,
  validateControlProfilePaths,controlProfilePath} from "./control-activation.mjs";
import {inspectQuiescentControlJournals, observeStoppedControlSchedule} from "./control-cutover.mjs";
import {controlSchedulePlan} from "./control-schedule.mjs";
import {runControlChild} from "./control-child.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {openControlStore} from "./control-store.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (v, code) => {if (!v) throw Error(`CONTROL_PROFILE_${code}`);};
const filled = v => typeof v === "string" && !!v.trim() && v.length <= 512;
const marker = root => path.join(root, "observer-recovery.lease");
async function sync(root) {
  const fd = await open(root, "r"); try {await fd.sync();} finally {await fd.close();}
}
async function absent(file) {
  try {await lstat(file); return false;} catch(e) {if(e.code === "ENOENT") return true; throw e;}
}
async function create(file, value) {
  const body = canonicalJson(value) + "\n";
  need(Buffer.byteLength(body) <= 1024 * 1024, "CAPACITY");
  const fd = await open(file, "wx", 0o400);
  try {await fd.writeFile(body); await fd.sync();} finally {await fd.close();}
}
async function publish(file, value, expected) {
  const temp = path.join(path.dirname(file), `.profile-intent-${randomUUID()}`);
  try {
    await create(temp, value);
    if(expected) need(hash(await readActivationJson(file)) === expected, "INTENT_CHANGED");
    else need(await absent(file), "INTENT_EXISTS");
    await rename(temp, file); await sync(path.dirname(file));
  } finally {if(!await absent(temp)) await unlink(temp);}
}
const bindings = rows => Object.fromEntries(Object.entries(rows).map(([id,row]) =>
  [id,{revision:row.revision,digest:row.digest}]));
async function select(file, expected, descriptor) {
  need(hash(await readActivationJson(file)) === expected, "DESCRIPTOR_CHANGED");
  const temp = path.join(path.dirname(file), `.profile-select-${randomUUID()}`);
  try {
    await create(temp, descriptor);
    need(hash(await readActivationJson(file)) === expected, "DESCRIPTOR_CHANGED");
    await rename(temp, file); await sync(path.dirname(file));
  } finally {if(!await absent(temp))await unlink(temp);}
}
const nativeSchedule = plan => runControlChild({executable:"/bin/launchctl",args:["print",plan.target],
  cwd:"/",env:{PATH:"/usr/bin:/bin"},input:"",timeoutMs:10000,maxBytes:128*1024});
function allocation(value, profile) {
  need(value && value.maxCalls === profile.maxCalls && value.expiresAt === profile.expiresAt &&
    Number.isSafeInteger(value.maxCalls) && value.maxCalls > 0 && value.maxCalls <= 20 &&
    Date.parse(value.expiresAt) > Date.now() && filled(value.evidence), "NEW_ALLOCATION_REQUIRED");
}
function policy(old, next, allocations) {
  need(next?.schema === old.schema && next.directory === old.directory &&
    hash(next.config) === hash(old.config), "HOST_CHANGE_FORBIDDEN");
  need(next.review.controlRoot === old.review.controlRoot && next.review.reviewer === old.review.reviewer &&
    next.review.sourceFile === old.review.sourceFile &&
    (next.review.native.authHome ?? next.review.native.home) ===
      (old.review.native.authHome ?? old.review.native.home), "REVIEW_IDENTITY_CHANGED");
  if(hash(next.review) !== hash(old.review)) {
    need(next.review.directory !== old.review.directory, "OLD_ALLOCATION_IMMUTABLE");
    allocation(allocations?.review, next.review);
  } else need(allocations?.review === undefined, "UNUSED_ALLOCATION");
  need(!old.notifications || hash(old.notifications) === hash(next.notifications ?? null), "NOTIFICATION_CHANGE_FORBIDDEN");
  if(old.ownerDelivery && hash(old.ownerDelivery) !== hash(next.ownerDelivery ?? null)) {
    need(!old.ownerDelivery.waits,"OWNER_SESSION_ALLOCATION_IMMUTABLE");
    need(next.ownerDelivery && next.ownerDelivery.directory !== old.ownerDelivery.directory,
      "OLD_OWNER_ALLOCATION_IMMUTABLE");
    // Renew capacity, never the delegate's authority or execution identity.
    const identity = ({directory,maxCalls,expiresAt,...rest}) => rest;
    need(hash(identity(old.ownerDelivery)) === hash(identity(next.ownerDelivery)), "OWNER_IDENTITY_CHANGED");
    allocation(allocations?.owner,next.ownerDelivery);
  } else if(next.ownerDelivery && !old.ownerDelivery) allocation(allocations?.owner, next.ownerDelivery);
  else need(allocations?.owner === undefined, "UNUSED_OWNER_ALLOCATION");
}
async function unchanged(intent) {
  need(hash(bindings(await inspectQuiescentControlJournals(intent.oldProfile))) === hash(intent.oldJournals), "OLD_JOURNALS_CHANGED");
  if(intent.nextJournals) need(hash(bindings(await inspectQuiescentControlJournals(intent.nextProfile))) === hash(intent.nextJournals), "NEW_JOURNALS_CHANGED");
}
async function finish(root, intent, release) {
  need(hash(await readActivationJson(marker(root))) === hash(intent), "INTENT_CHANGED");
  await unlink(marker(root)); await sync(root); await release();
}
async function stage(intent) {
  await unchanged(intent);
  await validateControlProfilePaths(intent.root,intent.nextProfile,true);
  const selected = await verifyControlActivation(intent.descriptorFile);
  const service = await selected.runtime.service.openControlService(intent.nextProfile);
  for(const [id,profile,oldProfile,reader] of [
    ["review",intent.nextProfile.review,intent.oldProfile.review,service.review],
    ["owner",intent.nextProfile.ownerDelivery,intent.oldProfile.ownerDelivery,service.ownerDelivery]]) {
    if(!profile || oldProfile && hash(profile) === hash(oldProfile)) continue;
    const store = await openControlStore(profile.directory);
    if(!await store.read()) await reader.initialize();
    await reader.capacity();
    const row = await store.read();
    need(row.revision === 0 && row.state.calls === 0 && Object.keys(row.state.runs).length === 0, "STAGED_ALLOCATION_USED");
  }
  if(intent.nextProfile.notifications && !intent.oldProfile.notifications) {
    const {openControlNotification} = await import("./control-notification.mjs");
    const reader = await openControlNotification({...intent.nextProfile.notifications,owner:intent.nextProfile.config.owner});
    await reader.initialize(); const row = await reader.snapshot();
    need(row.revision === 0 && row.state.writes === 0 && row.state.notices.length === 0, "STAGED_NOTIFICATIONS_USED");
  }
  const nextJournals = bindings(await inspectQuiescentControlJournals(intent.nextProfile));
  if(intent.nextJournals) need(hash(nextJournals) === hash(intent.nextJournals), "NEW_JOURNALS_CHANGED");
  const next = {...intent,phase:"STAGED",nextJournals};
  if(hash(next) !== hash(intent)) await publish(marker(intent.root),next,hash(intent));
  if(await absent(next.next.profileFile)) await publish(next.next.profileFile,next.nextProfile);
  need(hash(await readActivationJson(next.next.profileFile)) === next.next.profileHash &&
    !((await lstat(next.next.profileFile)).mode & 0o222), "PROFILE_CHANGED");
  return next;
}
async function advance(intent, readSchedule) {
  intent = await stage(intent);
  await observeStoppedControlSchedule(intent.plans,readSchedule); await unchanged(intent);
  const selected = hash(await readActivationJson(intent.descriptorFile));
  need([hash(intent.old),hash(intent.next)].includes(selected), "DESCRIPTOR_CHANGED");
  if(selected === hash(intent.old)) await select(intent.descriptorFile,selected,intent.next);
  await verifyControlActivation(intent.descriptorFile); await unchanged(intent);
  return intent;
}
async function archive(intent) {
  const file = path.join(intent.root,`profile-change-${hash(intent)}.json`);
  if(await absent(file)) await publish(file,intent);
  need(hash(await readActivationJson(file)) === hash(intent) && !((await lstat(file)).mode & 0o222), "ARCHIVE_CHANGED");
  return file;
}

export async function changeControlProfile({descriptorFile, expectedDescriptorHash, profile, allocations = {},
  actor, evidence, resumeFrom, noRacingSchedulerOperators, noConcurrentStateWriters}, {readSchedule = nativeSchedule} = {}) {
  need(filled(actor) && filled(evidence) && noRacingSchedulerOperators === true &&
    noConcurrentStateWriters === true && typeof readSchedule === "function", "OPERATOR_APPROVAL_REQUIRED");
  const verified = await verifyControlActivation(descriptorFile), root = verified.descriptor.controlRoot.path;
  need(Object.hasOwn(verified.runtime.identity.description.files, "scripts/control-profile-change.mjs"), "RUNTIME_UNSUPPORTED");
  const nextProfile = JSON.parse(canonicalJson(profile));
  policy(verified.profile, nextProfile, allocations);
  const release = await acquireControlLease(root);
  let intent;
  try {
    const current = await verifyControlActivation(descriptorFile);
    need(hash(current.descriptor) === expectedDescriptorHash &&
      hash(current.descriptor) === hash(verified.descriptor), "DESCRIPTOR_CHANGED");
    const plans = await Promise.all(["SESSION","LOGIN"].map(mode => controlSchedulePlan({descriptorFile,mode})));
    await observeStoppedControlSchedule(plans, readSchedule);
    const oldJournals = bindings(await inspectQuiescentControlJournals(current.profile));
    await validateControlProfilePaths(root,nextProfile,false,true);
    const profileHash = hash(nextProfile), profileFile = path.join(root, `service-${profileHash}.json`);
    let previous;
    if(resumeFrom) {
      need(/^[a-f0-9]{64}$/.test(resumeFrom), "RESUME_KEY_INVALID");
      const file = path.join(root,`profile-change-${resumeFrom}.json`);
      previous = await readActivationJson(file);
      need(!((await lstat(file)).mode & 0o222) && hash(previous) === resumeFrom && previous.root === root &&
        hash(previous.old) === hash(current.descriptor) && hash(previous.nextProfile) === profileHash &&
        hash(previous.allocations) === hash(allocations) && hash(previous.oldJournals) === hash(oldJournals), "RESUME_MISMATCH");
    } else {
      need(await absent(profileFile), "PROFILE_ALREADY_EXISTS");
      for(const [id,p,old] of [["REVIEW",nextProfile.review,current.profile.review],
        ["OWNER",nextProfile.ownerDelivery,current.profile.ownerDelivery],
        ["NOTIFICATION",nextProfile.notifications,current.profile.notifications]]) {
        if(p && (!old || p.directory !== old.directory) && !await absent(p.directory))
          need(!await (await openControlStore(p.directory)).read(), `NEW_${id}_JOURNAL_EXISTS`);
      }
    }
    const next = {...current.descriptor,profileFile,profileHash};
    intent = {schema:"control.profile-change.v1",phase:"PREPARED",root,descriptorFile,pid:process.pid,token:randomUUID(),
      old:current.descriptor,next,oldProfile:current.profile,nextProfile,oldJournals,nextJournals:previous?.nextJournals ?? null,
      actor,evidence,allocations,plans,lease:await readActivationJson(path.join(root,"observer.lease"))};
    await publish(marker(root), intent);
    intent = await advance(intent,readSchedule);
    await archive(intent);
    await finish(root,intent,release);
  } catch(error) {
    if(await absent(marker(root))) {await release(); throw error;}
    const held = Error("CONTROL_PROFILE_RECONCILIATION_REQUIRED",{cause:error});
    held.intentKey = hash(await readActivationJson(marker(root))); throw held;
  }
  return {status:"PROFILE_CHANGED_PAUSED",projectReadiness:"NOT_CERTIFIED",paused:true,
    previousDescriptorHash:expectedDescriptorHash,descriptorHash:hash(intent.next),
    historyFile:path.join(root,`profile-change-${hash(intent)}.json`),allocations,
    oldJournalsPreserved:true,scheduler:"STOPPED_NOT_RESTARTED",automaticRetry:false};
}

export async function recoverControlProfileChange({descriptorFile, expectedIntentKey, actor, evidence, action = "ROLLBACK",
  noRacingSchedulerOperators, noConcurrentStateWriters}, {observeStop, readSchedule = nativeSchedule} = {}) {
  need(filled(actor) && filled(evidence) && noRacingSchedulerOperators === true &&
    noConcurrentStateWriters === true && typeof observeStop === "function", "OPERATOR_APPROVAL_REQUIRED");
  const root = path.dirname(descriptorFile); await controlDirectory(root);
  need(descriptorFile === path.join(root,"activation.json"), "DESCRIPTOR_PATH_INVALID");
  let intent = await readActivationJson(marker(root));
  need(!((await lstat(marker(root))).mode & 0o222) && intent.schema === "control.profile-change.v1" &&
    intent.root === root && intent.descriptorFile === descriptorFile && ["PREPARED","STAGED"].includes(intent.phase) &&
    ["ROLLBACK","RESUME"].includes(action) && hash(intent) === expectedIntentKey &&
    intent.pid === intent.lease?.pid && Number.isSafeInteger(intent.pid) && intent.pid > 0 &&
    filled(intent.token) && filled(intent.lease.token) && controlProfilePath(root,intent.old) && controlProfilePath(root,intent.next) &&
    hash(intent.old.controlRoot) === hash(await controlDirectory(root)) &&
    hash({...intent.old,profileFile:intent.next.profileFile,profileHash:intent.next.profileHash}) === hash(intent.next) &&
    hash(intent.oldProfile) === intent.old.profileHash && hash(intent.nextProfile) === intent.next.profileHash &&
    intent.next.profileFile === path.join(root,`service-${intent.next.profileHash}.json`), "INTENT_INVALID");
  await validateControlProfilePaths(root,intent.oldProfile);
  policy(intent.oldProfile,intent.nextProfile,intent.allocations);
  const stop = await observeStop({pid:intent.pid,token:intent.token,lease:intent.lease});
  let stopped = false;
  try {process.kill(intent.pid,0);} catch(e) {if(e.code === "ESRCH")stopped=true; else throw e;}
  need(stopped && stop?.state === "STOPPED" && stop.pid === intent.pid && stop.token === intent.token &&
    filled(stop.evidence), "STOP_UNPROVEN");
  const guard = path.join(root,"profile-change-recovery.lease");
  await create(guard,{pid:process.pid,token:randomUUID()});
  try {
    need(hash(await readActivationJson(marker(root))) === expectedIntentKey, "INTENT_CHANGED");
    const lease = path.join(root,"observer.lease");
    if(!await absent(lease)) need(hash(await readActivationJson(lease)) === hash(intent.lease), "LEASE_CHANGED");
    await unchanged(intent); await observeStoppedControlSchedule(intent.plans,readSchedule);
    const selected = hash(await readActivationJson(descriptorFile));
    need([hash(intent.old),hash(intent.next)].includes(selected), "DESCRIPTOR_CHANGED");
    if(action === "RESUME") intent = await advance(intent,readSchedule);
    else {
      intent = await stage(intent);
      if(selected === hash(intent.next)) await select(descriptorFile,selected,intent.old);
    }
    await verifyControlActivation(descriptorFile);
    await unchanged(intent); const historyFile = await archive(intent);
    if(!await absent(lease)) await unlink(lease);
    await unlink(marker(root)); await sync(root);
    return {status:action === "RESUME" ? "PROFILE_CHANGED_PAUSED" : "PROFILE_ROLLED_BACK_PAUSED",
      projectReadiness:"NOT_CERTIFIED",historyPreserved:true,automaticRetry:false,actor,evidence,historyFile,resumeFrom:hash(intent)};
  } finally {await unlink(guard); await sync(root);}
}
