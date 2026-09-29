// Declared module boundaries constrain the supported context route, not the host OS.
import path from "node:path";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).sort().join() === [...names].sort().join();
const text = v => typeof v === "string" && v.trim().length > 0;
const need = (v, code) => { if (!v) throw new Error(code); };
const relative = v => text(v) && !v.includes("\\") && !v.includes("\0") && !path.posix.isAbsolute(v) &&
  v.split("/").every(p => p && p !== "." && p !== "..");
const paths = (v, nonempty = true) => Array.isArray(v) && (!nonempty || v.length > 0) && v.length <= 256 && v.every(relative) && new Set(v).size === v.length;
const ref = v => keys(v, ["path", "sha256"]) && relative(v.path) && /^[a-f0-9]{64}$/.test(v.sha256);
const within = (file, root) => file === root || file.startsWith(root + "/");

export function moduleAccessPolicy(access, target, candidateFiles) {
  need(keys(access, ["schema", "modules"]) && access.schema === "context.module-access.v1" &&
    Array.isArray(access.modules) && access.modules.length > 0 && access.modules.length <= 256, "MODULE_ACCESS_INVALID");
  const modules = access.modules;
  need(modules.every(m => keys(m, ["id", "intent", "contractFiles", "privatePaths", "release"]) && text(m.id) &&
    ["consume", "change", "create"].includes(m.intent) && paths(m.contractFiles) && paths(m.privatePaths, m.intent !== "consume") &&
    (m.intent === "consume" ? keys(m.release, ["artifact", "connection"]) && ref(m.release.artifact) && ref(m.release.connection) : m.release === null)) &&
    new Set(modules.map(m => m.id)).size === modules.length, "MODULE_ACCESS_INVALID");
  need(modules.some(m => m.id === target && m.intent !== "consume"), "MODULE_TARGET_UNOWNED");
  const consumed = modules.filter(m => m.intent === "consume");
  const owned = modules.filter(m => m.intent !== "consume");
  const roots = modules.flatMap(m => m.privatePaths.map(root => ({ id: m.id, root })));
  need(!roots.some((a, i) => roots.some((b, j) => i < j && a.id !== b.id &&
    (within(a.root, b.root) || within(b.root, a.root)))), "MODULE_OWNERSHIP_OVERLAP");
  const immutable = consumed.flatMap(m => [m.release.artifact, m.release.connection]);
  need(new Set(immutable.map(r => r.path)).size === immutable.length, "MODULE_RELEASE_AMBIGUOUS");
  const contracts = [...new Set(modules.flatMap(m => m.contractFiles))];
  const privateConsumed = file => consumed.some(m => m.privatePaths.some(root => within(file, root)));
  const artifact = file => consumed.some(m => m.release.artifact.path === file);
  const assertRead = (file, purpose = "context") => {
    need(relative(file), "MODULE_PATH_INVALID");
    // An opaque release may be hashed/executed, but never quoted into navigation.
    if (purpose === "binding" && artifact(file)) return;
    need(!privateConsumed(file) && !artifact(file), "CONSUMED_MODULE_CONTEXT_FORBIDDEN");
  };
  const assertMutation = file => {
    need(relative(file), "MODULE_PATH_INVALID");
    need(!privateConsumed(file) && !immutable.some(r => r.path === file) &&
      !consumed.some(m => m.contractFiles.includes(file)), "CONSUMED_MODULE_MUTATION_FORBIDDEN");
    need(owned.some(m => m.privatePaths.some(root => within(file, root)) || m.contractFiles.includes(file)), "MODULE_FILE_UNOWNED");
  };
  contracts.forEach(file => assertRead(file));
  consumed.forEach(m => assertRead(m.release.connection.path));
  need(Array.isArray(candidateFiles) && candidateFiles.length > 0, "MODULE_FILE_UNOWNED");
  candidateFiles.forEach(assertMutation);
  return { assertRead, assertMutation, immutable, contracts };
}
