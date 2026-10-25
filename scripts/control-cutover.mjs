// Trusted operator API only. Same-profile paused observers, not a hot swap,
// schema migration, scheduler registration, unpause or project adoption.
// Packages are trusted reviewed code; content hashes do not sandbox imports.
import {lstat, open, readFile, rename, unlink, realpath} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {controlDirectory, readActivationJson, verifyControlActivation, acquireControlLease, assertObserverRuntime, controlProfilePath} from "./control-activation.mjs";
import {verifyControlRuntime, loadControlRuntime} from "./control-runtime.mjs";
import {controlSchedulePlan, matchesControlRegistration} from "./control-schedule.mjs";
import {openControlStore} from "./control-store.mjs";
import {settledCommandHistory} from "./control-migration.mjs";
import {runControlChild} from "./control-child.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if (!value) throw Error(`CONTROL_CUTOVER_${code}`);};
const filled = v => typeof v === "string" && !!v.trim() && v.length <= 512;
const isDigest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const inside = (a, b) => a === b || b.startsWith(a + path.sep);
const markerFor = root => path.join(root, "observer-recovery.lease");
async function exists(file) {
  try {await lstat(file); return true;} catch (e) {if (e.code === "ENOENT") return false; throw e;}
}
async function sync(root) {
  const fd = await open(root, "r"); try {await fd.sync();} finally {await fd.close();}
}
async function create(file, bytes) {
  const fd = await open(file, "wx", 0o400);
  try {await fd.writeFile(bytes); await fd.sync();} finally {await fd.close();}
}
async function replace(descriptorFile, expectedHash, bytes) {
  need(hash(await readActivationJson(descriptorFile)) === expectedHash, "DESCRIPTOR_CHANGED");
  const temp = path.join(path.dirname(descriptorFile), `.cutover-${randomUUID()}`);
  try {
    await create(temp, bytes);
    need(hash(await readActivationJson(descriptorFile)) === expectedHash, "DESCRIPTOR_CHANGED");
    await rename(temp, descriptorFile); await sync(path.dirname(descriptorFile));
  } finally {if (await exists(temp)) await unlink(temp);}
}
async function nativeSchedule(plan) {
  return runControlChild({executable: "/bin/launchctl", args: ["print", plan.target], cwd: "/",
    env: {PATH: "/usr/bin:/bin"}, input: "", timeoutMs: 10000, maxBytes: 128 * 1024});
}
async function noScheduleFiles(plans) {
  // Check BOTH possible owned plist locations; never stop/remove a job or file.
  for (const plan of plans) if (await exists(plan.file)) {
    const s = await lstat(plan.file);
    need(s.isFile() && !s.isSymbolicLink() && s.uid === process.getuid() && !(s.mode & 0o077) &&
      await realpath(plan.file) === plan.file && await readFile(plan.file, "utf8") === plan.plist,
    "SCHEDULE_FILE_CONFLICT");
    need(false, "SCHEDULE_STOP_REQUIRED");
  }
}
async function stoppedSchedule(plans, readSchedule) {
  const plan = plans[0]; let r;
  // Detect changes during a transport observation. This finite readback is NOT
  // exclusion of a registrar; the operator must separately guarantee no races.
  for (let observation = 0; observation < 2; observation++) {
    await noScheduleFiles(plans);
    r = await readSchedule(structuredClone(plan));
    need(r?.state === "CLOSED" && !r.reason, "SCHEDULE_OBSERVATION_UNKNOWN");
    if (r.code === 0) {
      need(plans.some(p => matchesControlRegistration(r.output, p)), "SCHEDULE_REGISTRATION_CONFLICT");
      need(false, "SCHEDULE_STOP_REQUIRED");
    }
    need(r.code === 113 && typeof r.errors === "string" &&
      r.errors.includes(`Could not find service "${plan.label}"`), "SCHEDULE_STOP_UNPROVEN");
    await noScheduleFiles(plans);
  }
  return {status: "UNREGISTERED", target: plan.target, label: plan.label,
    descriptorHash: plan.descriptorHash, observedAt: new Date().toISOString(), errorsHash: sha256(r.errors)};
}
async function journals(profile) {
  const dirs = {host: profile.directory, review: profile.review.directory,
    ...(profile.ownerDelivery ? {owner: profile.ownerDelivery.directory} : {}),
    ...(profile.notifications ? {notifications: profile.notifications.directory} : {})};
  const rows = {};
  for (const [id, dir] of Object.entries(dirs)) {
    await controlDirectory(dir);
    rows[id] = await (await openControlStore(dir)).read();
    need(rows[id], "JOURNAL_MISSING");
  }
  const h = rows.host.state;
  need(h.schema === "control.host.v2" && h.configKey === hash(profile.config) && h.health &&
    record(h.acceptances) && record(h.reservations), "HOST_SCHEMA_OR_CONFIG_MISMATCH");
  need(h.paused === true, "PAUSE_REQUIRED");
  need([h.health, ...Object.values(h.acceptances)].every(r => record(r) && r.reviewLease === null &&
    !["REVIEW_IN_FLIGHT", "REVIEW_RECONCILIATION_REQUIRED"].includes(r.enrollment)), "REVIEW_NOT_QUIESCENT");
  need(await settledCommandHistory(await openControlStore(profile.directory), rows.host, profile.config), "ACTION_OUTCOME_UNKNOWN");
  for (const [id, schema] of [["review", "control.model-review.v1"], ["owner", "control.owner-delivery.v1"]]) {
    if (!rows[id]) continue;
    const s = rows[id].state;
    need(s.schema === schema && record(s.runs) && Number.isSafeInteger(s.calls) && s.calls >= 0,
      "RUN_JOURNAL_INVALID");
    need(Object.values(s.runs).every(r => record(r) && r.state === "STOPPED"), "MODEL_OR_OWNER_OUTCOME_UNKNOWN");
    need(!s.ownerSession?.active,"OWNER_SESSION_ACTIVE_OR_UNKNOWN");
  }
  return rows;
}
const bindings = rows => Object.fromEntries(Object.entries(rows).map(([id, row]) =>
  [id, {revision: row.revision, digest: row.digest}]));
