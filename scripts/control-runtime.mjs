// Protected runtime packaging only. Staging is not adoption, authority, service
// enrollment or a schema migration. Existing project files are never changed.
import {mkdir, lstat, realpath, readFile, readdir, open, rename, rm} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const need = (v, code) => {if (!v) throw Error(code);};
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const hash = value => sha256(canonicalJson(value));
const additional = [
  "control-activation", "control-observer-run", "control-recovery", "control-cutover", "control-profile-change", "control-schedule", "control-catalog", "control-child", "control-codex-profile", "control-endpoint", "control-findings", "control-health", "control-health-domain", "control-repo-observation",
  "control-host", "control-continuation", "control-loop", "control-mcp", "control-model-review", "control-cadence", "control-allowance", "control-notification", "control-migration",
  "control-owner", "control-owner-mcp", "control-owner-delivery", "control-notification-owner", "control-review-mcp", "control-review-process",
  "control-review-sources", "control-review-wire", "control-review-partitions", "control-partition-model-review", "control-runtime", "control-service",
  "control-stdio", "control-store", "control-worker-run", "controlled-context-run",
  "debt-progress", "finding-history", "increment-readiness", "local-control-sandbox",
  "post-accept", "project-recovery"
].map(name => `scripts/${name}.mjs`);
const baseFiles = ["vydykhai.json", "LICENSE.md", "NOTICE.md"];
// Verification binds the selected release's complete inventory, not today's
// additional file list. Otherwise adding a module makes intact rollback packages
// unreadable. Selected APIs still validate their schema and required capabilities.
const bootstrapFiles=[...baseFiles,"scripts/control-runtime.mjs","scripts/control-service.mjs",
  "scripts/control-host.mjs","scripts/control-worker-run.mjs"];
