// Private process activation only; no scheduler enrollment or project readiness.
import {lstat, realpath, mkdir, open, readFile, link, unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {loadControlRuntime} from "./control-runtime.mjs";
import {openControlStore} from "./control-store.mjs";
import {openControlNotification} from "./control-notification.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const need = (v, code) => {if (!v) throw Error(code);};
const hash = v => sha256(canonicalJson(v));
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const separate = (a, b) => !inside(a, b) && !inside(b, a);
export async function controlDirectory(root) {
  need(typeof root === "string" && path.isAbsolute(root), "CONTROL_ACTIVATION_PATH_INVALID");
  const s = await lstat(root);
  need(s.isDirectory() && !s.isSymbolicLink() && await realpath(root) === root &&
    !(s.mode & 0o077) && s.uid === process.getuid(), "CONTROL_ACTIVATION_DIRECTORY_UNSAFE");
  return {path: root, dev: String(s.dev), ino: String(s.ino), uid: s.uid};
}
async function exists(file) {
  try {await lstat(file); return true;} catch(e) {if(e.code === "ENOENT") return false; throw e;}
}
export async function readActivationJson(file) {
  const s = await lstat(file);
  need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && !(s.mode & 0o077) &&
    s.uid === process.getuid() && s.size <= 1024 * 1024 && await realpath(file) === file,
  "CONTROL_ACTIVATION_FILE_UNSAFE");
  const bytes = await readFile(file);
  need(bytes.length <= 1024 * 1024, "CONTROL_ACTIVATION_FILE_UNSAFE");
  return JSON.parse(bytes);
}
async function immutable(file, value) {
  if (await exists(file)) {
    need(hash(await readActivationJson(file)) === hash(value), "CONTROL_ACTIVATION_CONFLICT"); return;
  }
  const temp = path.join(path.dirname(file), `.activation-${randomUUID()}`);
  const fd = await open(temp, "wx", 0o400);
  try {await fd.writeFile(canonicalJson(value) + "\n"); await fd.sync();} finally {await fd.close();}
  try {await link(temp, file);} finally {await unlink(temp);}
  const dir = await open(path.dirname(file), "r");
  try {await dir.sync();} finally {await dir.close();}
}
export async function acquireControlLease(root) {
  await controlDirectory(root);
  need(!await exists(path.join(root, "observer-recovery.lease")), "CONTROL_OBSERVER_RECOVERY_IN_PROGRESS");
  const file = path.join(root, "observer.lease"), token = randomUUID();
  let fd;
  try {fd = await open(file, "wx", 0o600);} catch(e) {
    if(e.code === "EEXIST") throw Error("CONTROL_OBSERVER_LEASE_HELD_RECONCILIATION_REQUIRED"); throw e;
  }
  // Even an interrupted lease write remains exclusive. Never steal by pid or age.
  try {await fd.writeFile(canonicalJson({token, pid: process.pid}) + "\n"); await fd.sync();}
  finally {await fd.close();}
  const dir = await open(root, "r"); try {await dir.sync();} finally {await dir.close();}
  // Recovery creates its marker before inspecting ownership. A racing new
  // observer must not enter service state until that marker has gone away.
  if(await exists(path.join(root, "observer-recovery.lease"))) {
    await unlink(file);
    throw Error("CONTROL_OBSERVER_RECOVERY_IN_PROGRESS");
  }
  return async () => {
    need((await readActivationJson(file)).token === token, "CONTROL_OBSERVER_LEASE_CHANGED");
    await unlink(file);
    const dir = await open(root, "r"); try {await dir.sync();} finally {await dir.close();}
  };
}
async function validatePaths(root, profile, create = false, allowMissing = false) {
  need(profile?.schema === "control.service.v1" && profile.config?.health &&
    typeof profile.review?.sourceFile === "string" &&
    profile.config.evidenceRegistry === profile.review.sourceFile && profile.review.controlRoot === root &&
    profile.review.native,
  "CONTROL_ACTIVATION_PROFILE_INVALID");
  const workspace = profile.config.workspace;
  need(typeof workspace === "string" && path.isAbsolute(workspace) && await realpath(workspace) === workspace &&
    (await lstat(workspace)).isDirectory() && separate(root, workspace), "CONTROL_ACTIVATION_WORKSPACE_BOUNDARY");
  const dirs = [profile.directory, profile.review.directory];
  if(profile.notifications) {
    need(profile.notifications.directory === path.join(root,"notifications") &&
      profile.notifications.transportActor === "control-owner-transport","CONTROL_ACTIVATION_NOTIFICATION_INVALID");
    dirs.push(profile.notifications.directory);
  }
  if(profile.ownerDelivery) {
    need(profile.notifications && profile.ownerDelivery.directory===path.join(root,"owner-delivery") &&
      profile.ownerDelivery.native?.workspace===path.join(root,"owner-room") &&
      profile.ownerDelivery.native?.home===path.join(root,"owner-home") &&
      (profile.ownerDelivery.native.authHome??profile.ownerDelivery.native.home)===
        (profile.review.native.authHome??profile.ownerDelivery.native.home),"CONTROL_ACTIVATION_OWNER_DELIVERY_INVALID");
    dirs.push(profile.ownerDelivery.directory,profile.ownerDelivery.native.workspace,profile.ownerDelivery.native.home);
  }
  need(dirs.every(d => typeof d === "string" && inside(root, d) && d !== root) &&
    dirs.every((d,i)=>dirs.slice(i+1).every(other=>separate(d,other))),
    "CONTROL_ACTIVATION_JOURNAL_BOUNDARY");
  const room = profile.review.native.workspace, home = profile.review.native.home;
  need([room, home].every(d => typeof d === "string" && inside(root, d) && d !== root) &&
    [...dirs, room, home].every((d, i, all) => all.slice(i + 1).every(other => separate(d, other))),
    "CONTROL_ACTIVATION_REVIEW_ROOM_BOUNDARY");
  for (const dir of [...dirs, room, home]) {
    need(typeof dir === "string" && inside(root, dir) && dir !== root && path.resolve(dir) === dir,
      "CONTROL_ACTIVATION_PRIVATE_PATH_REQUIRED");
    const parts = path.relative(root, dir).split(path.sep);
    let parent = root;
    for (const part of parts) {
      parent = path.join(parent, part);
      if(create && !await exists(parent)) await mkdir(parent, {mode: 0o700});
      if(allowMissing && !await exists(parent)) continue;
      await controlDirectory(parent);
    }
  }
  // External auth is an explicit operator reference, never provisioned or copied.
  const authHome = profile.review.native.authHome ?? home;
  if(profile.allowance)need(profile.allowance.authHome===authHome &&
    profile.allowance.binary===profile.review.native.binary,"CONTROL_ACTIVATION_ALLOWANCE_IDENTITY_INVALID");
  need(typeof authHome === "string" && separate(workspace, authHome) &&
    [room, ...dirs].every(d => separate(d, authHome)), "CONTROL_ACTIVATION_AUTH_BOUNDARY");
  if(inside(root,authHome)) {
    if(!allowMissing || await exists(authHome)) await controlDirectory(authHome);
  }
  else {
    const a=await lstat(authHome);
    need(path.isAbsolute(authHome)&&a.isDirectory()&&!a.isSymbolicLink()&&await realpath(authHome)===authHome&&
      a.uid===process.getuid()&&!(a.mode&0o022),"CONTROL_ACTIVATION_AUTH_DIRECTORY_UNSAFE");
    // Standard Codex homes may be traversable; credential bytes must remain
    // private. Check metadata only, never read or copy operator credentials.
    const authFile=path.join(authHome,"auth.json");
    if(await exists(authFile)) {
      const f=await lstat(authFile);
      need(f.isFile()&&!f.isSymbolicLink()&&f.nlink===1&&f.uid===process.getuid()&&!(f.mode&0o077),
        "CONTROL_ACTIVATION_AUTH_FILE_UNSAFE");
    }
  }
  need(inside(root, profile.review.sourceFile) && ![...dirs, room, home].some(d => inside(d, profile.review.sourceFile)),
    "CONTROL_ACTIVATION_REGISTRY_BOUNDARY");
  await controlDirectory(path.dirname(profile.review.sourceFile));
  const registry = await readActivationJson(profile.review.sourceFile);
  need(registry.workspace === workspace, "CONTROL_ACTIVATION_REGISTRY_WORKSPACE_MISMATCH");
}
export {validatePaths as validateControlProfilePaths};
export function controlProfilePath(root, descriptor) {
  const digest = /^[a-f0-9]{64}$/.test(descriptor.profileHash ?? "");
  return digest && (descriptor.profileFile === path.join(root, "service.json") ||
    descriptor.profileFile === path.join(root, `service-${descriptor.profileHash}.json`));
}
export function assertObserverRuntime(runtime) {
  need(["control-activation","control-observer-run","control-schedule","control-recovery"].every(name=>
    Object.hasOwn(runtime?.identity?.description?.files??{},`scripts/${name}.mjs`)),
  "CONTROL_ACTIVATION_OBSERVER_RUNTIME_INCOMPLETE");
}
export async function verifyControlActivation(descriptorFile) {
  need(process.platform === "darwin", "CONTROL_ACTIVATION_HOST_UNSUPPORTED");
  const root = path.dirname(descriptorFile), identity = await controlDirectory(root);
  need(descriptorFile === path.join(root, "activation.json"), "CONTROL_ACTIVATION_DESCRIPTOR_PATH_INVALID");
  const descriptor = await readActivationJson(descriptorFile);
  need(!((await lstat(descriptorFile)).mode & 0o222), "CONTROL_ACTIVATION_DESCRIPTOR_MUTABLE");
  need(descriptor.schema === "control.activation.v1" && descriptor.status === "PRIVATE_ACTIVATED_NOT_PROJECT_READY" &&
    hash(descriptor.controlRoot) === hash(identity) && controlProfilePath(root, descriptor),
  "CONTROL_ACTIVATION_DESCRIPTOR_INVALID");
  const profile = await readActivationJson(descriptor.profileFile);
  need(hash(profile) === descriptor.profileHash, "CONTROL_ACTIVATION_PROFILE_CHANGED");
  need(!((await lstat(descriptor.profileFile)).mode & 0o222), "CONTROL_ACTIVATION_PROFILE_MUTABLE");
  await validatePaths(root, profile);
  need(separate(root, descriptor.runtime.root), "CONTROL_ACTIVATION_RUNTIME_BOUNDARY");
  const runtime = await loadControlRuntime({packageRoot: descriptor.runtime.root,
    expectedDigest: descriptor.runtime.digest, workspace: profile.config.workspace});
  assertObserverRuntime(runtime);
  need(descriptor.profileFile === path.join(root, "service.json") ||
    Object.hasOwn(runtime.identity.description.files, "scripts/control-profile-change.mjs"),
  "CONTROL_ACTIVATION_PROFILE_RUNTIME_UNSUPPORTED");
  return {descriptor, profile, runtime};
}
export async function activateControl({sourceRoot, root, expectedDigest, profile}) {
  need(process.platform === "darwin", "CONTROL_ACTIVATION_HOST_UNSUPPORTED");
  profile = JSON.parse(canonicalJson(profile));
  need(Buffer.byteLength(canonicalJson(profile)) <= 1024 * 1024, "CONTROL_ACTIVATION_PROFILE_CAPACITY");
  const identity = await controlDirectory(root);
  need(typeof sourceRoot === "string" && separate(root, sourceRoot), "CONTROL_ACTIVATION_RUNTIME_BOUNDARY");
  // sourceRoot is an externally staged package, not the source checkout.
  const runtime = await loadControlRuntime({packageRoot: sourceRoot, expectedDigest, workspace: profile.config?.workspace});
  assertObserverRuntime(runtime);
  const descriptorFile = path.join(root, "activation.json");
  const descriptor = {schema: "control.activation.v1", status: "PRIVATE_ACTIVATED_NOT_PROJECT_READY",
    controlRoot: identity, runtime: {root: runtime.identity.root, digest: runtime.identity.digest},
    profileFile: path.join(root, "service.json"), profileHash: hash(profile)};
  const release = await acquireControlLease(root);
  try {
    const installed = await exists(descriptorFile);
    if(installed) {
      need(hash(await readActivationJson(descriptorFile)) === hash(descriptor), "CONTROL_ACTIVATION_CONFLICT");
      await verifyControlActivation(descriptorFile);
    }
    await validatePaths(root, profile, !installed);
    await immutable(descriptor.profileFile, profile);
    const service = await runtime.service.openControlService(profile);
    const journals = [[profile.review.directory, service.review.initialize, service.review.capacity],
      [profile.directory, service.host.initialize, service.host.snapshot]];
    const missing = [];
    for(const [dir, initialize, readback] of journals) {
      if(await (await openControlStore(dir)).read()) await readback();
      else {need(!installed, "CONTROL_ACTIVATION_JOURNAL_MISSING"); missing.push(initialize);}
    }
    for(const initialize of missing) await initialize();
    if(profile.notifications) {
      const notifications=await openControlNotification({...profile.notifications,owner:profile.config.owner});
      if(installed)await notifications.snapshot(); else await notifications.initialize();
    }
    if(service.ownerDelivery) {
      const saved=await (await openControlStore(profile.ownerDelivery.directory)).read();
      if(!saved){need(!installed,"CONTROL_ACTIVATION_OWNER_JOURNAL_MISSING");await service.ownerDelivery.initialize();}
      await service.ownerDelivery.capacity();
    }
    await service.review.capacity(); await service.host.snapshot();
    await immutable(descriptorFile, descriptor);
    return Object.freeze({...descriptor, controlRoot: Object.freeze(identity), runtime: Object.freeze(descriptor.runtime), descriptorFile});
  } finally {await release();}
}