async function capacity(reader, allocation, row, owner, baseline) {
  const startedAt = Date.now(), result = await reader.capacity(), observedAt = Date.now();
  const expiresAt = Date.parse(allocation.expiresAt), used = row.state.calls;
  const available = Math.max(0, allocation.maxCalls - used);
  const at = time => time < expiresAt ? available : 0;
  const unknownRuns = Object.values(row.state.runs).filter(r => r.state !== "STOPPED").length;
  const code = owner ? "TARGET_OWNER_READBACK_MISMATCH" : "TARGET_BUDGET_READBACK_MISMATCH";
  need(record(result) && Number.isSafeInteger(allocation.maxCalls) && allocation.maxCalls >= 1 &&
    Number.isFinite(expiresAt) && result.used === used && Number.isSafeInteger(result.remaining) &&
    result.remaining >= 0 && [at(startedAt), at(observedAt)].includes(result.remaining) &&
    (!owner && result.unknownRuns === undefined || result.unknownRuns === unknownRuns), code);
  // Expiry may reduce capacity between readbacks. It must never refill it, even
  // if the wall clock moves backwards or the candidate reports unchanged used.
  need(!baseline || result.used === baseline.used && (result.unknownRuns ?? null) === baseline.reportedUnknownRuns &&
    result.remaining <= baseline.remaining, code);
  return {used, remaining: result.remaining, unknownRuns,
    reportedUnknownRuns: result.unknownRuns ?? null, observedAt};
}
async function compatible(runtime, profile, before, baseline) {
  assertObserverRuntime(runtime);
  const service = await runtime.service.openControlService(profile);
  // Optional profile capabilities must survive selection and rollback. Presence
  // is readback only; compatibility must never execute a registered action.
  need(!profile.continuation || typeof service.continueRegistered === "function", "TARGET_CONTINUATION_UNSUPPORTED");
  need(hash(await service.host.snapshot()) === hash(before.host.state), "TARGET_HOST_READBACK_MISMATCH");
  const related=Object.entries(before.host.state.acceptances).filter(([,row])=>row.relatedControlEvidence===true)
    .map(([id])=>id).sort();
  if(related.length) {
    need(typeof service.host.relatedControlPolicy === "function", "TARGET_RELATED_CONTROL_UNSUPPORTED");
    need(hash(await service.host.relatedControlPolicy())===hash(related), "TARGET_RELATED_CONTROL_READBACK_MISMATCH");
  }
  const preparations=Object.fromEntries(Object.entries(before.host.state.acceptances)
    .filter(([,row])=>row.preparationKey).map(([id,row])=>[id,row.preparationKey]));
  if(profile.config.requirePreparation || profile.config.health?.periodicReview===false || Object.keys(preparations).length) {
    need(typeof service.host.eventControlPolicy === "function", "TARGET_EVENT_POLICY_UNSUPPORTED");
    need(hash(await service.host.eventControlPolicy())===hash({schema:"control.event-policy.v1",
      requirePreparation:profile.config.requirePreparation===true,
      periodicReview:profile.config.health ? profile.config.health.periodicReview!==false : null,preparations}),
      "TARGET_EVENT_POLICY_READBACK_MISMATCH");
  }
  for (const [id, row] of Object.entries(before.host.state.acceptances)) {
    if (!row.reviewSourceScopeRevisions?.some(r => r.phase === "BEFORE_FIRST_REVIEW")) continue;
    // A raw snapshot is insufficient: older same-schema readers can retain
    // these bytes but cannot interpret the new preinitial evidence history.
    need(typeof service.host.reviewSourceScope === "function", "TARGET_SOURCE_SCOPE_UNSUPPORTED");
    need(hash(await service.host.reviewSourceScope(id)) === hash(row.reviewSourceScopeRevisions.at(-1).scope),
      "TARGET_SOURCE_SCOPE_READBACK_MISMATCH");
  }
  const budget = await capacity(service.review, profile.review, before.review, false, baseline?.review);
  let owner;
  if (profile.ownerDelivery) {
    if(profile.ownerDelivery.waits){
      need(service.ownerDelivery?.waiting,"TARGET_OWNER_WAIT_UNSUPPORTED");
      const actual=await service.ownerDelivery.waiting.snapshot();
      const expected=before.owner.state.ownerSession??{sessionId:null,turns:[],active:null,waiting:null,done:false};
      need(hash(actual)===hash(expected),"TARGET_OWNER_WAIT_READBACK_MISMATCH");
    }
    owner = await capacity(service.ownerDelivery, profile.ownerDelivery, before.owner, true, baseline?.owner);
  }
  if (profile.notifications) {
    const module = await import(pathToFileURL(path.join(runtime.identity.root, "scripts/control-notification.mjs")).href);
    const notifications = await module.openControlNotification({...profile.notifications, owner: profile.config.owner});
    need(hash((await notifications.snapshot()).state) === hash(before.notifications.state), "TARGET_NOTIFICATION_READBACK_MISMATCH");
  }
  need(hash(await journals(profile)) === hash(before), "JOURNALS_CHANGED");
  return {review: budget, ...(owner ? {owner} : {})};
}
async function profileFor(intent) {
  need(hash(await controlDirectory(intent.root)) === hash(intent.old.controlRoot), "DIRECTORY_CHANGED");
  need(controlProfilePath(intent.root, intent.old), "INTENT_INVALID");
  const profile = await readActivationJson(intent.old.profileFile);
  need(!((await lstat(intent.old.profileFile)).mode & 0o222) && hash(profile) === intent.old.profileHash &&
    sha256(await readFile(intent.old.profileFile)) === intent.profileBytesHash, "PROFILE_CHANGED");
  return profile;
}
async function current(intent) {
  const file = path.join(intent.root, "activation.json");
  const value = await readActivationJson(file);
  need(!((await lstat(file)).mode & 0o222), "DESCRIPTOR_MUTABLE");
  const key = hash(value);
  need(key === hash(intent.old) || key === hash(intent.next), "DESCRIPTOR_CHANGED");
  return key;
}
async function restore(intent, readSchedule) {
  const profile = await profileFor(intent);
  await stoppedSchedule(intent.plans, readSchedule);
  const before = await journals(profile);
  need(hash(bindings(before)) === hash(intent.journals), "JOURNALS_CHANGED");
  const runtime = await loadControlRuntime({packageRoot: intent.old.runtime.root,
    expectedDigest: intent.old.runtime.digest, workspace: profile.config.workspace});
  await compatible(runtime, profile, before, intent.capacities);
  await profileFor(intent); await stoppedSchedule(intent.plans, readSchedule);
  need(hash(bindings(await journals(profile))) === hash(intent.journals), "JOURNALS_CHANGED");
  const key = await current(intent);
  if (key !== hash(intent.old)) await replace(path.join(intent.root, "activation.json"), key, intent.oldBytes);
  await verifyControlActivation(path.join(intent.root, "activation.json"));
  await stoppedSchedule(intent.plans, readSchedule);
  need(hash(bindings(await journals(profile))) === hash(intent.journals), "JOURNALS_CHANGED");
}
async function finish(intent, release) {
  need(hash(await readActivationJson(markerFor(intent.root))) === hash(intent), "INTENT_CHANGED");
  if (release) await release();
  await unlink(markerFor(intent.root)); await sync(intent.root);
}
const receipt = (status, intent) => ({status, from: intent.old.runtime,
  to: status === "ROLLED_BACK_PAUSED" ? intent.old.runtime : intent.next.runtime,
  ...(status === "ROLLED_BACK_PAUSED" ? {attempted: intent.next.runtime} : {}),
  sameProfile: true, paused: true, statePreserved: true, projectReadiness: "NOT_CERTIFIED",
  scheduler: "STOPPED_NOT_RESTARTED", writerExclusion: "OBSERVER_LEASE_PLUS_OPERATOR_SCHEDULER_EXCLUSION",
  noRacingSchedulerOperators: true,
  intentKey: hash(intent), automaticRetry: false});