const allowed = name => baseFiles.includes(name) || /^scripts\/[a-z][a-z0-9-]*\.mjs$/.test(name);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
async function directoryAt(directory, privateOnly = false) {
  const info = await lstat(directory);
  need(info.isDirectory() && !info.isSymbolicLink() && await realpath(directory) === path.resolve(directory) &&
    (!privateOnly || !(info.mode & 0o077)), "CONTROL_RUNTIME_DIRECTORY_UNSAFE");
  return path.resolve(directory);
}
async function bytesAt(root, name) {
  need(allowed(name), "CONTROL_RUNTIME_PATH_INVALID");
  const file = path.join(root, name), info = await lstat(file);
  need(info.isFile() && !info.isSymbolicLink() && await realpath(file) === file && info.size <= 2 * 1024 * 1024,
    "CONTROL_RUNTIME_FILE_UNSAFE");
  const bytes = await readFile(file);
  need(bytes.length <= 2 * 1024 * 1024, "CONTROL_RUNTIME_FILE_UNSAFE");
  return bytes;
}
async function sourceSnapshot(sourceRoot) {
  const root = await directoryAt(sourceRoot);
  const manifest = JSON.parse(await bytesAt(root, "vydykhai.json"));
  need(Array.isArray(manifest.managedPaths) && /^\d+\.\d+\.\d+$/.test(manifest.version), "CONTROL_RUNTIME_SOURCE_INVALID");
  const paths = [...new Set([...baseFiles, ...additional,
    ...manifest.managedPaths.filter(p => typeof p === "string" && p.startsWith("scripts/"))])].sort();
  const files = {}, contents = new Map();
  for (const name of paths) {
    const bytes = await bytesAt(root, name); files[name] = sha256(bytes); contents.set(name, bytes);
  }
  const description = {schema: "control.runtime-package.v1", kind: "candidate-not-release",
    sourceVersion: manifest.version, supportedHost: "darwin", files};
  return {description, contents, digest: hash(description)};
}
export async function inspectControlRuntime(sourceRoot) {
  const {description, digest} = await sourceSnapshot(sourceRoot);
  return {description, digest};
}
async function save(file, bytes) {
  const fd = await open(file, "wx", 0o400);
  try {await fd.writeFile(bytes); await fd.sync();} finally {await fd.close();}
}
export async function verifyControlRuntime(packageRoot, expectedDigest) {
  need(digest(expectedDigest), "CONTROL_RUNTIME_DIGEST_REQUIRED");
  const root = await directoryAt(packageRoot, true);
  const receiptFile = path.join(root, "runtime.json"), info = await lstat(receiptFile);
  need(info.isFile() && !info.isSymbolicLink() && !(info.mode & 0o077) && info.size <= 1024 * 1024,
    "CONTROL_RUNTIME_RECEIPT_UNSAFE");
  const description = JSON.parse(await readFile(receiptFile, "utf8"));
  need(description.schema === "control.runtime-package.v1" && description.kind === "candidate-not-release" &&
    description.supportedHost === "darwin" && hash(description) === expectedDigest,
    "CONTROL_RUNTIME_DIGEST_MISMATCH");
  const names = Object.keys(description.files ?? {});
  need(names.length <= 100 && bootstrapFiles.every(name => names.includes(name)) &&
    names.every(name => allowed(name) && digest(description.files[name])), "CONTROL_RUNTIME_CONTENTS_INVALID");
  const actual = (await readdir(root)).filter(name => name !== "runtime.json" && name !== "scripts").sort();
  need(canonicalJson(actual) === canonicalJson(baseFiles.slice().sort()), "CONTROL_RUNTIME_UNDECLARED_FILES");
  const scriptNames = (await readdir(path.join(root, "scripts"))).map(name => `scripts/${name}`).sort();
  need(canonicalJson(scriptNames) === canonicalJson(names.filter(name => name.startsWith("scripts/")).sort()),
    "CONTROL_RUNTIME_UNDECLARED_FILES");
  for (const name of names) {
    need(sha256(await bytesAt(root, name)) === description.files[name], "CONTROL_RUNTIME_FILE_MISMATCH");
  }
  return {root, digest: expectedDigest, description, status: "STAGED_NOT_ACTIVATED"};
}
export async function stageControlRuntime({sourceRoot, directory, workspace, expectedDigest}) {
  const destination = await directoryAt(directory, true), project = await directoryAt(workspace);
  need(!inside(project, destination) && !inside(destination, project), "CONTROL_RUNTIME_WORKSPACE_BOUNDARY");
  need(digest(expectedDigest), "CONTROL_RUNTIME_DIGEST_REQUIRED");
  const snapshot = await sourceSnapshot(sourceRoot);
  need(snapshot.digest === expectedDigest, "CONTROL_RUNTIME_SOURCE_CHANGED");
  const target = path.join(destination, expectedDigest);
  let exists = true;
  try {await lstat(target);} catch (e) {if (e.code !== "ENOENT") throw e; exists = false;}
  if (exists) return verifyControlRuntime(target, expectedDigest);
  const staging = path.join(destination, `.staging-${randomUUID()}`);
  await mkdir(staging, {mode: 0o700});
  try {
    await mkdir(path.join(staging, "scripts"), {mode: 0o700});
    for (const [name, bytes] of snapshot.contents) await save(path.join(staging, name), bytes);
    await save(path.join(staging, "runtime.json"), canonicalJson(snapshot.description) + "\n");
    await verifyControlRuntime(staging, expectedDigest);
    // A fully populated package is published once. Never overwrite an existing
    // version or repair damaged installed bytes in place.
    try {await rename(staging, target);} catch (e) {
      if (!["EEXIST", "ENOTEMPTY"].includes(e.code)) throw e;
    }
    const fd = await open(destination, "r"); try {await fd.sync();} finally {await fd.close();}
    return await verifyControlRuntime(target, expectedDigest);
  } finally {await rm(staging, {recursive: true, force: true});}
}
export async function loadControlRuntime({packageRoot, expectedDigest, workspace}) {
  const verified = await verifyControlRuntime(packageRoot, expectedDigest), project = await directoryAt(workspace);
  need(!inside(project, verified.root) && !inside(verified.root, project), "CONTROL_RUNTIME_WORKSPACE_BOUNDARY");
  need(process.platform === "darwin", "CONTROL_RUNTIME_HOST_UNSUPPORTED");
  const load = name => import(pathToFileURL(path.join(verified.root, "scripts", name)).href);
  return {identity: verified, host: await load("control-host.mjs"), worker: await load("control-worker-run.mjs"),
    service: await load("control-service.mjs")};
}