// readSchedule is a trusted host-test/supervisor transport, never request JSON.
// All supported writers must use observer.lease; standalone raw service writers
// are NOT excluded by this API. The trusted operator must keep them stopped.
// Supported registration/removal shares that lease. The REQUIRED operator
// guarantee covers external launchctl and direct plist writers until
// switch/recovery returns; readback alone never certifies that exclusion.
export async function switchControlRuntime({descriptorFile, expectedOldDigest, packageRoot, expectedDigest,
  actor, evidence, noRacingSchedulerOperators}, {readSchedule = nativeSchedule} = {}) {
  need(process.platform === "darwin", "HOST_UNSUPPORTED");
  need(filled(actor) && filled(evidence) && isDigest(expectedOldDigest) && isDigest(expectedDigest) &&
    typeof readSchedule === "function", "APPROVAL_REQUIRED");
  need(noRacingSchedulerOperators === true, "SCHEDULER_OPERATOR_EXCLUSION_REQUIRED");
  const verified = await verifyControlActivation(descriptorFile), root = verified.descriptor.controlRoot.path;
  const release = await acquireControlLease(root);
  let intent = null;
  try {
    const {descriptor: old, profile, runtime} = await verifyControlActivation(descriptorFile);
    need(old.runtime.digest === expectedOldDigest, "OLD_RUNTIME_CHANGED");
    need(expectedDigest !== expectedOldDigest, "SAME_RUNTIME");
    const plans = await Promise.all(["SESSION", "LOGIN"].map(mode => controlSchedulePlan({descriptorFile, mode})));
    const schedulerObservation = await stoppedSchedule(plans, readSchedule);
    const before = await journals(profile), capacities = await compatible(runtime, profile, before);
    const target = await verifyControlRuntime(packageRoot, expectedDigest);
    need(old.profileFile === path.join(root, "service.json") ||
      Object.hasOwn(target.description.files, "scripts/control-profile-change.mjs"), "TARGET_PROFILE_UNSUPPORTED");
    need(!inside(root, target.root) && !inside(target.root, root), "RUNTIME_BOUNDARY");
    const next = {...old, runtime: {root: target.root, digest: target.digest}};
    const pending = {schema: "control.cutover-intent.v1", root, token: randomUUID(), pid: process.pid,
      lease: await readActivationJson(path.join(root, "observer.lease")), actor, evidence, old, next,
      oldBytes: await readFile(descriptorFile, "utf8"), profileBytesHash: sha256(await readFile(old.profileFile)),
      journals: bindings(before), capacities, plans, schedulerObservation, noRacingSchedulerOperators};
    // Existing recovery marker blocks every new observer, even after a crash.
    const bytes = canonicalJson(pending) + "\n";
    need(Buffer.byteLength(bytes) <= 1024 * 1024, "INTENT_CAPACITY");
    const temp = path.join(root, `.cutover-intent-${randomUUID()}`);
    try {
      await create(temp, bytes);
      need(!await exists(markerFor(root)), "INTENT_ALREADY_OWNED");
      // The observer lease excludes supported marker creators. Publish only a
      // complete synced file; a pre-publication crash never enters target code.
      await rename(temp, markerFor(root)); intent = pending;
    } finally {if (await exists(temp)) await unlink(temp);}
    await sync(root);
    const candidate = await loadControlRuntime({packageRoot: target.root, expectedDigest, workspace: profile.config.workspace});
    await compatible(candidate, profile, before, capacities);
    await profileFor(intent); await stoppedSchedule(plans, readSchedule);
    await profileFor(intent);
    need(hash(bindings(await journals(profile))) === hash(intent.journals), "JOURNALS_CHANGED");
    need(await current(intent) === hash(old), "DESCRIPTOR_CHANGED");
    await replace(descriptorFile, hash(old), canonicalJson(next) + "\n");
    const selected = await verifyControlActivation(descriptorFile);
    await compatible(selected.runtime, selected.profile, before, capacities);
    await stoppedSchedule(plans, readSchedule);
    await profileFor(intent);
    need(hash(bindings(await journals(profile))) === hash(intent.journals), "JOURNALS_CHANGED");
    need(await current(intent) === hash(next), "DESCRIPTOR_CHANGED");
  } catch (error) {
    if (!intent) {await release(); throw error;}
    try {await restore(intent, readSchedule);} catch (recoveryError) {
      const held = Error("CONTROL_CUTOVER_RECONCILIATION_REQUIRED", {cause: error});
      held.intentKey = hash(intent); held.recoveryError = recoveryError.message;
      // Never reset journal state, steal the lease or guess an unknown outcome.
      throw held;
    }
    await finish(intent, release);
    const rolledBack = Error("CONTROL_CUTOVER_FAILED_ROLLED_BACK", {cause: error});
    rolledBack.receipt = receipt("ROLLED_BACK_PAUSED", intent); throw rolledBack;
  }
  await finish(intent, release);
  return receipt("RUNTIME_SWITCHED_PAUSED", intent);
}
export {journals as inspectQuiescentControlJournals, stoppedSchedule as observeStoppedControlSchedule};

export async function inspectControlCutover(descriptorFile) {
  need(process.platform === "darwin", "HOST_UNSUPPORTED");
  const root = path.dirname(descriptorFile); await controlDirectory(root);
  need(descriptorFile === path.join(root, "activation.json"), "DESCRIPTOR_PATH_INVALID");
  const intent = await readActivationJson(markerFor(root));
  need(!((await lstat(markerFor(root))).mode & 0o222), "INTENT_MUTABLE");
  need(intent.schema === "control.cutover-intent.v1" && intent.root === root && filled(intent.token) &&
    intent.noRacingSchedulerOperators === true && record(intent.capacities) &&
    Number.isSafeInteger(intent.pid) && intent.pid > 0 && intent.lease?.pid === intent.pid &&
    filled(intent.lease.token) && intent.oldBytes && hash(JSON.parse(intent.oldBytes)) === hash(intent.old) &&
    hash({...intent.old, runtime: intent.next.runtime}) === hash(intent.next), "INTENT_INVALID");
  await profileFor(intent); await current(intent);
  return {status: "RECONCILIATION_REQUIRED", intentKey: hash(intent), intent, automaticRetry: false};
}
async function absentProcess(pid) {
  try {process.kill(pid, 0); return false;} catch (e) {if (e.code === "ESRCH") return true; throw e;}
}
export async function recoverControlCutover({descriptorFile, expectedIntentKey, actor, evidence, noRacingSchedulerOperators},
  {observeStop, readSchedule = nativeSchedule} = {}) {
  need(process.platform === "darwin", "HOST_UNSUPPORTED");
  need(filled(actor) && filled(evidence) && typeof observeStop === "function", "STOP_OBSERVER_REQUIRED");
  need(noRacingSchedulerOperators === true, "SCHEDULER_OPERATOR_EXCLUSION_REQUIRED");
  const {intent, intentKey} = await inspectControlCutover(descriptorFile);
  need(intentKey === expectedIntentKey, "INTENT_CHANGED");
  const stop = await observeStop({pid: intent.pid, token: intent.token, lease: intent.lease});
  need(stop?.state === "STOPPED" && stop.pid === intent.pid && stop.token === intent.token &&
    filled(stop.evidence) && await absentProcess(intent.pid), "STOP_UNPROVEN");
  // Serialize recovering operators. A crash during recovery itself retains this
  // guard for supervised operator reconciliation; no nested automatic takeover.
  const guard = path.join(intent.root, "cutover-recovery.lease");
  await create(guard, canonicalJson({pid: process.pid, token: randomUUID()}) + "\n");
  const guardIdentity = await readActivationJson(guard);
  try {
    need((await inspectControlCutover(descriptorFile)).intentKey === intentKey, "INTENT_CHANGED");
    const leaseFile = path.join(intent.root, "observer.lease"), held = await exists(leaseFile);
    if (held) need(hash(await readActivationJson(leaseFile)) === hash(intent.lease), "LEASE_CHANGED");
    await restore(intent, readSchedule);
    if (held) {
      need(hash(await readActivationJson(leaseFile)) === hash(intent.lease), "LEASE_CHANGED");
      await unlink(leaseFile); await sync(intent.root);
    }
    await finish(intent);
    return {...receipt("ROLLED_BACK_PAUSED", intent), recoveredBy: actor, recoveryEvidence: evidence};
  } finally {
    need(hash(await readActivationJson(guard)) === hash(guardIdentity), "RECOVERY_OWNER_CHANGED");
    await unlink(guard); await sync(intent.root);
  }
}
